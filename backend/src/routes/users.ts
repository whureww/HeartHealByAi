import { Router, Request, Response } from 'express';
import { pool } from '../db/mysql';
import { authenticate, generateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import redis from '../db/redis';
import nodemailer from 'nodemailer';
import jwt from "jsonwebtoken";
import { TokenManager } from '../utils/tokenManager';
import { getActiveRestriction } from '../utils/restrict';
import { callAI, getFallbackConfig } from '../utils/aiClient';
import { ensureDoctorEnColumns } from '../utils/doctorCols';
import { embedChatMessage } from '../utils/memory';
import { encryptSecret, decryptSecret, maskSecret } from '../utils/secretBox';
import { getAvatarUrl, uploadAvatarFromDataUrl } from '../utils/minio';
import { ensureUsersAvatarColumnDropped } from '../utils/avatarCols';

const router = Router();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const CODE_EXPIRY = 600;
const RATE_LIMIT_SECONDS = 60;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// 开发模式：未配置 SMTP 时，验证码不真正发信，打印到后端日志
const MAIL_DEV_MODE = !process.env.SMTP_USER || !process.env.SMTP_PASS;

interface User {
    id: number;
    username: string;
    email: string;
    phone?: string;
    password_hash: string;
    role: number;
    avatar?: string;
    created_at: Date;
    updated_at?: Date;
}

// Schema定义
const registerSchema = z.object({
    username: z.string().min(2, { message: "用户名至少2个字符" }),
    email: z.string().email({ message: "请输入有效的邮箱地址" }),
    password: z.string().min(6, { message: "密码至少6个字符" }),
    code: z.string().length(6, { message: "验证码必须是6位数字" }),
    phone: z.string().regex(/^1[3-9]\d{9}$/, { message: "请输入有效的手机号" }).optional()
});

const loginSchema = z.object({
    email: z.string().email({ message: "请输入有效的邮箱地址" }),
    password: z.string({ required_error: "密码不能为空" })
});

const updateProfileSchema = z.object({
    username: z.string().min(2).optional(),
    avatar: z.string().url().optional(),
    phone: z.string().regex(/^1[3-9]\d{9}$/).optional()
});

const sendCodeSchema = z.object({
    email: z.string().email({ message: "请输入有效的邮箱地址" })
});

const resetSchema = z.object({
    email: z.string().email({ message: "请输入有效的邮箱地址" }),
    code: z.string().length(6, { message: "验证码必须是6位数字" }),
    newPassword: z.string().min(6, { message: "密码至少6个字符" })
});

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

async function checkRateLimit(key: string, windowSeconds: number): Promise<void> {
    const result = await redis.set(key, '1', { NX: true, EX: windowSeconds });
    if (result === null) {
        throw new BusinessError('请求过于频繁，请稍后再试', 429);
    }
}

// ========== 发送注册验证码 ==========
router.post('/register/send-code', asyncHandler(async (req: Request, res: Response) => {
    const { email } = sendCodeSchema.parse(req.body);

    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if ((rows as User[]).length > 0) {
        throw new BusinessError('邮箱已被注册', 400);
    }

    await checkRateLimit(`rate_limit:register_code:${email}`, RATE_LIMIT_SECONDS);

    const existingCode = await redis.get(`register:${email}`);
    if (existingCode) {
        return res.json({
            success: true,
            message: '验证码已发送，请检查邮箱'
        });
    }

    const code = randomInt(100000, 999999).toString();

    if (MAIL_DEV_MODE) {
        // 开发模式：不发真实邮件，验证码打印到后端日志
        console.log(`[邮件开发模式] 注册验证码 -> ${email}: ${code}`);
        await redis.set(`register:${email}`, code, { EX: CODE_EXPIRY });
        return res.json({ success: true, message: '验证码已生成（开发模式，见后端日志）' });
    }

    try {
        await transporter.sendMail({
            from: `"注册系统" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "注册验证码",
            html: `
            <div style="padding: 20px; font-family: sans-serif;">
              <h3>欢迎注册</h3>
              <p>你的验证码是：<strong style="font-size:24px; color:#3b82f6">${code}</strong></p>
              <p>10分钟内有效，请勿向他人泄露</p>
            </div>
          `
        });

        await redis.set(`register:${email}`, code, { EX: CODE_EXPIRY });

        res.json({
            success: true,
            message: '验证码已发送至邮箱'
        });
    } catch (err) {
        console.error('Send email failed:', err);
        throw new BusinessError('邮件发送失败，请稍后重试', 500);
    }
}));

// ========== 注册 ==========
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, code, phone } = registerSchema.parse(req.body);
    // 安全修复：角色由服务端固定为普通用户，管理员只能通过数据库手动提升
    const role = 1;

    const storedCode = await redis.get(`register:${email}`);
    if (!storedCode || storedCode !== code) {
        throw new BusinessError('验证码错误或已过期', 400);
    }

    const [emailExists] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if ((emailExists as User[]).length > 0) {
        throw new BusinessError('邮箱已被注册', 400);
    }

    if (phone) {
        const [phoneExists] = await pool.execute('SELECT id FROM users WHERE phone = ?', [phone]);
        if ((phoneExists as User[]).length > 0) {
            throw new BusinessError('手机号已被注册', 400);
        }
    }

    const [nameExists] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if ((nameExists as User[]).length > 0) {
        throw new BusinessError('用户名已被使用', 400);
    }

    const hashedPwd = await hashPassword(password);
    const [result] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
        [username, email, hashedPwd, role, phone || null]
    );

    const userId = (result as any).insertId;

    const onlyId = TokenManager.generateOnlyId();
    const token = generateToken(userId, onlyId);
    await TokenManager.saveToken(userId, token, onlyId);

    res.json({
        success: true,
        message: '注册成功',
        data: { token, onlyId, userId, role }
    });
}));


// ========== 登录 ==========
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);
    await ensureUsersAvatarColumnDropped();

    const [rows] = await pool.execute(
        'SELECT id, password_hash, role, username, email, phone FROM users WHERE email = ?',
        [email]
    );
    const users = rows as User[];

    if (users.length === 0) {
        throw new BusinessError('邮箱或密码错误', 401);
    }

    const user = users[0];
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
        throw new BusinessError('邮箱或密码错误', 401);
    }

    // 封禁检查：封禁中的账号禁止登录（到期自动解除）；禁言不影响登录仅禁言发言
    const restriction = await getActiveRestriction(user.id);
    if (restriction?.type === 'banned') {
        throw new BusinessError(restriction.message, 403);
    }

    const onlyId = TokenManager.generateOnlyId();
    const token = generateToken(user.id, onlyId);
    await TokenManager.saveToken(user.id, token, onlyId);

    res.json({
        success: true,
        message: '登录成功',
        data: {
            token,
            onlyId,
            userId: user.id,
            role: user.role,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: await getAvatarUrl(user.id),
                role: user.role
            }
        }
    });
}));


// ========== 管理员万能钥匙解锁 ==========
// 锁屏语义 = 会话注销：本端点验证管理员身份后，为被锁定的原账户重新签发 token，
// 使「管理员密码解锁」能直接恢复本人会话，而无需知道原账户密码
router.post('/master-login', asyncHandler(async (req: Request, res: Response) => {
    const { admin_email, admin_password, email } = req.body || {};
    if (!admin_email || !admin_password || !email) {
        throw new BusinessError('参数不完整', 400);
    }

    const [arows] = await pool.execute(
        'SELECT id, password_hash, role FROM users WHERE email = ?',
        [admin_email]
    );
    const admins = arows as any[];
    if (admins.length === 0 || admins[0].role !== 3) {
        throw new BusinessError('管理员验证失败', 401);
    }
    const adminOk = await verifyPassword(admin_password, admins[0].password_hash);
    if (!adminOk) {
        throw new BusinessError('管理员验证失败', 401);
    }

    const [urows] = await pool.execute(
        'SELECT id, username, email, phone, role FROM users WHERE email = ?',
        [email]
    );
    const users = urows as User[];
    if (users.length === 0) {
        throw new BusinessError('账户不存在', 404);
    }
    const user = users[0];

    // 为原账户换发全新凭据（旧 token 在锁定时已注销进黑名单，不受影响）
    const onlyId = TokenManager.generateOnlyId();
    const token = generateToken(user.id, onlyId);
    await TokenManager.saveToken(user.id, token, onlyId);

    res.json({
        success: true,
        message: '解锁成功',
        data: {
            token,
            onlyId,
            userId: user.id,
            role: user.role,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: await getAvatarUrl(user.id),
                role: user.role
            }
        }
    });
}));


// ========== 修改用户信息（昵称 + 头像）==========
// 头像改为上传 MinIO 对象存储（客户端传 dataURL，服务端解码后写入独立桶 xinyu-avatar），
// 数据库不再存储任何头像数据
router.put('/profile', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const { username, avatar } = req.body;
    await ensureUsersAvatarColumnDropped();

    const fields: string[] = [];
    const values: any[] = [];
    let avatarUrl: string | null = null;

    // 修改昵称
    if (username !== undefined) {
        if (username.trim().length < 2 || username.trim().length > 20) {
            throw new BusinessError('昵称长度需在2-20个字符之间', 400);
        }
        const [existRows] = await pool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username.trim(), userId]
        );
        if ((existRows as any[]).length > 0) {
            throw new BusinessError('该昵称已被使用', 400);
        }
        fields.push('username = ?');
        values.push(username.trim());
    }

    // 修改头像：dataURL → MinIO（avatar/{userId}.jpg，覆盖写），数据库不再落任何头像数据
    if (avatar !== undefined) {
        if (!avatar) {
            throw new BusinessError('头像数据不能为空', 400);
        }
        avatarUrl = await uploadAvatarFromDataUrl(userId, avatar);
    }

    if (fields.length > 0) {
        values.push(userId);
        await pool.execute(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    if (avatarUrl) {
        res.json({ success: true, message: '头像更新成功', data: { avatar: avatarUrl } });
        return;
    }
    res.json({ success: true, message: '个人信息更新成功' });
}));

// ========== 获取用户信息（包含头像）==========
router.get('/me', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    await ensureUsersAvatarColumnDropped();

    const [rows] = await pool.execute(
        'SELECT id, username, email, phone, role, created_at FROM users WHERE id = ?',
        [userId]
    );

    const user = (rows as any[])[0];
    if (!user) {
        throw new BusinessError('用户不存在', 404);
    }

    res.json({ success: true, data: { ...user, avatar: await getAvatarUrl(userId) } });
}));


// ========== 退出登录 ==========
// 在 users.ts 中添加或修改 logout 路由
router.post('/logout', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const token = req.headers.authorization?.slice(7) || '';

    // 真注销：JWT 加入黑名单（剩余有效期内拒绝），Redis 会话映射同步删除
    if (token) {
        try {
            const decoded = jwt.decode(token) as any;
            const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;
            if (ttl > 0) {
                await TokenManager.blacklistToken(token, ttl);
            }
        } catch (e) {
            console.error('token 黑名单写入失败:', e);
        }
    }
    await TokenManager.removeToken(userId, token);

    // 获取 Socket.IO 实例和用户映射
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    
    if (io && userSockets) {
        const socketSet = userSockets.get(userId);
        if (socketSet) {
            // 断开该用户的所有连接
            for (const socketId of socketSet) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit('force-logout', { message: '账号已登出' });
                    socket.disconnect(true);
                }
            }
            userSockets.delete(userId);
        }
        
        // 广播该用户离线状态
        io.emit('user-status-change', { userId, isOnline: false });
    }
    
    res.json({ success: true, message: '登出成功' });
}));




// ========== Token刷新 ==========
router.post('/refresh-token', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const oldToken = req.headers.authorization?.slice(7);

    const [rows] = await pool.execute(
        'SELECT id, role FROM users WHERE id = ?',
        [userId]
    );
    const users = rows as User[];

    if (users.length === 0) {
        throw new BusinessError('用户不存在', 404);
    }

    const newOnlyId = TokenManager.generateOnlyId();
    const newToken = generateToken(userId, newOnlyId);

    if (oldToken) {
        const decoded = jwt.decode(oldToken) as any;
        if (decoded?.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await TokenManager.blacklistToken(oldToken, ttl);
            }
        }
    }

    await TokenManager.saveToken(userId, newToken, newOnlyId);

    res.json({
        success: true,
        message: 'Token刷新成功',
        data: { token: newToken, onlyId: newOnlyId, userId, role: users[0].role }
    });
}));

// ========== 发送找回密码验证码 ==========
router.post('/forget-password/send-code', asyncHandler(async (req: Request, res: Response) => {
    const { email } = sendCodeSchema.parse(req.body);
    await checkRateLimit(`rate_limit:send_code:${email}`, RATE_LIMIT_SECONDS);

    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);

    if ((rows as User[]).length === 0) {
        return res.json({
            success: true,
            message: '如果该邮箱已注册，验证码将发送至您的邮箱'
        });
    }

    const existingCode = await redis.get(`forget:${email}`);
    if (existingCode) {
        return res.json({
            success: true,
            message: '验证码已发送，请检查邮箱'
        });
    }

    const code = randomInt(100000, 999999).toString();

    if (MAIL_DEV_MODE) {
        // 开发模式：不发真实邮件，验证码打印到后端日志
        console.log(`[邮件开发模式] 找回密码验证码 -> ${email}: ${code}`);
        await redis.set(`forget:${email}`, code, { EX: CODE_EXPIRY });
        return res.json({ success: true, message: '验证码已生成（开发模式，见后端日志）' });
    }

    try {
        await transporter.sendMail({
            from: `"登录系统" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "找回密码验证码",
            html: `
            <div style="padding: 20px; font-family: sans-serif;">
              <h3>你正在重置密码</h3>
              <p>你的验证码是：<strong style="font-size:24px; color:#3b82f6">${code}</strong></p>
              <p>10分钟内有效，请勿向他人泄露</p>
            </div>
          `
        });

        await redis.set(`forget:${email}`, code, { EX: CODE_EXPIRY });

        res.json({
            success: true,
            message: '验证码已发送至邮箱'
        });
    } catch (err) {
        console.error('Send email failed:', err);
        throw new BusinessError('邮件发送失败，请稍后重试', 500);
    }
}));

// ========== 重置密码 ==========
router.post('/forget-password/reset', asyncHandler(async (req: Request, res: Response) => {
    const { email, code, newPassword } = resetSchema.parse(req.body);

    const stored = await redis.get(`forget:${email}`);
    if (!stored || stored !== code) {
        throw new BusinessError('验证码错误或已过期', 400);
    }

    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    const users = rows as User[];

    const hashedPwd = await hashPassword(newPassword);
    await pool.execute('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPwd, email]);

    await redis.del(`forget:${email}`);

    if (users.length > 0) {
        const userId = users[0].id;
        await redis.set(`password_changed:${userId}`, Date.now().toString());
        const oldOnlyId = await TokenManager.getOnlyId(userId);
        if (oldOnlyId) {
            await redis.del(`onlyid_token:${oldOnlyId}`);
        }
        await redis.del(`user_onlyid:${userId}`);
    }

    res.json({
        success: true,
        message: '密码重置成功，请使用新密码重新登录'
    });
}));

// ========== 获取用户统计数据 ==========
router.get('/stats', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [chatRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM chat_records WHERE user_id = ?',
        [userId]
    );

    const [testRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM test_results WHERE user_id = ?',
        [userId]
    );

    const [doctorRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM appointment_records WHERE user_id = ?',
        [userId]
    );

    const [reportRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM analysis_reports WHERE user_id = ?',
        [userId]
    );

    res.json({
        success: true,
        data: {
            chatCount: (chatRows as any[])[0].count,
            testCount: (testRows as any[])[0].count,
            doctorCount: (doctorRows as any[])[0].count,
            reportCount: (reportRows as any[])[0].count
        }
    });
}));

