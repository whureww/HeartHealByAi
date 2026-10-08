import { Router, Request, Response } from 'express';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';
import { callAIJson } from '../utils/aiClient';

const router = Router();

// AI 智能测评的特殊量表编码（在普通列表中隐藏，由前端单独置顶展示）
const AI_TEST_CODE = 'AI-GEN';
const AI_TEST_NAME = 'AI 智能测评';
// 题目数量范围（业务约束：生成少于下限自动重试，超过上限自动截取）
const AI_QUESTIONS_MIN = 8;
const AI_QUESTIONS_MAX = 20;

const AI_GEN_PROMPT = `你是心理测评问卷设计专家。请为一位用户生成一套个性化的心理健康自评问卷。
要求：
- 出 ${AI_QUESTIONS_MIN} 到 ${AI_QUESTIONS_MAX} 道题（建议 10-15 道），覆盖近期情绪状态、睡眠、压力感受、社交意愿、自我评价、兴趣动力等维度，题目表述具体、温和、贴近日常生活
- 每题 4 个选项，得分依次为 0/1/2/3，分数越高代表该维度越需要关注
- 选项文字要口语化、有区分度，避免机械重复
- 严格只输出如下 JSON，不要任何其他文字：
{"questions":[{"number":1,"content":"题干","options":[{"label":"A","text":"选项文字","score":0},{"label":"B","text":"选项文字","score":1},{"label":"C","text":"选项文字","score":2},{"label":"D","text":"选项文字","score":3}]}]}`;

const AI_SCORE_PROMPT = `你是心理测评分析师。以下是一份心理健康自评问卷的题目与用户的作答，请综合分析用户的整体心理状态。
要求：
- total_score：0-100 的整数，分数越高代表越需要关注
- level：仅从「正常 / 轻度 / 中度 / 重度」中选一个
- desc：一句话总体评价
- analysis：200-350 字的详细分析，结合用户在具体题目上的选择展开，最后给出 2-3 条温和可执行的建议；语气温和不评判，不构成医学诊断
- 严格只输出如下 JSON，不要任何其他文字：
{"total_score":0,"level":"正常","desc":"...","analysis":"..."}`;

// ===== AI 智能测评：生成个性化问卷 =====
router.post('/ai/questions', authenticate, asyncHandler(async (req: Request, res: Response) => {
    // 数量约束：< MIN 自动重试一次，> MAX 截取到上限
    let normalized: any[] = [];
    for (let attempt = 0; attempt < 2 && normalized.length < AI_QUESTIONS_MIN; attempt++) {
        const data = await callAIJson(AI_GEN_PROMPT, '请生成一套心理健康自评问卷。', { maxTokens: 4500, temperature: 0.8, label: 'ai-gen' });
        const questions = Array.isArray(data.questions) ? data.questions : null;
        if (!questions) continue;
        // 基础结构校验与规整
        normalized = questions.map((q: any, i: number) => ({
            number: i + 1,
            content: String(q.content || '').trim(),
            options: (Array.isArray(q.options) ? q.options : []).map((o: any, j: number) => ({
                label: String(o.label || String.fromCharCode(65 + j)),
                text: String(o.text || '').trim(),
                score: Number(o.score) || 0
            }))
        })).filter((q: any) => q.content && q.options.length >= 2);
        if (normalized.length > AI_QUESTIONS_MAX) {
            normalized = normalized.slice(0, AI_QUESTIONS_MAX);
        }
    }

    if (normalized.length < AI_QUESTIONS_MIN) {
        throw new BusinessError('AI 生成的问卷不完整，请重试', 502);
    }
    normalized.forEach((q, i) => { q.number = i + 1; });

    // 问卷内容持久化：每次生成的完整题目与选项入库（ai_test_papers）
    const [paperResult] = await pool.execute(
        'INSERT INTO ai_test_papers (user_id, questions) VALUES (?, ?)',
        [req.user!.id, JSON.stringify(normalized)]
    );

    res.json({
        success: true,
        data: {
            paper_id: (paperResult as any).insertId,
            name: AI_TEST_NAME,
            description: '由 AI 根据常见心理健康维度实时生成的个性化自评问卷',
            questions: normalized
        }
    });
}));

