import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TokenManager } from '../utils/tokenManager';
import { pool } from '../db/mysql';

const JWT_SECRET = process.env.JWT_SECRET || 'ijVBkJ6riP1KGyG98LY+oJWM1384Roc+KkdzgjmtGgX07SgQ+v/n5HgyOAJ/n5X1gFKEMmbJEvjmA2+iLaPbRg';

export { JWT_SECRET };

// ========== 扩展 Express Request 类型 ==========
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                onlyId: string;
                role: number;
            };
        }
    }
}

// ========== 生成 Token ==========
// 修复：不要手动传 iat（jwt.sign 会自动写入秒级 iat，手动传毫秒会导致永不过期）
export function generateToken(userId: number, onlyId: string): string {
    return jwt.sign(
        { userId, onlyId },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// ========== 验证 Token 并获取用户完整信息（包含 role）==========
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '未登录' });
    }

    const token = authHeader.slice(7);

    // 检查 token 是否在黑名单
    const isBlacklisted = await TokenManager.isBlacklisted(token);
    if (isBlacklisted) {
        return res.status(401).json({ success: false, message: '登录已失效，请重新登录' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // 验证 onlyId 是否有效（单点登录）
        const onlyIdValid = await TokenManager.verifyOnlyId(decoded.userId, decoded.onlyId);
        if (!onlyIdValid) {
            // 区分「被顶号」（映射存在但不一致）与「映射丢失」（Redis 重启/键过期）：
            // JWT 本身有效且未拉黑时，映射丢失属于服务端数据丢失，自愈重建而非误踢用户
            const stored = await TokenManager.getOnlyId(decoded.userId);
            if (stored === null) {
                await TokenManager.saveToken(decoded.userId, token, decoded.onlyId);
            } else {
                return res.status(401).json({
                    success: false,
                    message: '您的账号已在其他设备登录',
                    code: 'SESSION_EXPIRED'
                });
            }
        }

        // 查询数据库获取用户 role（只查存在的字段）
        const [rows] = await pool.execute(
            'SELECT id, role FROM users WHERE id = ?',
            [decoded.userId]
        );
        const user = (rows as any[])[0];

        if (!user) {
            return res.status(401).json({ success: false, message: '用户不存在' });
        }

        req.user = { 
            id: user.id, 
            onlyId: decoded.onlyId,  // 从 token 中获取 onlyId
            role: user.role 
        };
        next();
    } catch (err) {
        console.error('认证错误:', err);
        return res.status(401).json({ success: false, message: '登录已过期' });
    }
}
