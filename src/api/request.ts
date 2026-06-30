import axios from 'axios'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
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

// ===== 请求拦截器：添加日志 =====
request.interceptors.request.use(config => {
  console.log('[Request]', config.method?.toUpperCase(), config.url, config.data || config.params)
  return config
})

// ===== 响应拦截器：添加日志，修复返回逻辑 =====
request.interceptors.response.use(
  response => {
    console.log('[Response]', response.config.url, 'status:', response.status, 'data:', response.data)
    
    const res = response.data
    
    // 处理空响应
    if (!res || typeof res !== 'object') {
      console.error('[Response] 服务器返回格式错误:', response.data)
      return Promise.reject(new Error('服务器返回格式错误'))
    }

    // 处理业务错误
    if (!res.success) {
      console.log('[Response] 业务错误:', res.code, res.message)
      if (res.code === 'SESSION_EXPIRED') {
        if (!isRedirecting) {
          isRedirecting = true
          window.location.href = '/login'
          setTimeout(() => { isRedirecting = false }, 1000)
        }
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    
    // 返回完整响应数据（包含 success, data, message 等）
    return res
  },
  async err => {
    const status = err.response?.status
    const message = err.response?.data?.message || err.message || '请求失败'
    
    console.error('[Response Error]', err.config?.url, 'status:', status, 'message:', message)

    if (status === 401) {
      if (!isRedirecting) {
        isRedirecting = true
        window.location.href = '/login'
        setTimeout(() => { isRedirecting = false }, 1000)
      }
      return Promise.reject(new Error('登录已过期'))
    }

    if (status === 429) {
      return Promise.reject(new Error('请求过于频繁，请稍后再试'))
    }

    // 网络错误特殊处理
    if (!status && err.message?.includes('Network Error')) {
      return Promise.reject(new Error('网络连接失败，请检查后端服务是否运行'))
    }

    return Promise.reject(new Error(message))
  }
)

export default request
