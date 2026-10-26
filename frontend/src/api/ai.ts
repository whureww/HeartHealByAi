import request from './request'
import { API_BASE, getAuthToken } from '@/config'
import { i18n } from '@/i18n'

export interface AIChatResponse {
  success: boolean
  content: string
  usage?: any
}

export interface AIReportResponse {
  success: boolean
  report: string
  usage?: any
}

// 普通 AI 聊天（session_id 可选：供服务端记忆抽取标记来源会话）
export const chatWithAI = (messages: {role: string, content: string}[], context?: any, sessionId?: string): Promise<AIChatResponse> => {
  return request.post('/ai/chat', { messages, context, locale: i18n.global.locale.value, session_id: sessionId }) as Promise<AIChatResponse>
}

// 流式 AI 聊天
// options.translateTo 携带目标语言码时，后端同步按句流式翻译（bilibili Index-Translate），
// 译文经 {translated} SSE 事件由 options.onTranslated 回调下发；翻译失败只影响译文（fail-open）
export const chatWithAIStream = (
  messages: {role: string, content: string}[],
  onMessage: (content: string) => void,
  onError?: (error: string) => void,
  onComplete?: () => void,
  context?: any,
  sessionId?: string,
  options?: { translateTo?: string; onTranslated?: (content: string) => void }
) => {
// 由于 EventSource 不支持 POST，我们用 fetch + ReadableStream
  const token = getAuthToken()

  return fetch(`${API_BASE}/ai/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    // 携带界面语言：英文界面下要求 AI 用英文回复；session_id 供服务端记忆抽取标记来源；
    // translate_to 携带目标语言码时开启实时翻译
    body: JSON.stringify({
      messages,
      context,
      locale: i18n.global.locale.value,
      session_id: sessionId,
      translate_to: options?.translateTo || undefined
    })
  }).then(response => {
    if (!response.ok) {
      throw new Error(i18n.global.t('core.api.networkFailed'))
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error(i18n.global.t('core.api.streamUnavailable'))
    }

    const decoder = new TextDecoder()
    let buffer = ''

    return new Promise<void>((resolve, reject) => {
      function read() {
        reader!.read().then(({ done, value }) => {
          if (done) {
            onComplete?.()
            resolve()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.content) {
                  onMessage(data.content)
                } else if (data.translated) {
                  options?.onTranslated?.(data.translated)
                } else if (data.error) {
                  onError?.(data.error)
                }
              } catch (e) {
                // 忽略解析失败
              }
            }
          }

          read()
        }).catch(err => {
          onError?.(err.message)
          reject(err)
        })
      }

      read()
    })
  })
}

// 生成心理分析报告（携带界面语言：英文界面生成英文报告）
export const generateReport = (data: {
  chatHistory: any[],
  testResults: any[],
  startDate: string,
  endDate: string
}): Promise<AIReportResponse> => {
  return request.post('/ai/summarize-report', { ...data, locale: i18n.global.locale.value }) as Promise<AIReportResponse>
}

export interface AITranslateResponse {
  success: boolean
  translated: string
}

// 翻译已生成的报告（target 可选：Index-Translate 语言码，32 语种；
// 译文不落库，仅本次展示；原文始终保留）
// 翻译链路（分块送译/回落主厂模型）耗时可达 90s+，单独放宽超时到 120s（默认 50s 会中途掐断）
export const translateReport = (text: string, target?: string): Promise<AITranslateResponse> => {
  return request.post('/ai/translate', { text, target, locale: i18n.global.locale.value }, { timeout: 120000 }) as Promise<AITranslateResponse>
}
