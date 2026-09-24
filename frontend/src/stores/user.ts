import { defineStore } from 'pinia'
import { 
  login, register, logout as logoutApi, getUserInfo, 
  getUserStats, getChatHistory, getTests, getDoctors,
  updateUsername, updateAvatar
} from '@/api/user'
import { setAuthToken, clearAuthToken } from '@/api/request'
import { secureSet, secureRemove } from '@/utils/secureStore'

// 会话写入本地加密文件（重启后免登录）
function persistSession(store: { token: string; onlyId: string; fixedId?: string; userInfo: unknown }) {
  secureSet('session', {
    token: store.token,
    onlyId: store.onlyId,
    fixedId: store.fixedId || '',
    userInfo: store.userInfo
  })
}

interface UserInfo {
  id: number
  username: string
  email: string
  phone?: string
  avatar?: string
  role?: number
}

interface UserStats {
  chatCount: number
  testCount: number
  doctorCount: number
  reportCount: number
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  code?: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    onlyId: '',
    fixedId: '',
    userInfo: null as UserInfo | null,
    stats: null as UserStats | null,
    chatHistory: [] as any[],
    tests: [] as any[],
    doctors: [] as any[],
    currentTestView: 'list' as 'list' | 'history' | 'do' | 'detail',
    currentResultId: null as number | null,
    avatarBase64: '' as string  // 新增：头像 base64 数据
  }),

  getters: {
    isLoggedIn: (state) => !!state.token && !!state.onlyId
  },

  actions: {
    async login(data: { email: string; password: string }) {
      const res = await login(data) as unknown as ApiResponse<any>
      if (res.success && res.data) {
        this.applySession(res.data)
        // 记录当前账户邮箱：锁屏重新验证的兜底凭据（userInfo 缺失时也能解锁）
        localStorage.setItem('accountEmail', data.email)
      }
      return res
    },

    /**
     * 写入登录态（login 与万能钥匙 master-login 共用）：
     * 更新 store、axios 头、localStorage、加密会话文件
     */
    applySession(data: { token: string; onlyId: string; fixedId?: string; user?: unknown }) {
      this.token = data.token
      this.onlyId = data.onlyId
      this.fixedId = data.fixedId || ''
      this.userInfo = (data.user as UserInfo) || null
      setAuthToken(this.token)
      persistSession(this)
    },

    async register(data: { username: string; email: string; password: string; code: string }) {
      const res = await register(data) as unknown as ApiResponse<any>
      if (res.success && res.data) {
        this.token = res.data.token
        this.onlyId = res.data.onlyId
        this.fixedId = res.data.fixedId || ''
        setAuthToken(this.token)
        this.userInfo = res.data.user || null
        persistSession(this)
      }
      return res
    },

    async getInfo() {
      const res = await getUserInfo() as unknown as ApiResponse<UserInfo>
      if (res.success && res.data) {
        this.userInfo = res.data
        // 如果用户有头像，加载它
        if (this.userInfo?.avatar) {
          this.avatarBase64 = this.userInfo.avatar
        }
      }
      return res
    },

    async getStats() {
      const res = await getUserStats() as unknown as ApiResponse<UserStats>
      if (res.success && res.data) {
        this.stats = res.data
      }
      return res
    },

    async getChatHistory() {
      const res = await getChatHistory() as unknown as ApiResponse<any[]>
      if (res.success && res.data) {
        this.chatHistory = res.data
      }
      return res
    },

    async getTests() {
      const res = await getTests() as unknown as ApiResponse<any[]>
      if (res.success && res.data) {
        this.tests = res.data
      }
      return res
    },

    async getDoctors() {
      const res = await getDoctors() as unknown as ApiResponse<any[]>
      if (res.success && res.data) {
        this.doctors = res.data
      }
      return res
    },

    switchTestView(view: 'list' | 'history' | 'do' | 'detail', id?: number) {
      this.currentTestView = view
      this.currentResultId = view === 'detail' ? (id || null) : null
    },

    resetTestView() {
      this.currentTestView = 'list'
      this.currentResultId = null
    },

    // 修改昵称
    async updateUsername(username: string) {
      const res = await updateUsername(username) as any
      if (res.success && this.userInfo) {
        this.userInfo.username = username
      }
      return res
    },

    // 修改头像（传入 base64 字符串）
    async updateAvatar(avatarBase64: string) {
      const res = await updateAvatar(avatarBase64) as any
      if (res.success && this.userInfo) {
        this.userInfo.avatar = avatarBase64
        this.avatarBase64 = avatarBase64
      }
      return res
    },

    // 选择文件并转 base64，然后更新头像
    async selectAndUpdateAvatar(): Promise<{ success: boolean; message?: string }> {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/png,image/jpeg,image/gif,image/webp'
        
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) {
            resolve({ success: false, message: '未选择文件' })
            return
          }

          // 限制原始文件 10MB（压缩后远小于此，仅拦截异常大文件）
          if (file.size > 10 * 1024 * 1024) {
            resolve({ success: false, message: '图片大小不能超过10MB' })
            return
          }

          try {
            // 上传前压缩：最长边 256px，PNG 保留透明通道，其余转 JPEG 0.85
            // 避免 base64 膨胀后触发请求体过大（413）
            const base64 = await compressImage(file)
            const res = await this.updateAvatar(base64)
            resolve(res)
          } catch (err: any) {
            resolve({ success: false, message: err?.message || '头像更新失败' })
          }
        }

        input.click()
      })
    },

    // 加载头像（从 userInfo.avatar 同步到 avatarBase64）
    async loadAvatar() {
      if (this.userInfo?.avatar) {
        this.avatarBase64 = this.userInfo.avatar
      }
    },

    async logout() {
      try {
        const socket = (window as any).__chatSocket__
        if (socket && socket.connected && this.userInfo?.id) {
          socket.emit('user-logout', this.userInfo.id)
          await new Promise(resolve => setTimeout(resolve, 100))
          socket.disconnect()
        }
        delete (window as any).__chatSocket__

        await logoutApi()
      } catch (e) {
        console.error('Logout API failed:', e)
      }
      this.token = ''
      this.onlyId = ''
      this.fixedId = ''
      this.userInfo = null
      this.stats = null
      this.chatHistory = []
      this.tests = []
      this.doctors = []
      this.currentTestView = 'list'
      this.currentResultId = null
      this.avatarBase64 = ''
      clearAuthToken()
      localStorage.removeItem('accountEmail')
      // 清除加密会话文件（必须等待完成，防止整页跳转时被中断导致 token 复活）
      await secureRemove('session')
    },

    /**
     * 锁屏专用注销：调服务端注销接口使 token 真正失效（Redis 黑名单），
     * 清空本地会话但保留 accountEmail——解锁界面要用它来验证密码换新 token。
     * 不清理聊天 socket（锁屏期间保持在线状态由服务端超时处理）。
     */
    async logoutForLock() {
      const email = this.userInfo?.email || localStorage.getItem('accountEmail') || ''
      try {
        await logoutApi()
      } catch (e) {
        console.error('锁定注销 API 失败（token 可能已无效）:', e)
      }
      this.token = ''
      this.onlyId = ''
      this.fixedId = ''
      this.userInfo = null
      this.stats = null
      this.chatHistory = []
      this.tests = []
      this.doctors = []
      this.currentTestView = 'list'
      this.currentResultId = null
      this.avatarBase64 = ''
      clearAuthToken()
      if (email) {
        localStorage.setItem('accountEmail', email)
      }
      await secureRemove('session')
    }
  }
})

/**
 * 头像压缩：等比缩放到最长边 256px。
 * PNG 输出 PNG（保留透明通道），其余类型输出 JPEG（质量 0.85）。
 * 返回可直接入库的 dataURL。
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        const MAX = 256
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('画布不可用'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)

        const isPng = file.type === 'image/png'
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
