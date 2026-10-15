import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'

export type AppLocale = 'zh-CN' | 'en'

// 读取已保存的语言，否则按系统语言自动判断（zh* 走中文，其余英文）
export function detectLocale(): AppLocale {
  const saved = localStorage.getItem('locale')
  if (saved === 'zh-CN' || saved === 'en') return saved
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, en }
})

export function setAppLocale(loc: AppLocale) {
  i18n.global.locale.value = loc
  document.documentElement.setAttribute('lang', loc)
}
