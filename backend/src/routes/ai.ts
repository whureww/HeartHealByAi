import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import {
    callAI, callAIWithConfig, extractDeltaChunk, getStreamRequestParams,
    getAIConfig, getFallbackConfig, isRetryableAIError, isProviderError
} from '../utils/aiClient';
import { decryptSecret } from '../utils/secretBox';
import { pool } from '../db/mysql';
import { retrieveRagContext, extractAndStoreMemories, backfillChatEmbeddings } from '../utils/memory';
import { isSupportedLang, translateText, translateTextLong, TRANSLATE_LANG_NAMES } from '../utils/translate';

const router = Router();

/**
 * 解析当前用户的模型路由：
 * - 所选模型自带网关配置（base_url+api_key）→ 主路 = 用户自己的配置（key 解密使用），备路 = 默认主厂
 * - 所选模型无自带配置且配了副厂网关 → 主路 = 网关 + 所选模型，备路 = 默认主厂
 * - 未选择 → 主路 = 默认主厂，备路 = 副厂网关（默认模型）
 */
async function resolveUserRouting(userId: number): Promise<{
    primary: { baseURL: string; apiKey: string; model: string };
    secondary: { baseURL: string; apiKey: string; model: string } | null;
}> {
    const [rows] = await pool.execute(
        'SELECT model, base_url, api_key FROM user_chat_models WHERE user_id = ? AND selected = 1 LIMIT 1',
        [userId]
    );
    const row = (rows as any[])[0];
    const main = getAIConfig();
    const gw = getFallbackConfig();

    if (row) {
        // 用户自带网关配置优先（key 加密落库，这里解密用于转发）
        if (row.base_url && row.api_key) {
            try {
                const key = decryptSecret(String(row.api_key));
                if (key) {
                    return {
                        primary: { baseURL: String(row.base_url).replace(/\/+$/, ''), apiKey: key, model: String(row.model) },
                        secondary: main
                    };
                }
            } catch (e: any) {
                console.error('[resolveUserRouting] 用户模型密钥解密失败（' + row.model + '），回落默认链路');
            }
        }
        // 只填了模型名 → 走服务端统一副厂网关
        if (gw) {
            return { primary: { ...gw, model: String(row.model) }, secondary: main };
        }
    }
    return { primary: main, secondary: gw };
}

const SYSTEM_PROMPT = '你是一位专业且温暖的心理咨询师，名叫心愈。你的职责是：1.倾听与共情：认真倾听用户的情绪倾诉，给予共情和理解 2.专业疏导：运用心理学知识，帮助用户梳理情绪、缓解压力 3.安全边界：不提供医疗诊断，遇到严重心理问题建议寻求专业医生帮助 4.温暖陪伴：用亲切、自然的语气交流，像一位知心朋友。回复要求：语气温暖、亲切，避免说教；回复控制在200字以内，简洁有力；如果用户表达负面情绪，先共情再引导。排版要求（必须遵守）：回复分成2~3个自然段，段落之间用空行分隔，每段1~3句话，绝不允许把所有内容挤成一整段文字墙；第一段用一句话直接回应用户此刻的感受，最后一段温暖收束或给出一个小建议；适度使用emoji点缀（🌻💙✨等，每条回复不超过3个），可放在段首增加温度；不要使用#、*、-等markdown符号，纯文本排版';

const REPORT_PROMPT = '你是一位资深心理数据分析师，擅长整合多维度心理数据进行系统性分析。分析维度包括：1.情绪趋势：从聊天记录中提取情绪波动规律 2.测评解读：结合心理测评量表结果进行专业解读 3.风险评估：识别潜在的心理健康风险信号 4.改善建议：提供个性化、可执行的心理调节方案。输出格式要求：使用Markdown格式；分章节清晰呈现；语言专业但易懂；总字数控制在800-1200字';

// 上下文窗口上限：只把最近 30 条消息发给 AI（每条 user/ai 各算一条），
// 避免超长会话 token 成本线性膨胀与上游上下文超限报错
const CONTEXT_WINDOW = 30;

