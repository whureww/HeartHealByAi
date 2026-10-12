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
