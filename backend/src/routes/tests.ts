import { Router, Request, Response } from 'express';
import { pool } from '../db/mysql';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';
import { callAIJson } from '../utils/aiClient';
import { ensureScaleTemplates, ScaleItem } from '../utils/aiScaleSeed';

const router = Router();

// AI 智能测评的特殊量表编码（在普通列表中隐藏，由前端单独置顶展示）
const AI_TEST_CODE = 'AI-GEN';
const AI_TEST_NAME = 'AI 智能测评';
// 技术性兜底上限（非业务限制）：防止异常输出导致 token 溢出
const AI_QUESTIONS_HARD_CAP = 100;

// 兜底出题提示词：仅在数据库模板库不可用时使用
const AI_GEN_PROMPT_FALLBACK = `你是心理测评问卷设计专家。请为一位用户生成一套个性化的心理健康自评问卷。
要求：
- 第一步：从真实存在的标准化心理量表中选定一个作为蓝本，例如 PHQ-9 抑郁自评量表、GAD-7 广泛性焦虑障碍量表、PSS-10 知觉压力量表、SAS 焦虑自评量表、SDS 抑郁自评量表等
- 第二步：严格参照所选量表的测评维度、条目语义与题目风格逐条出题，总题量必须等于所选量表的标准化题量，并在 scale_item_count 字段报告该题量
- 题目语义必须与所选量表的真实条目保持专业一致（可适度温和化、贴近日常语言），必须完整覆盖量表的全部核心维度；严禁脱离蓝本随机拼凑，严禁自行缩减题量
- 每题 4 个选项，采用心理测评通行的频度/程度选项体系，得分依次递增（0/1/2/3），分数越高代表越需要关注
- 同时输出 scale_name（量表中文名）与 scale_reason（一句话选题依据）

严格只输出如下 JSON，不要任何其他文字：
{"scale_name":"量表名","scale_item_count":9,"scale_reason":"...","questions":[{"number":1,"content":"题干","options":[{"label":"A","text":"选项文字","score":0},{"label":"B","text":"选项文字","score":1},{"label":"C","text":"选项文字","score":2},{"label":"D","text":"选项文字","score":3}]}]}`;

const AI_SCORE_PROMPT = `你是心理测评分析师。以下是一份心理健康自评问卷的题目与用户的作答，请综合分析用户的整体心理状态。
要求：
- total_score：0-100 的整数，分数越高代表越需要关注
- level：仅从「正常 / 轻度 / 中度 / 重度」中选一个
- desc：一句话总体评价
- analysis：200-350 字的详细分析，结合用户在具体题目上的选择展开，最后给出 2-3 条温和可执行的建议；语气温和不评判，不构成医学诊断
- 严格只输出如下 JSON，不要任何其他文字：
{"total_score":0,"level":"正常","desc":"...","analysis":"..."}`;

