import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'
// 模块化分片：各业务域独立维护，构建期静态合并（无运行时注入时序问题）
import dashZh from './locales/parts/dashboard.zh'
import dashEn from './locales/parts/dashboard.en'
import flowZh from './locales/parts/flow.zh'
import flowEn from './locales/parts/flow.en'
import shellZh from './locales/parts/shell.zh'
import shellEn from './locales/parts/shell.en'
import adminZh from './locales/parts/admin.zh'
import adminEn from './locales/parts/admin.en'
import expertZh from './locales/parts/expert.zh'
import expertEn from './locales/parts/expert.en'
import coreZh from './locales/parts/core.zh'
import coreEn from './locales/parts/core.en'

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
  messages: {
    'zh-CN': { ...zhCN, ...dashZh, ...flowZh, ...shellZh, ...adminZh, ...expertZh, ...coreZh },
    en: { ...en, ...dashEn, ...flowEn, ...shellEn, ...adminEn, ...expertEn, ...coreEn }
  }
})

export function setAppLocale(loc: AppLocale) {
  i18n.global.locale.value = loc
  document.documentElement.setAttribute('lang', loc)
}
