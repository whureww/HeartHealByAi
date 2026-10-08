// 统一 AI 大模型调用客户端
// 兼容设计：
// - 请求端：兼容 OpenAI Chat Completions 风格（DeepSeek / Kimi / Qwen 兼容模式 /
//   智谱 GLM / OpenAI / 各类网关均采用此协议），厂商只需换 BASE_URL + KEY + MODEL
// - 响应端：归一化各家返回格式（choices[].message.content、内容分块数组、
//   DashScope 原生 output.text、Anthropic 网关 content[].text、<think> 思考标签等）
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface AIConfig {
    baseURL: string;
    apiKey: string;
    model: string;
}

export function getAIConfig(): AIConfig {
    const apiKey = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
    const baseURL = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
    const model = process.env.AI_MODEL || 'deepseek-v4-flash';
    return { baseURL, apiKey, model };
}

// 去除推理型模型的思考标签（DeepSeek-R1 / QwQ 等会输出 <think>...</think>）
function stripThink(text: string): string {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*$/gi, '') // 未闭合的思考标签也截掉
        .trim();
}

/**
 * 从各家大模型的非流式响应中提取正文文本。
 * 支持：
 * 1. OpenAI 风格 choices[0].message.content（字符串或分块数组）
 * 2. DashScope 原生 output.text / output.choices[0].message.content
 * 3. Anthropic 网关风格 content[].text
 */
export function extractAIContent(data: any): string {
    const msg = data?.choices?.[0]?.message;
    if (msg) {
        if (typeof msg.content === 'string') return stripThink(msg.content);
        if (Array.isArray(msg.content)) {
            return stripThink(msg.content
                .map((b: any) => (typeof b === 'string' ? b : b?.text || ''))
                .join(''));
        }
    }
    if (typeof data?.output?.text === 'string') return stripThink(data.output.text);
    const oc = data?.output?.choices?.[0]?.message?.content;
    if (typeof oc === 'string') return stripThink(oc);
    if (Array.isArray(data?.content)) {
        return stripThink(data.content
            .map((b: any) => (b?.type === 'text' ? b.text || '' : ''))
            .join(''));
    }
    return '';
}

/**
 * 从流式 SSE 块中提取增量文本。
 * 支持 choices[0].delta.content（字符串/分块数组）、DashScope output 增量；
 * 忽略 reasoning_content（思考过程不是正文）。
 */
export function extractDeltaChunk(data: any): string {
    const delta = data?.choices?.[0]?.delta;
    if (delta) {
        if (typeof delta.content === 'string') return delta.content;
        if (Array.isArray(delta.content)) {
            return delta.content.map((b: any) => (typeof b === 'string' ? b : b?.text || '')).join('');
        }
    }
    if (typeof data?.output?.text === 'string') return data.output.text;
    const oc = data?.output?.choices?.[0]?.message?.content;
    if (typeof oc === 'string') return oc;
    return '';
}

export interface CallAIOptions {
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    /** 启用 JSON 输出模式（OpenAI 兼容端点普遍支持；不支持的厂商会忽略该参数） */
    json?: boolean;
}

/** 统一的非流式调用，返回归一化后的正文文本 */
export async function callAI(
    messages: { role: string; content: string }[],
    opts: CallAIOptions = {}
): Promise<string> {
    const { baseURL, apiKey, model } = getAIConfig();
    if (!apiKey) {
        throw new Error('AI 服务未配置（缺少 AI_API_KEY / DEEPSEEK_API_KEY）');
    }
    const body: Record<string, unknown> = {
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2000
    };
    if (opts.json) {
        body.response_format = { type: 'json_object' };
    }
    const response = await axios.post(baseURL + '/chat/completions', body, {
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        timeout: opts.timeout ?? 60000
    });
    return extractAIContent(response.data);
}

/** 从模型输出中稳健提取 JSON（容忍 ```json 包裹或前后说明文字） */
export function extractJson(text: string): any {
    const cleaned = String(text).replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const s = cleaned.indexOf('{');
        const e = cleaned.lastIndexOf('}');
        if (s !== -1 && e > s) {
            return JSON.parse(cleaned.slice(s, e + 1));
        }
        throw new Error('AI 返回格式异常');
    }
}

/**
 * 调用 AI 并解析 JSON，失败自动重试。
 * 最终失败时抛出最后一次的错误，由调用方转换为业务提示。
 */
export async function callAIJson(
    systemPrompt: string,
    userPrompt: string,
    opts: CallAIOptions & { retries?: number; label?: string } = {}
): Promise<any> {
    const retries = opts.retries ?? 3;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const raw = await callAI(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                {
                    temperature: opts.temperature ?? 0.8,
                    maxTokens: opts.maxTokens ?? 2000,
                    timeout: opts.timeout ?? 60000,
                    json: true
                }
            );
            const parsed = extractJson(raw);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
            lastErr = new Error('AI 返回内容为空');
        } catch (e) {
            lastErr = e;
        }
    }
    if (opts.label) {
        console.error(`[${opts.label}] AI 调用重试 ${retries} 次仍失败:`, lastErr);
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** 获取流式调用的请求配置（axios 参数），由调用方接管 SSE 转发 */
export function getStreamRequestParams(
    messages: { role: string; content: string }[],
    opts: CallAIOptions = {}
) {
    const { baseURL, apiKey, model } = getAIConfig();
    return {
        url: baseURL + '/chat/completions',
        body: {
            model,
            messages,
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.maxTokens ?? 2000,
            stream: true
        },
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        timeout: opts.timeout ?? 30000
    };
}
