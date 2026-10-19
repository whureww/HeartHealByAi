// RAG 记忆与检索服务 —— 「能检索、能记忆」的核心实现
// 组成：
// 1. 记忆抽取：每轮对话结束后用 LLM 从「用户消息 + AI 回复」中抽取 0~3 条持久事实
//    （偏好/重要生活事件/情绪模式/长期困扰），向量化后落库 user_memories，带相似度去重
// 2. 上下文检索：对话前以最新一条用户消息为查询，同时检索
//    a) 记忆库（user_memories） b) 历史聊天原文（chat_records.embedding）
//    取 top-k 拼进系统提示词，让 AI「记得」跨会话的长期信息
// 3. 历史嵌入：消息落库时异步向量化；老数据首次检索时触发一次性后台补嵌（限 200 条）
// 稳定性约束：任何 RAG 环节失败都只打日志、返回空结果，绝不阻塞对话主链路（fail-open）
import { pool } from '../db/mysql';
import { callAIJson } from './aiClient';
import { embedTexts, embedText, cosineSimilarity, packVector, unpackVector, isRagEnabled } from './embedding';

// ========== 表结构懒迁移（沿用 ensureDoctorEnColumns 的 information_schema 模式） ==========
let ragColsReady: Promise<void> | null = null;

export function ensureRagSchema(): Promise<void> {
    if (!ragColsReady) {
        ragColsReady = (async () => {
            // user_memories 建表
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS user_memories (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id INT UNSIGNED NOT NULL,
                    content VARCHAR(500) NOT NULL COMMENT '记忆内容（第三人称事实陈述）',
                    embedding LONGTEXT NULL COMMENT '向量 JSON 数组',
                    source_session_id VARCHAR(40) DEFAULT NULL COMMENT '来源会话',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_memory_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            // chat_records 补嵌入列（存量部署的表是旧 schema，需懒迁移）
            const [cols] = await pool.query(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_records'
                   AND COLUMN_NAME = 'embedding'`
            );
            if (!((cols as any[]).length)) {
                await pool.execute(
                    "ALTER TABLE chat_records ADD COLUMN embedding LONGTEXT NULL COMMENT '向量 JSON 数组'"
                );
            }
        })().catch((e) => {
            ragColsReady = null;
            throw e;
        });
    }
    return ragColsReady;
}

// ========== 记忆抽取 ==========

// 抽取提示词：只抽持久事实，忽略一次性闲聊；输出 JSON
const EXTRACT_SYSTEM = '你是记忆管理助手。从心理咨询对话中提取关于「用户」的持久性事实，用于长期记忆。只提取满足以下条件的项：1.用户稳定的个人情况（身份、家庭、工作、重大生活事件）2.用户的情绪模式或长期困扰 3.用户明确的偏好、诉求或目标 4.用户提到的重要他人关系。不要提取：一次性闲聊、AI 的回复内容、临时情绪波动、敏感的健康隐私细节（如具体病症名）。每条用第三人称简短陈述（如「用户近期面临考研压力」「用户喜欢在晚上散步放松」），每条不超过60字，最多3条，没有可提取内容时返回空数组。';

/** 抽取结果的最短长度：过短的碎片没有记忆价值 */
const MIN_MEMORY_LEN = 6;
/** 与既有记忆相似度达到该阈值视为重复，跳过入库 */
const DEDUP_THRESHOLD = 0.86;

/** 防止同一用户并发重复抽取（同一轮只抽一次即可） */
const extractingUsers = new Set<number>();

/**
 * 一轮对话结束后抽取记忆（fire-and-forget 调用，内部吞掉所有错误）。
 * @param userMsg 用户消息  @param aiReply AI 回复全文
 */
export async function extractAndStoreMemories(
    userId: number,
    sessionId: string,
    userMsg: string,
    aiReply: string
): Promise<void> {
    try {
        if (!isRagEnabled()) return;
        const uMsg = String(userMsg || '').trim();
        const aMsg = String(aiReply || '').trim();
        if (uMsg.length < 4) return;   // 过短消息（如「嗯」）无抽取价值
        if (extractingUsers.has(userId)) return;
        extractingUsers.add(userId);
        try {
            await ensureRagSchema();
            const result = await callAIJson(
                EXTRACT_SYSTEM,
                `用户消息：${uMsg.slice(0, 1500)}\nAI回复：${aMsg.slice(0, 1500)}`,
                { temperature: 0.2, maxTokens: 500, timeout: 30000, retries: 2, label: 'memory-extract' }
            );
            const items = Array.isArray(result?.memories) ? result.memories : [];
            const facts = items
                .map((s: any) => String(s || '').trim())
                .filter((s: string) => s.length >= MIN_MEMORY_LEN && s.length <= 200)
                .slice(0, 3);
            if (facts.length === 0) return;

            // 一次批量向量化新事实 + 加载既有记忆做相似度去重
            const [newVecs, existing] = await Promise.all([
                embedTexts(facts),
                loadUserMemoryVectors(userId)
            ]);
            if (!newVecs) return;
            for (let i = 0; i < facts.length; i++) {
                const vec = newVecs[i];
                if (!vec) continue;
                const dup = existing.some((m) => cosineSimilarity(vec, m.vec) >= DEDUP_THRESHOLD);
                if (dup) continue;
                await pool.execute(
                    'INSERT INTO user_memories (user_id, content, embedding, source_session_id) VALUES (?, ?, ?, ?)',
                    [userId, facts[i], packVector(vec), sessionId]
                );
                existing.push({ vec, content: facts[i] });   // 同批内也去重
            }
        } finally {
            extractingUsers.delete(userId);
        }
    } catch (e: any) {
        console.error('[memory] 记忆抽取失败（不影响对话）:', e.message);
    }
}

async function loadUserMemoryVectors(userId: number): Promise<{ vec: number[]; content: string }[]> {
    const [rows] = await pool.execute(
        'SELECT content, embedding FROM user_memories WHERE user_id = ? AND embedding IS NOT NULL LIMIT 500',
        [userId]
    );
    const out: { vec: number[]; content: string }[] = [];
    for (const r of rows as any[]) {
        const vec = unpackVector(r.embedding);
        if (vec) out.push({ vec, content: r.content });
    }
    return out;
}

// ========== 检索 ==========

const QUERY_HISTORY_WINDOW_DAYS = 180;   // 历史原文检索只看近半年
const MIN_SIMILARITY = 0.35;             // 低于该相似度的结果无召回价值

/**
 * 以查询文本检索该用户的 RAG 上下文：记忆库 top-k + 历史聊天原文 top-k。
 * 任何失败返回空对象（fail-open）。
 */
export async function retrieveRagContext(
    userId: number,
    query: string,
    topK = 4
): Promise<{ memories: string[]; history: { type: string; content: string; created_at: string }[] }> {
    const empty = { memories: [] as string[], history: [] as { type: string; content: string; created_at: string }[] };
    try {
        const q = String(query || '').trim();
        if (!isRagEnabled() || q.length < 2) return empty;
        await ensureRagSchema();
        const qvec = await embedText(q);
        if (!qvec) return empty;

        const [memRows, histRows] = await Promise.all([
            pool.execute(
                'SELECT content, embedding FROM user_memories WHERE user_id = ? AND embedding IS NOT NULL LIMIT 500',
                [userId]
            ),
            pool.execute(
                `SELECT type, content, embedding, created_at FROM chat_records
                 WHERE user_id = ? AND embedding IS NOT NULL AND content IS NOT NULL
                   AND created_at > (NOW() - INTERVAL ${QUERY_HISTORY_WINDOW_DAYS} DAY)
                 ORDER BY id DESC LIMIT 1500`,
                [userId]
            )
        ]);

        const memories = (memRows[0] as any[])
            .map((r) => ({ content: r.content as string, sim: cosineSimilarity(qvec, unpackVector(r.embedding) || []) }))
            .filter((r) => r.sim >= MIN_SIMILARITY)
            .sort((a, b) => b.sim - a.sim)
            .slice(0, topK)
            .map((r) => r.content);

        const history = (histRows[0] as any[])
            .map((r) => ({
                type: r.type as string,
                content: String(r.content || '').slice(0, 160),
                created_at: r.created_at,
                sim: cosineSimilarity(qvec, unpackVector(r.embedding) || [])
            }))
            .filter((r) => r.sim >= MIN_SIMILARITY)
            .sort((a, b) => b.sim - a.sim)
            .slice(0, topK)
            .map((r) => ({ type: r.type, content: r.content, created_at: r.created_at }));

        return { memories, history };
    } catch (e: any) {
        console.error('[memory] RAG 检索失败（不影响对话）:', e.message);
        return empty;
    }
}

// ========== 历史消息嵌入 ==========

/** 消息落库后异步向量化（fire-and-forget，失败静默——下次检索时还有补嵌兜底） */
export async function embedChatMessage(recordId: number, content: string): Promise<void> {
    try {
        if (!isRagEnabled()) return;
        const text = String(content || '').trim();
        if (text.length < 2) return;
        await ensureRagSchema();
        const vec = await embedText(text);
        if (!vec) return;
        await pool.execute('UPDATE chat_records SET embedding = ? WHERE id = ?', [packVector(vec), recordId]);
    } catch (e: any) {
        console.error('[memory] 消息嵌入失败（不影响落库）:', e.message);
    }
}

// 一次性后台补嵌进行中的用户集合（防重复触发）
const backfilling = new Set<number>();

/**
 * 老数据补嵌：该用户存在大量未嵌入的历史消息时，后台补嵌最近 200 条。
 * 首次检索前触发一次，之后进程内不再重复。
 */
export async function backfillChatEmbeddings(userId: number): Promise<void> {
    try {
        if (!isRagEnabled() || backfilling.has(userId)) return;
        await ensureRagSchema();
        const [rows] = await pool.execute(
            'SELECT id, content FROM chat_records WHERE user_id = ? AND embedding IS NULL AND CHAR_LENGTH(content) >= 2 ORDER BY id DESC LIMIT 200',
            [userId]
        );
        const items = rows as any[];
        if (items.length === 0) return;
        backfilling.add(userId);
        try {
            // 分批嵌入（每批 32 条），逐批落库
            for (let i = 0; i < items.length; i += 32) {
                const batch = items.slice(i, i + 32);
                const vecs = await embedTexts(batch.map((r) => String(r.content || '')));
                if (!vecs) return;
                for (let j = 0; j < batch.length; j++) {
                    if (vecs[j]) {
                        await pool.execute('UPDATE chat_records SET embedding = ? WHERE id = ?', [packVector(vecs[j]), batch[j].id]);
                    }
                }
            }
        } finally {
            backfilling.delete(userId);
        }
    } catch (e: any) {
        console.error('[memory] 历史消息补嵌失败:', e.message);
    }
}