// ========== 获取聊天记录 ==========
// 不带 session_id：返回全部会话消息（导出 / AI 报告分析用，向后兼容）
// 带 session_id：返回指定会话的消息
router.get('/chat-history', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = String(req.query.session_id || '').trim();
    // 分页：limit/offset，默认返回最近 50 条；不传 limit 时保持旧全量行为（导出/报告分析依赖全量）
    const limitRaw = req.query.limit === undefined ? NaN : parseInt(String(req.query.limit), 10);
    const offsetRaw = req.query.offset === undefined ? 0 : parseInt(String(req.query.offset), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : NaN;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const paginated = Number.isFinite(limit);

    // id 次级排序：created_at 为秒级精度，同秒入库（如用户消息与 AI 回复）需按自增 id 稳定排序
    let rows: any[];
    if (sessionId && /^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
        if (paginated) {
            // 先取符合条件的总数与「本次窗口之前」的数量（判断是否还有更早消息）
            const [[cnt]]: any[] = await pool.execute(
                'SELECT COUNT(*) AS total FROM chat_records WHERE user_id = ? AND session_id = ?',
                [userId, sessionId]
            );
            // limit/offset 已经过 parseInt + 范围校验，是纯整数（无注入面），
            // 直接内插规避 mysql2 预处理对 LIMIT ? 占位符的兼容坑
            [rows] = (await pool.execute(
                `SELECT id, content, type, created_at FROM chat_records WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
                [userId, sessionId]
            )) as any[];
            rows.reverse();
            res.json({
                success: true,
                data: rows,
                total: cnt.total,
                hasMore: offset + rows.length < cnt.total
            });
            return;
        }
        [rows] = (await pool.execute(
            'SELECT id, content, type, created_at FROM chat_records WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC, id ASC',
            [userId, sessionId]
        )) as any[];
    } else {
        [rows] = (await pool.execute(
            'SELECT id, content, type, session_id, created_at FROM chat_records WHERE user_id = ? ORDER BY created_at ASC, id ASC',
            [userId]
        )) as any[];
    }

    res.json({
        success: true,
        data: rows
    });
}));

// ========== 获取会话列表 ==========
// 会话元数据存 chat_sessions（含锁定/创建时间/AI 总结标题）；
// 先把 chat_records 中尚无会话记录的历史数据自动回填（含 default 旧数据），再整体返回
router.get('/chat-sessions', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    await pool.execute(
        `INSERT IGNORE INTO chat_sessions (user_id, session_id, title, created_at, last_time)
         SELECT c.user_id, c.session_id,
             LEFT(COALESCE((SELECT m.content FROM chat_records m
                WHERE m.user_id = c.user_id AND m.session_id = c.session_id AND m.type = 'user'
                ORDER BY m.created_at ASC, m.id ASC LIMIT 1), '新对话'), 60),
             MIN(c.created_at), MAX(c.created_at)
         FROM chat_records c
         WHERE c.user_id = ?
         GROUP BY c.user_id, c.session_id`,
        [userId]
    );

    const [rows] = await pool.execute(
        `SELECT s.session_id, s.title, s.locked, s.created_at, s.last_time,
            (SELECT COUNT(*) FROM chat_records c
             WHERE c.user_id = s.user_id AND c.session_id = s.session_id) AS message_count
         FROM chat_sessions s
         WHERE s.user_id = ?
         ORDER BY s.locked DESC, s.last_time DESC, s.id DESC`,
        [userId]
    );

    res.json({
        success: true,
        data: rows
    });
}));

// ========== 新建对话 ==========
// 立即创建会话记录（标题暂为「新对话」），使其不出消息也能出现在侧栏列表
router.post('/chat-sessions', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { randomUUID } = require('crypto');
    const sessionId = String(req.body?.session_id || randomUUID()).trim();

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
        res.status(400).json({ success: false, message: '会话标识不合法' });
        return;
    }

    await pool.execute(
        'INSERT IGNORE INTO chat_sessions (user_id, session_id) VALUES (?, ?)',
        [userId, sessionId]
    );

    const [rows]: any[] = await pool.execute(
        'SELECT session_id, title, locked, created_at, last_time FROM chat_sessions WHERE user_id = ? AND session_id = ?',
        [userId, sessionId]
    );

    res.json({ success: true, data: rows[0] });
}));

// ========== 锁定 / 解锁对话 ==========
// 锁定后置顶显示且不可删除
router.put('/chat-sessions/:sessionId/lock', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = String(req.params.sessionId || '').trim();
    const locked = Number(req.body?.locked) ? 1 : 0;

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
        res.status(400).json({ success: false, message: '会话标识不合法' });
        return;
    }

    const [result]: any = await pool.execute(
        'UPDATE chat_sessions SET locked = ? WHERE user_id = ? AND session_id = ?',
        [locked, userId, sessionId]
    );

    if (!result.affectedRows) {
        res.status(404).json({ success: false, message: '对话不存在' });
        return;
    }

    res.json({ success: true, message: locked ? '已锁定对话' : '已解除锁定', data: { locked } });
}));

// ========== AI 总结对话标题 ==========
// 取该会话前若干条消息交由 AI 生成简短主题标题，替代「首条消息」式标题
router.post('/chat-sessions/:sessionId/summary', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = String(req.params.sessionId || '').trim();

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
        res.status(400).json({ success: false, message: '会话标识不合法' });
        return;
    }

    // 取最近 12 条消息（倒序取再正序拼），让标题能跟上对话主题的转移，
    // 而不是永远反映会话开头的内容
    const [msgsDesc]: any[] = await pool.execute(
        `SELECT type, content FROM chat_records
         WHERE user_id = ? AND session_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 12`,
        [userId, sessionId]
    );
    const msgs = [...msgsDesc].reverse();

    if (!msgs.length) {
        res.json({ success: true, data: { title: '新对话' } });
        return;
    }

    const transcript = msgs
        .map((m: any) => `${m.type === 'user' ? '用户' : 'AI'}：${String(m.content || '').slice(0, 160)}`)
        .join('\n');

    try {
        const title = await callAI(
            [
                { role: 'system', content: '你是聊天记录标题生成器。根据对话内容生成一个不超过12个字的简短标题，概括对话的主题或情绪。要求：只输出标题文字本身；不要引号、句号或任何修饰；不要使用"对话""聊天"这类空泛词；语气中性客观。' },
                { role: 'user', content: transcript }
            ],
            { temperature: 0.3, maxTokens: 30, timeout: 60000 }
        );

        // 清洗：去引号/换行/首尾空白，超长截断
        const clean = String(title || '')
            .replace(/["'「」『』《》`]/g, '')
            .split('\n')[0]
            .trim()
            .slice(0, 20);

        if (!clean) {
            await fallbackTitle(msgs, userId, sessionId, res);
            return;
        }

        await pool.execute(
            'UPDATE chat_sessions SET title = ? WHERE user_id = ? AND session_id = ?',
            [clean, userId, sessionId]
        );

        res.json({ success: true, data: { title: clean } });
    } catch (e: any) {
        console.error('生成对话标题失败，启用本地兜底:', e.message);
        // AI 不可用时本地兜底：取首条用户消息前 12 字做标题，避免标题一直停留「新对话」
        await fallbackTitle(msgs, userId, sessionId, res);
    }
}));

