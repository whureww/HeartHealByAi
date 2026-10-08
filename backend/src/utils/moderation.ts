// 聊天内容审核：拦截不文明 / 违规内容
// 说明：本地词库过滤，命中即拦截；词库可按需扩充

// 敏感词库（含常见变体，统一小写；匹配前会先归一化文本）
const BLOCKED_WORDS: string[] = [
    // 脏话与侮辱性词汇
    '傻逼', '煞笔', '沙雕', '傻b', 'sb', '傻卵', '妈的', '他妈的', '特么的', '卧槽尼玛',
    '操你', '草你', '日你', '干你', '艹你', 'fuck', 'shit', 'bitch', 'damn you',
    '去死', '找死', '畜生', '杂种', '贱人', '婊子', '婊砸', '母狗', '绿帽',
    '废物', '白痴', '智障', '脑残', '弱智', '脑瘫', '低能儿', '蠢货', '蠢猪',
    '滚蛋', '滚犊子', '滚你妈', '恶心玩意', '什么玩意儿垃圾',
    // 色情低俗
    '做爱', '打炮', '约炮', '开房', '一夜情', '嫖娼', '卖淫', '援交',
    'porn', 'nude', 'sex chat', '一夜性', '性服务',
    // 违禁与导流
    '加微信', '加qq', '加v', '加我vx', '私聊转账', '博彩', '赌球', '六合彩',
    '代开发票', '刷单', '兼职日结', '网贷', '套现', '毒品', '冰毒', '大麻',
    '枪支', '弹药', '代办证件', 'bitcoin转账', '转账到',
    // 自伤诱导类（预防性拦截，引导专业帮助）
    '教你自杀', '自杀方法', '怎么自杀', '安乐死药'
];

// 归一化：小写、去空白与常见干扰符号（防止"傻 逼"、"sh!t"式变体绕过）
function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\s·・.,，。!！?？~～*#@%^&()（）\[\]【】{}<>《》\-_=+|\\/、;；:""''']+/g, '');
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
    for (const word of BLOCKED_WORDS) {
        if (normalized.includes(word)) {
            return { ok: false, hit: word };
        }
    }
    return { ok: true };
}
