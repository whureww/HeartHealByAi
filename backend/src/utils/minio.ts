// MinIO 头像对象存储封装
// 独立桶 xinyu-avatar（与 club-ticket 等其他项目的桶完全隔离，凭据亦为独立子用户），
// 对象命名 avatar/{userId}.jpg（客户端统一压缩为 JPEG），用户 ID 即定位符，
// 数据库不再存储任何头像数据（users.avatar 列已移除）
import { Client } from 'minio';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || '127.0.0.1';
const MINIO_PORT = Number(process.env.MINIO_PORT || 9000);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
// 客户端可直达的地址（桌面端 <img> 直接加载）：如 http://162.x.x.x:9000
const MINIO_PUBLIC_BASE = (process.env.MINIO_PUBLIC_BASE || '').replace(/\/+$/, '');
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'xinyu-avatar';

let client: Client | null = null;
let ensured: Promise<void> | null = null;

function getClient(): Client {
    if (!MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
        throw new Error('未配置 MINIO_ACCESS_KEY / MINIO_SECRET_KEY 环境变量');
    }
    if (!client) {
        client = new Client({
            endPoint: MINIO_ENDPOINT,
            port: MINIO_PORT,
            useSSL: String(process.env.MINIO_USE_SSL || 'false') === 'true',
            accessKey: MINIO_ACCESS_KEY,
            secretKey: MINIO_SECRET_KEY
        });
    }
    return client;
}

/** 懒初始化：确保桶存在且为公共可读（只读下载；上传仅经后端鉴权） */
export function ensureAvatarBucket(): Promise<void> {
    if (!ensured) {
        ensured = (async () => {
            const mc = getClient();
            const exists = await mc.bucketExists(MINIO_BUCKET);
            if (!exists) {
                await mc.makeBucket(MINIO_BUCKET, '');
            }
            // 公共读策略：所有人可 GET（头像本就对全平台可见），写入仍需凭据
            const policy = JSON.stringify({
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Principal: { AWS: ['*'] },
                    Action: ['s3:GetObject'],
                    Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`]
                }]
            });
            await mc.setBucketPolicy(MINIO_BUCKET, policy);
        })().catch((e) => {
            ensured = null;
            throw e;
        });
    }
    return ensured;
}

/** 用户头像的对象键 */
function avatarObjectKey(userId: number): string {
    return `avatar/${userId}.jpg`;
}

/** 用户头像的公网访问 URL（不含存在性判断） */
function avatarPublicUrl(userId: number): string {
    if (!MINIO_PUBLIC_BASE) return '';
    return `${MINIO_PUBLIC_BASE}/${MINIO_BUCKET}/${avatarObjectKey(userId)}`;
}

// 存在性缓存：命中/未命中均缓存 60s，避免列表接口频繁 statObject
const existenceCache = new Map<number, { exists: boolean; expires: number }>();
const EXIST_TTL_MS = 60_000;

/**
 * 获取用户头像 URL；用户从未上传时返回 ''（前端回落占位图）。
 * 存在性查询带短 TTL 缓存；上传成功后会主动置为存在。
 */
export async function getAvatarUrl(userId: number): Promise<string> {
    const url = avatarPublicUrl(userId);
    if (!url) return '';

    const now = Date.now();
    const cached = existenceCache.get(userId);
    if (cached && cached.expires > now) {
        return cached.exists ? url : '';
    }
    try {
        await getClient().statObject(MINIO_BUCKET, avatarObjectKey(userId));
        existenceCache.set(userId, { exists: true, expires: now + EXIST_TTL_MS });
        return url;
    } catch {
        existenceCache.set(userId, { exists: false, expires: now + EXIST_TTL_MS });
        return '';
    }
}

/**
 * 上传头像（dataURL → JPEG 对象，覆盖写；Cache-Control: no-cache 保证更换后各端即时可见）。
 * 返回可直接写入前端展示状态的公网 URL。
 */
export async function uploadAvatarFromDataUrl(userId: number, dataUrl: string): Promise<string> {
    await ensureAvatarBucket();
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s.exec(String(dataUrl || '').trim());
    if (!match) {
        throw new Error('无效的头像数据（需为 data:image/*;base64 格式）');
    }
    const mime = match[1] === 'jpg' ? 'jpeg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
        throw new Error('头像数据为空');
    }
    if (buffer.length > 2 * 1024 * 1024) {
        throw new Error('头像文件过大（压缩后应小于 2MB）');
    }
    await getClient().putObject(MINIO_BUCKET, avatarObjectKey(userId), buffer, buffer.length, {
        'Content-Type': 'image/' + mime,
        'Cache-Control': 'no-cache, max-age=0'
    });
    existenceCache.set(userId, { exists: true, expires: Date.now() + EXIST_TTL_MS });
    return avatarPublicUrl(userId);
}