// 本地兜底标题：AI 总结不可用时，用首条用户消息前 12 字概括（与历史回填同思路）
async function fallbackTitle(msgs: any[], userId: number, sessionId: string, res: Response) {
    const firstUser = msgs.find((m: any) => m.type === 'user');
    const local = String(firstUser?.content || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 12);
    const title = local || '新对话';
    await pool.execute(
        'UPDATE chat_sessions SET title = ? WHERE user_id = ? AND session_id = ?',
        [title, userId, sessionId]
    );
    res.json({ success: true, data: { title, fallback: true } });
}

// ========== 删除会话 ==========
// 锁定中的对话不允许删除，需先解除锁定
router.delete('/chat-sessions/:sessionId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = String(req.params.sessionId || '').trim();

    if (!sessionId || !/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
        res.status(400).json({ success: false, message: '会话标识不合法' });
        return;
    }

    const [sess]: any[] = await pool.execute(
        'SELECT locked FROM chat_sessions WHERE user_id = ? AND session_id = ?',
        [userId, sessionId]
    );

    if (!sess.length) {
        res.status(404).json({ success: false, message: '对话不存在' });
        return;
    }
    if (Number(sess[0].locked) === 1) {
        res.status(403).json({ success: false, message: '对话已锁定，请先解除锁定再删除' });
        return;
    }

    const [result]: any = await pool.execute(
        'DELETE FROM chat_records WHERE user_id = ? AND session_id = ?',
        [userId, sessionId]
    );
    await pool.execute(
        'DELETE FROM chat_sessions WHERE user_id = ? AND session_id = ?',
        [userId, sessionId]
    );

    res.json({
        success: true,
        message: '会话已删除',
        data: { deleted: result.affectedRows || 0 }
    });
}));

