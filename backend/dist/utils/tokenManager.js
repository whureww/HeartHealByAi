"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = void 0;
const redis_1 = __importDefault(require("../db/redis"));
const crypto_1 = require("crypto");
class TokenManager {
    // 生成唯一设备/会话 ID
    static generateOnlyId() {
        return (0, crypto_1.randomBytes)(16).toString('hex');
    }
    // 保存用户 token 和 onlyId（单点登录：新登录踢掉旧登录）
    static async saveToken(userId, token, onlyId, expiresIn = 7 * 24 * 60 * 60) {
        // 删除该用户旧的 token 关联
        const oldOnlyId = await redis_1.default.get(`user_onlyid:${userId}`);
        if (oldOnlyId) {
            await redis_1.default.del(`onlyid_token:${oldOnlyId}`);
        }
        // 保存新的 onlyId 和 token 映射
        await redis_1.default.set(`user_onlyid:${userId}`, onlyId, { EX: expiresIn });
        await redis_1.default.set(`onlyid_token:${onlyId}`, token, { EX: expiresIn });
        await redis_1.default.set(`token_onlyid:${token}`, onlyId, { EX: expiresIn });
    }
    // 验证 onlyId 是否有效（防止 token 被盗用后在其他设备使用）
    static async verifyOnlyId(userId, onlyId) {
        const storedOnlyId = await redis_1.default.get(`user_onlyid:${userId}`);
        return storedOnlyId === onlyId;
    }
    // 获取用户当前 onlyId
    static async getOnlyId(userId) {
        return await redis_1.default.get(`user_onlyid:${userId}`);
    }
    // 删除用户 token（退出登录）
    static async removeToken(userId, token) {
        const onlyId = await redis_1.default.get(`token_onlyid:${token}`);
        if (onlyId) {
            await redis_1.default.del(`onlyid_token:${onlyId}`);
        }
        await redis_1.default.del(`user_onlyid:${userId}`);
        await redis_1.default.del(`token_onlyid:${token}`);
    }
    // 将 token 加入黑名单（用于主动失效）
    static async blacklistToken(token, ttl) {
        await redis_1.default.set(`token_blacklist:${token}`, '1', { EX: ttl });
    }
    // 检查 token 是否在黑名单
    static async isBlacklisted(token) {
        const result = await redis_1.default.get(`token_blacklist:${token}`);
        return result !== null;
    }
}
exports.TokenManager = TokenManager;
