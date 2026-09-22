<template>
  <div class="page">
    <div class="card login-card">
      <div class="brand">
        <div class="brand-mark"><AppIcon name="brand" :size="30" /></div>
        <h2>心愈</h2>
        <p>私密倾诉 · 测评 · 专家问诊 · 数据分析</p>
      </div>

      <div class="input-group" :class="{ shake: showError.email }">
        <AppIcon name="mail" :size="16" class="input-icon" />
        <input
          v-model="form.email"
          type="email"
          @focus="showError.email = false"
          @blur="validateEmail"
          placeholder=" "
        />
        <span class="text" :class="{ red: showError.email }">
          {{ showError.email ? '请输入有效邮箱' : '邮箱' }}
        </span>
      </div>

      <div class="input-group" :class="{ shake: showError.password }">
        <AppIcon name="lock" :size="16" class="input-icon" />
        <input
          v-model="form.password"
          type="password"
          @focus="showError.password = false"
          @blur="validatePwd"
          placeholder=" "
        />
        <span class="text" :class="{ red: showError.password }">
          {{ showError.password ? '密码至少6位' : '密码' }}
        </span>
      </div>

      <button class="btn login-btn" @click="handleLogin" :disabled="loading">
        {{ loading ? '正在进入...' : '进入心愈' }}
      </button>

      <div class="links">
        <a href="#" @click.prevent="goTo('/register')">注册账号</a>
        <a href="#" @click.prevent="goTo('/forget-password')">忘记密码</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useLoadingStore } from '@/stores/loading'
import { error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const userStore = useUserStore()
const loadingStore = useLoadingStore()

const form = ref({ email: '', password: '' })
const loading = ref(false)
const showError = ref({ email: false, password: false })

function autoHideError(field: 'email' | 'password') {
  setTimeout(() => {
    showError.value[field] = false
  }, 3000)
}

const validateEmail = () => {
  const reg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,63}$/
  showError.value.email = !form.value.email || !reg.test(form.value.email)
  if (showError.value.email) autoHideError('email')
}
const validatePwd = () => {
  showError.value.password = !form.value.password || form.value.password.length < 6
  if (showError.value.password) autoHideError('password')
}

const goTo = (path: string) => {
  loadingStore.show('页面切换中...')
  setTimeout(() => {
    router.push(path)
    loadingStore.hide()
  }, 400)
}

const handleLogin = async () => {
  validateEmail()
  validatePwd()
  if (showError.value.email || showError.value.password) return

  try {
    loading.value = true
    loadingStore.show('登录中...')

    console.log('开始登录请求:', form.value)
    const res = await userStore.login(form.value)
    console.log('登录响应:', res)

    if (res && res.success) {
      console.log('登录成功，获取用户信息')
      await userStore.getInfo()
      console.log('用户信息:', userStore.userInfo)

      setTimeout(async () => {
        await router.replace('/dashboard')
        loadingStore.hide()
        loading.value = false
      }, 800)
    } else {
      console.log('登录失败:', res)
      loadingStore.hide()
      loading.value = false
      await error(res?.message || '登录失败', '登录失败')
    }
  } catch (e: any) {
    console.error('登录异常:', e)
    loadingStore.hide()
    loading.value = false
    await error(e?.message || '登录失败', '登录失败')
  }
}


</script>

<style scoped>
.page {
  width: 100vw;
  height: calc(100vh - var(--titlebar-h));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden !important;
  box-sizing: border-box;
  padding: 16px;
}

.login-card {
  background: var(--card-bg);
  width: 100%;
  max-width: 400px;
  max-height: calc(100vh - var(--titlebar-h) - 32px);
  padding: 32px 28px;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  text-align: center;
  margin: auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  font-family: var(--font-ui);
  animation: card-settle 0.6s var(--ease-out) both;
}

@keyframes card-settle {
  from {
    opacity: 0;
    transform: translateY(14px);
    box-shadow: 0 0 0 rgba(84, 58, 22, 0), 0 0 0 rgba(84, 58, 22, 0);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.brand {
  margin-bottom: 24px;
  flex-shrink: 0;
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.brand h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.brand p {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
}

.input-group {
  position: relative;
  margin-bottom: 14px;
  width: 100%;
  height: 42px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.input-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  z-index: 1;
}

.input-group input {
  width: 100%;
  height: 100%;
  padding: 0 14px 0 40px;
  background: var(--input-bg);
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  box-sizing: border-box;
}

.input-group input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.input-group input:not(:placeholder-shown) + .text,
.input-group input:focus + .text {
  display: none;
}

.input-group .text {
  position: absolute;
  left: 40px;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
  pointer-events: none;
}

.input-group .text.red {
  color: var(--danger);
  display: flex !important;
}

/* 输入框已有内容时，错误提示改为悬浮小标签置于输入框上沿，避免与文字重叠 */
.input-group input:not(:placeholder-shown) + .text.red,
.input-group input:focus + .text.red {
  display: flex !important;
  height: auto;
  top: 0;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 600;
  background: var(--card-bg);
  padding: 0 5px;
  border-radius: 4px;
  z-index: 1;
}

.input-group.shake {
  animation: shake 0.28s ease-in-out;
}

@keyframes shake {
  0%,100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.btn {
  width: 100%;
  height: 42px;
  border-radius: var(--radius-ctl);
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
  font-weight: 600;
  flex-shrink: 0;
  box-sizing: border-box;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.login-btn {
  background: var(--accent);
  color: var(--on-accent);
  margin-top: 6px;
}

.login-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.links {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 12.5px;
  flex-shrink: 0;
}

.links a {
  color: var(--accent);
  text-decoration: none;
}

.links a:hover {
  text-decoration: underline;
}
</style>