// ========== 对话模型管理 ==========
// 用户可添加/删除/选择对话模型：可自带网关地址 + API Key（key AES-256-GCM 加密落库，
// 接口只返回掩码），也可只填模型名走服务端统一副厂网关；未选择时走默认主厂链路
const MODEL_RE = /^[a-zA-Z0-9._\-\/]{1,80}$/;
const BASE_URL_RE = /^https?:\/\/[^\s]{1,190}$/i;
// 网关模型列表内存缓存（5 分钟），避免每次打开面板都打网关
let gwModelsCache: { at: number; ids: string[] } | null = null;

router.get('/chat-models', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // 网关可用模型（未配置副厂时为空数组）
    let available: string[] = [];
    const gw = getFallbackConfig();
    if (gw) {
        if (gwModelsCache && Date.now() - gwModelsCache.at < 5 * 60 * 1000) {
            available = gwModelsCache.ids;
        } else {
            try {
                const axios = require('axios');
                const r = await axios.get(gw.baseURL + '/models', {
                    headers: { Authorization: 'Bearer ' + gw.apiKey },
                    timeout: 10000
                });
                available = (r.data?.data || [])
                    .map((m: any) => String(m.id || ''))
                    .filter((id: string) => MODEL_RE.test(id))
                    .sort();
                gwModelsCache = { at: Date.now(), ids: available };
            } catch (e: any) {
                console.error('[chat-models] 拉取网关模型列表失败:', e.code || e.response?.status || e.message);
                available = gwModelsCache?.ids || [];
            }
        }
    }

    // 用户自定义模型（key 只回掩码，绝不回原文）
    const [rows] = await pool.execute(
        'SELECT model, base_url, api_key, selected FROM user_chat_models WHERE user_id = ? ORDER BY id ASC',
        [userId]
    );
    const custom = (rows as any[]).map(r => {
        let keyHint = '';
        if (r.api_key) {
            try { keyHint = maskSecret(decryptSecret(r.api_key)); } catch { keyHint = '****'; }
        }
        return { model: r.model, base_url: r.base_url || '', key_hint: keyHint, selected: Number(r.selected) === 1 };
    });
    const selected = (custom.find(c => c.selected) || {}).model || null;

    res.json({ success: true, data: { available, custom, selected, gateway_enabled: !!gw } });
}));

