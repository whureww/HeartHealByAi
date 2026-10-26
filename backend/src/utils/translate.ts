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

// ===== 长文本分块翻译 =====
// 实测网关对 2500+ 字长文本必现 504（其内部约 30s 超时），短文本（~1s）稳定但高峰期整机会抖动；
// 报告类长文本按段落边界切成小块送译，全部成功后按原顺序拼接；网关整体不可用时快速转入主厂模型回落
const CHUNK_MAX_CHARS = 800;     // 单块字符上限（块越小 504 概率越低）
const CHUNK_CONCURRENCY = 3;     // 并发送译数（对公共网关保持克制）
const CHUNK_TIMEOUT_MS = 22000;  // 单块超时（健康网关 800 字约 1~15s 出结果，超时即视为网关过载）
const CHUNK_RETRIES = 1;         // 单块失败重试次数（网关偶发抖动，重试常可恢复）
const PHASE_BUDGET_MS = 40000;   // 网关阶段总预算：超时立即放弃网关转入回落，避免故障期用户空等 90s+

/** 按段落边界切块：优先在空行处断开，超长段落按句号/问号/感叹号二次切分 */
function splitIntoChunks(text: string, maxChars = CHUNK_MAX_CHARS): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const sentences = (p: string): string[] => {
    if (p.length <= maxChars) return [p];
    const parts: string[] = [];
    let buf = '';
    for (const seg of p.split(/(?<=[。！？!?；;\.])\s*/)) {
      if ((buf + seg).length > maxChars && buf) {
        parts.push(buf);
        buf = seg;
      } else {
        buf += seg;
      }
    }
    if (buf.trim()) parts.push(buf);
    return parts;
  };

  const chunks: string[] = [];
  let cur = '';
  for (const p of paragraphs) {
    const pieces = sentences(p.trim()).filter((s) => s.length);
    for (const piece of pieces) {
      if (!cur) {
        cur = piece;
      } else if ((cur + '\n\n' + piece).length <= maxChars) {
        cur += '\n\n' + piece;
      } else {
        chunks.push(cur);
        cur = piece;
      }
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

/**
 * 长文本翻译入口：短文本直接透传；长文本自动分块并受限并发送译，按原序拼接。
 * 任一块失败即整体抛错（调用方决定回落策略），避免拼接出残缺译文。
 */
export async function translateTextLong(text: string, targetCode: string, constraint?: string, timeoutMs = 90000): Promise<string> {
  const src = String(text || '').trim();
  if (src.length <= CHUNK_MAX_CHARS) {
    return translateText(src, targetCode, constraint, timeoutMs);
  }

  const chunks = splitIntoChunks(src);
  const results: string[] = new Array(chunks.length).fill('');
  let next = 0;
  let failed = false;
  const phaseStart = Date.now();

  const worker = async () => {
    while (next < chunks.length && !failed) {
      // 网关阶段预算耗尽：停止排新任务，尽快转入回落链路
      if (Date.now() - phaseStart > PHASE_BUDGET_MS) {
        failed = true;
        console.error('[translate] 网关阶段超预算，转回落');
        break;
      }
      const idx = next++;
      let t = '';
      // 单块失败自动重试（网关偶发 504/抖动，重试常可恢复）
      for (let r = 0; r <= CHUNK_RETRIES && !t; r++) {
        try {
          t = await translateText(chunks[idx], targetCode, constraint, CHUNK_TIMEOUT_MS);
        } catch (e: any) {
          console.error(`[translate] 分块 ${idx + 1}/${chunks.length} 第 ${r + 1} 次尝试失败:`, e?.message);
        }
      }
      if (t) {
        results[idx] = t;
      } else {
        failed = true;
        console.error(`[translate] 分块 ${idx + 1}/${chunks.length} 重试后仍失败，整体转回落`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, worker));

  if (failed) throw new Error('分块翻译部分失败');
  return results.join('\n\n');
}
