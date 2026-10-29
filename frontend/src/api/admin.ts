import request from './request'

export const getUserList = (params: any) => request.get('/admin/users', { params })
export const updateUserRole = (id: number, role: number) => request.put(`/admin/users/${id}/role`, { role })
export const getTestList = (params?: any) => request.get('/admin/tests', { params })
export const createTest = (data: any) => request.post('/admin/tests', data)
export const updateTestStatus = (id: number, status: number) => request.put(`/admin/tests/${id}/status`, { status })
export const deleteTest = (id: number) => request.delete(`/admin/tests/${id}`)
export const getAllAppointments = () => request.get('/admin/appointments')
export const getAdminStats = () => request.get('/admin/stats')
export const createUser = (data: { username: string; email: string; password: string; role: number; phone?: string }) => request.post('/admin/users', data)
export const deleteUser = (id: number) => request.delete(`/admin/users/${id}`)
// 管理员协助用户修改账号资料 / 重置密码（均需二次确认后调用）
export const updateUserProfile = (id: number, data: { username: string; email: string; phone?: string }) =>
  request.put(`/admin/users/${id}/profile`, data)
export const resetUserPassword = (id: number, password: string) => request.put(`/admin/users/${id}/password`, { password })
export const createAppointment = (data: { user_id: number; doctor_id: number; status?: string }) => request.post('/admin/appointments', data)
export const deleteAppointment = (id: number) => request.delete(`/admin/appointments/${id}`)

// 专家名片审核
export const getDoctorCards = () => request.get('/admin/doctor-cards')
export const reviewDoctorCard = (id: number, action: 'approve' | 'reject') =>
  request.put(`/admin/doctor-cards/${id}/review`, { action })

// 敏感词库管理（聊天审核，增删实时生效）
export const getSensitiveWords = () => request.get('/admin/sensitive-words')
export const addSensitiveWord = (data: { word: string; category: string; is_short?: boolean }) =>
  request.post('/admin/sensitive-words', data)
export const deleteSensitiveWord = (id: number) => request.delete(`/admin/sensitive-words/${id}`)

// 举报管理（聊天举报核查与处置，禁言/封禁实时生效）
export const getReports = (status?: string) => request.get('/admin/reports', { params: { status: status ?? '' } })
export const handleReport = (id: number, data: { action: 'mute' | 'ban' | 'dismiss'; duration?: string; note?: string }) =>
  request.post(`/admin/reports/${id}/handle`, data)
export const unrestrictUser = (id: number) => request.post(`/admin/users/${id}/unrestrict`)

// AI 对话审查（可审查/透明化/可追溯：查看会话全文自动落审计记录，审计日志可回查）
export const getAdminChats = (params: { page?: number; pageSize?: number; keyword?: string }) =>
  request.get('/admin/chats', { params })
export const getAdminChatDetail = (userId: number, sessionId: string) =>
  request.get(`/admin/chats/${userId}/${encodeURIComponent(sessionId)}`)
export const getChatAuditLogs = (params?: { page?: number; pageSize?: number; targetUserId?: number; sessionId?: string }) =>
  request.get('/admin/chat-audit-logs', { params })
// 审查处置：禁言/封禁会话归属账号（实时生效，封禁强制踢线）、删除违规会话
export const restrictChatUser = (userId: number, sessionId: string, data: { action: 'mute' | 'ban'; duration?: string }) =>
  request.post(`/admin/chats/${userId}/${encodeURIComponent(sessionId)}/restrict`, data)
export const deleteAdminChat = (userId: number, sessionId: string) =>
  request.delete(`/admin/chats/${userId}/${encodeURIComponent(sessionId)}`)