// 添加 / 更新自定义模型（同模型名重复提交 = 更新地址与 Key）
// - 填 base_url + api_key：用户自带网关配置（私密，服务端仅解密用于转发）
// - 都留空：走服务端统一副厂网关（需网关已配置）
router.post('/chat-models', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const model = String(req.body?.model || '').trim();
    const baseUrl = String(req.body?.base_url || '').trim().replace(/\/+$/, '');
    const apiKey = String(req.body?.api_key || '').trim();
    // old_model：编辑时允许重命名模型（保留原行的加密 key 与网关配置整体迁移到新名字）
    const oldModel = String(req.body?.old_model || '').trim();

    if (!MODEL_RE.test(model)) {
        res.status(400).json({ success: false, message: '模型名不合法（限字母数字._-/，80 字符内）' });
        return;
    }
    if (baseUrl && !BASE_URL_RE.test(baseUrl)) {
        res.status(400).json({ success: false, message: '网关地址不合法（需 http/https 开头）' });
        return;
    }
    if (apiKey && (apiKey.length < 8 || apiKey.length > 200)) {
        res.status(400).json({ success: false, message: 'API Key 长度需在 8-200 字符之间' });
        return;
    }
    if (Boolean(baseUrl) !== Boolean(apiKey)) {
        res.status(400).json({ success: false, message: '网关地址与 API Key 需同时填写（留空则使用服务端模型网关）' });
        return;
    }
    if (!baseUrl && !getFallbackConfig()) {
        res.status(400).json({ success: false, message: '服务端模型网关未配置，请自带网关地址与 API Key' });
        return;
    }

    // 重命名路径：old_model 存在且不等于新名字时，把原行整体改名（含加密 key）；
    // 若新名字已存在则拒绝，避免覆盖另一条配置
    if (oldModel && MODEL_RE.test(oldModel) && oldModel !== model) {
        const [dup] = (await pool.execute(
            'SELECT id FROM user_chat_models WHERE user_id = ? AND model = ?',
            [userId, model]
        )) as any[];
        if (dup.length) {
            res.status(400).json({ success: false, message: '新模型名已存在，请换一个名字' });
            return;
        }
        await pool.execute(
            'UPDATE user_chat_models SET model = ? WHERE user_id = ? AND model = ?',
            [model, userId, oldModel]
        );
        // 名字变了，地址/Key 也按本次提交更新（key 留空沿用已加密值）
        if (apiKey) {
            await pool.execute(
                'UPDATE user_chat_models SET base_url = ?, api_key = ? WHERE user_id = ? AND model = ?',
                [baseUrl, encryptSecret(apiKey), userId, model]
            );
        } else if (baseUrl) {
            await pool.execute(
                'UPDATE user_chat_models SET base_url = ? WHERE user_id = ? AND model = ?',
                [baseUrl, userId, model]
            );
        }
        res.json({ success: true, message: '模型已更新' });
        return;
    }

    const encrypted = apiKey ? encryptSecret(apiKey) : null;
    // 编辑已有模型且 key 留空时沿用已存加密值（不能写 null 覆盖掉原 key）
    await pool.execute(
        `INSERT INTO user_chat_models (user_id, model, base_url, api_key) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE base_url = VALUES(base_url)${apiKey ? ', api_key = VALUES(api_key)' : ''}`,
        [userId, model, baseUrl, encrypted]
    );
    res.json({ success: true, message: baseUrl ? '模型已保存（自带网关配置）' : '模型已添加（走服务端网关）' });
}));

