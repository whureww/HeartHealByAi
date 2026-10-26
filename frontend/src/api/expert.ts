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

// 获取专家统计数据
export const getExpertStats = () => request.get('/expert/stats')

// 我的名片：读取
export const getMyCard = () => request.get('/expert/my-card')

// 我的名片：保存并提交审核（英文信息选填，供英文界面展示）
export const saveMyCard = (data: {
  name: string; title: string; specialty: string; intro: string;
  name_en?: string; title_en?: string; specialty_en?: string; intro_en?: string
}) =>
  request.put('/expert/my-card', data)

// 我的问卷：创建（提交后待管理员审核上架）
export const createMyTest = (data: any) => request.post('/expert/tests', data)

// 我的问卷：列表
export const getMyTests = () => request.get('/expert/tests')

// 我的问卷：详情（编辑回填）
export const getMyTestDetail = (id: number) => request.get(`/expert/tests/${id}`)

// 我的问卷：更新（仅待审核状态可改）
export const updateMyTest = (id: number, data: any) => request.put(`/expert/tests/${id}`, data)

// 我的问卷：删除（仅待审核状态可删）
export const deleteMyTest = (id: number) => request.delete(`/expert/tests/${id}`)

// 问卷模板：我的模板列表（含完整内容，套用时直接回填）
export const getTestTemplates = () => request.get('/expert/test-templates')

// 问卷模板：预设量表模板（开箱即用的 14 份真实标准化量表，id 为 'preset:编码'）
export const getTestTemplatePresets = () => request.get('/expert/test-templates/presets')

// 问卷模板：把当前表单存为模板
export const saveTestTemplate = (data: any) => request.post('/expert/test-templates', data)

// 问卷模板：删除
export const deleteTestTemplate = (id: number) => request.delete(`/expert/test-templates/${id}`)
