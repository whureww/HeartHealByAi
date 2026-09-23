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
