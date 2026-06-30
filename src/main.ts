import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const pinia = createPinia()
const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
const theme = savedTheme || 'system'
const applyTheme = (t: string) => {
  const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

applyTheme(theme)

const app = createApp(App)
app.use(createPinia())
app.use(pinia)
app.use(router)
app.mount('#app')
