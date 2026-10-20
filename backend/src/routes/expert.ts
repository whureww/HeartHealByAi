import { Router } from 'express';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';
import { isAppointmentParticipant } from '../utils/guards';
import { ensureDoctorEnColumns } from '../utils/doctorCols';
import { ensureTestCreatedByColumn } from '../utils/testCols';

const router = Router();

const requireExpert = asyncHandler(async (req: any, res: any, next: any) => {
    if (req.user!.role !== 2) {
        throw new BusinessError('无权访问，需要专家权限', 403);
    }
    next();
});

// ========== doctors 表英文列懒迁移见 utils/doctorCols.ts（双语名片：英文界面优先显示 _en 字段，留空回落中文） ==========

// ========== 专家名片：读取我的名片 ==========
router.get('/my-card', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    await ensureDoctorEnColumns();
    const expertUserId = req.user.id;
    const [rows] = await pool.execute(
        'SELECT id, name, title, specialty, intro, name_en, title_en, specialty_en, intro_en, status FROM doctors WHERE user_id = ?',
        [expertUserId]
    );
    const card = (rows as any[])[0] || null;
    res.json({ success: true, data: card });
}));

// ========== 专家名片：保存并提交审核 ==========
// 保存后状态置为 2（待审核），管理员通过后才显示在专家列表
router.put('/my-card', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    await ensureDoctorEnColumns();
    const expertUserId = req.user.id;
    const { name, title, specialty, intro, name_en, title_en, specialty_en, intro_en } = req.body;

    if (!name || !String(name).trim()) {
        throw new BusinessError('专家姓名不能为空', 400);
    }
    if (String(name).length > 50) {
        throw new BusinessError('姓名不能超过 50 字', 400);
    }

    const [rows] = await pool.execute(
        'SELECT id FROM doctors WHERE user_id = ?',
        [expertUserId]
    );
    const existing = (rows as any[])[0];

    if (existing) {
        await pool.execute(
            'UPDATE doctors SET name = ?, title = ?, specialty = ?, intro = ?, name_en = ?, title_en = ?, specialty_en = ?, intro_en = ?, status = 2 WHERE id = ?',
            [
                String(name).trim(), String(title || ''), String(specialty || ''), String(intro || ''),
                String(name_en || '').trim().slice(0, 80), String(title_en || '').trim().slice(0, 80),
                String(specialty_en || '').trim().slice(0, 300), String(intro_en || '').trim(), existing.id
            ]
        );
    } else {
        // 兜底：老专家账号可能无名片记录，自动补建
        await pool.execute(
            'INSERT INTO doctors (name, title, specialty, intro, name_en, title_en, specialty_en, intro_en, user_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2)',
            [
                String(name).trim(), String(title || ''), String(specialty || ''), String(intro || ''),
                String(name_en || '').trim().slice(0, 80), String(title_en || '').trim().slice(0, 80),
                String(specialty_en || '').trim().slice(0, 300), String(intro_en || '').trim(), expertUserId
            ]
        );
    }

    res.json({ success: true, message: '名片已提交审核，管理员通过后将显示在专家列表' });
}));

// ========== 专家问卷：校验并规整题目（question_number 服务端重排） ==========
const normalizeTestQuestions = (questions: any): { ok: boolean; data: any[]; message?: string } => {
    const list = Array.isArray(questions)
        ? questions.map((q: any, i: number) => {
            const content = String(q?.content || '').trim();
            const options = (Array.isArray(q?.options) ? q.options : [])
                .map((o: any) => ({ score: Number(o?.score) || 0, text: String(o?.text || '').trim() }))
                .filter((o: any) => o.text);
            return {
                question_number: i + 1,
                content,
                dimension: String(q?.dimension || ''),
                reverse_scoring: q?.reverse_scoring ? 1 : 0,
                options
            };
        })
        : [];

    if (list.length === 0) {
        return { ok: false, data: [], message: '请至少添加一道题目' };
    }
    if (list.some((q: any) => !q.content || q.options.length < 2)) {
        return { ok: false, data: [], message: '每道题目需填写题干，且至少 2 个选项' };
    }
    return { ok: true, data: list };
};

