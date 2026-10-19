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
}

// AI 记忆功能是否启用（服务端已配置向量服务）
export const getMemoryStatus = (): Promise<{ success: boolean; data: MemoryStatus }> => {
  return request.get('/memory/status') as Promise<{ success: boolean; data: MemoryStatus }>
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
