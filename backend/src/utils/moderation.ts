// 聊天内容审核：拦截不文明 / 违规内容
// 策略：NFKC 归一化 + 字形替换还原 + 剔除全部非文字字符（防分隔/夹杂符号/emoji 绕过），
//      主词库直接匹配 + 短词库边界匹配（防止英文单词内部误伤，如 husband 含 sb）
// 词库来源：数据库 sensitive_words 表（管理员后台可增删，实时生效），
//           表为空时自动播种内置默认词库；DB 异常时回退内置默认词库

import { pool } from '../db/mysql';

// ===== 内置默认词库（仅作首次播种与 DB 异常时的兜底）=====
const DEFAULT_INSULT_WORDS = [
    '傻逼', '煞笔', '傻比', '傻屄', '傻13', '沙雕', '傻b', '傻卵', '妈的', '他妈的', '特么的',
    '卧槽尼玛', '草泥马', '操你妈', '草你妈', '你妈逼', '你妈死了', '干你', '操你', '草你',
    '日你', '艹你', '去死', '找死', '死全家', '全家死光', '畜生', '杂种', '狗杂种', '狗东西',
    '贱人', '贱货', '婊子', '婊砸', '绿茶婊', '母狗', '绿帽', '老逼登', '二逼', '憨批', '傻缺',
    '废物', '废柴', '白痴', '智障', '脑残', '弱智', '脑瘫', '低能儿', '蠢货', '蠢猪',
    '滚蛋', '滚犊子', '滚你妈', '恶心玩意', '什么玩意儿垃圾'
];
const DEFAULT_PORN_WORDS = [
    '做爱', '打炮', '约炮', '约pao', '炮友', '开房', '一夜情', '嫖娼', '卖淫', '援交',
    '黄片', '裸聊', '卖片', '色情', 'a片', '一夜性', '性服务',
    'porn', 'nude', 'sex chat', 'fuck', 'shit', 'bitch', 'motherfucker', 'fucker', 'fxck', 'asshole', 'dickhead',
    'cunt', 'bullshit', 'dumbass', 'jackass', 'whore', 'slut', 'nigger', 'nigga', 'retard'
];
const DEFAULT_ILLEGAL_WORDS = [
    '加微信', '加qq', '加v', '加我vx', '私聊转账', '博彩', '赌球', '六合彩', '百家乐', '网络赌博',
    '代开发票', '刷单', '刷信誉', '兼职日结', '高薪兼职', '网贷', '套现', '毒品', '冰毒', '大麻',
    '枪支', '弹药', '代办证件', 'bitcoin转账', '转账到', '色情服务'
];
const DEFAULT_SELFHARM_WORDS = [
    '教你自杀', '自杀方法', '怎么自杀', '自杀教程', '自杀群', '约死', '安乐死药'
];
const DEFAULT_SHORT_WORDS = [
    'sb', 'nm', 'cnm', 'nmsl', 'wcnm', 'gnm', 'nnd', 'tmd', 'md', 'mmp', 'fk', 'sht', 'kys', 'stfu', 'av', 'yp', 'zz'
];

interface WordEntry { w: string; c: string; s: number }
const DEFAULT_WORD_ENTRIES: WordEntry[] = [
    ...DEFAULT_INSULT_WORDS.map(w => ({ w, c: '侮辱', s: 0 })),
    ...DEFAULT_PORN_WORDS.map(w => ({ w, c: '色情', s: 0 })),
    ...DEFAULT_ILLEGAL_WORDS.map(w => ({ w, c: '违禁', s: 0 })),
    ...DEFAULT_SELFHARM_WORDS.map(w => ({ w, c: '自伤', s: 0 })),
    ...DEFAULT_SHORT_WORDS.map(w => ({ w, c: '缩写', s: 1 }))
];

// 运行时词库（启动时从 DB 加载；admin 增删后 invalidateWords() 重载）
let blockedWords: string[] = DEFAULT_WORD_ENTRIES.filter(e => !e.s).map(e => e.w);
let shortWords: string[] = DEFAULT_WORD_ENTRIES.filter(e => !!e.s).map(e => e.w);