// ===== AI 智能测评：根据回答由 AI 评分并保存 =====
router.post('/ai/submit', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { paper_id, answers } = req.body || {};
    const clientQuestions = (req.body || {}).questions;

    // 优先使用数据库中留存的问卷内容（paper_id），保证评分依据与用户所见一致
    let sourceQuestions: any[] | null = null;
    if (paper_id) {
        const [prows] = await pool.execute(
            'SELECT questions FROM ai_test_papers WHERE id = ? AND user_id = ?',
            [paper_id, userId]
        );
        const paper = (prows as any[])[0];
        if (!paper) {
            throw new BusinessError('问卷不存在或已失效，请重新生成', 404);
        }
        try {
            sourceQuestions = JSON.parse(paper.questions);
        } catch {
            sourceQuestions = null;
        }
    }
    if (!Array.isArray(sourceQuestions)) {
        // 兼容旧客户端：直接传 questions 数组
        sourceQuestions = Array.isArray(clientQuestions) ? clientQuestions : null;
    }
    if (!sourceQuestions || !Array.isArray(answers)
        || sourceQuestions.length === 0 || answers.length !== sourceQuestions.length) {
        throw new BusinessError('参数不完整', 400);
    }
    const questions = sourceQuestions;

    // 组装评分材料：题目 + 用户所选选项文本（不信任前端直接给的分数，仅作参考）
    const qaList = questions.map((q: any, i: number) => {
        const ans = answers[i] || {};
        const opt = (q.options || []).find((o: any) => o.label === ans.label || o.text === ans.text);
        return {
            number: i + 1,
            question: String(q.content || ''),
            selected: String(ans.text || opt?.text || '未作答'),
            ref_score: Number(ans.score ?? opt?.score ?? 0)
        };
    });

    // 温度调低保证分级稳定；token 上限加大避免分析文字截断 JSON
    let judged: any;
    try {
        judged = await callAIJson(
            AI_SCORE_PROMPT,
            '题目与用户作答如下（JSON）：\n' + JSON.stringify(qaList),
            { maxTokens: 2500, temperature: 0.3, label: 'ai-score' }
        );
    } catch {
        throw new BusinessError('AI 服务繁忙，请稍后重试', 503);
    }

    const totalScore = Math.max(0, Math.min(100, Number(judged.total_score) || 0));
    const level = String(judged.level || '未知');
    const desc = String(judged.desc || '');
    const analysis = String(judged.analysis || '');

    // 确保 AI 智能测评的量表记录存在（test_results 外键需要 test_id），题数随每次生成同步
    await pool.execute(
        `INSERT INTO psychological_tests (code, name, description, category, total_questions, estimated_minutes, scoring_method, status)
         SELECT ?, ?, ?, '智能', ?, ?, 'ai', 1
         WHERE NOT EXISTS (SELECT 1 FROM psychological_tests WHERE code = ?)`,
        [AI_TEST_CODE, AI_TEST_NAME, '由 AI 实时生成题目并评分的个性化测评', questions.length, 5, AI_TEST_CODE]
    );
    await pool.execute(
        'UPDATE psychological_tests SET total_questions = ? WHERE code = ?',
        [questions.length, AI_TEST_CODE]
    );
    const [testRows] = await pool.execute(
        'SELECT id FROM psychological_tests WHERE code = ?',
        [AI_TEST_CODE]
    );
    const testId = (testRows as any[])[0]?.id;
    if (!testId) {
        throw new BusinessError('测评记录初始化失败', 500);
    }

    // 存储带题干与完整选项的作答明细，专家端可直接展示「问题 + 全部选项 + 用户选择」
    const answersJson = JSON.stringify(qaList.map((qa, i) => {
        const q = questions[i] || {};
        const ans = answers[i] || {};
        const opt = (q.options || []).find((o: any) => o.label === ans.label || o.text === ans.text);
        return {
            question_id: i + 1,
            content: qa.question,
            options: q.options || [],
            selected_label: opt?.label ?? ans.label ?? '',
            selected_text: qa.selected,
            score: qa.ref_score
        };
    }));

    const [result] = await pool.execute(
        `INSERT INTO test_results (user_id, test_id, test_code, answers, total_score, result_level, result_desc)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, testId, AI_TEST_CODE, answersJson, totalScore, level, desc + (analysis ? '\n\n' + analysis : '')]
    );

    res.json({
        success: true,
        data: {
            id: (result as any).insertId,
            test_code: AI_TEST_CODE,
            test_name: AI_TEST_NAME,
            total_score: totalScore,
            result_level: level,
            result_desc: desc,
            analysis,
            completed_at: new Date().toISOString()
        }
    });
}));

// ===== 获取测评列表 =====
router.get('/list', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const [rows] = await pool.execute(
        "SELECT id, code, name, description, category, total_questions, estimated_minutes, scoring_method FROM psychological_tests WHERE status = 1 AND code != 'AI-GEN'"
    );

    res.json({
        success: true,
        data: rows
    });
}));

// ===== 获取测评题目 =====
router.get('/questions/:testId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const testId = parseInt(req.params.testId);

    if (isNaN(testId)) {
        throw new BusinessError('无效的测评ID', 400);
    }

    const [testRows] = await pool.execute(
        'SELECT id, code, name, description, total_questions, estimated_minutes, scoring_method FROM psychological_tests WHERE id = ? AND status = 1',
        [testId]
    );

    const tests = testRows as any[];
    if (tests.length === 0) {
        throw new BusinessError('测评不存在', 404);
    }

    const [questionRows] = await pool.execute(
        `SELECT id, question_number, content, dimension, reverse_scoring, options
         FROM test_questions WHERE test_id = ? ORDER BY question_number`,
        [testId]
    );

    const questions = (questionRows as any[]).map(q => ({
        ...q,
        reverse_scoring: q.reverse_scoring === 1,
        options: JSON.parse(q.options)
    }));

    res.json({
        success: true,
        data: {
            test: tests[0],
            questions
        }
    });
}));

// ===== 提交测评结果 =====
router.post('/submit', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { test_id, answers } = req.body;

    if (!test_id || !answers || !Array.isArray(answers)) {
        throw new BusinessError('参数不完整', 400);
    }

    const [testRows] = await pool.execute(
        'SELECT code, name, result_levels, scoring_method FROM psychological_tests WHERE id = ?',
        [test_id]
    );

    const tests = testRows as any[];
    if (tests.length === 0) {
        throw new BusinessError('测评不存在', 404);
    }

    const test = tests[0];
    
    // 兼容 result_levels 为 null 的情况
    let resultLevels = [];
    try {
        resultLevels = test.result_levels ? JSON.parse(test.result_levels) : [];
    } catch (e) {
        console.error('解析 result_levels 失败:', e);
        resultLevels = [];
    }

    let totalScore = 0;
    for (const answer of answers) {
        totalScore += (answer.score || 0);
    }

    let resultLevel = '未知';
    let resultDesc = '暂无评估标准';

    // 如果有 result_levels，按分数匹配
    if (resultLevels && resultLevels.length > 0) {
        for (const level of resultLevels) {
            if (totalScore >= level.min && totalScore <= level.max) {
                resultLevel = level.level;
                resultDesc = level.desc;
                break;
            }
        }
    } else {
        // 没有 result_levels 时的默认逻辑
        if (totalScore <= 39) {
            resultLevel = '正常';
            resultDesc = '您的测评结果在正常范围内。';
        } else if (totalScore <= 49) {
            resultLevel = '轻度';
            resultDesc = '您存在轻度问题，建议关注。';
        } else if (totalScore <= 59) {
            resultLevel = '中度';
            resultDesc = '您存在中度问题，建议寻求专业帮助。';
        } else {
            resultLevel = '重度';
            resultDesc = '您存在较严重问题，强烈建议尽快寻求专业帮助。';
        }
    }

    const [result] = await pool.execute(
        `INSERT INTO test_results (user_id, test_id, test_code, answers, total_score, result_level, result_desc)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, test_id, test.code, JSON.stringify(answers), totalScore, resultLevel, resultDesc]
    );

    res.json({
        success: true,
        data: {
            id: (result as any).insertId,
            test_code: test.code,
            test_name: test.name,
            total_score: totalScore,
            result_level: resultLevel,
            result_desc: resultDesc,
            completed_at: new Date().toISOString()
        }
    });
}));

