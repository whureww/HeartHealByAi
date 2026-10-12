// 聊天内容预检接口（发送前轻量词库检查，完整审核在服务端发送链路强制执行）
import request from './request'

export const precheckContent = (content: string) =>
  request.post('/moderation/precheck', { content })
