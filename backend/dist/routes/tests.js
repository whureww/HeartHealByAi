"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mysql_1 = require("../db/mysql");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const error_2 = require("../middleware/error");
const router = (0, express_1.Router)();
// ===== 获取测评列表 =====
router.get('/list', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const [rows] = await mysql_1.pool.execute('SELECT id, code, name, description, category, total_questions, estimated_minutes, scoring_method FROM psychological_tests WHERE status = 1');
    res.json({
        success: true,
        data: rows
    });
}));
// ===== 获取测评题目 =====
router.get('/questions/:testId', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const testId = parseInt(req.params.testId);
    if (isNaN(testId)) {
        throw new error_2.BusinessError('无效的测评ID', 400);
    }
    const [testRows] = await mysql_1.pool.execute('SELECT id, code, name, description, total_questions, estimated_minutes, scoring_method FROM psychological_tests WHERE id = ? AND status = 1', [testId]);
    const tests = testRows;
    if (tests.length === 0) {
        throw new error_2.BusinessError('测评不存在', 404);
    }
    const [questionRows] = await mysql_1.pool.execute(`SELECT id, question_number, content, dimension, reverse_scoring, options
         FROM test_questions WHERE test_id = ? ORDER BY question_number`, [testId]);
    const questions = questionRows.map(q => ({
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
router.post('/submit', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { test_id, answers } = req.body;
    if (!test_id || !answers || !Array.isArray(answers)) {
        throw new error_2.BusinessError('参数不完整', 400);
    }
    const [testRows] = await mysql_1.pool.execute('SELECT code, name, result_levels, scoring_method FROM psychological_tests WHERE id = ?', [test_id]);
    const tests = testRows;
    if (tests.length === 0) {
        throw new error_2.BusinessError('测评不存在', 404);
    }
    const test = tests[0];
    // 兼容 result_levels 为 null 的情况
    let resultLevels = [];
    try {
        resultLevels = test.result_levels ? JSON.parse(test.result_levels) : [];
    }
    catch (e) {
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
    }
    else {
        // 没有 result_levels 时的默认逻辑
        if (totalScore <= 39) {
            resultLevel = '正常';
            resultDesc = '您的测评结果在正常范围内。';
        }
        else if (totalScore <= 49) {
            resultLevel = '轻度';
            resultDesc = '您存在轻度问题，建议关注。';
        }
        else if (totalScore <= 59) {
            resultLevel = '中度';
            resultDesc = '您存在中度问题，建议寻求专业帮助。';
        }
        else {
            resultLevel = '重度';
            resultDesc = '您存在较严重问题，强烈建议尽快寻求专业帮助。';
        }
    }
    const [result] = await mysql_1.pool.execute(`INSERT INTO test_results (user_id, test_id, test_code, answers, total_score, result_level, result_desc)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [userId, test_id, test.code, JSON.stringify(answers), totalScore, resultLevel, resultDesc]);
    res.json({
        success: true,
        data: {
            id: result.insertId,
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
router.get('/history', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [rows] = await mysql_1.pool.execute(`SELECT r.id, t.code, t.name, r.total_score, r.result_level, r.result_desc, r.completed_at
         FROM test_results r
                  JOIN psychological_tests t ON r.test_id = t.id
         WHERE r.user_id = ?
         ORDER BY r.completed_at DESC`, [userId]);
    res.json({
        success: true,
        data: rows
    });
}));
// ===== 获取单次测评结果详情 =====
router.get('/result/:resultId', auth_1.authenticate, (0, error_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const resultId = parseInt(req.params.resultId);
    if (isNaN(resultId)) {
        throw new error_2.BusinessError('无效的结果ID', 400);
    }
    const [rows] = await mysql_1.pool.execute(`SELECT r.id, r.test_code, t.name, r.answers, r.total_score, r.result_level, r.result_desc, r.completed_at
         FROM test_results r
                  JOIN psychological_tests t ON r.test_id = t.id
         WHERE r.id = ? AND r.user_id = ?`, [resultId, userId]);
    const results = rows;
    if (results.length === 0) {
        throw new error_2.BusinessError('结果不存在', 404);
    }
    res.json({
        success: true,
        data: {
            ...results[0],
            answers: JSON.parse(results[0].answers)
        }
    });
}));
exports.default = router;
