import axios from 'axios'
import { API_BASE } from '@/config'
import { secureRemove } from '@/utils/secureStore'

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
async function handleSessionExpired() {
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
      return Promise.reject(new Error('服务器返回格式错误'))
    }

    if (!res.success) {
      if (res.code === 'SESSION_EXPIRED') {
        void handleSessionExpired()
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res  
  },
  async err => {
    const status = err.response?.status
    const message = err.response?.data?.message || err.message || '请求失败'

    if (status === 401) {
      void handleSessionExpired()
      return Promise.reject(new Error('登录已过期'))
    }

    if (status === 429) {
      return Promise.reject(new Error('请求过于频繁，请稍后再试'))
    }

    return Promise.reject(new Error(message))
  }
)

export default request