// 删除自定义模型（若删除的是当前选中模型，则同时清空选择，回到默认链路）
router.delete('/chat-models/:model', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const model = String(req.params.model || '').trim();
    if (!MODEL_RE.test(model)) {
        res.status(400).json({ success: false, message: '模型名不合法' });
        return;
    }
    const [ret]: any = await pool.execute(
        'DELETE FROM user_chat_models WHERE user_id = ? AND model = ?',
        [userId, model]
    );
    // 若删除的是选中模型，清空选择标记（下一次查询 selected 自然为 null）
    if (ret.affectedRows > 0) {
        await pool.execute(
            'UPDATE user_chat_models SET selected = 0 WHERE user_id = ? AND model = ?',
            [userId, model]
        );
    }
    res.json({ success: true, message: '模型已删除' });
}));

// 选择/切换当前对话模型（传空串或 null 表示恢复默认模型）
router.put('/chat-models/select', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const model = req.body?.model == null ? '' : String(req.body.model).trim();

    if (model === '') {
        await pool.execute('UPDATE user_chat_models SET selected = 0 WHERE user_id = ?', [userId]);
        res.json({ success: true, message: '已恢复默认模型', data: { selected: null } });
        return;
    }
    if (!MODEL_RE.test(model)) {
        res.status(400).json({ success: false, message: '模型名不合法' });
        return;
    }
    await pool.execute('UPDATE user_chat_models SET selected = 0 WHERE user_id = ?', [userId]);
    await pool.execute(
        'INSERT IGNORE INTO user_chat_models (user_id, model) VALUES (?, ?)',
        [userId, model]
    );
    await pool.execute(
        'UPDATE user_chat_models SET selected = 1 WHERE user_id = ? AND model = ?',
        [userId, model]
    );
    res.json({ success: true, message: '已切换模型', data: { selected: model } });
}));

// 测试模型连通性（发一条 max_tokens=1 的最小补全请求验证端点+密钥+模型可用）
// - 传 base_url + api_key：测试待保存的表单配置（先测后存）
// - 传 use_saved: true：测试已保存的模型配置（key 解密使用）
// - base_url 留空：测试服务端统一模型网关
router.post('/chat-models/test', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const model = String(req.body?.model || '').trim();
    const baseUrl = String(req.body?.base_url || '').trim().replace(/\/+$/, '');
    const apiKey = String(req.body?.api_key || '').trim();
    const useSaved = Boolean(req.body?.use_saved);

    if (!MODEL_RE.test(model)) {
        res.status(400).json({ success: false, message: '模型名不合法' });
        return;
    }

    let targetURL = baseUrl;
    let targetKey = apiKey;

    if (useSaved) {
        const [rows] = await pool.execute(
            'SELECT base_url, api_key FROM user_chat_models WHERE user_id = ? AND model = ?',
            [userId, model]
        );
        const row = (rows as any[])[0];
        if (!row) {
            res.status(404).json({ success: false, message: '该模型配置不存在' });
            return;
        }
        if (row.base_url && row.api_key) {
            targetURL = String(row.base_url);
            try {
                targetKey = decryptSecret(String(row.api_key));
            } catch {
                res.json({ success: false, message: '密钥解密失败，请编辑重新保存该模型配置' });
                return;
            }
        } else {
            targetURL = '';
            targetKey = '';
        }
    }

    if (!targetURL) {
        const gw = getFallbackConfig();
        if (!gw) {
            res.json({ success: false, message: '该模型未带网关配置，且服务端模型网关未配置' });
            return;
        }
        targetURL = gw.baseURL;
        targetKey = gw.apiKey;
    }

    const axios = require('axios');
    const started = Date.now();
    try {
        await axios.post(
            targetURL + '/chat/completions',
            { model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, stream: false },
            {
                headers: { Authorization: 'Bearer ' + targetKey, 'Content-Type': 'application/json' },
                timeout: 20000,
                validateStatus: null
            }
        ).then((r: any) => {
            if (r.status >= 200 && r.status < 300) return;
            const detail = String(r.data?.error?.message || r.data?.message || '').slice(0, 120);
            const err: any = new Error(`服务返回 ${r.status}${detail ? '：' + detail : ''}`);
            throw err;
        });
        res.json({ success: true, message: '连接成功', latency_ms: Date.now() - started });
    } catch (e: any) {
        const brief = String(e.message || e.code || '连接失败').slice(0, 160);
        res.json({ success: false, message: brief });
    }
}));