// ========== 专家问卷：创建（status=0 待审核，管理员上架后全平台可见） ==========
router.post('/tests', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    await ensureTestCreatedByColumn();
    const expertUserId = req.user.id;
    const { name, description, category, estimated_minutes, scoring_method, result_levels, questions } = req.body || {};

    if (!name || !String(name).trim()) {
        throw new BusinessError('问卷名称不能为空', 400);
    }
    const norm = normalizeTestQuestions(questions);
    if (!norm.ok) {
        throw new BusinessError(norm.message!, 400);
    }

    // 安全约束：status/created_by 服务端强制，code 自动生成（专家不可自上架、不可指定编码）
    const code = `EXP-${expertUserId}-${Date.now()}`;
    const [testResult] = await pool.execute(
        `INSERT INTO psychological_tests
         (code, name, description, category, total_questions, estimated_minutes, scoring_method, result_levels, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
            code, String(name).trim(), String(description || ''), String(category || 'emotion'),
            norm.data.length, Number(estimated_minutes) || 5,
            String(scoring_method || 'sum'),
            JSON.stringify(Array.isArray(result_levels) ? result_levels : []),
            expertUserId
        ]
    );
    const testId = (testResult as any).insertId;

    for (const q of norm.data) {
        await pool.execute(
            `INSERT INTO test_questions
             (test_id, question_number, content, dimension, reverse_scoring, options)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [testId, q.question_number, q.content, q.dimension, q.reverse_scoring, JSON.stringify(q.options)]
        );
    }

    res.json({ success: true, message: '问卷已提交，等待管理员审核上架', data: { id: testId } });
}));

// ========== 专家问卷：我的问卷列表 ==========
router.get('/tests', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    await ensureTestCreatedByColumn();
    const expertUserId = req.user.id;
    const [rows] = await pool.execute(
        `SELECT id, code, name, category, total_questions, status, created_at
         FROM psychological_tests WHERE created_by = ?
         ORDER BY created_at DESC`,
        [expertUserId]
    );
    res.json({ success: true, data: rows });
}));

// ========== 专家问卷：详情（编辑回填，仅自己的） ==========
router.get('/tests/:id', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    await ensureTestCreatedByColumn();
    const expertUserId = req.user.id;
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
        throw new BusinessError('无效的问卷ID', 400);
    }

    const [rows] = await pool.execute(
        'SELECT * FROM psychological_tests WHERE id = ? AND created_by = ?',
        [testId, expertUserId]
    );
    const test = (rows as any[])[0];
    if (!test) {
        throw new BusinessError('问卷不存在或无权访问', 404);
    }

    const [qRows] = await pool.execute(
        `SELECT id, question_number, content, dimension, reverse_scoring, options
         FROM test_questions WHERE test_id = ? ORDER BY question_number ASC`,
        [testId]
    );
    const questions = (qRows as any[]).map((q: any) => ({
        id: q.id,
        question_number: q.question_number,
        content: q.content,
        dimension: q.dimension || '',
        reverse_scoring: !!q.reverse_scoring,
        options: JSON.parse(q.options || '[]')
    }));

    res.json({ success: true, data: { ...test, questions } });
}));