// ===== AI 智能测评：生成个性化问卷 =====
// 出题依据：数据库 ai_scale_templates 中的真实标准化量表模板（14 份量表、约 185 个真实条目，
// 反向计分已在库中翻转）。AI 只负责逐条温和化改写题干，选项与分值由服务端直接取自模板，
// 保证题量、维度、选项体系与真实量表完全一致
router.post('/ai/questions', authenticate, asyncHandler(async (req: Request, res: Response) => {
    let paperMeta: { scale_name: string; scale_note: string; estimated_minutes: number } | null = null;
    let questions: any[] | null = null;
    let scaleReason = '';

    // 首选：数据库真实量表模板驱动
    try {
        await ensureScaleTemplates();
        const [tplRows] = await pool.execute('SELECT code, name, category, estimated_minutes, intro, score_note, items FROM ai_scale_templates WHERE enabled = 1');
        const templates = tplRows as any[];
        if (templates.length > 0) {
            const tpl = templates[Math.floor(Math.random() * templates.length)] as any;
            const tplItems: ScaleItem[] = JSON.parse(tpl.items);
            const itemCount = tplItems.length;

            // 出题提示词：完整真实条目作为蓝本，AI 逐条对应改写题干（只输出题干列表）
            const itemList = tplItems
                .map((it) => {
                    const optText = it.options.map((o) => `${o.label} ${o.text}(${o.score})`).join(' / ');
                    return `${it.number}. ${it.content}\n   选项：${optText}`;
                })
                .join('\n');

            const tplPrompt = `你是心理测评问卷设计专家。服务端已为用户选定一份真实标准化心理量表作为出题蓝本，请严格依据它生成个性化问卷。

【蓝本量表】${tpl.name}（${tpl.category}领域）
【量表说明】${tpl.intro}
【标准化条目（共 ${itemCount} 条）】
${itemList}

生成要求：
1. 输出恰好 ${itemCount} 条题干，第 i 条题干必须对应蓝本第 i 条目，逐一对应，不得增删、合并、跳过或调换测评维度
2. 每条题干的语义必须与蓝本条目保持专业一致，允许且仅允许做适度的温和化、口语化改写（更贴近日常表达），禁止改变测评方向或替换成无关问题
3. 不要输出选项，选项由系统按蓝本自动附加
4. 用一句话说明为用户选用该量表的理由（scale_reason）

严格只输出如下 JSON，不要任何其他文字：
{"scale_reason":"...","contents":["题干1","题干2","..."]}`;

            // 两次机会：题干数量必须与蓝本完全一致
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const data = await callAIJson(
                        tplPrompt,
                        '请依据上述蓝本量表生成个性化问卷题干。',
                        { maxTokens: 6000, temperature: 0.6, label: 'ai-gen' }
                    );
                    const contents = Array.isArray(data.contents) ? data.contents : null;
                    if (contents && contents.length === itemCount && contents.every((c: any) => String(c || '').trim())) {
                        questions = tplItems.map((it, i) => ({
                            number: i + 1,
                            content: String(contents[i]).trim(),
                            options: it.options
                        }));
                        scaleReason = String(data.scale_reason || '').trim().slice(0, 200);
                        paperMeta = {
                            scale_name: String(tpl.name),
                            scale_note: String(tpl.score_note || ''),
                            estimated_minutes: Number(tpl.estimated_minutes) || Math.max(3, Math.round(itemCount * 0.5))
                        };
                        break;
                    }
                    console.error(`[ai-gen] 模板出题题干数量不符（${contents ? contents.length : '无'} != ${itemCount}，量表=${tpl.name}），重试`);
                } catch (e: any) {
                    console.error('[ai-gen] 模板出题调用失败:', e?.message);
                }
            }
        }
    } catch (e: any) {
        console.error('[ai-gen] 模板库不可用，走兜底出题:', e?.message);
    }

    // 兜底：数据库模板不可用时按原提示词出题（AI 自行生成选项）
    if (!questions) {
        let normalized: any[] = [];
        for (let attempt = 0; attempt < 2 && normalized.length === 0; attempt++) {
            const data = await callAIJson(AI_GEN_PROMPT_FALLBACK, '请生成一套心理健康自评问卷。', { maxTokens: 12000, temperature: 0.7, label: 'ai-gen' });
            const list = Array.isArray(data.questions) ? data.questions : null;
            if (!list) continue;
            scaleReason = String(data.scale_reason || '').trim().slice(0, 200);
            normalized = list.map((q: any, i: number) => ({
                number: i + 1,
                content: String(q.content || '').trim(),
                options: (Array.isArray(q.options) ? q.options : []).map((o: any, j: number) => ({
                    label: String(o.label || String.fromCharCode(65 + j)),
                    text: String(o.text || '').trim(),
                    score: Number(o.score) || 0
                }))
            })).filter((q: any) => q.content && q.options.length >= 2);
            if (normalized.length > AI_QUESTIONS_HARD_CAP) {
                normalized = normalized.slice(0, AI_QUESTIONS_HARD_CAP);
            }
        }
        if (normalized.length === 0) {
            throw new BusinessError('AI 生成的问卷不完整，请重试', 502);
        }
        questions = normalized;
    }

    const finalQuestions = questions!;
    finalQuestions.forEach((q, i) => { q.number = i + 1; });
    const estimatedMinutes = paperMeta?.estimated_minutes || Math.max(3, Math.min(45, Math.round(finalQuestions.length * 0.5)));

    // 问卷内容持久化：完整题目与选项 + 量表计分说明一并入库（ai_test_papers），评分时提供计分依据
    const [paperResult] = await pool.execute(
        'INSERT INTO ai_test_papers (user_id, questions) VALUES (?, ?)',
        [req.user!.id, JSON.stringify({
            v: 1,
            scale_name: paperMeta?.scale_name || '',
            scale_note: paperMeta?.scale_note || '',
            estimated_minutes: estimatedMinutes,
            questions: finalQuestions
        })]
    );

    const basisNote = paperMeta?.scale_name
        ? `参照真实标准量表「${paperMeta.scale_name}」的结构生成`
        : '参照标准化心理量表结构生成';
    res.json({
        success: true,
        data: {
            paper_id: (paperResult as any).insertId,
            name: AI_TEST_NAME,
            description: `由 AI ${basisNote}（共 ${finalQuestions.length} 题）${scaleReason ? '；选题依据：' + scaleReason : ''}`,
            questions: finalQuestions
        }
    });
}));

