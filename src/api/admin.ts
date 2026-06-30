import request from './request'

export const getUserList = (params: any) => request.get('/admin/users', { params })
export const updateUserRole = (id: number, role: number) => request.put(`/admin/users/${id}/role`, { role })
export const getTestList = (params?: any) => request.get('/admin/tests', { params })
export const createTest = (data: any) => request.post('/admin/tests', data)
export const updateTestStatus = (id: number, status: number) => request.put(`/admin/tests/${id}/status`, { status })
export const deleteTest = (id: number) => request.delete(`/admin/tests/${id}`)
export const getAllAppointments = () => request.get('/admin/appointments') 
export const getAdminStats = () => request.get('/admin/stats')