// ========== 专家问卷：编辑（仅自己的待审核问卷可改，已上架/已下架归管理员处置） ==========
router.put('/tests/:id', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    await ensureTestCreatedByColumn();
    const expertUserId = req.user.id;
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
        throw new BusinessError('无效的问卷ID', 400);
    }

    const [rows] = await pool.execute(
        'SELECT status FROM psychological_tests WHERE id = ? AND created_by = ?',
        [testId, expertUserId]
    );
    const test = (rows as any[])[0];
    if (!test) {
        throw new BusinessError('问卷不存在或无权访问', 404);
    }
    if (Number(test.status) !== 0) {
        throw new BusinessError('仅待审核状态的问卷可编辑，已上架/已下架问卷请联系管理员', 403);
    }

    const { name, description, category, estimated_minutes, scoring_method, result_levels, questions } = req.body || {};
    if (!name || !String(name).trim()) {
        throw new BusinessError('问卷名称不能为空', 400);
    }
    const norm = normalizeTestQuestions(questions);
    if (!norm.ok) {
        throw new BusinessError(norm.message!, 400);
    }

    await pool.execute(
        `UPDATE psychological_tests
         SET name = ?, description = ?, category = ?, total_questions = ?, estimated_minutes = ?, scoring_method = ?, result_levels = ?
         WHERE id = ?`,
        [
            String(name).trim(), String(description || ''), String(category || 'emotion'),
            norm.data.length, Number(estimated_minutes) || 5,
            String(scoring_method || 'sum'),
            JSON.stringify(Array.isArray(result_levels) ? result_levels : []),
            testId
        ]
    );

    await pool.execute('DELETE FROM test_questions WHERE test_id = ?', [testId]);
    for (const q of norm.data) {
        await pool.execute(
            `INSERT INTO test_questions
             (test_id, question_number, content, dimension, reverse_scoring, options)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [testId, q.question_number, q.content, q.dimension, q.reverse_scoring, JSON.stringify(q.options)]
        );
    }

    res.json({ success: true, message: '问卷已更新，仍为待审核状态' });
}));

// ========== 专家问卷：删除（仅自己的待审核问卷；已上架问卷含用户作答数据，归管理员处置） ==========
router.delete('/tests/:id', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    await ensureTestCreatedByColumn();
    const expertUserId = req.user.id;
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
        throw new BusinessError('无效的问卷ID', 400);
    }

    const [rows] = await pool.execute(
        'SELECT status FROM psychological_tests WHERE id = ? AND created_by = ?',
        [testId, expertUserId]
    );
    const test = (rows as any[])[0];
    if (!test) {
        throw new BusinessError('问卷不存在或无权访问', 404);
    }
    if (Number(test.status) !== 0) {
        throw new BusinessError('仅待审核状态的问卷可删除，已上架/已下架问卷请联系管理员', 403);
    }

    await pool.execute('DELETE FROM test_questions WHERE test_id = ?', [testId]);
    await pool.execute('DELETE FROM psychological_tests WHERE id = ?', [testId]);

    res.json({ success: true, message: '问卷已删除' });
}));

// 获取专家的预约列表
router.get('/appointments', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    const expertUserId = req.user.id;

    const [doctorRows] = await pool.execute(
        'SELECT id FROM doctors WHERE user_id = ?',
        [expertUserId]
    );

    const doctorId = (doctorRows as any[])[0]?.id;
    if (!doctorId) {
        return res.json({ success: true, data: [] });
    }

    const [rows] = await pool.execute(
        `SELECT ar.*, u.username as user_name, u.email as user_email, u.phone as user_phone
         FROM appointment_records ar
         JOIN users u ON ar.user_id = u.id
         WHERE ar.doctor_id = ?
         ORDER BY ar.created_at DESC`,
        [doctorId]
    );

    res.json({ success: true, data: rows });
}));

// 获取专家统计数据
router.get('/stats', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    const expertUserId = req.user.id;

    // 先通过 user_id 查 doctors 表获取 doctor_id
    const [doctorRows] = await pool.execute(
        'SELECT id FROM doctors WHERE user_id = ?',
        [expertUserId]
    );
    const doctorId = (doctorRows as any[])[0]?.id;
    
    if (!doctorId) {
        return res.json({
            success: true,
            data: {
                pendingCount: 0,
                completedCount: 0,
                unfinishedCount: 0,
                totalPatients: 0
            }
        });
    }

    try {
        // 待处理预约数
        const [pendingRows] = await pool.execute(
            `SELECT COUNT(*) as count FROM appointment_records 
             WHERE doctor_id = ? AND status = 'pending'`,
            [doctorId]
        );

        // 已完成咨询数
        const [completedRows] = await pool.execute(
            `SELECT COUNT(*) as count FROM appointment_records 
             WHERE doctor_id = ? AND status = 'completed'`,
            [doctorId]
        );

        // 未完成咨询数（已确认但未完成）
        const [unfinishedRows] = await pool.execute(
            `SELECT COUNT(*) as count FROM appointment_records 
             WHERE doctor_id = ? AND status = 'confirmed'`,
            [doctorId]
        );

        // 累计服务用户数（去重）
        const [patientsRows] = await pool.execute(
            `SELECT COUNT(DISTINCT user_id) as count FROM appointment_records 
             WHERE doctor_id = ?`,
            [doctorId]
        );

        res.json({
            success: true,
            data: {
                pendingCount: (pendingRows as any[])[0]?.count || 0,
                completedCount: (completedRows as any[])[0]?.count || 0,
                unfinishedCount: (unfinishedRows as any[])[0]?.count || 0,
                totalPatients: (patientsRows as any[])[0]?.count || 0
            }
        });

    } catch (error: any) {
        console.error('获取专家统计失败:', error);
        res.status(500).json({ error: '获取统计失败' });
    }
}));

// 获取预约详情（带权限校验 - 普通用户和专家分别校验）
router.get('/appointments/:id', authenticate, asyncHandler(async (req: any, res: any) => {
    await ensureDoctorEnColumns();
    const appointmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let sql = `SELECT ar.*, u.username as user_name, u.email as user_email, u.phone as user_phone, u.avatar as user_avatar
               FROM appointment_records ar
               JOIN users u ON ar.user_id = u.id
               WHERE ar.id = ?`;
    let params: any[] = [appointmentId];
    
    if (userRole === 1) {
        sql += ' AND ar.user_id = ?';
        params.push(userId);
    } else if (userRole === 2) {
        const [doctorRows] = await pool.execute(
            'SELECT id FROM doctors WHERE user_id = ?',
            [userId]
        );
        const doctorId = (doctorRows as any[])[0]?.id;
        if (!doctorId) {
            throw new BusinessError('专家信息不存在', 404);
        }
        sql += ' AND ar.doctor_id = ?';
        params.push(doctorId);
    }
    
    const [aptRows] = await pool.execute(sql, params);
    
    const appointment = (aptRows as any[])[0];
    if (!appointment) {
        throw new BusinessError('预约不存在', 404);
    }

    let doctorUserId = null;
    if (appointment.doctor_id) {
        // 附带专家名片公开信息（姓名/职称/专长/简介/头像）：
        // 用户端聊天页展示「专家信息」卡使用，不包含邮箱/手机等隐私字段
        const [docRows] = await pool.execute(
            `SELECT d.user_id, u.avatar AS doctor_avatar, d.name AS doctor_name, d.title AS doctor_title,
                    d.specialty AS doctor_specialty, d.intro AS doctor_intro,
                    d.name_en, d.title_en, d.specialty_en, d.intro_en
             FROM doctors d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ?`,
            [appointment.doctor_id]
        );
        const doc = (docRows as any[])[0];
        doctorUserId = doc?.user_id || null;
        appointment.doctor_avatar = doc?.doctor_avatar || null;
        appointment.doctor_name = doc?.doctor_name || null;
        appointment.doctor_title = doc?.doctor_title || null;
        appointment.doctor_specialty = doc?.doctor_specialty || null;
        appointment.doctor_intro = doc?.doctor_intro || null;
        appointment.doctor_name_en = doc?.name_en || null;
        appointment.doctor_title_en = doc?.title_en || null;
        appointment.doctor_specialty_en = doc?.specialty_en || null;
        appointment.doctor_intro_en = doc?.intro_en || null;
    }
    appointment.doctor_user_id = doctorUserId;

    // LEFT JOIN + 名称兜底：量表被删除后专家端仍能看到该用户的测评结果
    const [testRows] = await pool.execute(
        `SELECT tr.*,
                COALESCE(pt.name,
                         IF(tr.test_code = 'AI-GEN', 'AI 智能测评', NULLIF(tr.test_code, '')),
                         '已删除的量表') AS test_name
         FROM test_results tr
         LEFT JOIN psychological_tests pt ON tr.test_id = pt.id
         WHERE tr.user_id = ?
         ORDER BY tr.completed_at DESC
         LIMIT 5`,
        [appointment.user_id]
    );

    // 为每份结果附带题目与选项文本，供专家端完整展示「问题 + 用户选择」
    const testList = testRows as any[];
    const testIds = [...new Set(testList.map((r) => r.test_id).filter(Boolean))];
    if (testIds.length > 0) {
        const placeholders = testIds.map(() => '?').join(',');
        const [qRows] = await pool.execute(
            `SELECT id, test_id, content, options FROM test_questions WHERE test_id IN (${placeholders})`,
            testIds
        );
        for (const r of testList) {
            const qs = (qRows as any[]).filter((q) => q.test_id === r.test_id);
            r.test_questions = qs.length
                ? JSON.stringify(qs.map((q) => ({ id: q.id, content: q.content, options: JSON.parse(q.options) })))
                : null;
        }
    }

    res.json({
        success: true,
        data: {
            appointment,
            testResults: testRows
        }
    });
}));

// 更新预约状态 + 通过 Socket.IO 实时广播
router.put('/appointments/:id/status', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    const appointmentId = req.params.id;
    const { status } = req.body;
    const expertUserId = req.user.id;

    // 状态白名单：confirmed 确认 / rejected 拒绝（待确认阶段） / cancelled 取消 / completed 完成
    const allowed = ['confirmed', 'rejected', 'cancelled', 'completed'];
    if (!allowed.includes(status)) {
        throw new BusinessError('无效的预约状态', 400);
    }

    const [doctorRows] = await pool.execute(
        'SELECT id FROM doctors WHERE user_id = ?',
        [expertUserId]
    );
    const doctorId = (doctorRows as any[])[0]?.id;

    if (!doctorId) {
        throw new BusinessError('专家信息不存在', 404);
    }

    await pool.execute(
        'UPDATE appointment_records SET status = ? WHERE id = ? AND doctor_id = ?',
        [status, appointmentId, doctorId]
    );

    // ===== Socket.IO 实时广播 =====
    const io = req.app.get('io');
    if (io) {
        // 1. 广播给该预约详情页的所有用户（页面实时更新）
        io.to(`appointment-${appointmentId}`).emit('appointment-updated', {
            appointmentId: parseInt(appointmentId),
            status,
            updaterId: expertUserId,
            updateTime: new Date().toISOString()
        });

        // 2. 获取预约用户ID，广播给该用户的所有连接（列表页实时刷新）
        const [aptRows] = await pool.execute(
            'SELECT user_id FROM appointment_records WHERE id = ?',
            [appointmentId]
        );
        const userId = (aptRows as any[])[0]?.user_id;
        
        if (userId) {
            // 广播给所有当前在线用户的前端（根据 userId 判断是否需要更新）
            io.emit('appointment-list-updated', {
                userId,                    // 目标用户ID（前端按此字段过滤）
                appointmentId: parseInt(appointmentId),
                status,
                updaterId: expertUserId,
                updateTime: new Date().toISOString()
            });
            console.log(`广播预约 ${appointmentId} 状态更新给用户 ${userId}`);
        }
    }

    res.json({ success: true, message: '状态更新成功' });
}));

// 获取聊天记录
router.get('/chat/:appointmentId', authenticate, asyncHandler(async (req: any, res: any) => {
    const appointmentId = Number(req.params.appointmentId);
    const userId = req.user.id;

    // 安全修复：归属校验——仅预约本人与对应专家可读取聊天记录
    const part = await isAppointmentParticipant(appointmentId, userId);
    if (!part.ok) {
        throw new BusinessError('预约不存在或无权访问', 404);
    }

    const [rows] = await pool.execute(
        `SELECT ec.*,
                sender.username as sender_name,
                receiver.username as receiver_name
         FROM expert_chat ec
         JOIN users sender ON ec.sender_id = sender.id
         JOIN users receiver ON ec.receiver_id = receiver.id
         WHERE ec.appointment_id = ?
         ORDER BY ec.created_at ASC, ec.id ASC`,
        [appointmentId]
    );

    res.json({ success: true, data: rows });
}));

export default router;
