"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("../middleware/auth");
dotenv_1.default.config();
const router = (0, express_1.Router)();
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = 'https://api.deepseek.com';
const SYSTEM_PROMPT = '你是一位专业且温暖的心理咨询师，名叫心愈。你的职责是：1.倾听与共情：认真倾听用户的情绪倾诉，给予共情和理解 2.专业疏导：运用心理学知识，帮助用户梳理情绪、缓解压力 3.安全边界：不提供医疗诊断，遇到严重心理问题建议寻求专业医生帮助 4.温暖陪伴：用亲切、自然的语气交流，像一位知心朋友。回复要求：语气温暖、亲切，避免说教；适当使用emoji增加亲和力；回复控制在200字以内，简洁有力；如果用户表达负面情绪，先共情再引导';
const REPORT_PROMPT = '你是一位资深心理数据分析师，擅长整合多维度心理数据进行系统性分析。分析维度包括：1.情绪趋势：从聊天记录中提取情绪波动规律 2.测评解读：结合心理测评量表结果进行专业解读 3.风险评估：识别潜在的心理健康风险信号 4.改善建议：提供个性化、可执行的心理调节方案。输出格式要求：使用Markdown格式；分章节清晰呈现；语言专业但易懂；总字数控制在800-1200字';
// ===== 普通 AI 聊天接口（非流式）=====
router.post('/chat', auth_1.authenticate, async (req, res) => {
    try {
        const { messages, context } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({ error: 'messages 不能为空' });
            return;
        }
        const chatMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.map((msg) => ({
                role: msg.role,
                content: msg.content
            }))
        ];
        if (context && Object.keys(context).length > 0) {
            const contextStr = JSON.stringify(context, null, 2);
            chatMessages[0].content = chatMessages[0].content + ' 用户背景数据：' + contextStr;
        }
        const response = await axios_1.default.post(BASE_URL + '/chat/completions', {
            model: 'deepseek-v4-flash',
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 800,
        }, {
            headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });
        const content = response.data.choices[0]?.message?.content || '抱歉，我暂时无法回复，请稍后再试。';
        res.json({
            success: true,
            content,
            usage: response.data.usage
        });
    }
    catch (error) {
        console.error('AI 聊天接口错误:', error.message);
        res.status(500).json({
            success: false,
            error: 'AI 服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
        });
    }
});
// ===== 流式 AI 聊天接口（SSE）=====
router.post('/chat-stream', auth_1.authenticate, async (req, res) => {
    try {
        const { messages, context } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({ error: 'messages 不能为空' });
            return;
        }
        const chatMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.map((msg) => ({
                role: msg.role,
                content: msg.content
            }))
        ];
        if (context && Object.keys(context).length > 0) {
            const contextStr = JSON.stringify(context, null, 2);
            chatMessages[0].content = chatMessages[0].content + ' 用户背景数据：' + contextStr;
        }
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        // 发送请求到 DeepSeek（流式）
        const response = await axios_1.default.post(BASE_URL + '/chat/completions', {
            model: 'deepseek-v4-flash',
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 800,
            stream: true, // ← 开启流式
        }, {
            headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
            responseType: 'stream', // ← 流式响应
        });
        // 转发 DeepSeek 的流式数据
        const stream = response.data;
        stream.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                if (line.trim() === 'data: [DONE]') {
                    res.write('data: [DONE]\n\n');
                    continue;
                }
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const content = data.choices?.[0]?.delta?.content || '';
                        if (content) {
                            // 发送 SSE 格式数据
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    }
                    catch (e) {
                        // 忽略解析失败的行
                    }
                }
            }
        });
        stream.on('end', () => {
            res.end();
        });
        stream.on('error', (err) => {
            console.error('流式响应错误:', err);
            res.write(`data: ${JSON.stringify({ error: '流式响应中断' })}\n\n`);
            res.end();
        });
    }
    catch (error) {
        console.error('流式 AI 聊天接口错误:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'AI 服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
            });
        }
        else {
            res.write(`data: ${JSON.stringify({ error: '服务异常' })}\n\n`);
            res.end();
        }
    }
});
// ===== 生成心理分析报告接口 =====
router.post('/summarize-report', auth_1.authenticate, async (req, res) => {
    try {
        const { chatHistory, testResults, startDate, endDate } = req.body;
        if (!startDate || !endDate) {
            res.status(400).json({ error: '请提供完整的起止日期' });
            return;
        }
        const chatSummary = (chatHistory || []).map((msg) => ({
            time: msg.created_at || '未知',
            role: msg.type === 'user' ? '用户' : 'AI',
            content: (msg.content || '').substring(0, 100)
        }));
        const testData = (testResults || []).map((result) => ({
            name: result.test_name || '未知量表',
            score: result.total_score || 0,
            level: result.result_level || '未知',
            desc: result.result_desc || ''
        }));
        const periodStr = String(startDate) + ' 至 ' + String(endDate);
        const analysisData = {
            period: periodStr,
            chatSummary: chatSummary,
            testResults: testData
        };
        const userPrompt = '请根据以下用户心理数据生成一份专业的心理状态分析报告：' + JSON.stringify(analysisData, null, 2);
        const response = await axios_1.default.post(BASE_URL + '/chat/completions', {
            model: 'deepseek-v4-flash',
            messages: [
                { role: 'system', content: REPORT_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 2000,
        }, {
            headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 20000,
        });
        const report = response.data.choices[0]?.message?.content || '报告生成失败，请稍后重试。';
        res.json({
            success: true,
            report: report,
            usage: response.data.usage
        });
    }
    catch (error) {
        console.error('报告生成接口错误:', error.message);
        res.status(500).json({
            success: false,
            error: '报告生成服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
        });
    }
});
exports.default = router;
