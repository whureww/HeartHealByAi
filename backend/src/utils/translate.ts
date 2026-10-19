import axios from 'axios';

/**
 * bilibili Index-Translate 免费公共翻译网关封装
 * 参考：https://github.com/bilibili/Index-Translate/blob/main/inference/llm/call_api.py
 * 端点：https://index-translate.bilibili.com/v1/chat/completions（OpenAI 兼容、免 API key）
 */

// 网关地址与模型可用环境变量覆盖（默认旗舰 35B 模型）
const TRANSLATE_BASE_URL = (process.env.INDEX_TRANSLATE_BASE_URL || 'https://index-translate.bilibili.com/v1').replace(/\/+$/, '');
const TRANSLATE_MODEL = process.env.INDEX_TRANSLATE_MODEL || 'Index-Translate-35B-A3B';
const TRANSLATE_UA = 'Index-Translate-Client/1.0';

// 语言码 → 目标语言中文名（与上游 call_api.py 的 LANG_NAMES 保持一致，模型对中文语言名提示效果最佳）
export const TRANSLATE_LANG_NAMES: Record<string, string> = {
  en: '英语', zh: '中文', de: '德语', fr: '法语', es: '西班牙语',
  ja: '日语', ko: '韩语', pt: '葡萄牙语', ru: '俄语', ar: '阿拉伯语',
  it: '意大利语', nl: '荷兰语', pl: '波兰语', ro: '罗马尼亚语',
  sv: '瑞典语', tr: '土耳其语', hi: '印地语', vi: '越南语',
  th: '泰语', id: '印尼语', ms: '马来语', fil: '菲律宾语',
  ukr_cyrl: '乌克兰语', fas_arab: '波斯语', ces_latn: '捷克语',
  ell_grek: '希腊语', dan_latn: '丹麦语', hun_latn: '匈牙利语',
  fin_latn: '芬兰语', nob_latn: '书面挪威语', slk_latn: '斯洛伐克语',
  bul_cyrl: '保加利亚语'
};

export function isSupportedLang(code: string): boolean {
  return !!TRANSLATE_LANG_NAMES[String(code || '').toLowerCase()];
}

/** 复刻 call_api.py::build_prompt：无约束走极简分支，带约束走【源文】+【约束要求】格式 */
function buildTranslatePrompt(text: string, targetCode: string, constraint?: string): string {
  const tgtName = TRANSLATE_LANG_NAMES[String(targetCode).toLowerCase()];
  const stripped = text.trim();
  const lines = (constraint || '').trim();
  if (lines) {
    const header = `请将以下文本翻译成${tgtName}，并且严格遵循所有约束要求。`;
    const reqLines = lines.split('\n').map((line, i) => {
      const l = line.trim();
      return `${i + 1}. ${l.startsWith('【') ? l : '【注意】' + l}`;
    });
    return `${header}\n\n【源文】\n${stripped}\n\n【约束要求】\n${reqLines.join('\n')}\n\n只输出译文，不要有任何额外说明。`;
  }
  return `请将以下文本翻译为${tgtName}，直接输出翻译结果，不要进行任何解释。\n\n${stripped}`;
}

/** 复刻 call_api.py::strip_think：剥离 CoT 思考块，仅保留译文正文 */
function stripThink(text: string): string {
  let out = String(text || '');
  if (out.includes('</think>')) out = out.split('</think>').slice(1).join('</think>');
  return out.trim().replace(/^<think>/, '').trim();
}

/** 请求体构造：enable_thinking 必须关闭，否则 CoT 文本会顶替译文 */
function buildTranslateBody(prompt: string, maxTokens: number, stream: boolean) {
  return {
    model: TRANSLATE_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: maxTokens,
    stream,
    chat_template_kwargs: { enable_thinking: false }
  };
}

/**
 * 非流式翻译一段文本（失败抛错，fail-open 策略由调用方决定）
 * @param text 原文
 * @param targetCode 目标语言码（TRANSLATE_LANG_NAMES 的键）
 * @param constraint 可选翻译约束（如"保留 Markdown 结构"）
 * @param timeoutMs 请求超时（毫秒）
 */
export async function translateText(text: string, targetCode: string, constraint?: string, timeoutMs = 30000): Promise<string> {
  const prompt = buildTranslatePrompt(text, targetCode, constraint);
  // max_tokens 按原文长度粗估（膨胀率一般 <2 倍），并设上下限
  const maxTokens = Math.min(4000, Math.max(64, Math.ceil(text.length * 2) + 64));
  const res = await axios.post(
    TRANSLATE_BASE_URL + '/chat/completions',
    buildTranslateBody(prompt, maxTokens, false),
    { headers: { 'Content-Type': 'application/json', 'User-Agent': TRANSLATE_UA }, timeout: timeoutMs }
  );
  const content = res?.data?.choices?.[0]?.message?.content;
  return stripThink(typeof content === 'string' ? content : '');
}
