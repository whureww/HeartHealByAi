import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';
import { invalidateWords } from '../utils/moderation';

const router = Router();

// 校验是否是管理员
const requireAdmin = asyncHandler(async (req: Request, res: Response, next: any) => {
    if (req.user!.role !== 3) {
        throw new BusinessError('仅管理员可执行此操作', 403);
    }
    next();
});

// ========== 用户管理 ==========

// routes/admin.ts - 获取用户列表
router.get('/users', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const keyword = req.query.keyword as string || '';
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    let params: any[] = [];

    if (keyword) {
        whereClause = ' WHERE username LIKE ? OR email LIKE ? OR phone LIKE ?';
        params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];
    }

    // 计数查询 - 使用 query 而非 execute（规避 Bun + mysql2 的兼容问题）
    const countSql = `SELECT COUNT(*) as total FROM users${whereClause}`;
    const [countRows] = await pool.query(countSql, params);
    const total = (countRows as any[])[0].total;

    // 查询列表 - LIMIT 与 OFFSET 转换为数字传入
    const sql = `SELECT id, username, email, phone, role, avatar, created_at FROM users${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, Number(pageSize), Number(offset)];
    
    const [rows] = await pool.query(sql, queryParams);

    res.json({
        success: true,
        data: {
            list: rows,
            total,
            page,
            pageSize
        }
    });
}));


// 修改用户角色
router.put('/users/:id/role', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (![1, 2, 3].includes(role)) {
        throw new BusinessError('无效的角色', 400);
    }

    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    res.json({ success: true, message: '角色修改成功' });
}));
// admin.ts - 平台统计（口径与后台各管理页一致）
router.get('/stats', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    try {
        // 注册用户 = 全部账号（与「用户管理」页总数一致，含专家与管理员）
        const [userRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM users'
        );

        // 入驻专家 = 上架中的专家名片（与「名片审核」页有效专家一致；0 下架 / 1 上架 / 2 待审核）
        const [expertRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM doctors WHERE status = 1'
        );

        // 总预约数 = 全部预约记录（与「预约管理」页列表一致）
        const [appointmentRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM appointment_records'
        );

        const [testRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM test_results'
        );

        res.json({
            success: true,
            data: {
                totalUsers: (userRows as any[])[0]?.count || 0,
                totalExperts: (expertRows as any[])[0]?.count || 0,
                totalAppointments: (appointmentRows as any[])[0]?.count || 0,
                totalTests: (testRows as any[])[0]?.count || 0
            }
        });

    } catch (error: any) {
        console.error('获取平台统计失败:', error);
        res.status(500).json({ error: '获取统计失败' });
    }
}));


// ========== 问卷管理 ==========

// 获取问卷列表（status 未传时返回全部）
router.get('/tests', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string;
    
    let sql = 'SELECT * FROM psychological_tests';
    const params: any[] = [];
    
    if (status !== undefined) {
        sql += ' WHERE status = ?';
        params.push(parseInt(status));
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, data: rows });
}));

// 新建问卷
router.post('/tests', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const {
        code, name, description, category,
        total_questions, estimated_minutes,
        scoring_method, result_levels, questions
    } = req.body;

    // 创建问卷
    const [testResult] = await pool.execute(
        `INSERT INTO psychological_tests
         (code, name, description, category, total_questions, estimated_minutes, scoring_method, result_levels, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,  // 默认状态为0（未上架）
        [code, name, description, category, total_questions, estimated_minutes, scoring_method, JSON.stringify(result_levels)]
    );

    const testId = (testResult as any).insertId;

    // 写入题目
    if (questions && questions.length > 0) {
        for (const q of questions) {
            await pool.execute(
                `INSERT INTO test_questions 
                 (test_id, question_number, content, dimension, reverse_scoring, options)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [testId, q.question_number, q.content, q.dimension, q.reverse_scoring ? 1 : 0, JSON.stringify(q.options)]
            );
        }
    }

    res.json({ success: true, message: '问卷创建成功，默认未上架', data: { id: testId } });
}));

// 设置问卷状态（上架 / 下架）
router.put('/tests/:id/status', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const testId = parseInt(req.params.id);
    const { status } = req.body;  // 0=未上架, 1=已上架, 2=已下架

    if (![0, 1, 2].includes(status)) {
        throw new BusinessError('无效的状态', 400);
    }

    await pool.execute('UPDATE psychological_tests SET status = ? WHERE id = ?', [status, testId]);

    const statusText = { 0: '未上架', 1: '已上架', 2: '已下架' };
    res.json({ success: true, message: `问卷已${statusText[status as keyof typeof statusText]}` });
}));

// 删除问卷
router.delete('/tests/:id', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const testId = parseInt(req.params.id);

    await pool.execute('DELETE FROM test_questions WHERE test_id = ?', [testId]);
    await pool.execute('DELETE FROM psychological_tests WHERE id = ?', [testId]);

    res.json({ success: true, message: '问卷已删除' });
}));
// ========== 平台预约 ==========
router.get('/appointments', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const [rows] = await pool.execute(
        `SELECT ar.*, u.username as user_name, u.email as user_email,
                d.name as doctor_name, d.title as doctor_title
         FROM appointment_records ar
         JOIN users u ON ar.user_id = u.id
         JOIN doctors d ON ar.doctor_id = d.id
         ORDER BY ar.created_at DESC`
    );
    res.json({ success: true, data: rows });
}));

// ========== 新增用户（管理员创建，无需邮箱验证码） ==========
router.post('/users', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, role, phone } = req.body;

    if (!username || !email || !password) {
        throw new BusinessError('用户名、邮箱、密码不能为空', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BusinessError('邮箱格式不正确', 400);
    }
    if (String(password).length < 6) {
        throw new BusinessError('密码至少 6 位', 400);
    }
    const validRole = [1, 2, 3].includes(Number(role)) ? Number(role) : 1;

    const [dup] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if ((dup as any[]).length > 0) {
        throw new BusinessError('该邮箱已被注册', 409);
    }

    const hashed = await bcrypt.hash(String(password), 12);
    const [result] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
        [username, email, hashed, validRole, phone || null]
    );

    // 专家账号：同步创建名片记录（默认下架状态），专家登录后编辑名片并提交管理员审核，通过后才显示在专家列表
    if (validRole === 2) {
        const newUserId = (result as any).insertId;
        await pool.execute(
            'INSERT INTO doctors (name, title, specialty, intro, user_id, status) VALUES (?, ?, ?, ?, ?, 0)',
            [username, '', '', '', newUserId]
        );
    }

    res.json({ success: true, message: validRole === 2 ? '专家账号创建成功，名片待本人完善并提交审核后上架' : '用户创建成功' });
}));

// ========== 删除用户（连带清理其业务数据） ==========
router.delete('/users/:id', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (userId === req.user!.id) {
        throw new BusinessError('不能删除当前登录的账号', 400);
    }

    const [exists] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if ((exists as any[]).length === 0) {
        throw new BusinessError('用户不存在', 404);
    }

    // 清理关联数据（schema 无外键约束，需手动删）
    await pool.execute('DELETE FROM appointment_records WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM test_results WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM chat_records WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM analysis_reports WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM expert_chat WHERE sender_id = ? OR receiver_id = ?', [userId, userId]);
    await pool.execute('DELETE FROM user_oauth WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM doctors WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true, message: '用户及其关联数据已删除' });
}));

// ========== 专家名片审核：列表（含全部状态，供管理员管理上下架） ==========
router.get('/doctor-cards', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const [rows] = await pool.execute(
        `SELECT d.id, d.name, d.title, d.specialty, d.intro, d.status, d.created_at,
                u.email AS user_email
         FROM doctors d
         LEFT JOIN users u ON d.user_id = u.id
         ORDER BY CASE d.status WHEN 2 THEN 0 WHEN 0 THEN 1 ELSE 2 END, d.created_at DESC`
    );
    res.json({ success: true, data: rows });
}));

// ========== 专家名片审核：通过(上架)/拒绝(下架) ==========
router.put('/doctor-cards/:id/review', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const cardId = parseInt(req.params.id);
    const { action } = req.body; // approve | reject

    if (!['approve', 'reject'].includes(action)) {
        throw new BusinessError('无效的审核操作', 400);
    }

    const [rows] = await pool.execute('SELECT id, status FROM doctors WHERE id = ?', [cardId]);
    const card = (rows as any[])[0];
    if (!card) {
        throw new BusinessError('名片不存在', 404);
    }

    const newStatus = action === 'approve' ? 1 : 0;
    await pool.execute('UPDATE doctors SET status = ? WHERE id = ?', [newStatus, cardId]);

    // Socket.IO 实时广播：名片上下架后所有在线客户端刷新专家列表
    const io = req.app.get('io');
    if (io) {
        io.emit('doctor-list-updated', {
            doctorId: cardId,
            status: newStatus,
            updateTime: new Date().toISOString()
        });
    }

    res.json({
        success: true,
        message: action === 'approve' ? '已通过，名片已上架专家列表' : '已拒绝，名片保持下架状态'
    });
}));

// ========== 新增预约（管理员代建） ==========
router.post('/appointments', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { user_id, doctor_id, status } = req.body;

    const userId = parseInt(user_id);
    const doctorId = parseInt(doctor_id);
    if (!userId || !doctorId) {
        throw new BusinessError('请选择用户和专家', 400);
    }
    const validStatus = ['pending', 'confirmed', 'completed', 'cancelled'].includes(status) ? status : 'pending';

    const [u] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if ((u as any[]).length === 0) throw new BusinessError('用户不存在', 404);
    const [d] = await pool.execute('SELECT id FROM doctors WHERE id = ?', [doctorId]);
    if ((d as any[]).length === 0) throw new BusinessError('专家不存在', 404);

    const [r] = await pool.execute(
        'INSERT INTO appointment_records (user_id, doctor_id, status) VALUES (?, ?, ?)',
        [userId, doctorId, validStatus]
    );
    res.json({ success: true, message: '预约创建成功', data: { id: (r as any).insertId } });
}));

// ========== 删除预约 ==========
router.delete('/appointments/:id', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [r] = await pool.execute('DELETE FROM appointment_records WHERE id = ?', [id]);
    if ((r as any).affectedRows === 0) {
        throw new BusinessError('预约记录不存在', 404);
    }
    res.json({ success: true, message: '预约记录已删除' });
}));

// ========== 敏感词库管理（聊天审核词库，实时生效） ==========
router.get('/sensitive-words', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const [rows] = await pool.execute(
        'SELECT id, word, category, is_short, created_at FROM sensitive_words ORDER BY id DESC'
    );
    res.json({ success: true, data: rows });
}));

router.post('/sensitive-words', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { word, category, is_short } = req.body;
    const w = String(word || '').trim();
    if (!w || w.length > 64) {
        throw new BusinessError('敏感词不能为空且不超过 64 字', 400);
    }
    const cat = ['侮辱', '色情', '违禁', '自伤', '缩写', '其他'].includes(category) ? category : '其他';
    const short = is_short ? 1 : 0;
    try {
        const [r] = await pool.execute(
            'INSERT INTO sensitive_words (word, category, is_short) VALUES (?, ?, ?)',
            [w, cat, short]
        );
        invalidateWords();
        res.json({ success: true, message: '敏感词已添加并即时生效', data: { id: (r as any).insertId } });
    } catch (e: any) {
        if (e && e.code === 'ER_DUP_ENTRY') {
            throw new BusinessError('该敏感词已存在', 400);
        }
        throw e;
    }
}));

router.delete('/sensitive-words/:id', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const [r] = await pool.execute('DELETE FROM sensitive_words WHERE id = ?', [id]);
    if ((r as any).affectedRows === 0) {
        throw new BusinessError('敏感词不存在', 404);
    }
    invalidateWords();
    res.json({ success: true, message: '敏感词已删除并即时生效' });
}));

export default router;
