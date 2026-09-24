import { Router } from 'express';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';

const router = Router();

const requireExpert = asyncHandler(async (req: any, res: any, next: any) => {
    if (req.user!.role !== 2) {
        throw new BusinessError('无权访问，需要专家权限', 403);
    }
    next();
});

// ========== 专家名片：读取我的名片 ==========
router.get('/my-card', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    const expertUserId = req.user.id;
    const [rows] = await pool.execute(
        'SELECT id, name, title, specialty, intro, status FROM doctors WHERE user_id = ?',
        [expertUserId]
    );
    const card = (rows as any[])[0] || null;
    res.json({ success: true, data: card });
}));

// ========== 专家名片：保存并提交审核 ==========
// 保存后状态置为 2（待审核），管理员通过后才显示在专家列表
router.put('/my-card', authenticate, requireExpert, asyncHandler(async (req: any, res: any) => {
    const expertUserId = req.user.id;
    const { name, title, specialty, intro } = req.body;

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
            'UPDATE doctors SET name = ?, title = ?, specialty = ?, intro = ?, status = 2 WHERE id = ?',
            [String(name).trim(), String(title || ''), String(specialty || ''), String(intro || ''), existing.id]
        );
    } else {
        // 兜底：老专家账号可能无名片记录，自动补建
        await pool.execute(
            'INSERT INTO doctors (name, title, specialty, intro, user_id, status) VALUES (?, ?, ?, ?, ?, 2)',
            [String(name).trim(), String(title || ''), String(specialty || ''), String(intro || ''), expertUserId]
        );
    }

    res.json({ success: true, message: '名片已提交审核，管理员通过后将显示在专家列表' });
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
    const appointmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let sql = `SELECT ar.*, u.username as user_name, u.email as user_email, u.phone as user_phone
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
        const [docRows] = await pool.execute(
            'SELECT user_id FROM doctors WHERE id = ?',
            [appointment.doctor_id]
        );
        doctorUserId = (docRows as any[])[0]?.user_id || null;
    }
    appointment.doctor_user_id = doctorUserId;

    const [testRows] = await pool.execute(
        `SELECT tr.*, pt.name as test_name
         FROM test_results tr
         JOIN psychological_tests pt ON tr.test_id = pt.id
         WHERE tr.user_id = ?
         ORDER BY tr.completed_at DESC
         LIMIT 5`,
        [appointment.user_id]
    );

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
    const appointmentId = req.params.appointmentId;

    const [rows] = await pool.execute(
        `SELECT ec.*, 
                sender.username as sender_name,
                receiver.username as receiver_name
         FROM expert_chat ec
         JOIN users sender ON ec.sender_id = sender.id
         JOIN users receiver ON ec.receiver_id = receiver.id
         WHERE ec.appointment_id = ?
         ORDER BY ec.created_at ASC`,
        [appointmentId]
    );

    res.json({ success: true, data: rows });
}));

// 发送消息
router.post('/chat', authenticate, asyncHandler(async (req: any, res: any) => {
    const { appointmentId, receiverId, content } = req.body;
    const senderId = req.user.id;

    await pool.execute(
        `INSERT INTO expert_chat (sender_id, receiver_id, content, appointment_id)
         VALUES (?, ?, ?, ?)`,
        [senderId, receiverId, content, appointmentId]
    );

    res.json({ success: true, message: '发送成功' });
}));

export default router;