// ========== 保存聊天记录 ==========
// session_id 可选：前端为每个对话生成唯一 id，不传时归入 default（旧数据兼容）
router.post('/chat', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { content, type } = req.body;
    const sessionId = String(req.body.session_id || 'default').trim() || 'default';

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
        res.status(400).json({ success: false, message: '会话标识不合法' });
        return;
    }

    const [result] = await pool.execute(
        'INSERT INTO chat_records (user_id, content, type, session_id) VALUES (?, ?, ?, ?)',
        [userId, content, type, sessionId]
    );

    // RAG：消息异步向量化供历史检索（fire-and-forget，不阻塞落库响应）
    void embedChatMessage((result as any).insertId, String(content || ''));

    // 消息入库的同时确保会话行存在并刷新活跃时间（兜底：未经 POST /chat-sessions 创建的会话）
    await pool.execute(
        'INSERT IGNORE INTO chat_sessions (user_id, session_id) VALUES (?, ?)',
        [userId, sessionId]
    );
    await pool.execute(
        'UPDATE chat_sessions SET last_time = CURRENT_TIMESTAMP WHERE user_id = ? AND session_id = ?',
        [userId, sessionId]
    );

    res.json({
        success: true,
        data: { id: (result as any).insertId }
    });
}));

// ========== 删除会话 ==========
router.delete('/chat-sessions/:sessionId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = String(req.params.sessionId || '').trim();

    if (!sessionId || !/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
        res.status(400).json({ success: false, message: '会话标识不合法' });
        return;
    }

    const [result]: any = await pool.execute(
        'DELETE FROM chat_records WHERE user_id = ? AND session_id = ?',
        [userId, sessionId]
    );

    res.json({
        success: true,
        message: '会话已删除',
        data: { deleted: result.affectedRows || 0 }
    });
}));

// ========== 获取心理测评列表 ==========
router.get('/tests', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const [rows] = await pool.execute(
        "SELECT id, code, name, description, category, total_questions, estimated_minutes, scoring_method FROM psychological_tests WHERE status = 1 AND code != 'AI-GEN'"
    );

    res.json({
        success: true,
        data: rows
    });
}));

// ========== 获取专家列表 ==========
router.get('/doctors', authenticate, asyncHandler(async (req: any, res: any) => {
    await ensureDoctorEnColumns();
    await ensureUsersAvatarColumnDropped();
    const [rows] = await pool.execute(
        `SELECT d.id, d.name, d.title, d.specialty, d.intro, d.user_id,
                d.name_en, d.title_en, d.specialty_en, d.intro_en
         FROM doctors d
         WHERE d.status = 1`
    );

    // 头像来自 MinIO（avatar/{userId}.jpg），按专家 user_id 逐一推导
    const doctors = await Promise.all((rows as any[]).map(async (d) => ({
        ...d,
        avatar: d.user_id ? await getAvatarUrl(d.user_id) : ''
    })));

    res.json({
        success: true,
        data: doctors
    });
}));


// ========== 保存分析报告 ==========
router.post('/analysis-report', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { startDate, endDate, content } = req.body;

    const [result] = await pool.execute(
        'INSERT INTO analysis_reports (user_id, start_date, end_date, content) VALUES (?, ?, ?, ?)',
        [userId, startDate, endDate, content]
    );

    res.json({
        success: true,
        data: { id: (result as any).insertId }
    });
}));

// ========== 获取分析报告列表 ==========
router.get('/analysis-reports', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const [rows] = await pool.execute(
        'SELECT id, start_date, end_date, content, created_at FROM analysis_reports WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );
    res.json({ success: true, data: rows });
}));

// ========== 清空用户所有数据 ==========
router.post('/clear-all', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    await pool.execute('DELETE FROM chat_records WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM test_results WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM analysis_reports WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM appointment_records WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM user_memories WHERE user_id = ?', [userId]);

    res.json({
        success: true,
        message: '所有数据已清空'
    });
}));
// ========== 创建预约 ==========
router.post('/appointments', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { doctorId } = req.body;

    // 检查专家是否存在
    const [doctorRows] = await pool.execute(
        'SELECT id FROM doctors WHERE id = ? AND status = 1',
        [doctorId]
    );
    if ((doctorRows as any[]).length === 0) {
        throw new BusinessError('专家不存在', 404);
    }

    // 去重校验：同一用户对同一专家已有进行中（待确认/已确认）的预约时禁止重复创建
    const [dupRows] = await pool.execute(
        `SELECT id FROM appointment_records
         WHERE user_id = ? AND doctor_id = ? AND status IN ('pending', 'confirmed')
         LIMIT 1`,
        [userId, doctorId]
    );
    if ((dupRows as any[]).length > 0) {
        throw new BusinessError('您已有该专家的进行中预约，请勿重复预约', 409);
    }

    // 创建预约
    const [result] = await pool.execute(
        'INSERT INTO appointment_records (user_id, doctor_id, status, created_at) VALUES (?, ?, ?, NOW())',
        [userId, doctorId, 'pending']
    );

    res.json({
        success: true,
        message: '预约成功',
        data: { id: (result as any).insertId }
    });
}));
// ========== 获取我的预约列表 ==========
router.get('/appointments', authenticate, asyncHandler(async (req: Request, res: Response) => {
    await ensureDoctorEnColumns();
    const userId = req.user!.id;
    const [rows] = await pool.execute(
        `SELECT ar.*, d.name as doctor_name, d.title as doctor_title,
                d.name_en as doctor_name_en, d.title_en as doctor_title_en
         FROM appointment_records ar
         JOIN doctors d ON ar.doctor_id = d.id
         WHERE ar.user_id = ?
         ORDER BY ar.created_at DESC`,
        [userId]
    );
    res.json({ success: true, data: rows });
}));

