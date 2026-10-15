// 敏感配置加密盒：用户自带模型 API Key 落库前 AES-256-GCM 加密
// 密钥从环境变量派生（专用 MODEL_KEY_SECRET，缺省回退 JWT_SECRET）
import crypto from 'crypto';

function getKey(): Buffer {
    const secret = process.env.MODEL_KEY_SECRET || process.env.JWT_SECRET || '';
    if (!secret) {
        throw new Error('缺少 MODEL_KEY_SECRET / JWT_SECRET，无法加密敏感配置');
    }
    return crypto.createHash('sha256').update(secret).digest();
}

/** 加密为 v1:iv:tag:data 十六进制串（自识别版本前缀，便于未来轮换） */
export function encryptSecret(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'v1:' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + data.toString('hex');
}

/** 解密；格式不符或校验失败抛错（调用方按坏数据处理） */
export function decryptSecret(payload: string): string {
    const parts = String(payload || '').split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('密文格式不合法');
    }
    const [, ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/** 密钥展示掩码：仅保留末 4 位 */
export function maskSecret(plain: string): string {
    const s = String(plain || '');
    if (s.length <= 4) return '****';
    return '****' + s.slice(-4);
}
