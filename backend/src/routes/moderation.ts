// 聊天内容预检：发送前轻量词库检查（毫秒级，不调用 AI）
// 前端点发送时先调此接口，命中敏感词即时标红提示，避免「发出去了才被拦」的体验落差；
// 完整审核（词库 + AI 复核）仍在 Socket / HTTP 发送链路服务端强制执行，此接口仅作体验优化
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { checkMessageContent } from '../utils/moderation';

const router = Router();

router.post('/precheck', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { content } = req.body;
    const result = checkMessageContent(String(content || ''));
    res.json({
        success: true,
        data: {
            ok: result.ok,
            hit: result.hit || null
        }
    });
}));

export default router;