// RAG 注入格式（语言跟随界面语言，非中文界面用英文标签）
function buildRagPrompt(rag: { memories: string[]; history: { type: string; content: string; created_at: string }[] }, isEn: boolean): string {
    const parts: string[] = [];
    if (rag.memories.length > 0) {
        parts.push(isEn
            ? '【Long-term memory】Facts about this user from previous conversations. Weave them in naturally; never recite them mechanically or mention this list:\n- ' + rag.memories.join('\n- ')
            : '【长期记忆】以下是关于该用户的过往记忆，请自然融入回复，不要机械复述或刻意提及：\n- ' + rag.memories.join('\n- '));
    }
    if (rag.history.length > 0) {
        const lines = rag.history.map((h) => {
            const role = h.type === 'user' ? (isEn ? 'User' : '用户') : (isEn ? 'AI' : 'AI');
            const time = h.created_at ? String(h.created_at).slice(0, 16).replace('T', ' ') : '';
            return `[${time}] ${role}: ${h.content}`;
        });
        parts.push(isEn
            ? '【Relevant past conversations】Related excerpts from earlier chats:\n' + lines.join('\n')
            : '【相关历史对话】过往聊天中与此相关的片段：\n' + lines.join('\n'));
    }
    return parts.join('\n\n');
}

