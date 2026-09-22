import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import { isTauri, secureGet, secureSet } from './utils/secureStore'

const pinia = createPinia()

const applyTheme = (t: string) => {
  const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// 应用配置在加密文件中的默认值（与 settings store 保持一致）
const DEFAULT_CONFIG: Record<string, string> = {
  theme: 'system',
  notifications: 'all',
  soundEnabled: 'true',
  closeAction: 'ask',
  autoBackup: 'false',
  backupInterval: '7',
  lockOnLeave: 'false',
  lockTimeout: '5'
}

// 启动前从本地恢复数据（应用配置 + 登录会话）
// Tauri 环境走加密文件；纯浏览器（开发模式）走 localStorage
async function restoreLocalData() {
  // 1. 恢复应用配置；首次运行时把默认配置写入加密文件
  if (isTauri()) {
    const config = await secureGet<Record<string, string>>('config')
    if (config) {
      for (const [key, value] of Object.entries(config)) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, String(value))
      }
    } else {
      await secureSet('config', DEFAULT_CONFIG)
    }
  }

  // 2. 应用主题
  applyTheme(localStorage.getItem('theme') || 'system')

  // 3. 会话恢复：加密文件（Tauri）与 localStorage 互为补充
  let token = localStorage.getItem('token') || ''
  let onlyId = localStorage.getItem('onlyId') || ''
  if (isTauri()) {
    const session = await secureGet<{ token: string; onlyId: string }>('session')
    if (session?.token && !token) {
      localStorage.setItem('token', session.token)
      localStorage.setItem('onlyId', session.onlyId || '')
      token = session.token
      onlyId = session.onlyId || ''
    } else if (token && !session) {
      await secureSet('session', { token, onlyId })
    }
  }

  // 4. 水合 Pinia 用户状态（路由守卫依赖 store 中的 token/onlyId）
  if (token) {
    const { useUserStore } = await import('./stores/user')
    useUserStore(pinia).$patch({ token, onlyId: onlyId || '' })
  }
}

// 自动备份：开启后按周期把本地配置快照写入加密备份文件（滚动单份）
// 聊天/测评等业务数据在服务端，此处备份的是纯本地数据（设置项）
async function runAutoBackup() {
  try {
    if (localStorage.getItem('autoBackup') !== 'true') return
    const intervalDays = Number(localStorage.getItem('backupInterval')) || 7
    const last = Number(localStorage.getItem('lastBackupAt')) || 0
    if (Date.now() - last < intervalDays * 86400000) return

    const snapshot: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      // 会话凭据不进备份（已单独加密存储，避免重复落盘）
      if (key && key !== 'token' && key !== 'onlyId') {
        snapshot[key] = localStorage.getItem(key) || ''
      }
    }
    await secureSet('backup', { savedAt: new Date().toISOString(), data: snapshot })
    localStorage.setItem('lastBackupAt', String(Date.now()))
  } catch (e) {
    console.error('自动备份失败:', e)
  }
}

async function bootstrap() {
  await restoreLocalData()

  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  app.mount('#app')

  void runAutoBackup()
}

bootstrap()
