import request from './request'

// 预约列表
export const getExpertAppointments = () => request.get('/expert/appointments')

// 预约详情
export const getAppointmentDetail = (id: number) => request.get(`/expert/appointments/${id}`)

// 更新预约状态
export const updateAppointmentStatus = (id: number, status: string) => 
  request.put(`/expert/appointments/${id}/status`, { status })

// 获取聊天记录
export const getChatMessages = (appointmentId: number) => 
  request.get(`/expert/chat/${appointmentId}`)

// 发送消息
export const sendChatMessage = (data: { appointmentId: number, receiverId: number, content: string }) => 
  request.post('/expert/chat', data)
// 获取专家统计数据
export const getExpertStats = () => request.get('/expert/stats')

// 我的名片：读取
export const getMyCard = () => request.get('/expert/my-card')

// 我的名片：保存并提交审核
export const saveMyCard = (data: { name: string; title: string; specialty: string; intro: string }) =>
  request.put('/expert/my-card', data)