// ===== 获取用户测评历史 =====
router.get('/history', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [rows] = await pool.execute(
        `SELECT r.id, t.code, t.name, r.total_score, r.result_level, r.result_desc, r.completed_at
         FROM test_results r
                  JOIN psychological_tests t ON r.test_id = t.id
         WHERE r.user_id = ?
         ORDER BY r.completed_at DESC`,
        [userId]
    );

    res.json({
        success: true,
        data: rows
    });
}));

// ===== 获取单次测评结果详情 =====
router.get('/result/:resultId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const resultId = parseInt(req.params.resultId);

    if (isNaN(resultId)) {
        throw new BusinessError('无效的结果ID', 400);
    }

    const [rows] = await pool.execute(
        `SELECT r.id, r.test_code, t.name, r.answers, r.total_score, r.result_level, r.result_desc, r.completed_at
         FROM test_results r
                  JOIN psychological_tests t ON r.test_id = t.id
         WHERE r.id = ? AND r.user_id = ?`,
        [resultId, userId]
    );

    const results = rows as any[];
    if (results.length === 0) {
        throw new BusinessError('结果不存在', 404);
    }

    res.json({
        success: true,
        data: {
            ...results[0],
            answers: JSON.parse(results[0].answers)
        }
    });
}));

export default router;
