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

    const [rows] = await pool.execute(
        'SELECT id, password_hash, role, username, email, phone, avatar FROM users WHERE email = ?',
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
                avatar: user.avatar,
                role: user.role
            }
        }
    });
}));


// ========== 修改用户信息（昵称 + 头像base64）==========
router.put('/profile', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const { username, avatar } = req.body;
    
    const fields: string[] = [];
    const values: any[] = [];

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

    // 修改头像（base64 字符串）
    if (avatar !== undefined) {
        // 简单校验：必须是 base64 图片格式
        if (avatar && !avatar.startsWith('data:image/')) {
            throw new BusinessError('头像格式错误', 400);
        }
        fields.push('avatar = ?');
        values.push(avatar || null);
    }

    if (fields.length === 0) {
        throw new BusinessError('没有要更新的字段', 400);
    }

    values.push(userId);
    await pool.execute(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
    );

    res.json({ success: true, message: '个人信息更新成功' });
}));

// ========== 获取用户信息（包含头像）==========
router.get('/me', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    
    const [rows] = await pool.execute(
        'SELECT id, username, email, phone, role, avatar, created_at FROM users WHERE id = ?',
        [userId]
    );
    
    const user = (rows as any[])[0];
    if (!user) {
        throw new BusinessError('用户不存在', 404);
    }
    
    res.json({ success: true, data: user });
}));


// ========== 退出登录 ==========
// 在 users.ts 中添加或修改 logout 路由
router.post('/logout', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    
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
router.get('/chat-history', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [rows] = await pool.execute(
        'SELECT id, content, type, created_at FROM chat_records WHERE user_id = ? ORDER BY created_at ASC',
        [userId]
    );

    res.json({
        success: true,
        data: rows
    });
}));

// ========== 保存聊天记录 ==========
router.post('/chat', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { content, type } = req.body;

    const [result] = await pool.execute(
        'INSERT INTO chat_records (user_id, content, type) VALUES (?, ?, ?)',
        [userId, content, type]
    );

    res.json({
        success: true,
        data: { id: (result as any).insertId }
    });
}));

// ========== 获取心理测评列表 ==========
router.get('/tests', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const [rows] = await pool.execute(
        'SELECT id, code, name, description, category, total_questions, estimated_minutes, scoring_method FROM psychological_tests WHERE status = 1'
    );

    res.json({
        success: true,
        data: rows
    });
}));

// ========== 获取专家列表 ==========
router.get('/doctors', authenticate, asyncHandler(async (req: any, res: any) => {
    const [rows] = await pool.execute(
        `SELECT d.id, d.name, d.title, d.specialty, d.user_id 
         FROM doctors d 
         WHERE d.status = 1`
    );
    
    res.json({
        success: true,
        data: rows
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

// ========== 清空用户所有数据 ==========
router.post('/clear-all', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    await pool.execute('DELETE FROM chat_records WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM test_results WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM analysis_reports WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM appointment_records WHERE user_id = ?', [userId]);

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
    const userId = req.user!.id;
    const [rows] = await pool.execute(
        `SELECT ar.*, d.name as doctor_name, d.title as doctor_title
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
// 获取当前用户信息（包含头像路径）
router.get('/info', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    
    const [rows] = await pool.execute(
        'SELECT id, username, email, phone, avatar, role, created_at FROM users WHERE id = ?',
        [userId]
    );
    
    const user = (rows as any[])[0];
    if (!user) {
        throw new BusinessError('用户不存在', 404);
    }
    
    res.json({ success: true, data: user });
}));

// 修改头像（只存路径到数据库）
router.put('/avatar', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const { avatarPath } = req.body;
    
    if (!avatarPath) {
        throw new BusinessError('头像路径不能为空', 400);
    }
    
    await pool.execute(
        'UPDATE users SET avatar = ? WHERE id = ?',
        [avatarPath, userId]
    );
    
    res.json({ success: true, message: '头像修改成功', data: { avatar: avatarPath } });
}));

// 获取用户完整信息（包含头像路径）
router.get('/profile', authenticate, asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    
    const [rows] = await pool.execute(
        'SELECT id, username, email, phone, avatar, role FROM users WHERE id = ?',
        [userId]
    );
    
    const user = (rows as any[])[0];
    if (!user) {
        throw new BusinessError('用户不存在', 404);
    }
    
    res.json({ success: true, data: user });
}));


export default router;
