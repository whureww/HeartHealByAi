import { Router, Request, Response } from 'express';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';

const router = Router();

//  м        Ƿ  ǹ   Ա
const requireAdmin = asyncHandler(async (req: Request, res: Response, next: any) => {
    if (req.user!.role !== 3) {
        throw new BusinessError('  Ȩ    ', 403);
    }
    next();
});

// ==========  û      ==========

// routes/admin.ts -   ȡ û  б 
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

    //   ѯ     - ʹ   query        execute       Bun + mysql2        ⣩
    const countSql = `SELECT COUNT(*) as total FROM users${whereClause}`;
    const [countRows] = await pool.query(countSql, params);
    const total = (countRows as any[])[0].total;

    //   ѯ б  - LIMIT    OFFSET תΪ    
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


//  ޸  û   ɫ
router.put('/users/:id/role', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (![1, 2, 3].includes(role)) {
        throw new BusinessError('  Ч Ľ ɫ', 400);
    }

    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    res.json({ success: true, message: '  ɫ ޸ĳɹ ' });
}));
// admin.ts - 修复后的 stats 路由
router.get('/stats', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    try {
        const [userRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM users WHERE role = 1'
        );
        
        const [expertRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM users WHERE role = 2'
        );
        
        // 修复：appointments → appointment_records
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


// ==========  ʾ      ==========

//   ȡ ʾ  б       δ  ˵ģ 
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

//      ʾ 
router.post('/tests', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const {
        code, name, description, category,
        total_questions, estimated_minutes,
        scoring_method, result_levels, questions
    } = req.body;

    //      ʾ 
    const [testResult] = await pool.execute(
        `INSERT INTO psychological_tests 
         (code, name, description, category, total_questions, estimated_minutes, scoring_method, result_levels, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,  // Ĭ  ״̬Ϊ0      ˣ 
        [code, name, description, category, total_questions, estimated_minutes, scoring_method, JSON.stringify(result_levels)]
    );

    const testId = (testResult as any).insertId;

    //       Ŀ
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

    res.json({ success: true, message: ' ʾ      ɹ    ȴ    ', data: { id: testId } });
}));

//     ʾ    ϼ / ¼ܣ 
router.put('/tests/:id/status', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const testId = parseInt(req.params.id);
    const { status } = req.body;  // 0=     , 1=   ϼ , 2=   ¼ 

    if (![0, 1, 2].includes(status)) {
        throw new BusinessError('  Ч  ״̬', 400);
    }

    await pool.execute('UPDATE psychological_tests SET status = ? WHERE id = ?', [status, testId]);

    const statusText = { 0: '     ', 1: '   ϼ ', 2: '   ¼ ' };
    res.json({ success: true, message: ` ʾ   ${statusText[status as keyof typeof statusText]}` });
}));

// ɾ   ʾ 
router.delete('/tests/:id', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const testId = parseInt(req.params.id);
    
    await pool.execute('DELETE FROM test_questions WHERE test_id = ?', [testId]);
    await pool.execute('DELETE FROM psychological_tests WHERE id = ?', [testId]);
    
    res.json({ success: true, message: ' ʾ   ɾ  ' });
}));
// ==========   ȡ    ԤԼ ==========
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

export default router;
