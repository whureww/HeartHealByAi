// 服务端消息翻译层：后端返回的中文 message 在英文界面下的映射展示
// 策略：精确匹配已知文案 → i18n key；未收录的透传原文（后续后端补错误码后可平滑升级）
import { i18n } from '@/i18n'

const SERVER_MSG_KEYS: Record<string, string> = {
  // 会话管理
  '对话已锁定，请先解除锁定再删除': 'core.server.sessionLocked',
  '对话不存在': 'core.server.sessionNotFound',
  '会话标识不合法': 'core.server.sessionInvalid',
  '会话已删除': 'core.server.sessionDeleted',
  // 模型配置
  '模型名不合法（限字母数字._-/，80 字符内）': 'core.server.modelInvalid',
  '模型名不合法': 'core.server.modelInvalidShort',
  '网关地址不合法（需 http/https 开头）': 'core.server.baseUrlInvalid',
  'API Key 长度需在 8-200 字符之间': 'core.server.keyLenInvalid',
  '网关地址与 API Key 需同时填写（留空则使用服务端模型网关）': 'core.server.pairRequired',
  '服务端模型网关未配置，请自带网关地址与 API Key': 'core.server.gatewayMissing',
  '新模型名已存在，请换一个名字': 'core.server.modelNameTaken',
  '该模型配置不存在': 'core.server.modelNotFound',
  '密钥解密失败，请编辑重新保存该模型配置': 'core.server.keyDecryptFailed',
  '该模型未带网关配置，且服务端模型网关未配置': 'core.server.noGatewayAndConfig',
  '已切换模型': 'core.server.modelSwitched',
  '已恢复默认模型': 'core.server.modelReset',
  '模型已更新': 'core.server.modelUpdated',
  '模型已删除': 'core.server.modelDeleted',
  // 认证与会话状态
  '登录已过期': 'core.api.sessionExpired',
  '登录已失效，请重新登录': 'core.api.sessionExpired',
  '您的账号已在其他设备登录': 'core.server.loggedInElsewhere',
  // 通用操作反馈
  '预约成功': 'core.server.apptSuccess',
  '预约已取消': 'core.server.apptCancelled',
  '举报已提交，管理员会尽快核实处理': 'core.server.reportSubmitted',
  '所有数据已清空': 'core.server.dataCleared',
  '个人信息更新成功': 'core.server.profileUpdated',
  '头像修改成功': 'core.server.avatarUpdated',
  '注册成功': 'core.server.registered',
  '密码重置成功，请使用新密码重新登录': 'core.server.passwordReset',
  // AI 记忆（RAG）
  '记忆查询失败': 'core.server.memoryQueryFailed',
  '记忆 id 不合法': 'core.server.memoryIdInvalid',
  '记忆不存在或已删除': 'core.server.memoryNotFound',
  '记忆删除失败': 'core.server.memoryDeleteFailed',
  '记忆清空失败': 'core.server.memoryClearFailed'
}

/** 翻译服务端消息：命中映射表按当前语言返回，否则透传原文 */
export function tServer(msg?: string | null): string {
  if (!msg) return ''
  const key = SERVER_MSG_KEYS[msg]
  return key ? i18n.global.t(key) : msg
}