/** 从 DB 加载词库；表为空时播种默认词库；DB 异常时保留当前词库（默认兜底） */
export async function loadSensitiveWords(): Promise<void> {
    try {
        const [rows] = await pool.execute('SELECT word, is_short FROM sensitive_words');
        const list = rows as any[];
        if (!list.length) {
            const vals = DEFAULT_WORD_ENTRIES.map(e => [e.w, e.c, e.s]);
            await pool.query(
                'INSERT IGNORE INTO sensitive_words (word, category, is_short) VALUES ?',
                [vals]
            );
            console.log(`[审核] 已播种默认词库 ${vals.length} 条`);
            return; // 内存词库与默认一致，无需重载
        }
        blockedWords = list.filter(r => !r.is_short).map(r => String(r.word));
        shortWords = list.filter(r => !!r.is_short).map(r => String(r.word));
        console.log(`[审核] 词库已加载：主词 ${blockedWords.length} 条，短词 ${shortWords.length} 条`);
    } catch (e) {
        console.error('[审核] 词库加载失败，沿用当前词库:', (e as Error).message);
    }
}

/** 词库变更后重载（admin 增删接口调用） */
export function invalidateWords(): void {
    loadSensitiveWords().catch(() => {});
}

// 字形替换还原表：常见的西里尔/希腊形近字母映射回 ASCII，防 fυck 式绕过
const HOMOGLYPHS: Record<string, string> = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'ѕ': 's', 'і': 'i',
    'α': 'a', 'ο': 'o', 'υ': 'u', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ü': 'u'
};

// 字形替换正则从映射表键动态构建，避免字符类与映射表手工维护不同步
const HOMOGLYPH_RE = new RegExp('[' + Object.keys(HOMOGLYPHS).join('') + ']', 'g');

// 归一化：NFKC（全角转半角等）→ 小写 → 形近字还原 → 剔除所有非字母/数字字符
// （空白、标点、emoji、零宽字符全部剔除，"傻 逼"、"f**k"、"草~泥~马" 等变体全部失效）
function normalize(text: string): string {
    let t = String(text).normalize('NFKC').toLowerCase();
    t = t.replace(HOMOGLYPH_RE, (c) => HOMOGLYPHS[c] || c);
    t = t.replace(/[^\p{L}\p{N}]+/gu, '');
    return t;
}

// 短词匹配：命中位置前后均不是 ASCII 字母才算独立词
function hitShortWord(norm: string, word: string): boolean {
    const isAsciiLetter = (c: string | undefined) => !!c && c >= 'a' && c <= 'z';
    let idx = norm.indexOf(word);
    while (idx !== -1) {
        const before = idx > 0 ? norm[idx - 1] : undefined;
        const after = idx + word.length < norm.length ? norm[idx + word.length] : undefined;
        if (!isAsciiLetter(before) && !isAsciiLetter(after)) return true;
        idx = norm.indexOf(word, idx + 1);
    }
    return false;
}

export interface ModerationResult {
    ok: boolean;
    hit?: string;
}

/**
 * 词库检查（同步、毫秒级，供发送前预检接口复用）
 * @returns ok=true 通过；ok=false 命中敏感词（hit 为命中的词）
 */
export function checkMessageContent(content: string): ModerationResult {
    if (!content || !String(content).trim()) {
        return { ok: false, hit: '空内容' };
    }
    const normalized = normalize(String(content));
    if (!normalized) {
        return { ok: false, hit: '空内容' };
    }
    for (const word of blockedWords) {
        if (normalized.includes(word)) {
            return { ok: false, hit: word };
        }
    }
    for (const word of shortWords) {
        if (hitShortWord(normalized, word)) {
            return { ok: false, hit: word };
        }
    }
    return { ok: true };
}

// ===== AI 复审层：词库通过后由大模型复核隐晦侮辱/淫秽变体 =====
// 策略：词库秒拦（免费快速）→ AI 复核（分级：pass / suspect / block，结合上下文识别骚扰）
//       → 同内容哈希缓存 → AI 故障 fail-closed（重试后仍失败按拦截处理，宁可错拦不可放过）

import { callAIJson } from './aiClient';
import { createHash } from 'crypto';

// 审核结论缓存：内容 SHA256 → 结论（上限 500 条，满了清最早的）
const AI_VERDICT_CACHE = new Map<string, ModerationResult>();
const AI_CACHE_MAX = 500;

// 进行中的审核去重：同一内容并发发送只发起一次 AI 调用
const AI_PENDING = new Map<string, Promise<ModerationResult>>();

