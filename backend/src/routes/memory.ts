// AI 长期记忆管理路由：开关 / 查看 / 删除 / 清空用户被 AI 自动抽取的记忆
// 心理健康场景下隐私可控优先：用户对自己被记住的一切拥有完全的知情权与删除权
import { Router, Request, Response } from 'express';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { ensureRagSchema, getMemorySettings, setMemorySettings } from '../utils/memory';
import { isRagEnabled } from '../utils/embedding';

const router = Router();

// ========== 记忆功能状态 + 用户开关（前端据此渲染开关与提示） ==========
router.get('/status', authenticate, async (req: Request, res: Response) => {
    try {
        const settings = await getMemorySettings(req.user!.id);
        res.json({
            success: true,
            data: {
                enabled: isRagEnabled(),
                ai_memory: settings.ai_memory,
                cross_memory: settings.cross_memory
            }
        });
    } catch (e: any) {
        console.error('[memory/status] 查询失败:', e.message);
        res.status(500).json({ success: false, message: '记忆状态查询失败' });
    }
});

// ========== 保存记忆开关（AI 记忆 / 跨对话记忆） ==========
router.put('/settings', authenticate, async (req: Request, res: Response) => {
    try {
        const { ai_memory, cross_memory } = req.body || {};
        if (typeof ai_memory !== 'boolean' || typeof cross_memory !== 'boolean') {
            res.status(400).json({ success: false, message: '参数不完整：ai_memory 与 cross_memory 均为必填布尔值' });
            return;
        }
        await setMemorySettings(req.user!.id, ai_memory, cross_memory);
        res.json({
            success: true,
            message: '记忆设置已保存',
            data: { ai_memory, cross_memory }
        });
    } catch (e: any) {
        console.error('[memory/settings] 保存失败:', e.message);
        res.status(500).json({ success: false, message: '记忆设置保存失败' });
    }
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
