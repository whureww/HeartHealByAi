// 心理知识库：管理员维护的公共心理知识文档，向量化后供 AI 对话与出题检索引用
// 与用户记忆（user_memories）的区别：知识库是平台公共内容（人人可检索），
// 记忆是用户个人数据（仅本人可见）。两者互不影响，均以 MySQL LONGTEXT 存向量 JSON。
import { pool } from '../db/mysql';
import { embedTexts, embedText, cosineSimilarity, packVector, unpackVector, isRagEnabled } from './embedding';

let schemaReady: Promise<void> | null = null;

export function ensureKnowledgeSchema(): Promise<void> {
    if (!schemaReady) {
        schemaReady = (async () => {
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS knowledge_articles (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    article_id INT UNSIGNED NOT NULL COMMENT '文档标识（一篇文档切分为多个内容块，同篇共享）',
                    title VARCHAR(120) NOT NULL COMMENT '文档标题',
                    category VARCHAR(40) NOT NULL DEFAULT 'general' COMMENT '分类',
                    chunk_index INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '内容块序号',
                    chunk_text TEXT NOT NULL COMMENT '内容块文本',
                    embedding LONGTEXT NULL COMMENT '向量 JSON 数组',
                    enabled TINYINT NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_knowledge_article (article_id),
                    KEY idx_knowledge_enabled (enabled)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS knowledge_meta (
                    meta_key VARCHAR(40) PRIMARY KEY,
                    meta_value VARCHAR(200) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        })().catch((e) => {
            schemaReady = null;
            throw e;
        });
    }
    return schemaReady;
}

// ========== 文档切分 ==========

/** 单块目标长度：过短召回噪声大，过长稀释相关性 */
const CHUNK_TARGET = 400;
const CHUNK_MAX = 500;

/** 按段落聚合切分为内容块：空行分段优先，单段超长按句边界再切 */
export function splitArticle(text: string): string[] {
    const src = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!src) return [];
    const paragraphs = src.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    const pieces: string[] = [];
    for (const para of paragraphs) {
        if (para.length <= CHUNK_MAX) {
            pieces.push(para);
            continue;
        }
        // 超长段落按句切（中英文句末标点），再聚合
        const sentences = para.match(/[^。！？.!?]+[。！？.!?]?/g) || [para];
        let buf = '';
        for (const s of sentences) {
            if (buf && (buf + s).length > CHUNK_TARGET) {
                pieces.push(buf.trim());
                buf = s;
            } else {
                buf += s;
            }
        }
        if (buf.trim()) pieces.push(buf.trim());
    }

    // 相邻碎块聚合到目标长度
    const chunks: string[] = [];
    let acc = '';
    for (const p of pieces) {
        if (acc && (acc + '\n' + p).length > CHUNK_TARGET) {
            chunks.push(acc);
            acc = p;
        } else {
            acc = acc ? acc + '\n' + p : p;
        }
    }
    if (acc.trim()) chunks.push(acc);
    return chunks.filter((c) => c.length >= 10);
}

// ========== 增删查 ==========

/** 新增文档：切分 + 批量向量化入库，返回内容块数（向量服务不可用时仍入库，embedding 留空待补） */
export async function addKnowledgeArticle(title: string, category: string, content: string): Promise<number> {
    await ensureKnowledgeSchema();
    const chunks = splitArticle(content);
    if (chunks.length === 0) throw new Error('文档内容切分后为空');
    const [maxRows] = await pool.execute('SELECT COALESCE(MAX(article_id), 0) AS m FROM knowledge_articles');
    const articleId = Number((maxRows as any[])[0].m) + 1;

    let vecs: number[][] | null = null;
    if (isRagEnabled()) {
        vecs = await embedTexts(chunks).catch(() => null);
    }
    for (let i = 0; i < chunks.length; i++) {
        await pool.execute(
            'INSERT INTO knowledge_articles (article_id, title, category, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?, ?, ?)',
            [articleId, title.slice(0, 120), category.slice(0, 40), i, chunks[i], vecs?.[i] ? packVector(vecs[i]) : null]
        );
    }
    return chunks.length;
}

/** 删除整篇文档（按文档标识） */
export async function deleteKnowledgeArticle(articleId: number): Promise<void> {
    await ensureKnowledgeSchema();
    await pool.execute('DELETE FROM knowledge_articles WHERE article_id = ?', [articleId]);
}

/** 文档列表（按文档分组） */
export async function listKnowledgeArticles(): Promise<any[]> {
    await ensureKnowledgeSchema();
    const [rows] = await pool.execute(
        `SELECT article_id, MAX(title) AS title, MAX(category) AS category,
                COUNT(*) AS chunks, SUM(CHAR_LENGTH(chunk_text)) AS chars, MAX(created_at) AS created_at
         FROM knowledge_articles GROUP BY article_id ORDER BY article_id DESC`
    );
    return rows as any[];
}

// ========== 检索 ==========

const K_MIN_SIMILARITY = 0.4;

/** 以查询文本检索知识库，返回最相关的知识片段（标题 + 内容块）。失败返回空数组（fail-open）。 */
export async function retrieveKnowledge(query: string, topK = 3): Promise<{ title: string; text: string }[]> {
    try {
        const q = String(query || '').trim();
        if (!isRagEnabled() || q.length < 2) return [];
        await ensureKnowledgeSchema();
        const qvec = await embedText(q);
        if (!qvec) return [];
        const [rows] = await pool.execute(
            'SELECT title, chunk_text, embedding FROM knowledge_articles WHERE enabled = 1 AND embedding IS NOT NULL'
        );
        return (rows as any[])
            .map((r) => ({ title: r.title as string, text: r.chunk_text as string, sim: cosineSimilarity(qvec, unpackVector(r.embedding) || []) }))
            .filter((r) => r.sim >= K_MIN_SIMILARITY)
            .sort((a, b) => b.sim - a.sim)
            .slice(0, topK)
            .map((r) => ({ title: r.title, text: r.text }));
    } catch (e: any) {
        console.error('[knowledge] 知识库检索失败（不影响主链路）:', e.message);
        return [];
    }
}

// ========== 内置种子文档（首次初始化时播种，管理员可删可补） ==========

const K_SEED_VERSION = '1';
const SEED_ARTICLES: Array<{ title: string; category: string; content: string }> = [
    {
        title: '情绪调节的实用方法',
        category: 'emotion',
        content: '情绪调节是心理健康的核心能力之一。当强烈情绪来袭时，可以先尝试「命名情绪」：把当下的感受用词语说出来（如"我现在感到委屈"），研究表明这一简单动作本身就能降低情绪强度。\n\n「STOP 技术」四步法：停下来（Stop）、深呼吸（Take a breath）、观察身体与想法（Observe）、带着觉察继续行动（Proceed）。它适合在情绪即将失控时快速使用。\n\n书写表达也是有效的情绪出口：每天用几分钟把烦心事写下来，能让情绪从"在心里打转"变成"被看见、被整理"。坚持一至两周，多数人会感到情绪波动变得平缓。\n\n需要注意：情绪没有好坏之分，压抑和否认反而会放大情绪。允许自己难过、愤怒，再选择合适的方式表达，是更健康的路径。'
    },
    {
        title: '正念呼吸与放松练习',
        category: 'emotion',
        content: '正念呼吸是最容易上手的放松练习：找一个安静的地方坐下，闭上眼睛，把注意力放在呼吸上，感受气流进出鼻腔的感觉。走神是正常的，发现走神后温和地把注意力带回呼吸即可，每次练习五到十分钟。\n\n「4-7-8 呼吸法」有助于快速平静：吸气 4 秒，屏息 7 秒，缓慢呼气 8 秒，重复 4 轮。呼气延长能激活副交感神经，让心跳放缓、身体放松。\n\n渐进式肌肉放松适合睡前进行：从脚趾到额头，逐组肌肉先紧绷 5 秒再彻底放松 10 秒，感受紧张与松弛的对比，帮助身体释放累积的压力。\n\n正念练习贵在规律而非时长，每天固定时间练习几分钟，比偶尔一次长时间练习更有效。'
    },
    {
        title: '改善睡眠的卫生习惯',
        category: 'sleep',
        content: '睡眠卫生是一组帮助改善睡眠的日常习惯。规律作息是第一条：每天同一时间上床和起床，包括周末，帮助身体建立稳定的生物钟。\n\n卧室只留给睡眠：睡前一小时远离手机、电脑等发光屏幕，蓝光会抑制褪黑素分泌；把床只用于睡觉，不在床上工作、刷视频，让大脑建立"上床=睡觉"的条件反射。\n\n下午三点后避免咖啡、浓茶等含咖啡因饮品；晚餐不宜过饱；睡前可以用温水泡脚、听轻音乐或做舒缓的拉伸帮助入睡。\n\n躺下 20 分钟仍睡不着时，不要在床上翻来覆去硬撑，起身到昏暗的环境里做点单调安静的事，有困意再回床。若失眠持续超过一个月并影响白天状态，建议寻求专业帮助。'
    },
    {
        title: '识别心理危机信号与求助途径',
        category: 'crisis',
        content: '了解危机信号有助于及早发现自己或身边人需要帮助：持续两周以上的情绪低落、兴趣丧失；睡眠食欲的显著改变；强烈的无望感、无价值感；社交明显退缩；提到"活着没意思"甚至有自伤想法。出现这些信号时请认真对待。\n\n自我照顾的底线：保持基本的吃饭、睡觉和与信任的人的联系。危机时刻，陪伴与倾诉本身就是保护因素。\n\n求助是勇敢而非软弱的表现。可求助的渠道包括：学校心理咨询中心、正规医院的心理科或精神科、拨打全国心理援助热线 12356（或北京心理危机研究与干预中心热线 010-82951332）。\n\n如果身边人出现危机信号：认真倾听、不评判、不轻易说"想开点"；直接询问对方是否有伤害自己的念头不会"提醒"对方，反而能打开求助的通道；陪伴对方联系专业帮助。紧急情况下请立即陪同就医或拨打急救电话。'
    },
    {
        title: '应对压力与预防倦怠',
        category: 'stress',
        content: '压力并非全然有害，适度的压力能提升表现；真正伤害身心的是长期得不到缓冲的慢性压力。识别压力信号是第一步：易怒、注意力下降、肌肉紧张、频繁头痛或肠胃不适，都可能是身体在提醒你负荷过重。\n\n任务管理上，把大目标拆成可完成的小步骤，用「写下-排序-逐个完成」代替在脑中反复盘旋；每天留出哪怕 20 分钟完全属于自己的时间，做与工作和学习无关的事。\n\n运动是被反复验证的减压方式：每周 3 次、每次 30 分钟的有氧运动（快走、慢跑、游泳）能显著降低压力激素水平。\n\n预防倦怠要留意三个信号：情绪耗竭（感到被掏空）、去人格化（对人冷漠敷衍）、成就感下降。当它们同时出现并持续数周，建议调整负荷并考虑寻求心理咨询的支持。'
    },
    {
        title: '人际沟通中的边界与表达',
        category: 'relationship',
        content: '健康的人际关系需要清晰的边界。边界不是冷漠，而是让对方知道你的底线与需要，这反而能让关系更长久。感到被冒犯却不说，委屈会累积成怨恨；温和而清晰地表达，是维护关系的必要技能。\n\n「我信息」表达法可以降低对抗性：把「你总是打断我」换成「当我说话被打断时，我会感到不被尊重」。描述事实 + 表达感受 + 提出期望，比指责更容易被听进去。\n\n学会拒绝同样重要：拒绝不合理的请求时，可以肯定关系、说明难处、给出替代方案，例如「我很想帮你，但这周我实在排不开，下周可以吗」。不必为拒绝过度愧疚。\n\n在亲密关系中，冲突不可避免，关键是修复：争吵后主动复盘「刚才我们都在气头上，我想重新谈谈」，比冷战等待更能修复信任。'
    }
];

/** 种子播种：meta 表记录版本，版本升级或首次初始化时整体播种（表内已有种子文档则跳过） */
export async function ensureKnowledgeSeeds(): Promise<void> {
    try {
        await ensureKnowledgeSchema();
        const [rows] = await pool.execute('SELECT meta_value FROM knowledge_meta WHERE meta_key = ?', ['knowledge_seed_version']);
        if ((rows as any[]).length > 0) return;
        for (const a of SEED_ARTICLES) {
            await addKnowledgeArticle(a.title, a.category, a.content);
        }
        await pool.execute('INSERT INTO knowledge_meta (meta_key, meta_value) VALUES (?, ?)', ['knowledge_seed_version', K_SEED_VERSION]);
        console.log(`[knowledge] 知识库种子已播种：${SEED_ARTICLES.length} 篇内置文档`);
    } catch (e: any) {
        console.error('[knowledge] 知识库种子播种失败:', e.message);
    }
}
