import request from './request'
import { API_BASE, getAuthToken } from '@/config'

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

// 普通 AI 聊天
export const chatWithAI = (messages: {role: string, content: string}[], context?: any): Promise<AIChatResponse> => {
  return request.post('/ai/chat', { messages, context }) as Promise<AIChatResponse>
}

// 流式 AI 聊天
export const chatWithAIStream = (
  messages: {role: string, content: string}[],
  onMessage: (content: string) => void,
  onError?: (error: string) => void,
  onComplete?: () => void,
  context?: any
) => {
// 由于 EventSource 不支持 POST，我们用 fetch + ReadableStream
  const token = getAuthToken()

  return fetch(`${API_BASE}/ai/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ messages, context })
  }).then(response => {
    if (!response.ok) {
      throw new Error('网络请求失败')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
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

// 生成心理分析报告
export const generateReport = (data: {
  chatHistory: any[],
  testResults: any[],
  startDate: string,
  endDate: string
}): Promise<AIReportResponse> => {
  return request.post('/ai/summarize-report', data) as Promise<AIReportResponse>
}
