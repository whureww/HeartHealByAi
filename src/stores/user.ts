import { defineStore } from 'pinia'
import { 
  login, register, logout as logoutApi, getUserInfo, 
  getUserStats, getChatHistory, getTests, getDoctors,
  updateUsername, updateAvatar
} from '@/api/user'
import { setAuthToken, clearAuthToken } from '@/api/request'

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
        this.token = res.data.token
        this.onlyId = res.data.onlyId
        this.fixedId = res.data.fixedId || ''
        setAuthToken(this.token)
        this.userInfo = res.data.user || null
      }
      return res
    },

    async register(data: { username: string; email: string; password: string; code: string }) {
      const res = await register(data) as unknown as ApiResponse<any>
      if (res.success && res.data) {
        this.token = res.data.token
        this.onlyId = res.data.onlyId
        this.fixedId = res.data.fixedId || ''
        setAuthToken(this.token)
        this.userInfo = res.data.user || null
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

          // 限制大小 2MB
          if (file.size > 2 * 1024 * 1024) {
            resolve({ success: false, message: '图片大小不能超过2MB' })
            return
          }

          const reader = new FileReader()
          reader.onload = async () => {
            const base64 = reader.result as string
            try {
              const res = await this.updateAvatar(base64)
              resolve(res)
            } catch (e: any) {
              resolve({ success: false, message: e.message || '头像更新失败' })
            }
          }
          reader.onerror = () => {
            resolve({ success: false, message: '图片读取失败' })
          }
          reader.readAsDataURL(file)
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
    }
  }
})
