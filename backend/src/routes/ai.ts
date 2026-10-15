import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { callAI, extractDeltaChunk, getStreamRequestParams } from '../utils/aiClient';

const router = Router();

const SYSTEM_PROMPT = '你是一位专业且温暖的心理咨询师，名叫心愈。你的职责是：1.倾听与共情：认真倾听用户的情绪倾诉，给予共情和理解 2.专业疏导：运用心理学知识，帮助用户梳理情绪、缓解压力 3.安全边界：不提供医疗诊断，遇到严重心理问题建议寻求专业医生帮助 4.温暖陪伴：用亲切、自然的语气交流，像一位知心朋友。回复要求：语气温暖、亲切，避免说教；适当使用emoji增加亲和力；回复控制在200字以内，简洁有力；如果用户表达负面情绪，先共情再引导';

const REPORT_PROMPT = '你是一位资深心理数据分析师，擅长整合多维度心理数据进行系统性分析。分析维度包括：1.情绪趋势：从聊天记录中提取情绪波动规律 2.测评解读：结合心理测评量表结果进行专业解读 3.风险评估：识别潜在的心理健康风险信号 4.改善建议：提供个性化、可执行的心理调节方案。输出格式要求：使用Markdown格式；分章节清晰呈现；语言专业但易懂；总字数控制在800-1200字';

function buildChatMessages(messages: any[], context: any): { role: string; content: string }[] {
    const chatMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content
        }))
    ];
    if (context && Object.keys(context).length > 0) {
        const contextStr = JSON.stringify(context, null, 2);
        chatMessages[0].content += ' 用户背景数据：' + contextStr;
    }
    return chatMessages;
}

// ===== 普通 AI 聊天接口（非流式）=====
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    const content = await callAI(buildChatMessages(messages, context), {
      temperature: 0.7,
      maxTokens: 800,
      timeout: 30000
    });

    res.json({
      success: true,
      content: content || '抱歉，我暂时无法回复，请稍后再试。'
    });

  } catch (error: any) {
    console.error('AI 聊天接口错误:', error.message);
    res.status(500).json({
      success: false,
      error: 'AI 服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
    });
  }
});

// ===== 流式 AI 聊天接口（SSE）=====
router.post('/chat-stream', authenticate, async (req: Request, res: Response) => {
  try {
    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    const chatMessages = buildChatMessages(messages, context);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 统一客户端构造流式请求参数（厂商由环境变量决定）
    const params = getStreamRequestParams(chatMessages, { temperature: 0.7, maxTokens: 800 });

    const requestStream = () => axios.post(params.url, params.body, {
      headers: params.headers,
      timeout: params.timeout,
      responseType: 'stream'
    });

    // 上游瞬时故障自动重试：DeepSeek 偶发 503/连接重置（实测美国服务器访问
    // 间歇出现），失败快（尚未发出任何响应头）时静默重试一次
    let response;
    try {
      response = await requestStream();
    } catch (err: any) {
      const retryable = [502, 503, 504].includes(err.response?.status)
        || ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EPIPE'].includes(err.code);
      if (!retryable) throw err;
      console.error('上游瞬时故障（' + (err.code || err.response?.status) + '），1.5s 后重试一次');
      await new Promise(r => setTimeout(r, 1500));
      response = await requestStream();
    }

    // 转发流式数据（增量文本经 extractDeltaChunk 归一化，兼容各家格式）
    const stream = response.data;

    // 上游流看门狗：axios 的 timeout 只覆盖到收到响应头为止，若对端在
    // 传输阶段停滞（连接挂着但一个字节都不来），超时不会触发，请求会
    // 永久挂死（前端表现为一直"思考中"）。这里在持续无数据 30 秒时
    // 主动断开上游并向前端下发错误事件，让界面能恢复可输入状态
    const INACTIVITY_MS = 30000;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const clearWatchdog = () => {
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    };
    const resetWatchdog = () => {
        clearWatchdog();
        watchdog = setTimeout(() => {
            console.error('流式响应看门狗触发：上游 ' + INACTIVITY_MS + 'ms 无数据，主动断开');
            try { stream.destroy(); } catch (e) { /* 忽略销毁异常 */ }
            res.write(`data: ${JSON.stringify({ error: 'AI 响应超时，请稍后重试' })}\n\n`);
            res.end();
        }, INACTIVITY_MS);
    };
    resetWatchdog();

    // 跨 chunk 缓冲：TCP 分包可能把一行 data: {...} 拆到两个 chunk，
    // 按 chunk 直接切行会把拆断的行静默丢弃（回复随机丢字）；
    // 这里保留不完整尾行待下次拼接，并用流式解码避免多字节 UTF-8 字符被分包切坏
    const decoder = new TextDecoder('utf-8');
    let lineBuffer = '';

    const handleLine = (line: string) => {
      if (line.trim() === '') return;

      if (line.trim() === 'data: [DONE]') {
        res.write('data: [DONE]\n\n');
        return;
      }

      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          const content = extractDeltaChunk(data);
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (e) {
          // 忽略解析失败的行
        }
      }
    };

    stream.on('data', (chunk: Buffer) => {
      resetWatchdog();
      lineBuffer += decoder.decode(chunk, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';   // 不完整的尾行留到下一个 chunk 拼接
      for (const line of lines) {
        handleLine(line);
      }
    });

    stream.on('end', () => {
      clearWatchdog();
      lineBuffer += decoder.decode();   // flush 解码器残留字节
      if (lineBuffer.trim() !== '') {
        handleLine(lineBuffer);         // 处理结尾未带换行符的最后一行
      }
      res.end();
    });

    stream.on('error', (err: any) => {
      clearWatchdog();
      console.error('流式响应错误:', err);
      res.write(`data: ${JSON.stringify({ error: '流式响应中断' })}\n\n`);
      res.end();
    });

  } catch (error: any) {
    console.error('流式 AI 聊天接口错误:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'AI 服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: '服务异常' })}\n\n`);
      res.end();
    }
  }
});

// ===== 生成心理分析报告接口 =====
router.post('/summarize-report', authenticate, async (req: Request, res: Response) => {
  try {
    const { chatHistory, testResults, startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({ error: '请提供完整的起止日期' });
      return;
    }

    const chatSummary = (chatHistory || []).map((msg: any) => ({
      time: msg.created_at || '未知',
      role: msg.type === 'user' ? '用户' : 'AI',
      content: (msg.content || '').substring(0, 100)
    }));

    const testData = (testResults || []).map((result: any) => ({
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

    const report = await callAI(
      [
        { role: 'system', content: REPORT_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { temperature: 0.5, maxTokens: 2500, timeout: 60000 }
    );

    res.json({
      success: true,
      report: report || '报告生成失败，请稍后重试。'
    });

  } catch (error: any) {
    console.error('报告生成接口错误:', error.message);
    res.status(500).json({
      success: false,
      error: '报告生成服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
    });
  }
});

export default router;
