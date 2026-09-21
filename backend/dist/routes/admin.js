"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mysql_1 = require("../db/mysql");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const error_2 = require("../middleware/error");
const router = (0, express_1.Router)();
//  м        Ƿ  ǹ   Ա
const requireAdmin = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (req.user.role !== 3) {
        throw new error_2.BusinessError('  Ȩ    ', 403);
    }
    next();
});
// ==========  û      ==========
// routes/admin.ts -   ȡ û  б 
router.get('/users', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const keyword = req.query.keyword || '';
    const offset = (page - 1) * pageSize;
    let whereClause = '';
    let params = [];
    if (keyword) {
        whereClause = ' WHERE username LIKE ? OR email LIKE ? OR phone LIKE ?';
        params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];
    }
    //   ѯ     - ʹ   query        execute       Bun + mysql2        ⣩
    const countSql = `SELECT COUNT(*) as total FROM users${whereClause}`;
    const [countRows] = await mysql_1.pool.query(countSql, params);
    const total = countRows[0].total;
    //   ѯ б  - LIMIT    OFFSET תΪ    
    const sql = `SELECT id, username, email, phone, role, avatar, created_at FROM users${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, Number(pageSize), Number(offset)];
    const [rows] = await mysql_1.pool.query(sql, queryParams);
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
//  ޸  û   ɫ
router.put('/users/:id/role', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    if (![1, 2, 3].includes(role)) {
        throw new error_2.BusinessError('  Ч Ľ ɫ', 400);
    }
    await mysql_1.pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    res.json({ success: true, message: '  ɫ ޸ĳɹ ' });
}));
// admin.ts - 修复后的 stats 路由
router.get('/stats', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    try {
        const [userRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM users WHERE role = 1');
        const [expertRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM users WHERE role = 2');
        // 修复：appointments → appointment_records
        const [appointmentRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM appointment_records');
        const [testRows] = await mysql_1.pool.execute('SELECT COUNT(*) as count FROM test_results');
        res.json({
            success: true,
            data: {
                totalUsers: userRows[0]?.count || 0,
                totalExperts: expertRows[0]?.count || 0,
                totalAppointments: appointmentRows[0]?.count || 0,
                totalTests: testRows[0]?.count || 0
            }
        });
    }
    catch (error) {
        console.error('获取平台统计失败:', error);
        res.status(500).json({ error: '获取统计失败' });
    }
}));
// ==========  ʾ      ==========
//   ȡ ʾ  б       δ  ˵ģ 
router.get('/tests', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    const status = req.query.status;
    let sql = 'SELECT * FROM psychological_tests';
    const params = [];
    if (status !== undefined) {
        sql += ' WHERE status = ?';
        params.push(parseInt(status));
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await mysql_1.pool.execute(sql, params);
    res.json({ success: true, data: rows });
}));
//      ʾ 
router.post('/tests', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    const { code, name, description, category, total_questions, estimated_minutes, scoring_method, result_levels, questions } = req.body;
    //      ʾ 
    const [testResult] = await mysql_1.pool.execute(`INSERT INTO psychological_tests 
         (code, name, description, category, total_questions, estimated_minutes, scoring_method, result_levels, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`, // Ĭ  ״̬Ϊ0      ˣ 
    [code, name, description, category, total_questions, estimated_minutes, scoring_method, JSON.stringify(result_levels)]);
    const testId = testResult.insertId;
    //       Ŀ
    if (questions && questions.length > 0) {
        for (const q of questions) {
            await mysql_1.pool.execute(`INSERT INTO test_questions 
                 (test_id, question_number, content, dimension, reverse_scoring, options)
                 VALUES (?, ?, ?, ?, ?, ?)`, [testId, q.question_number, q.content, q.dimension, q.reverse_scoring ? 1 : 0, JSON.stringify(q.options)]);
        }
    }
    res.json({ success: true, message: ' ʾ      ɹ    ȴ    ', data: { id: testId } });
}));
//     ʾ    ϼ / ¼ܣ 
router.put('/tests/:id/status', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    const testId = parseInt(req.params.id);
    const { status } = req.body; // 0=     , 1=   ϼ , 2=   ¼ 
    if (![0, 1, 2].includes(status)) {
        throw new error_2.BusinessError('  Ч  ״̬', 400);
    }
    await mysql_1.pool.execute('UPDATE psychological_tests SET status = ? WHERE id = ?', [status, testId]);
    const statusText = { 0: '     ', 1: '   ϼ ', 2: '   ¼ ' };
    res.json({ success: true, message: ` ʾ   ${statusText[status]}` });
}));
// ɾ   ʾ 
router.delete('/tests/:id', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    const testId = parseInt(req.params.id);
    await mysql_1.pool.execute('DELETE FROM test_questions WHERE test_id = ?', [testId]);
    await mysql_1.pool.execute('DELETE FROM psychological_tests WHERE id = ?', [testId]);
    res.json({ success: true, message: ' ʾ   ɾ  ' });
}));
// ==========   ȡ    ԤԼ ==========
router.get('/appointments', auth_1.authenticate, requireAdmin, (0, error_1.asyncHandler)(async (req, res) => {
    const [rows] = await mysql_1.pool.execute(`SELECT ar.*, u.username as user_name, u.email as user_email,
                d.name as doctor_name, d.title as doctor_title
         FROM appointment_records ar
         JOIN users u ON ar.user_id = u.id
         JOIN doctors d ON ar.doctor_id = d.id
         ORDER BY ar.created_at DESC`);
    res.json({ success: true, data: rows });
}));
exports.default = router;
