import axios from 'axios'
import { API_BASE } from '@/config'

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
        if (!isRedirecting) {
          isRedirecting = true
          window.location.href = '/login'
          setTimeout(() => { isRedirecting = false }, 1000)
        }
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res  
  },
  async err => {
    const status = err.response?.status
    const message = err.response?.data?.message || err.message || '请求失败'

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

    return Promise.reject(new Error(message))
  }
)

export default request
