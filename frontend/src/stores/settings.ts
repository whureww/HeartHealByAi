import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { secureSet, isTauri } from '@/utils/secureStore'

type Theme = 'light' | 'dark' | 'system'
type CloseAction = 'minimize' | 'exit' | 'ask'
type NotifyType = 'all' | 'important' | 'none'

export const useSettingsStore = defineStore('settings', () => {
  // ===== 主题设置 =====
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'system')
  
  // ===== 消息提醒 =====
  const notifications = ref<NotifyType>((localStorage.getItem('notifications') as NotifyType) || 'all')
  const soundEnabled = ref(localStorage.getItem('soundEnabled') !== 'false')
  
  // ===== 窗口行为 =====
  const closeAction = ref<CloseAction>((localStorage.getItem('closeAction') as CloseAction) || 'ask')
  
  // ===== 数据设置 =====
  const autoBackup = ref(localStorage.getItem('autoBackup') === 'true')
  const backupInterval = ref(Number(localStorage.getItem('backupInterval')) || 7)
  
  // ===== 隐私设置 =====
  const lockOnLeave = ref(localStorage.getItem('lockOnLeave') === 'true')
  const lockTimeout = ref(Number(localStorage.getItem('lockTimeout')) || 5)

  // 监听变化并保存
  watch([theme, notifications, soundEnabled, closeAction, autoBackup, backupInterval, lockOnLeave, lockTimeout], () => {
    localStorage.setItem('theme', theme.value)
    localStorage.setItem('notifications', notifications.value)
    localStorage.setItem('soundEnabled', String(soundEnabled.value))
    localStorage.setItem('closeAction', closeAction.value)
    localStorage.setItem('autoBackup', String(autoBackup.value))
    localStorage.setItem('backupInterval', String(backupInterval.value))
    localStorage.setItem('lockOnLeave', String(lockOnLeave.value))
    localStorage.setItem('lockTimeout', String(lockTimeout.value))
    // 同步到本地加密文件（AppData\Roaming\com.xinyu.heart\secure\config.dat）
    secureSet('config', {
      theme: theme.value,
      notifications: notifications.value,
      soundEnabled: String(soundEnabled.value),
      closeAction: closeAction.value,
      autoBackup: String(autoBackup.value),
      backupInterval: String(backupInterval.value),
      lockOnLeave: String(lockOnLeave.value),
      lockTimeout: String(lockTimeout.value)
    })
  }, { deep: true })

  // 应用主题
  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // 同步原生窗口主题：深色时窗口边框/标题栏跟随，避免出现系统白框
    if (isTauri()) {
      getCurrentWindow().setTheme(isDark ? 'dark' : 'light').catch(() => {})
    }
  }

  // 初始化主题（只调用一次，在 App.vue 的 onMounted 中）
  let systemListenerAdded = false
  
  const initTheme = () => {
    applyTheme(theme.value)
    
    // 只添加一次系统主题监听器，防止重复
    if (!systemListenerAdded) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (theme.value === 'system') {
          applyTheme('system')
        }
      })
      systemListenerAdded = true
    }
  }

  // 设置主题
  const setTheme = (t: Theme) => {
    theme.value = t
    applyTheme(t)
  }

  // 设置关闭行为
  const setCloseAction = (action: CloseAction) => {
    closeAction.value = action
  }

  // 设置通知
  const setNotifications = (type: NotifyType) => {
    notifications.value = type
  }

  // 切换声音
  const toggleSound = () => {
    soundEnabled.value = !soundEnabled.value
  }

  // 切换自动备份
  const toggleAutoBackup = () => {
    autoBackup.value = !autoBackup.value
  }

  // 切换离开锁定
  const toggleLockOnLeave = () => {
    lockOnLeave.value = !lockOnLeave.value
  }

  // 从 localStorage 重新水合（数据备份导入后调用，让 UI 与恢复后的设置保持一致）
  const refreshFromLocal = () => {
    const themeVal = localStorage.getItem('theme') as Theme | null
    if (themeVal) theme.value = themeVal
    const notifyVal = localStorage.getItem('notifications') as NotifyType | null
    if (notifyVal) notifications.value = notifyVal
    soundEnabled.value = localStorage.getItem('soundEnabled') !== 'false'
    const closeVal = localStorage.getItem('closeAction') as CloseAction | null
    if (closeVal) closeAction.value = closeVal
    autoBackup.value = localStorage.getItem('autoBackup') === 'true'
    backupInterval.value = Number(localStorage.getItem('backupInterval')) || 7
    lockOnLeave.value = localStorage.getItem('lockOnLeave') === 'true'
    lockTimeout.value = Number(localStorage.getItem('lockTimeout')) || 5
    applyTheme(theme.value)
  }

  return {
    theme,
    notifications,
    soundEnabled,
    closeAction,
    autoBackup,
    backupInterval,
    lockOnLeave,
    lockTimeout,
    setTheme,
    initTheme,
    setCloseAction,
    setNotifications,
    toggleSound,
    toggleAutoBackup,
    toggleLockOnLeave,
    refreshFromLocal
  }
})