// 熔断器：AI 连续不可用时 60 秒内直接按拦截处理，不再逐条等待超时
let AI_DOWN_UNTIL = 0;

function aiCacheKey(content: string): string {
    return createHash('sha256').update(String(content)).digest('hex');
}

/** AI 复核（分级结论），供 checkMessageContentAI 调用 */
async function aiReview(content: string, context?: ModerationContextItem[]): Promise<ModerationResult> {
    // 熔断期内直接拦截，避免每条消息都等 2 轮超时
    if (Date.now() < AI_DOWN_UNTIL) {
        return { ok: false, hit: '审核服务暂不可用，请稍后重试' };
    }

    const key = aiCacheKey(content);
    const cached = AI_VERDICT_CACHE.get(key);
    if (cached) return cached;

    const existing = AI_PENDING.get(key);
    if (existing) return existing;

    const ctxText = context && context.length
        ? '\n【最近聊天上下文】\n' + context.map(c => `${c.role === 'expert' ? '对方' : '用户'}：${c.content}`).join('\n')
        : '';

    const task = (async (): Promise<ModerationResult> => {
        try {
            const verdict = await callAIJson(
                '你是内容安全审核员。判断【待审消息】在心理咨询平台场景下是否包含：' +
                '侮辱谩骂（含谐音、拆字、拼音缩写、形近字等变体）、淫秽色情、人身攻击、恶意骚扰。' +
                '注意：正常表达负面情绪、倾诉痛苦、心理咨询相关内容不算违规；' +
                '结合【最近聊天上下文】判断，孤立看模糊但结合上下文构成骚扰或攻击的应判 block。' +
                '分级标准：block=明确违规；suspect=疑似隐晦变体但把握不足；pass=正常内容。' +
                '只输出 JSON：{"level":"pass"} 或 {"level":"suspect","reason":"简短中文原因"} 或 {"level":"block","reason":"简短中文原因"}',
                `【待审消息】${String(content).slice(0, 500)}${ctxText}`,
                { temperature: 0.1, maxTokens: 200, timeout: 15000, retries: 2, label: 'AI 审核' }
            );

            // 解析分级结论；兼容旧格式 {"ok": false}
            const v = verdict && typeof verdict === 'object' ? verdict : {};
            const level = String((v as any).level || '').toLowerCase();
            let result: ModerationResult;
            if (level === 'block' || (v as any).ok === false) {
                result = { ok: false, hit: String((v as any).reason || '内容违规') };
            } else if (level === 'suspect') {
                // 疑似变体把握不足：放行但记录，便于后续核查词库盲区
                result = { ok: true };
                console.warn('[AI 审核] 疑似违规放行:', String((v as any).reason || '未给出原因'));
            } else {
                result = { ok: true };
            }

            if (AI_VERDICT_CACHE.size >= AI_CACHE_MAX) {
                const first = AI_VERDICT_CACHE.keys().next().value;
                if (first) AI_VERDICT_CACHE.delete(first);
            }
            AI_VERDICT_CACHE.set(key, result);
            return result;
        } catch (e) {
            // fail-closed：AI 不可用时按拦截处理（含未配置 AI_API_KEY 的情况），
            // 并触发 60 秒熔断，避免刷消息时每条都等待重试超时
            AI_DOWN_UNTIL = Date.now() + 60_000;
            console.error('[AI 审核] 服务不可用，按拦截处理（熔断 60s）:', (e as Error).message);
            return { ok: false, hit: '审核服务暂不可用，请稍后重试' };
        } finally {
            AI_PENDING.delete(key);
        }
    })();

    AI_PENDING.set(key, task);
    return task;
}

export interface ModerationContextItem {
    role?: 'user' | 'expert';
    content: string;
}

/**
 * 完整审核链路：词库秒拦 → AI 复核（分级 + 上下文）。
 * Socket 与 HTTP 两条消息发送链路统一调用此函数。
 * @param context 同一会话最近几条消息（可选），用于 AI 识别上下文性骚扰
 */
export async function checkMessageContentAI(
    content: string,
    context?: ModerationContextItem[]
): Promise<ModerationResult> {
    const keyword = checkMessageContent(content);
    if (!keyword.ok) return keyword;
    return aiReview(content, context);
}