// ===== AI 智能测评：根据回答由 AI 评分并保存 =====
router.post('/ai/submit', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { paper_id, answers } = req.body || {};
    const clientQuestions = (req.body || {}).questions;

    // 优先使用数据库中留存的问卷内容（paper_id），保证评分依据与用户所见一致
    // 兼容两种存储格式：旧版为纯题目数组；新版为 { v, scale_name, scale_note, estimated_minutes, questions }
    let sourceQuestions: any[] | null = null;
    let scaleNote = '';
    let paperEstMinutes = 0;
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
            const parsed = JSON.parse(paper.questions);
            if (Array.isArray(parsed)) {
                sourceQuestions = parsed;
            } else if (parsed && Array.isArray(parsed.questions)) {
                sourceQuestions = parsed.questions;
                scaleNote = String(parsed.scale_note || '');
                paperEstMinutes = Number(parsed.estimated_minutes) || 0;
            }
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
    // scale_note 提供量表计分方向说明（如 SES/WHO-5 等正向量表、含反向计分量表），避免 AI 误读
    let judged: any;
    try {
        judged = await callAIJson(
            AI_SCORE_PROMPT,
            (scaleNote ? '量表计分说明：' + scaleNote + '\n\n' : '')
            + '题目与用户作答如下（JSON）：\n' + JSON.stringify(qaList),
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
    const estMinutes = paperEstMinutes || Math.max(3, Math.min(45, Math.round(questions.length * 0.5)));
    await pool.execute(
        `INSERT INTO psychological_tests (code, name, description, category, total_questions, estimated_minutes, scoring_method, status)
         SELECT ?, ?, ?, '智能', ?, ?, 'ai', 1
         WHERE NOT EXISTS (SELECT 1 FROM psychological_tests WHERE code = ?)`,
        [AI_TEST_CODE, AI_TEST_NAME, '由 AI 实时生成题目并评分的个性化测评', questions.length, estMinutes, AI_TEST_CODE]
    );
    await pool.execute(
        'UPDATE psychological_tests SET total_questions = ?, estimated_minutes = ? WHERE code = ?',
        [questions.length, estMinutes, AI_TEST_CODE]
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

    // LEFT JOIN + 名称兜底：量表被管理员删除后历史作答仍可见（按存库编码显示），AI 量表恢复固定名
    const [rows] = await pool.execute(
        `SELECT r.id,
                COALESCE(t.code, r.test_code) AS code,
                COALESCE(t.name,
                         IF(r.test_code = 'AI-GEN', 'AI 智能测评', NULLIF(r.test_code, '')),
                         '已删除的量表') AS name,
                r.total_score, r.result_level, r.result_desc, r.completed_at
         FROM test_results r
                  LEFT JOIN psychological_tests t ON r.test_id = t.id
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

    // LEFT JOIN + 名称兜底：量表删除后详情仍可打开（与历史列表的显示规则一致）
    const [rows] = await pool.execute(
        `SELECT r.id, r.test_code,
                COALESCE(t.name,
                         IF(r.test_code = 'AI-GEN', 'AI 智能测评', NULLIF(r.test_code, '')),
                         '已删除的量表') AS name,
                r.answers, r.total_score, r.result_level, r.result_desc, r.completed_at
         FROM test_results r
                  LEFT JOIN psychological_tests t ON r.test_id = t.id
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
