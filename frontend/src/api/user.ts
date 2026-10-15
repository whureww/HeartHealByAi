import request from './request'

// ========== 认证相关 ==========
export const login = (data: { email: string; password: string }) => {
  return request.post('/users/login', data)
}

// ========== 聊天举报 ==========
export const submitChatReport = (data: {
  appointment_id: number
  message_ids: number[]
  reason: string
  detail?: string
}) => request.post('/users/reports', data)

export const register = (data: { username: string; email: string; password: string; code: string }) => {
  return request.post('/users/register', data)
}

export const logout = () => {
  return request.post('/users/logout')
}

export const sendRegisterCode = (data: { email: string }) => {
  return request.post('/users/register/send-code', data)
}

export const sendResetCode = (data: { email: string }) => {
  return request.post('/users/forget-password/send-code', data)
}

export const resetPassword = (data: { email: string; code: string; newPassword: string }) => {
  return request.post('/users/forget-password/reset', data)
}

// ========== 用户信息 ==========
export const getUserInfo = () => {
  return request.get('/users/me')
}

// 修改昵称
export const updateUsername = (username: string) => {
  return request.put('/users/profile', { username })
}

// 修改头像（传 base64 字符串）
export const updateAvatar = (avatar: string) => {
  return request.put('/users/profile', { avatar })
}

// ========== 统计数据 ==========
export const getUserStats = () => {
  return request.get('/users/stats')
}

// ========== 聊天记录 ==========
// 不带 sessionId 返回全部会话消息（导出 / 报告分析），带则返回指定会话
export const getChatHistory = (sessionId?: string) => {
  return request.get('/users/chat-history', sessionId ? { params: { session_id: sessionId } } : undefined)
}

export const saveChat = (data: { content: string; type: string; session_id?: string }) => {
  return request.post('/users/chat', data)
}

// ========== AI 对话会话 ==========
export const getChatSessions = () => {
  return request.get('/users/chat-sessions')
}

// 新建对话：立即创建会话记录（空对话也出现在侧栏）
export const createChatSession = () => {
  return request.post('/users/chat-sessions')
}

// 锁定 / 解锁对话（锁定后置顶且不可删除）
export const lockChatSession = (sessionId: string, locked: boolean) => {
  return request.put(`/users/chat-sessions/${sessionId}/lock`, { locked })
}

// 让 AI 重新总结对话标题
export const refreshSessionSummary = (sessionId: string) => {
  return request.post(`/users/chat-sessions/${sessionId}/summary`)
}

export const deleteChatSession = (sessionId: string) => {
  return request.delete(`/users/chat-sessions/${sessionId}`)
}

// ========== 对话模型管理 ==========
// 获取可用模型（网关列表 + 用户自定义）与当前选中
export const getChatModels = () => {
  return request.get('/users/chat-models')
}

// 添加 / 更新自定义模型（base_url+api_key 自带网关配置；都留空走服务端网关）
export const addChatModel = (data: { model: string; base_url?: string; api_key?: string }) => {
  return request.post('/users/chat-models', data)
}

// 删除自定义模型
export const deleteChatModel = (model: string) => {
  return request.delete(`/users/chat-models/${encodeURIComponent(model)}`)
}

// 测试模型连通性（可直接测表单值，或 use_saved 测已保存配置）
export const testChatModel = (data: { model: string; base_url?: string; api_key?: string; use_saved?: boolean }) => {
  return request.post('/users/chat-models/test', data)
}

// 选择当前对话模型（传空串恢复默认）
export const selectChatModel = (model: string) => {
  return request.put('/users/chat-models/select', { model })
}

// ========== 测评 ==========
export const getTests = () => {
  return request.get('/users/tests')
}

// ========== 专家 ==========
export const getDoctors = () => {
  return request.get('/users/doctors')
}

// ========== 预约 ==========
export const createAppointment = (data: { doctorId: number }) => {
  return request.post('/users/appointments', data)
}

export const getUserAppointments = () => {
  return request.get('/users/appointments')
}

export const cancelAppointment = (id: number) => {
  return request.put(`/users/appointments/${id}/cancel`)
}

// ========== 报告 ==========
export const saveAnalysisReport = (data: { startDate: string; endDate: string; content: string }) => {
  return request.post('/users/analysis-report', data)
}

export const getAnalysisReports = () => {
  return request.get('/users/analysis-reports')
}

// ========== 数据管理 ==========
export const clearAllData = () => {
  return request.post('/users/clear-all')
}
