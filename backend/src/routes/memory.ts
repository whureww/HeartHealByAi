// AI 长期记忆管理路由：查看 / 删除 / 清空用户被 AI 自动抽取的记忆
// 心理健康场景下隐私可控优先：用户对自己被记住的一切拥有完全的知情权与删除权
import { Router, Request, Response } from 'express';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { ensureRagSchema } from '../utils/memory';
import { isRagEnabled } from '../utils/embedding';

const router = Router();

// ========== 记忆功能状态（前端据此决定是否显示提示） ==========
router.get('/status', authenticate, (req: Request, res: Response) => {
    res.json({ success: true, data: { enabled: isRagEnabled() } });
});

// ========== 记忆列表（不含向量，仅展示内容与时间） ==========
router.get('/list', authenticate, async (req: Request, res: Response) => {
    try {
        await ensureRagSchema();
        const userId = req.user!.id;
        const [rows] = await pool.execute(
            'SELECT id, content, source_session_id, created_at, updated_at FROM user_memories WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 500',
            [userId]
        );
        res.json({ success: true, data: rows });
    } catch (e: any) {
        console.error('[memory/list] 查询失败:', e.message);
        res.status(500).json({ success: false, message: '记忆查询失败' });
    }
});

// ========== 删除单条记忆 ==========
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        await ensureRagSchema();
        const userId = req.user!.id;
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ success: false, message: '记忆 id 不合法' });
            return;
        }
        const [result]: any = await pool.execute(
            'DELETE FROM user_memories WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        if (!result.affectedRows) {
            res.status(404).json({ success: false, message: '记忆不存在或已删除' });
            return;
        }
        res.json({ success: true });
    } catch (e: any) {
        console.error('[memory/delete] 删除失败:', e.message);
        res.status(500).json({ success: false, message: '记忆删除失败' });
    }
});

// ========== 清空全部记忆 ==========
router.post('/clear', authenticate, async (req: Request, res: Response) => {
    try {
        await ensureRagSchema();
        const userId = req.user!.id;
        const [result]: any = await pool.execute(
            'DELETE FROM user_memories WHERE user_id = ?',
            [userId]
        );
        res.json({ success: true, data: { deleted: result.affectedRows || 0 } });
    } catch (e: any) {
        console.error('[memory/clear] 清空失败:', e.message);
        res.status(500).json({ success: false, message: '记忆清空失败' });
    }
});

export default router;
