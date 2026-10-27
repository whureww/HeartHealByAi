import request from './request'

export interface MemoryItem {
  id: number
  content: string
  source_session_id: string | null
  created_at: string
  updated_at: string
}

export interface MemoryStatus {
  enabled: boolean
  ai_memory: boolean
  cross_memory: boolean
}

// AI 记忆功能是否启用（服务端已配置向量服务）+ 用户记忆开关状态
export const getMemoryStatus = (): Promise<{ success: boolean; data: MemoryStatus }> => {
  return request.get('/memory/status') as Promise<{ success: boolean; data: MemoryStatus }>
}

// 保存记忆开关（AI 记忆 / 跨对话记忆）
export const updateMemorySettings = (aiMemory: boolean, crossMemory: boolean): Promise<{ success: boolean; data: { ai_memory: boolean; cross_memory: boolean } }> => {
  return request.put('/memory/settings', { ai_memory: aiMemory, cross_memory: crossMemory }) as Promise<{ success: boolean; data: { ai_memory: boolean; cross_memory: boolean } }>
}

// 记忆列表
export const listMemories = (): Promise<{ success: boolean; data: MemoryItem[] }> => {
  return request.get('/memory/list') as Promise<{ success: boolean; data: MemoryItem[] }>
}

// 删除单条记忆
export const deleteMemory = (id: number): Promise<{ success: boolean }> => {
  return request.delete(`/memory/${id}`) as Promise<{ success: boolean }>
}

// 清空全部记忆
export const clearMemories = (): Promise<{ success: boolean; data: { deleted: number } }> => {
  return request.post('/memory/clear') as Promise<{ success: boolean; data: { deleted: number } }>
}