// ========== 取消预约 ==========
router.put('/appointments/:id/cancel', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const appointmentId = req.params.id;

    // 仅待确认/已确认可取消；已拒绝/已完成/已取消不允许再改状态
    const [statusRows] = await pool.execute(
        'SELECT status FROM appointment_records WHERE id = ? AND user_id = ?',
        [appointmentId, userId]
    );
    const current = (statusRows as any[])[0];
    if (!current) {
        throw new BusinessError('预约不存在或无权操作', 404);
    }
    if (!['pending', 'confirmed'].includes(current.status)) {
        throw new BusinessError('当前状态不可取消', 400);
    }

    await pool.execute(
        'UPDATE appointment_records SET status = ? WHERE id = ? AND user_id = ?',
        ['cancelled', appointmentId, userId]
    );

    // Socket.IO 实时广播：专家端列表/详情即时感知用户取消
    const io = req.app.get('io');
    if (io) {
        io.to(`appointment-${appointmentId}`).emit('appointment-updated', {
            appointmentId: parseInt(appointmentId),
            status: 'cancelled',
            updaterId: userId,
            updateTime: new Date().toISOString()
        });

        // 广播给所有在线客户端（接收方按 userId / 预约归属自行过滤）
        io.emit('appointment-list-updated', {
            userId,
            appointmentId: parseInt(appointmentId),
            status: 'cancelled',
            updaterId: userId,
            updateTime: new Date().toISOString()
        });
    }

    res.json({ success: true, message: '预约已取消' });
}));
// 获取当前用户信息（包含头像 URL，头像存储于 MinIO）
router.get('/info', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    await ensureUsersAvatarColumnDropped();

    const [rows] = await pool.execute(
        'SELECT id, username, email, phone, role, created_at FROM users WHERE id = ?',
        [userId]
    );

    const user = (rows as any[])[0];
    if (!user) {
        throw new BusinessError('用户不存在', 404);
    }

    res.json({ success: true, data: { ...user, avatar: await getAvatarUrl(userId) } });
}));

// 修改头像（dataURL → MinIO 对象存储，数据库不落任何头像数据）
router.put('/avatar', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const { avatarPath, avatar } = req.body;
    const dataUrl = avatar || avatarPath;

    if (!dataUrl) {
        throw new BusinessError('头像数据不能为空', 400);
    }
    await ensureUsersAvatarColumnDropped();

    const url = await uploadAvatarFromDataUrl(userId, dataUrl);
    res.json({ success: true, message: '头像修改成功', data: { avatar: url } });
}));

// 获取用户完整信息（包含头像 URL，头像存储于 MinIO）
router.get('/profile', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    await ensureUsersAvatarColumnDropped();

    const [rows] = await pool.execute(
        'SELECT id, username, email, phone, role FROM users WHERE id = ?',
        [userId]
    );

    const user = (rows as any[])[0];
    if (!user) {
        throw new BusinessError('用户不存在', 404);
    }

    res.json({ success: true, data: { ...user, avatar: await getAvatarUrl(userId) } });
}));

// ========== 举报聊天消息 ==========
// 举报人必须为该预约的参与方；被举报消息须属于该预约且发送者为「对方」（不能举报自己）
router.post('/reports', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const reporterId = req.user!.id;
    const { appointment_id, message_ids, reason, detail } = req.body || {};

    const ids: number[] = Array.isArray(message_ids)
        ? message_ids.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
        : [];
    if (!appointment_id || ids.length === 0) {
        throw new BusinessError('请先选择要举报的聊天消息', 400);
    }
    const reasonText = String(reason || '').trim();
    if (!reasonText) {
        throw new BusinessError('请选择举报理由', 400);
    }
    const detailText = String(detail || '').trim().slice(0, 500);

    // 归属校验：举报人必须是预约参与方
    const [partRows] = await pool.execute(
        `SELECT ar.user_id, d.user_id AS doctor_user_id
         FROM appointment_records ar JOIN doctors d ON ar.doctor_id = d.id
         WHERE ar.id = ?`,
        [appointment_id]
    );
    const part = (partRows as any[])[0];
    if (!part || (Number(part.user_id) !== reporterId && Number(part.doctor_user_id) !== reporterId)) {
        throw new BusinessError('无权举报该预约下的消息', 403);
    }

    // 被举报人 = 预约对方；消息必须属于该预约且由对方发送
    const reportedId = Number(part.user_id) === reporterId
        ? Number(part.doctor_user_id)
        : Number(part.user_id);
    const placeholders = ids.map(() => '?').join(',');
    const [msgRows] = await pool.execute(
        `SELECT id FROM expert_chat
         WHERE id IN (${placeholders}) AND appointment_id = ? AND sender_id = ?`,
        [...ids, appointment_id, reportedId]
    );
    const validIds = (msgRows as any[]).map((r: any) => Number(r.id));
    if (validIds.length === 0) {
        throw new BusinessError('所选消息不存在或不可举报', 400);
    }

    const [result] = await pool.execute(
        `INSERT INTO chat_reports (reporter_id, reported_id, appointment_id, message_ids, reason, detail, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
        [reporterId, reportedId, appointment_id, JSON.stringify(validIds), reasonText, detailText]
    );

    res.json({
        success: true,
        message: '举报已提交，管理员会尽快核实处理',
        data: { id: (result as any).insertId, count: validIds.length }
    });
}));


export default router;
