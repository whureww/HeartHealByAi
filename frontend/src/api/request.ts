import axios from 'axios'
import { API_BASE } from '@/config'
import { secureRemove } from '@/utils/secureStore'
import { i18n } from '@/i18n'
import { tServer } from '@/utils/serverMsg'

const request = axios.create({
  baseURL: API_BASE,
  timeout: 50000,
  withCredentials: false
})

let isRedirecting = false

const savedToken = localStorage.getItem('token')
if (savedToken) {
  request.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
}

export function setAuthToken(token: string) {
  localStorage.setItem('token', token)
  request.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export function clearAuthToken() {
  localStorage.removeItem('token')
  delete request.defaults.headers.common['Authorization']
}

// 会话过期统一处理：必须先把本地凭据清干净（含加密会话文件）再整页跳转。
// 若先跳转后清理，重载时过期 token 会被再次恢复，形成"重载循环"（表现为窗口频闪）。
// 已在公开页（登录/注册/忘记密码）时只拒绝请求，交给路由守卫处理，不再跳转。
export async function handleSessionExpired() {
  if (isRedirecting) return
  isRedirecting = true
  clearAuthToken()
  try {
    await secureRemove('session')
  } catch {
    // 清理失败不阻断跳转
  }
  const publicPaths = ['/login', '/register', '/forget-password']
  if (!publicPaths.includes(location.pathname)) {
    window.location.href = '/login'
  }
  setTimeout(() => { isRedirecting = false }, 1000)
}

request.interceptors.request.use(config => {
  return config
})

request.interceptors.response.use(
  response => {
    const res = response.data
    if (!res || typeof res !== 'object') {
      return Promise.reject(new Error(i18n.global.t('core.api.badResponse')))
    }

    if (!res.success) {
      if (res.code === 'SESSION_EXPIRED') {
        void handleSessionExpired()
      }
      // 服务器 message 先过映射层：已知文案按当前语言展示，未收录透传原文
      return Promise.reject(new Error(tServer(res.message) || i18n.global.t('core.api.requestFailed')))
    }
    return res
  },
  async err => {
    const status = err.response?.status
    const message = tServer(err.response?.data?.message) || err.message || i18n.global.t('core.api.requestFailed')

    if (status === 401) {
      // 认证类接口自身的 401（如登录时密码错误）是业务结果，不是会话过期：
      // 透传服务器原始文案（如"邮箱或密码错误"），不触发登出/跳转
      const url: string = err.config?.url || ''
      if (/\/(login|register|send-code|reset)$/.test(url)) {
        return Promise.reject(new Error(message))
      }
      void handleSessionExpired()
      // authExpired 为机读标记：路由守卫凭它判定会话过期，不依赖文案语言
      const e: any = new Error(i18n.global.t('core.api.sessionExpired'))
      e.authExpired = true
      return Promise.reject(e)
    }

    if (status === 429) {
      return Promise.reject(new Error(i18n.global.t('core.api.tooManyRequests')))
    }

    return Promise.reject(new Error(message))
  }
)

export default request
