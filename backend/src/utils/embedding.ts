// 统一向量嵌入（Embedding）客户端 —— RAG 检索与记忆的底座
// 设计要点：
// - 走 OpenAI 兼容 /embeddings 协议，默认 SiliconFlow + BAAI/bge-m3（免费额度、中文效果好），
//   通过 EMBED_BASE_URL / EMBED_API_KEY / EMBED_MODEL 三个环境变量即可换任意兼容厂商
// - 未配置 EMBED_API_KEY 时视为「RAG 未启用」：所有调用返回 null，上层自动降级，
//   对话与落库主流程完全不受影响（fail-open）
// - 调用一律 try/catch 包裹并打日志，嵌入失败绝不阻塞业务主链路
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface EmbedConfig {
    baseURL: string;
    apiKey: string;
    model: string;
}

/** 嵌入配置；未配置 key 时返回 null（= RAG 功能整体关闭） */
export function getEmbedConfig(): EmbedConfig | null {
    const apiKey = process.env.EMBED_API_KEY || '';
    if (!apiKey) return null;
    const baseURL = (process.env.EMBED_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
    const model = process.env.EMBED_MODEL || 'BAAI/bge-m3';
    return { baseURL, apiKey, model };
}

/** RAG 是否已启用（供 /memory/status 与前端提示用） */
export function isRagEnabled(): boolean {
    return getEmbedConfig() !== null;
}

/** 单条文本超长截断（bge-m3 支持长文本，这里 4000 字符封顶控制成本与延迟） */
const MAX_TEXT_LEN = 4000;

/**
 * 批量嵌入文本，返回与输入等长的向量数组。
 * 未配置嵌入服务或调用失败时返回 null（调用方降级处理）。
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
    const cfg = getEmbedConfig();
    if (!cfg || texts.length === 0) return null;
    try {
        const response = await axios.post(
            cfg.baseURL + '/embeddings',
            {
                model: cfg.model,
                input: texts.map((t) => String(t || '').slice(0, MAX_TEXT_LEN))
            },
            {
                headers: { Authorization: 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
                timeout: 20000
            }
        );
        const data = response.data?.data;
        if (!Array.isArray(data) || data.length !== texts.length) return null;
        // 兼容按 index 排序的返回（OpenAI 规范：data[i].index 对应输入位置）
        const sorted = [...data].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
        const vectors = sorted.map((d: any) => (Array.isArray(d.embedding) ? d.embedding : null));
        if (vectors.some((v: any) => !v)) return null;
        return vectors as number[][];
    } catch (e: any) {
        console.error('[embedding] 嵌入调用失败:', e.message);
        return null;
    }
}

/** 单条文本嵌入；未配置/失败返回 null */
export async function embedText(text: string): Promise<number[] | null> {
    const vecs = await embedTexts([text]);
    return vecs ? vecs[0] : null;
}

/** 余弦相似度（向量已归一化与否均可，公式自带长度修正） */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** 向量 JSON 序列化（落库用） */
export function packVector(vec: number[]): string {
    return JSON.stringify(vec);
}

/** 向量 JSON 反序列化（坏数据返回 null） */
export function unpackVector(raw: string | null | undefined): number[] | null {
    if (!raw) return null;
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) && v.length > 0 && typeof v[0] === 'number' ? v : null;
    } catch {
        return null;
    }
}
