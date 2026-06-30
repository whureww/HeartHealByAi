import { defineStore } from 'pinia'
import { 
  login as loginApi, 
  register as registerApi, 
  logout as logoutApi, 
  getUserInfo, 
  getUserStats, 
  getChatHistory, 
  getTests, 
  getDoctors 
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
    currentResultId: null as number | null
  }),

  getters: {
    isLoggedIn: (state) => !!state.token && !!state.onlyId
  },

  actions: {
    async login(data: { email: string; password: string }) {
      const res = await loginApi(data) as any
      if (res.success && res.data) {
        this.token = res.data.token
        this.onlyId = res.data.onlyId
        this.fixedId = res.data.fixedId || ''
        this.userInfo = res.data.user || null
        setAuthToken(this.token)
      }
      return res
    },

    async register(data: { username: string; email: string; password: string; code: string }) {
      const res = await registerApi(data) as any
      if (res.success && res.data) {
        this.token = res.data.token
        this.onlyId = res.data.onlyId
        this.fixedId = res.data.fixedId || ''
        this.userInfo = res.data.user || null
        setAuthToken(this.token)
      }
      return res
    },

    async getInfo() {
      const res = await getUserInfo() as any
      if (res.success && res.data) {
        this.userInfo = res.data
      }
      return res
    },

    async getStats() {
      const res = await getUserStats() as any
      if (res.success && res.data) {
        this.stats = res.data
      }
      return res
    },

    async getChatHistory() {
      const res = await getChatHistory() as any
      if (res.success && res.data) {
        this.chatHistory = res.data
      }
      return res
    },

    async getTests() {
      const res = await getTests() as any
      if (res.success && res.data) {
        this.tests = res.data
      }
      return res
    },

    async getDoctors() {
      const res = await getDoctors() as any
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

    async logout() {
      try {
        // 如果有 Socket 连接，先发送登出事件并断开
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
      clearAuthToken()
    }

  }
})
