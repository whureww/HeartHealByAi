import request from './request'

// ========== 认证相关 ==========
export const login = (data: { email: string; password: string }) => {
  return request.post('/users/login', data)
}

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
export const getChatHistory = () => {
  return request.get('/users/chat-history')
}

export const saveChat = (data: { content: string; type: string }) => {
  return request.post('/users/chat', data)
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

// ========== 数据管理 ==========
export const clearAllData = () => {
  return request.post('/users/clear-all')
}
