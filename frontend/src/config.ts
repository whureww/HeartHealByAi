// ===== 全局服务地址配置 =====
// 桌面端打包后连接的云服务器地址，修改 .env 文件即可，无需改代码
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string) || 'http://your-server-ip:3001/api'

export const SOCKET_URL: string =
  (import.meta.env.VITE_SOCKET_URL as string) ||
  API_BASE.replace(/\/api\/?$/, '')

export function getAuthToken(): string {
  return localStorage.getItem('token') || ''
}
