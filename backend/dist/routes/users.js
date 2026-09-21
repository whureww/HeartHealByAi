"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mysql_1 = require("../db/mysql");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const error_2 = require("../middleware/error");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const redis_1 = __importDefault(require("../db/redis"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tokenManager_1 = require("../utils/tokenManager");
const router = (0, express_1.Router)();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const CODE_EXPIRY = 600;
const RATE_LIMIT_SECONDS = 60;
const transporter = nodemailer_1.default.createTransport({
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
// Schema定义
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(2, { message: "用户名至少2个字符" }),
    email: zod_1.z.string().email({ message: "请输入有效的邮箱地址" }),
    password: zod_1.z.string().min(6, { message: "密码至少6个字符" }),
    code: zod_1.z.string().length(6, { message: "验证码必须是6位数字" }),
    phone: zod_1.z.string().regex(/^1[3-9]\d{9}$/, { message: "请输入有效的手机号" }).optional()
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email({ message: "请输入有效的邮箱地址" }),
    password: zod_1.z.string({ required_error: "密码不能为空" })
});
const updateProfileSchema = zod_1.z.object({
    username: zod_1.z.string().min(2).optional(),
    avatar: zod_1.z.string().url().optional(),
    phone: zod_1.z.string().regex(/^1[3-9]\d{9}$/).optional()
});
const sendCodeSchema = zod_1.z.object({
    email: zod_1.z.string().email({ message: "请输入有效的邮箱地址" })
});
const resetSchema = zod_1.z.object({
    email: zod_1.z.string().email({ message: "请输入有效的邮箱地址" }),
    code: zod_1.z.string().length(6, { message: "验证码必须是6位数字" }),
    newPassword: zod_1.z.string().min(6, { message: "密码至少6个字符" })
});
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, BCRYPT_ROUNDS);
}
async function verifyPassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
async function checkRateLimit(key, windowSeconds) {
    const result = await redis_1.default.set(key, '1', { NX: true, EX: windowSeconds });
    if (result === null) {
        throw new error_2.BusinessError('请求过于频繁，请稍后再试', 429);
    }
}
// ========== 发送注册验证码 ==========
router.post('/register/send-code', (0, error_1.asyncHandler)(async (req, res) => {
    const { email } = sendCodeSchema.parse(req.body);
    const [rows] = await mysql_1.pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
        throw new error_2.BusinessError('邮箱已被注册', 400);
    }
    await checkRateLimit(`rate_limit:register_code:${email}`, RATE_LIMIT_SECONDS);
    const existingCode = await redis_1.default.get(`register:${email}`);
    if (existingCode) {
        return res.json({
            success: true,
            message: '验证码已发送，请检查邮箱'
        });
    }
    const code = (0, crypto_1.randomInt)(100000, 999999).toString();
    if (MAIL_DEV_MODE) {
        // 开发模式：不发真实邮件，验证码打印到后端日志
        console.log(`[邮件开发模式] 注册验证码 -> ${email}: ${code}`);
        await redis_1.default.set(`register:${email}`, code, { EX: CODE_EXPIRY });
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
        await redis_1.default.set(`register:${email}`, code, { EX: CODE_EXPIRY });
        res.json({
            success: true,
            message: '验证码已发送至邮箱'
        });
    }
    catch (err) {
        console.error('Send email failed:', err);
        throw new error_2.BusinessError('邮件发送失败，请稍后重试', 500);
    }
}));
// ========== 注册 ==========
router.post('/register', (0, error_1.asyncHandler)(async (req, res) => {
    const { username, email, password, code, phone } = registerSchema.parse(req.body);
    // 安全修复：角色由服务端固定为普通用户，管理员只能通过数据库手动提升
    const role = 1;
    const storedCode = await redis_1.default.get(`register:${email}`);
    if (!storedCode || storedCode !== code) {
        throw new error_2.BusinessError('验证码错误或已过期', 400);
    }
    const [emailExists] = await mysql_1.pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (emailExists.length > 0) {
        throw new error_2.BusinessError('邮箱已被注册', 400);
    }
    if (phone) {
        const [phoneExists] = await mysql_1.pool.execute('SELECT id FROM users WHERE phone = ?', [phone]);
        if (phoneExists.length > 0) {
            throw new error_2.BusinessError('手机号已被注册', 400);
        }
    }
    const [nameExists] = await mysql_1.pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (nameExists.length > 0) {
        throw new error_2.BusinessError('用户名已被使用', 400);
    }
    const hashedPwd = await hashPassword(password);
    const [result] = await mysql_1.pool.execute('INSERT INTO users (username, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)', [username, email, hashedPwd, role, phone || null]);
    const userId = result.insertId;
    const onlyId = tokenManager_1.TokenManager.generateOnlyId();
    const token = (0, auth_1.generateToken)(userId, onlyId);
    await tokenManager_1.TokenManager.saveToken(userId, token, onlyId);
    res.json({
        success: true,
        message: '注册成功',
        data: { token, onlyId, userId, role }
    });
}));
// ========== 登录 ==========
router.post('/login', (0, error_1.asyncHandler)(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const [rows] = await mysql_1.pool.execute('SELECT id, password_hash, role, username, email, phone, avatar FROM users WHERE email = ?', [email]);
    const users = rows;
    if (users.length === 0) {
        throw new error_2.BusinessError('邮箱或密码错误', 401);
    }
    const user = users[0];
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
        throw new error_2.BusinessError('邮箱或密码错误', 401);
    }
    const onlyId = tokenManager_1.TokenManager.generateOnlyId();
    const token = (0, auth_1.generateToken)(user.id, onlyId);
    await tokenManager_1.TokenManager.saveToken(user.id, token, onlyId);
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
router.put('/profile', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { username, avatar } = req.body;
    const fields = [];
    const values = [];
    // 修改昵称
    if (username !== undefined) {
        if (username.trim().length < 2 || username.trim().length > 20) {
            throw new error_2.BusinessError('昵称长度需在2-20个字符之间', 400);
        }
        const [existRows] = await mysql_1.pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username.trim(), userId]);
        if (existRows.length > 0) {
            throw new error_2.BusinessError('该昵称已被使用', 400);
        }
        fields.push('username = ?');
        values.push(username.trim());
    }
    // 修改头像（base64 字符串）
    if (avatar !== undefined) {
        // 简单校验：必须是 base64 图片格式
        if (avatar && !avatar.startsWith('data:image/')) {
            throw new error_2.BusinessError('头像格式错误', 400);
        }
        fields.push('avatar = ?');
        values.push(avatar || null);
    }
    if (fields.length === 0) {
        throw new error_2.BusinessError('没有要更新的字段', 400);
    }
    values.push(userId);
    await mysql_1.pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: '个人信息更新成功' });
}));
// ========== 获取用户信息（包含头像）==========
router.get('/me', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [rows] = await mysql_1.pool.execute('SELECT id, username, email, phone, role, avatar, created_at FROM users WHERE id = ?', [userId]);
    const user = rows[0];
    if (!user) {
        throw new error_2.BusinessError('用户不存在', 404);
    }
    res.json({ success: true, data: user });
}));
// ========== 退出登录 ==========
// 在 users.ts 中添加或修改 logout 路由
router.post('/logout', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
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
router.post('/refresh-token', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const oldToken = req.headers.authorization?.slice(7);
    const [rows] = await mysql_1.pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
    const users = rows;
    if (users.length === 0) {
        throw new error_2.BusinessError('用户不存在', 404);
    }
    const newOnlyId = tokenManager_1.TokenManager.generateOnlyId();
    const newToken = (0, auth_1.generateToken)(userId, newOnlyId);
    if (oldToken) {
        const decoded = jsonwebtoken_1.default.decode(oldToken);
        if (decoded?.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await tokenManager_1.TokenManager.blacklistToken(oldToken, ttl);
            }
        }
    }
    await tokenManager_1.TokenManager.saveToken(userId, newToken, newOnlyId);
    res.json({
        success: true,
        message: 'Token刷新成功',
        data: { token: newToken, onlyId: newOnlyId, userId, role: users[0].role }
    });
}));
// ========== 发送找回密码验证码 ==========
router.post('/forget-password/send-code', (0, error_1.asyncHandler)(async (req, res) => {
    const { email } = sendCodeSchema.parse(req.body);
    await checkRateLimit(`rate_limit:send_code:${email}`, RATE_LIMIT_SECONDS);
    const [rows] = await mysql_1.pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
        return res.json({
            success: true,
            message: '如果该邮箱已注册，验证码将发送至您的邮箱'
        });
    }
    const existingCode = await redis_1.default.get(`forget:${email}`);
    if (existingCode) {
        return res.json({
            success: true,
            message: '验证码已发送，请检查邮箱'
        });
    }
    const code = (0, crypto_1.randomInt)(100000, 999999).toString();
    if (MAIL_DEV_MODE) {
        // 开发模式：不发真实邮件，验证码打印到后端日志
        console.log(`[邮件开发模式] 找回密码验证码 -> ${email}: ${code}`);
        await redis_1.default.set(`forget:${email}`, code, { EX: CODE_EXPIRY });
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
        await redis_1.default.set(`forget:${email}`, code, { EX: CODE_EXPIRY });
        res.json({
            success: true,
            message: '验证码已发送至邮箱'
        });
    }
    catch (err) {
        console.error('Send email failed:', err);
        throw new error_2.BusinessError('邮件发送失败，请稍后重试', 500);
    }
}));
// ========== 重置密码 ==========
router.post('/forget-password/reset', (0, error_1.asyncHandler)(async (req, res) => {
    const { email, code, newPassword } = resetSchema.parse(req.body);
    const stored = await redis_1.default.get(`forget:${email}`);
    if (!stored || stored !== code) {
        throw new error_2.BusinessError('验证码错误或已过期', 400);
    }
    const [rows] = await mysql_1.pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    const users = rows;
    const hashedPwd = await hashPassword(newPassword);
    await mysql_1.pool.execute('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPwd, email]);
    await redis_1.default.del(`forget:${email}`);
    if (users.length > 0) {
        const userId = users[0].id;
        await redis_1.default.set(`password_changed:${userId}`, Date.now().toString());
        const oldOnlyId = await tokenManager_1.TokenManager.getOnlyId(userId);
        if (oldOnlyId) {
            await redis_1.default.del(`onlyid_token:${oldOnlyId}`);
        }
        await redis_1.default.del(`user_onlyid:${userId}`);
    }
    res.json({
        success: true,
        message: '密码重置成功，请使用新密码重新登录'
    });
}));
// ========== 获取用户统计数据 ==========
router.get('/stats', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [chatRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM chat_records WHERE user_id = ?', [userId]);
    const [testRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM test_results WHERE user_id = ?', [userId]);
    const [doctorRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM appointment_records WHERE user_id = ?', [userId]);
    const [reportRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM analysis_reports WHERE user_id = ?', [userId]);
    res.json({
        success: true,
        data: {
            chatCount: chatRows[0].count,
            testCount: testRows[0].count,
            doctorCount: doctorRows[0].count,
            reportCount: reportRows[0].count
        }
    });
}));
// ========== 获取聊天记录 ==========
router.get('/chat-history', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [rows] = await mysql_1.pool.execute('SELECT id, content, type, created_at FROM chat_records WHERE user_id = ? ORDER BY created_at ASC', [userId]);
    res.json({
        success: true,
        data: rows
    });
}));
// ========== 保存聊天记录 ==========
router.post('/chat', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { content, type } = req.body;
    const [result] = await mysql_1.pool.execute('INSERT INTO chat_records (user_id, content, type) VALUES (?, ?, ?)', [userId, content, type]);
    res.json({
        success: true,
        data: { id: result.insertId }
    });
}));
// ========== 获取心理测评列表 ==========
router.get('/tests', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const [rows] = await mysql_1.pool.execute('SELECT id, code, name, description, category, total_questions, estimated_minutes, scoring_method FROM psychological_tests WHERE status = 1');
    res.json({
        success: true,
        data: rows
    });
}));
// ========== 获取专家列表 ==========
router.get('/doctors', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const [rows] = await mysql_1.pool.execute(`SELECT d.id, d.name, d.title, d.specialty, d.user_id 
         FROM doctors d 
         WHERE d.status = 1`);
    res.json({
        success: true,
        data: rows
    });
}));
// ========== 保存分析报告 ==========
router.post('/analysis-report', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate, content } = req.body;
    const [result] = await mysql_1.pool.execute('INSERT INTO analysis_reports (user_id, start_date, end_date, content) VALUES (?, ?, ?, ?)', [userId, startDate, endDate, content]);
    res.json({
        success: true,
        data: { id: result.insertId }
    });
}));
// ========== 清空用户所有数据 ==========
router.post('/clear-all', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    await mysql_1.pool.execute('DELETE FROM chat_records WHERE user_id = ?', [userId]);
    await mysql_1.pool.execute('DELETE FROM test_results WHERE user_id = ?', [userId]);
    await mysql_1.pool.execute('DELETE FROM analysis_reports WHERE user_id = ?', [userId]);
    await mysql_1.pool.execute('DELETE FROM appointment_records WHERE user_id = ?', [userId]);
    res.json({
        success: true,
        message: '所有数据已清空'
    });
}));
// ========== 创建预约 ==========
router.post('/appointments', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { doctorId } = req.body;
    // 检查专家是否存在
    const [doctorRows] = await mysql_1.pool.execute('SELECT id FROM doctors WHERE id = ? AND status = 1', [doctorId]);
    if (doctorRows.length === 0) {
        throw new error_2.BusinessError('专家不存在', 404);
    }
    // 创建预约
    const [result] = await mysql_1.pool.execute('INSERT INTO appointment_records (user_id, doctor_id, status, created_at) VALUES (?, ?, ?, NOW())', [userId, doctorId, 'pending']);
    res.json({
        success: true,
        message: '预约成功',
        data: { id: result.insertId }
    });
}));
// ========== 获取我的预约列表 ==========
router.get('/appointments', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [rows] = await mysql_1.pool.execute(`SELECT ar.*, d.name as doctor_name, d.title as doctor_title
         FROM appointment_records ar
         JOIN doctors d ON ar.doctor_id = d.id
         WHERE ar.user_id = ?
         ORDER BY ar.created_at DESC`, [userId]);
    res.json({ success: true, data: rows });
}));
// ========== 取消预约 ==========
router.put('/appointments/:id/cancel', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const appointmentId = req.params.id;
    await mysql_1.pool.execute('UPDATE appointment_records SET status = ? WHERE id = ? AND user_id = ?', ['cancelled', appointmentId, userId]);
    res.json({ success: true, message: '预约已取消' });
}));
// 获取当前用户信息（包含头像路径）
router.get('/info', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [rows] = await mysql_1.pool.execute('SELECT id, username, email, phone, avatar, role, created_at FROM users WHERE id = ?', [userId]);
    const user = rows[0];
    if (!user) {
        throw new error_2.BusinessError('用户不存在', 404);
    }
    res.json({ success: true, data: user });
}));
// 修改头像（只存路径到数据库）
router.put('/avatar', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { avatarPath } = req.body;
    if (!avatarPath) {
        throw new error_2.BusinessError('头像路径不能为空', 400);
    }
    await mysql_1.pool.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, userId]);
    res.json({ success: true, message: '头像修改成功', data: { avatar: avatarPath } });
}));
// 获取用户完整信息（包含头像路径）
router.get('/profile', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [rows] = await mysql_1.pool.execute('SELECT id, username, email, phone, avatar, role FROM users WHERE id = ?', [userId]);
    const user = rows[0];
    if (!user) {
        throw new error_2.BusinessError('用户不存在', 404);
    }
    res.json({ success: true, data: user });
}));
exports.default = router;