function buildChatMessages(
    messages: any[],
    context: any,
    locale?: string,
    rag?: { memories: string[]; history: { type: string; content: string; created_at: string }[] } | null
): { role: string; content: string }[] {
    // 只保留最近 CONTEXT_WINDOW 条对话消息
    const windowed = Array.isArray(messages) && messages.length > CONTEXT_WINDOW
        ? messages.slice(-CONTEXT_WINDOW)
        : (messages || []);
    let system = SYSTEM_PROMPT;
    // 语言跟随：前端携带用户界面语言，非中文界面要求 AI 用对应语言回复
    const isEn = locale === 'en';
    if (isEn) {
        system += ' Always respond in English regardless of the language the user writes in.'
            + ' Formatting rules (must follow): split the reply into 2-3 short paragraphs separated by blank lines (1-3 sentences each, never one wall of text);'
            + ' open with one sentence directly acknowledging how the user feels, close warmly with a small suggestion;'
            + ' use a few emojis (max 3 per reply), no markdown symbols like # * -.';
    }
    // RAG 上下文注入：长期记忆 + 相关历史对话（检索失败时为空，直接跳过）
    const ragPrompt = rag ? buildRagPrompt(rag, isEn) : '';
    if (ragPrompt) {
        system += '\n\n' + ragPrompt;
    }
    const chatMessages: { role: string; content: string }[] = [
        { role: 'system', content: system },
        ...windowed.map((msg: any) => ({
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

/**
 * RAG 前置检索：以最后一条用户消息为查询，拉取记忆 + 历史片段。
 * 检索内部 fail-open（失败返回空），这里再兜一层 try 保证对话绝不因 RAG 中断。
 * 同时顺手触发历史消息一次性补嵌（老数据）。
 */
async function retrieveContextSafe(userId: number, messages: any[]) {
    try {
        const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
        const query = String(lastUser?.content || '').trim();
        if (!query) return null;
        const rag = await retrieveRagContext(userId, query);
        void backfillChatEmbeddings(userId);
        return rag;
    } catch (e: any) {
        console.error('[ai] RAG 上下文检索异常（跳过注入）:', e.message);
        return null;
    }
}

/** 对话结束后异步抽取记忆（fire-and-forget，不阻塞响应） */
function scheduleMemoryExtraction(userId: number, sessionId: string, userMsg: string, aiReply: string) {
    void extractAndStoreMemories(userId, sessionId, userMsg, aiReply);
}

// ===== 普通 AI 聊天接口（非流式）=====
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const { messages, context, locale, session_id } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    // RAG：检索记忆与相关历史注入系统提示词（失败自动降级为无 RAG 对话）
    const rag = await retrieveContextSafe(req.user!.id, messages);
    const chatMessages = buildChatMessages(messages, context, locale, rag);
    const opts = { temperature: 0.7, maxTokens: 800, timeout: 30000 };

    // 用户级模型路由：所选模型走副厂网关，失败自动回落默认主厂
    const { primary, secondary } = await resolveUserRouting(req.user!.id);
    let content: string;
    try {
      content = await callAIWithConfig(primary, chatMessages, opts);
    } catch (err: any) {
      // 瞬时故障或上游明确拒绝（key 封禁等）都回落备用厂商
      if (!secondary || !(isRetryableAIError(err) || isProviderError(err))) throw err;
      console.error('[ai/chat] 主路故障（' + (err.code || err.response?.status) + '），回落备用厂商');
      content = await callAIWithConfig(secondary, chatMessages, opts);
    }

    // 回复完成后异步抽取长期记忆（fire-and-forget，不阻塞响应）
    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
    if (content) {
      scheduleMemoryExtraction(
        req.user!.id,
        String(session_id || 'default'),
        String(lastUser?.content || ''),
        content
      );
    }

    res.json({
      success: true,
      // 兜底回复语言跟随界面语言，避免英文界面冒出中文残留
      content: content || (locale === 'en' ? "Sorry, I can't reply right now. Please try again later." : '抱歉，我暂时无法回复，请稍后再试。')
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
  // 响应是否已收尾/中断（防止在途译文向已结束的连接写入；try/catch 作用域外声明）
  let responseClosed = false;
  res.on('close', () => { responseClosed = true; });

  try {
    const { messages, context, locale, session_id, translate_to } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    // 实时翻译目标语言（可选）：携带受支持的语言码时，AI 增量按句送
    // bilibili Index-Translate 同步翻译，译文经 {translated} 事件下发
    const translateTo = typeof translate_to === 'string' && isSupportedLang(translate_to)
      ? String(translate_to).toLowerCase()
      : '';

    // RAG：检索记忆与相关历史注入系统提示词（失败自动降级为无 RAG 对话）
    const rag = await retrieveContextSafe(req.user!.id, messages);
    const chatMessages = buildChatMessages(messages, context, locale, rag);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 用户级模型路由：主路失败 → 1.5s 重试一次 → 仍失败切备路
    // （未选模型：主=默认厂商，备=副厂网关；选了模型：主=网关+所选模型，备=默认厂商）
    const { primary, secondary } = await resolveUserRouting(req.user!.id);
    const primaryParams = getStreamRequestParams(chatMessages, { temperature: 0.7, maxTokens: 800 }, primary);
    const secondaryParams = secondary
        ? getStreamRequestParams(chatMessages, { temperature: 0.7, maxTokens: 800 }, secondary)
        : null;

    const requestStream = (cfg = primaryParams) => axios.post(cfg.url, cfg.body, {
      headers: cfg.headers,
      timeout: cfg.timeout,
      responseType: 'stream'
    });

    let response;
    try {
      response = await requestStream();
    } catch (err: any) {
      const transient = isRetryableAIError(err);
      // 瞬时故障先原厂商重试一次；瞬时或明确拒绝（key 封禁等）都可切备路
      if (!transient && !isProviderError(err)) throw err;
      if (transient) {
        console.error('[ai/chat-stream] 主路瞬时故障（' + (err.code || err.response?.status) + '），1.5s 后重试一次');
        await new Promise(r => setTimeout(r, 1500));
        try {
          response = await requestStream();
        } catch (err2: any) {
          err = err2;
        }
      }
      if (!response) {
        if (!secondaryParams || !(isRetryableAIError(err) || isProviderError(err))) throw err;
        console.error('[ai/chat-stream] 主路不可用（' + (err.code || err.response?.status) + '），切换备用厂商');
        response = await requestStream(secondaryParams);
      }
    }

    // 转发流式数据（增量文本经 extractDeltaChunk 归一化，兼容各家格式）
    const stream = response.data;

    // 全文累积：流结束后用于异步抽取长期记忆（fire-and-forget，不影响转发）
    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
    let fullReply = '';

    // ===== 实时翻译（bilibili Index-Translate，fail-open：译文失败不影响原文转发）=====
    // AI 增量按句切分 → 句子进翻译队列（并发 2）→ 完成后严格按原文句序经 {translated} 事件下发
    let sentenceBuf = '';
    let translatedSeq = 0;                       // 已入队句子序号
    let flushSeq = 0;                            // 下一个待下发的句子序号
    const translatedMap = new Map<number, string>();
    const translateQueue: { idx: number; text: string }[] = [];
    let translateInFlight = 0;
    let translateEnded = false;                  // 上游流已结束
    let finishAfterTranslate: (() => void) | null = null;
    const TRANSLATE_PARALLEL = 2;

    const emitTranslated = () => {
      if (responseClosed) return;
      while (translatedMap.has(flushSeq)) {
        const t = translatedMap.get(flushSeq)!;
        translatedMap.delete(flushSeq);
        flushSeq++;
        if (t) res.write(`data: ${JSON.stringify({ translated: t })}\n\n`);
      }
    };

    const pumpTranslate = () => {
      while (translateInFlight < TRANSLATE_PARALLEL && translateQueue.length > 0) {
        const job = translateQueue.shift()!;
        translateInFlight++;
        translateText(job.text, translateTo, undefined, 30000)
          .then((t) => { translatedMap.set(job.idx, t); })
          .catch((e: any) => {
            console.error('[ai/chat-stream] 实时翻译单句失败（跳过该句）:', e?.message);
            translatedMap.set(job.idx, '');
          })
          .finally(() => {
            translateInFlight--;
            emitTranslated();
            pumpTranslate();
            if (translateEnded && translateInFlight === 0 && translateQueue.length === 0 && finishAfterTranslate) {
              const fin = finishAfterTranslate;
              finishAfterTranslate = null;
              fin();
            }
          });
      }
    };

    // 从缓冲切出完整句子：中文句末标点必切；英文 .!? 需后随空白/结尾且句子足够长
    //（避免小数、缩写被切碎，不满足则并入下一句），不完整尾段留在缓冲
    const splitSentences = (buf: string): { sentences: string[]; rest: string } => {
      const sentences: string[] = [];
      let start = 0;
      const re = /[。！？；…\n]|([.!?])(?=\s|$)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(buf)) !== null) {
        const end = m.index + m[0].length;
        const seg = buf.slice(start, end);
        if (m[1] && seg.trim().length < 8) continue;
        start = end;
        if (seg.trim()) sentences.push(seg);
      }
      return { sentences, rest: buf.slice(start) };
    };

    const feedTranslation = (delta: string) => {
      if (!translateTo) return;
      sentenceBuf += delta;
      const { sentences, rest } = splitSentences(sentenceBuf);
      sentenceBuf = rest;
      for (const s of sentences) {
        translateQueue.push({ idx: translatedSeq++, text: s });
      }
      if (sentences.length) pumpTranslate();
    };

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
            responseClosed = true;
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
            fullReply += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
            feedTranslation(content);
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

    const finishResponse = () => {
      responseClosed = true;
      // 流结束后异步抽取长期记忆（fire-and-forget，不阻塞响应收尾）
      if (fullReply.trim()) {
        scheduleMemoryExtraction(
          req.user!.id,
          String(session_id || 'default'),
          String(lastUser?.content || ''),
          fullReply
        );
      }
      res.end();
    };

    stream.on('end', () => {
      clearWatchdog();
      lineBuffer += decoder.decode();   // flush 解码器残留字节
      if (lineBuffer.trim() !== '') {
        handleLine(lineBuffer);         // 处理结尾未带换行符的最后一行
      }
      if (!translateTo) {
        finishResponse();
        return;
      }
      // 实时翻译收尾：剩余不满一句的尾巴也送翻译；等在途/排队译文按序
      // 下发完再结束响应。兜底 15s 强制收尾，宁缺译文不断流（fail-open）
      if (sentenceBuf.trim()) {
        translateQueue.push({ idx: translatedSeq++, text: sentenceBuf.trim() });
        sentenceBuf = '';
      }
      translateEnded = true;
      finishAfterTranslate = () => {
        emitTranslated();
        finishResponse();
      };
      const forceEnd = setTimeout(() => {
        if (finishAfterTranslate) {
          console.error('[ai/chat-stream] 实时翻译收尾超时（15s），跳过剩余译文');
          const fin = finishAfterTranslate;
          finishAfterTranslate = null;
          fin();
        }
      }, 15000);
      const oldFin = finishAfterTranslate;
      finishAfterTranslate = () => {
        clearTimeout(forceEnd);
        oldFin();
      };
      pumpTranslate();
      if (translateInFlight === 0 && translateQueue.length === 0 && finishAfterTranslate) {
        const fin = finishAfterTranslate;
        finishAfterTranslate = null;
        fin();
      }
    });

    stream.on('error', (err: any) => {
      clearWatchdog();
      console.error('流式响应错误:', err);
      responseClosed = true;
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
      responseClosed = true;
      res.write(`data: ${JSON.stringify({ error: '服务异常' })}\n\n`);
      res.end();
    }
  }
});

// ===== 生成心理分析报告接口 =====
router.post('/summarize-report', authenticate, async (req: Request, res: Response) => {
  try {
    const { chatHistory, testResults, startDate, endDate, locale } = req.body;

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

    // 报告语言跟随生成时的界面语言；时间段文案同步本地化
    const isEn = locale === 'en';
    const periodStr = isEn
      ? `${startDate} to ${endDate}`
      : `${startDate} 至 ${endDate}`;

    const analysisData = {
      period: periodStr,
      chatSummary: chatSummary,
      testResults: testData
    };

    const userPrompt = '请根据以下用户心理数据生成一份专业的心理状态分析报告：' + JSON.stringify(analysisData, null, 2);

    const systemPrompt = isEn
      ? REPORT_PROMPT + ' Write the entire report in English regardless of the language of the input data.'
      : REPORT_PROMPT;

    const report = await callAI(
      [
        { role: 'system', content: systemPrompt },
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

// ===== 报告翻译：走 bilibili Index-Translate 公共网关（32 语种），不可用时回落主厂大模型 =====
// 译文不落库、不覆盖原文
router.post('/translate', authenticate, async (req: Request, res: Response) => {
  try {
    const { text, locale, target } = req.body || {};
    const raw = String(text || '').trim();
    if (!raw) {
      res.status(400).json({ success: false, error: '缺少待翻译文本' });
      return;
    }
    // 目标语言：显式语言码（Index-Translate 语种表）优先；未传/不支持时随界面语言回落中英
    const targetCode = isSupportedLang(String(target || ''))
      ? String(target).toLowerCase()
      : (locale === 'en' ? 'en' : 'zh');

    // 首选 Index-Translate 公共翻译网关（免费、多语种；长文本自动分块绕开其 504 限制）
    try {
      const translated = await translateTextLong(
        raw.slice(0, 12000),
        targetCode,
        '严格保留原文的 Markdown 结构、标题、列表与换行，忠实且自然地翻译全部内容',
        90000
      );
      if (translated) {
        res.json({ success: true, translated });
        return;
      }
      throw new Error('empty translation');
    } catch (e: any) {
      // 公共网关不可用 → 回落主厂大模型翻译链路（保底）
      console.error('[ai/translate] Index-Translate 不可用，回落主厂模型:', e?.message);
      // 目标语言必须跟随用户所选 targetCode，而非界面语言 locale：
      // 此前按 locale 取「简体中文」，中文界面选英语翻译时回落链路会把中文原样返回（等于没翻译）
      const targetName = TRANSLATE_LANG_NAMES[targetCode] || (locale === 'en' ? 'English' : '简体中文');
      const fallbackMessages = [
        {
          role: 'system' as const,
          content: 'You are a professional translator for psychological analysis reports. Translate the user text into ' + targetName
            + '. Preserve the original Markdown structure, headings, lists and line breaks exactly. Translate faithfully and naturally; output ONLY the translation with no explanations.'
        },
        { role: 'user' as const, content: raw.slice(0, 12000) }
      ];
      // 回落链路稳健性：deepseek-v4-flash 为推理型模型，长文本会先输出大段思考，
      // token 预算不足时 content 可能为空 → 首选 8000，仍为空则升级 12000 再试一次
      let fallback = '';
      let lastErr: any = null;
      for (const maxTokens of [8000, 12000]) {
        try {
          fallback = await callAI(fallbackMessages, { temperature: 0.3, maxTokens, timeout: 90000 });
        } catch (e: any) {
          lastErr = e;
        }
        if (fallback) break;
      }
      if (!fallback) {
        if (lastErr) throw lastErr;
        throw new Error('翻译结果为空');
      }
      res.json({ success: true, translated: fallback });
    }
  } catch (error: any) {
    console.error('翻译接口错误:', error.message);
    res.status(500).json({
      success: false,
      error: '翻译服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
    });
  }
});

export default router;
