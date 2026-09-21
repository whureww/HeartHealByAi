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

// 启动前从加密文件恢复本地数据（应用配置 + 登录会话）
async function restoreLocalData() {
  if (!isTauri()) return

  // 1. 恢复应用配置；首次运行时把默认配置写入加密文件
  const config = await secureGet<Record<string, string>>('config')
  if (config) {
    for (const [key, value] of Object.entries(config)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, String(value))
    }
  } else {
    await secureSet('config', DEFAULT_CONFIG)
  }

  // 2. 应用主题
  applyTheme(localStorage.getItem('theme') || 'system')

  // 3. 恢复登录会话（token + onlyId），实现重启后免登录
  let session = await secureGet<{ token: string; onlyId: string }>('session')
  if (session) {
    if (!localStorage.getItem('token')) {
      localStorage.setItem('token', session.token || '')
      localStorage.setItem('onlyId', session.onlyId || '')
    }
  } else {
    const token = localStorage.getItem('token')
    if (token) {
      session = { token, onlyId: localStorage.getItem('onlyId') || '' }
      await secureSet('session', session)
    }
  }

  // 4. 水合 Pinia 用户状态（路由守卫依赖 store 中的 token/onlyId）
  if (session?.token) {
    const { useUserStore } = await import('./stores/user')
    const userStore = useUserStore(pinia)
    userStore.token = session.token
    userStore.onlyId = session.onlyId || ''
  }
}

async function bootstrap() {
  await restoreLocalData()

  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  app.mount('#app')
}

bootstrap()
