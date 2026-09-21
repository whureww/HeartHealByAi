import redis from '../db/redis';
import { randomBytes } from 'crypto';

export class TokenManager {
    // 生成唯一设备/会话 ID
    static generateOnlyId(): string {
        return randomBytes(16).toString('hex');
    }

    // 保存用户 token 和 onlyId（单点登录：新登录踢掉旧登录）
    static async saveToken(userId: number, token: string, onlyId: string, expiresIn: number = 7 * 24 * 60 * 60): Promise<void> {
        // 删除该用户旧的 token 关联
        const oldOnlyId = await redis.get(`user_onlyid:${userId}`);
        if (oldOnlyId) {
            await redis.del(`onlyid_token:${oldOnlyId}`);
        }

        // 保存新的 onlyId 和 token 映射
        await redis.set(`user_onlyid:${userId}`, onlyId, { EX: expiresIn });
        await redis.set(`onlyid_token:${onlyId}`, token, { EX: expiresIn });
        await redis.set(`token_onlyid:${token}`, onlyId, { EX: expiresIn });
    }

    // 验证 onlyId 是否有效（防止 token 被盗用后在其他设备使用）
    static async verifyOnlyId(userId: number, onlyId: string): Promise<boolean> {
        const storedOnlyId = await redis.get(`user_onlyid:${userId}`);
        return storedOnlyId === onlyId;
    }

    // 获取用户当前 onlyId
    static async getOnlyId(userId: number): Promise<string | null> {
        return await redis.get(`user_onlyid:${userId}`);
    }

    // 删除用户 token（退出登录）
    static async removeToken(userId: number, token: string): Promise<void> {
        const onlyId = await redis.get(`token_onlyid:${token}`);
        if (onlyId) {
            await redis.del(`onlyid_token:${onlyId}`);
        }
        await redis.del(`user_onlyid:${userId}`);
        await redis.del(`token_onlyid:${token}`);
    }

    // 将 token 加入黑名单（用于主动失效）
    static async blacklistToken(token: string, ttl: number): Promise<void> {
        await redis.set(`token_blacklist:${token}`, '1', { EX: ttl });
    }

    // 检查 token 是否在黑名单
    static async isBlacklisted(token: string): Promise<boolean> {
        const result = await redis.get(`token_blacklist:${token}`);
        return result !== null;
    }
}
