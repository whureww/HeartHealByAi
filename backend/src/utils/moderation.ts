// 聊天内容审核：拦截不文明 / 违规内容
// 策略：NFKC 归一化 + 字形替换还原 + 剔除全部非文字字符（防分隔/夹杂符号/emoji 绕过），
//      主词库直接匹配 + 短词库边界匹配（防止英文单词内部误伤，如 husband 含 sb）

// 主词库（中文词与 5 位以上英文词，直接 includes 匹配；英文统一小写）
const BLOCKED_WORDS: string[] = [
    // 脏话与侮辱性词汇
    '傻逼', '煞笔', '傻比', '傻屄', '傻13', '沙雕', '傻b', '傻卵', '妈的', '他妈的', '特么的',
    '卧槽尼玛', '草泥马', '操你妈', '草你妈', '你妈逼', '你妈死了', '干你', '操你', '草你',
    '日你', '艹你', '去死', '找死', '死全家', '全家死光', '畜生', '杂种', '狗杂种', '狗东西',
    '贱人', '贱货', '婊子', '婊砸', '绿茶婊', '母狗', '绿帽', '老逼登', '二逼', '憨批', '傻缺',
    '废物', '废柴', '白痴', '智障', '脑残', '弱智', '脑瘫', '低能儿', '蠢货', '蠢猪',
    '滚蛋', '滚犊子', '滚你妈', '恶心玩意', '什么玩意儿垃圾',
    // 色情低俗
    '做爱', '打炮', '约炮', '约pao', '炮友', '开房', '一夜情', '嫖娼', '卖淫', '援交',
    '黄片', '裸聊', '卖片', '色情', 'a片', '一夜性', '性服务',
    'porn', 'nude', 'sex chat', 'fuck', 'shit', 'bitch', 'motherfucker', 'fucker', 'fxck', 'asshole', 'dickhead',
    'cunt', 'bullshit', 'dumbass', 'jackass', 'whore', 'slut', 'nigger', 'nigga', 'retard',
    // 违禁与导流
    '加微信', '加qq', '加v', '加我vx', '私聊转账', '博彩', '赌球', '六合彩', '百家乐', '网络赌博',
    '代开发票', '刷单', '刷信誉', '兼职日结', '高薪兼职', '网贷', '套现', '毒品', '冰毒', '大麻',
    '枪支', '弹药', '代办证件', 'bitcoin转账', '转账到', '色情服务',
    // 自伤诱导类（预防性拦截，表达痛苦本身不拦截，引导专业帮助）
    '教你自杀', '自杀方法', '怎么自杀', '自杀教程', '自杀群', '约死', '安乐死药'
];

// 短词库（不超过 4 位的拼音缩写/英文俚语，仅作为独立词出现才命中，
// 要求命中位置前后都不是 ASCII 字母，避免 husband→sb、type→yp 之类误伤）
const BLOCKED_SHORT_WORDS: string[] = [
    'sb', 'nm', 'cnm', 'nmsl', 'wcnm', 'gnm', 'nnd', 'tmd', 'md', 'mmp', 'fk', 'sht', 'kys', 'stfu', 'av', 'yp', 'zz'
];

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
 * 检查聊天内容是否违规
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
    for (const word of BLOCKED_WORDS) {
        if (normalized.includes(word)) {
            return { ok: false, hit: word };
        }
    }
    for (const word of BLOCKED_SHORT_WORDS) {
        if (hitShortWord(normalized, word)) {
            return { ok: false, hit: word };
        }
    }
    return { ok: true };
}

// ===== AI 复审层：词库通过后由大模型复核隐晦侮辱/淫秽变体 =====
// 策略：词库秒拦（免费快速）→ AI 复核（能理解语境、谐音、拆字等绕过手段）
//       → 同内容哈希缓存（相同文本不重复调用）→ AI 故障时放行（不阻塞正常聊天）

import { callAIJson } from './aiClient';
import { createHash } from 'crypto';

// 审核结论缓存：内容 SHA256 → 结论（上限 500 条，满了清最早的）
const AI_VERDICT_CACHE = new Map<string, ModerationResult>();
const AI_CACHE_MAX = 500;

// 进行中的审核去重：同一内容并发发送只发起一次 AI 调用
const AI_PENDING = new Map<string, Promise<ModerationResult>>();

function aiCacheKey(content: string): string {
    return createHash('sha256').update(String(content)).digest('hex');
}

/**
 * AI 复核消息内容：判断是否包含侮辱、谩骂、淫秽色情或其他不宜在心理咨询平台出现的内容。
 * 返回 { ok, hit }；AI 调用失败时放行（fail-open，词库层已兜底）。
 */
async function aiReview(content: string): Promise<ModerationResult> {
    const key = aiCacheKey(content);
    const cached = AI_VERDICT_CACHE.get(key);
    if (cached) return cached;

    const existing = AI_PENDING.get(key);
    if (existing) return existing;

    const task = (async (): Promise<ModerationResult> => {
        try {
            const verdict = await callAIJson(
                '你是内容安全审核员。判断用户消息是否包含以下任一类内容：' +
                '侮辱谩骂（含谐音、拆字、拼音缩写、形近字等变体）、淫秽色情、人身攻击、恶意骚扰。' +
                '注意：正常表达负面情绪、倾诉痛苦、心理咨询相关内容不算违规。' +
                '只输出 JSON：{"ok": true} 或 {"ok": false, "reason": "简短中文原因"}',
                String(content).slice(0, 500),
                { temperature: 0.1, maxTokens: 200, timeout: 12000, retries: 1, label: 'AI 审核' }
            );
            // ok 缺失时按放行处理，避免模型输出异常误拦
            const result: ModerationResult =
                verdict && typeof verdict === 'object' && verdict.ok === false
                    ? { ok: false, hit: String(verdict.reason || '内容违规') }
                    : { ok: true };

            if (AI_VERDICT_CACHE.size >= AI_CACHE_MAX) {
                const first = AI_VERDICT_CACHE.keys().next().value;
                if (first) AI_VERDICT_CACHE.delete(first);
            }
            AI_VERDICT_CACHE.set(key, result);
            return result;
        } catch (e) {
            // AI 不可用：放行，词库层已拦截明显违规
            console.error('[AI 审核] 调用失败，放行（词库已兜底）:', (e as Error).message);
            return { ok: true };
        } finally {
            AI_PENDING.delete(key);
        }
    })();

    AI_PENDING.set(key, task);
    return task;
}

/**
 * 完整审核链路：词库秒拦 → AI 复核。
 * Socket 与 HTTP 两条消息发送链路统一调用此函数。
 */
export async function checkMessageContentAI(content: string): Promise<ModerationResult> {
    const keyword = checkMessageContent(content);
    if (!keyword.ok) return keyword;
    return aiReview(content);
}
