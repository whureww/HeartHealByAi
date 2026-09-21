"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.generateToken = generateToken;
exports.authenticate = authenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tokenManager_1 = require("../utils/tokenManager");
const mysql_1 = require("../db/mysql");
const JWT_SECRET = process.env.JWT_SECRET || 'ijVBkJ6riP1KGyG98LY+oJWM1384Roc+KkdzgjmtGgX07SgQ+v/n5HgyOAJ/n5X1gFKEMmbJEvjmA2+iLaPbRg';
exports.JWT_SECRET = JWT_SECRET;
// ========== 生成 Token ==========
// 修复：不要手动传 iat（jwt.sign 会自动写入秒级 iat，手动传毫秒会导致永不过期）
function generateToken(userId, onlyId) {
    return jsonwebtoken_1.default.sign({ userId, onlyId }, JWT_SECRET, { expiresIn: '7d' });
}
// ========== 验证 Token 并获取用户完整信息（包含 role）==========
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '未登录' });
    }
    const token = authHeader.slice(7);
    // 检查 token 是否在黑名单
    const isBlacklisted = await tokenManager_1.TokenManager.isBlacklisted(token);
    if (isBlacklisted) {
        return res.status(401).json({ success: false, message: '登录已失效，请重新登录' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // 验证 onlyId 是否有效（单点登录）
        const onlyIdValid = await tokenManager_1.TokenManager.verifyOnlyId(decoded.userId, decoded.onlyId);
        if (!onlyIdValid) {
            return res.status(401).json({
                success: false,
                message: '您的账号已在其他设备登录',
                code: 'SESSION_EXPIRED'
            });
        }
        // 查询数据库获取用户 role（只查存在的字段）
        const [rows] = await mysql_1.pool.execute('SELECT id, role FROM users WHERE id = ?', [decoded.userId]);
        const user = rows[0];
        if (!user) {
            return res.status(401).json({ success: false, message: '用户不存在' });
        }
        req.user = {
            id: user.id,
            onlyId: decoded.onlyId, // 从 token 中获取 onlyId
            role: user.role
        };
        next();
    }
    catch (err) {
        console.error('认证错误:', err);
        return res.status(401).json({ success: false, message: '登录已过期' });
    }
}
