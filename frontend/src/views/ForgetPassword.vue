<template>
  <div class="page">
    <div class="card login-card">
      <div class="brand">
        <div class="brand-mark"><AppIcon name="brand" :size="30" /></div>
        <h2>心愈</h2>
        <p>找回密码 · 输入邮箱重置密码</p>
      </div>

      <div class="input-group" :class="{ shake: showError.email }">
        <AppIcon name="mail" :size="16" class="input-icon" />
        <input v-model="form.email" type="email" @focus="showError.email = false" @blur="validateEmail" placeholder=" " />
        <span class="text" :class="{ red: showError.email }">{{ showError.email ? '请输入有效邮箱' : '邮箱' }}</span>
      </div>

      <div class="code-row" :class="{ shake: showError.code }">
        <div class="code-input-group">
          <AppIcon name="shield" :size="16" class="input-icon" />
          <input
            v-model="form.code"
            @focus="showError.code = false"
            @blur="validateCode"
            placeholder=" "
          />
          <span class="text" :class="{ red: showError.code }">
            {{ showError.code ? '6位验证码' : '验证码' }}
          </span>
        </div>
        <button
          class="btn-send"
          @click="sendCode"
          :disabled="loading.code || codeText !== '发送验证码'"
        >
          {{ codeText }}
        </button>
      </div>

      <div class="input-group" :class="{ shake: showError.newPassword }">
        <AppIcon name="lock" :size="16" class="input-icon" />
        <input v-model="form.newPassword" type="password" @focus="showError.newPassword = false" @blur="validatePwd" placeholder=" " />
        <span class="text" :class="{ red: showError.newPassword }">{{ showError.newPassword ? '密码至少6位' : '新密码' }}</span>
      </div>

      <button class="btn login-btn" @click="resetPwd" :disabled="loading.reset">
        {{ loading.reset ? '重置中...' : '重置密码' }}
      </button>

      <p class="link">
        <a href="#" @click.prevent="goTo('/login')">返回登录</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLoadingStore } from '@/stores/loading'
import { sendResetCode, resetPassword } from '@/api/user'
import { alert, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const loadingStore = useLoadingStore()

const form = ref({ email: '', code: '', newPassword: '' })
const loading = ref({ code: false, reset: false })
const codeText = ref('发送验证码')
let countdown: number | null = null

const showError = ref({ email: false, code: false, newPassword: false })

function autoHideError(field: 'email' | 'code' | 'newPassword') {
  setTimeout(() => { showError.value[field] = false }, 3000)
}

const validateEmail = () => {
  const reg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,63}$/
  showError.value.email = !form.value.email || !reg.test(form.value.email)
  if (showError.value.email) autoHideError('email')
}
const validateCode = () => {
  showError.value.code = !form.value.code || form.value.code.length !== 6
  if (showError.value.code) autoHideError('code')
}
const validatePwd = () => {
  showError.value.newPassword = !form.value.newPassword || form.value.newPassword.length < 6
  if (showError.value.newPassword) autoHideError('newPassword')
}

const goTo = (path: string) => {
  loadingStore.show('页面切换中...')
  setTimeout(() => { router.push(path); loadingStore.hide() }, 400)
}

const sendCode = async () => {
  validateEmail()
  if (showError.value.email) return
  loading.value.code = true
  try {
    await sendResetCode({ email: form.value.email })
    await alert('验证码已发送，请检查邮箱', '已发送')
    let sec = 60
    codeText.value = `${sec}秒后重发`
    countdown = window.setInterval(() => {
      sec--
      codeText.value = `${sec}秒后重发`
      if (sec <= 0) { clearInterval(countdown!); countdown = null; codeText.value = '发送验证码' }
    }, 1000)
  } catch (err: any) { await error(err.message || '发送失败', '发送失败') }
  finally { loading.value.code = false }
}

const resetPwd = async () => {
  validateEmail(); validateCode(); validatePwd()
  if (showError.value.email || showError.value.code || showError.value.newPassword) return
  loading.value.reset = true
  loadingStore.show('重置中...')
  try {
    await resetPassword({ email: form.value.email, code: form.value.code, newPassword: form.value.newPassword })
    setTimeout(async () => {
      loadingStore.hide();
      loading.value.reset = false;
      await success('密码重置成功，请使用新密码登录', '重置成功');
      router.push('/login')
    }, 800)
  } catch (err: any) {
    loadingStore.hide();
    loading.value.reset = false;
    await error(err.message || '重置失败', '重置失败')
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
}

.brand {
  margin-bottom: 22px;
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

.code-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  width: 100%;
  height: 42px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.code-input-group {
  position: relative;
  flex: 1;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.code-input-group input {
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

.code-input-group input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.code-input-group input:not(:placeholder-shown) + .text,
.code-input-group input:focus + .text {
  display: none;
}

.code-input-group .text {
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

.code-input-group .text.red {
  color: var(--danger);
  display: flex !important;
}

.code-input-group input:not(:placeholder-shown) + .text.red,
.code-input-group input:focus + .text.red {
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

.btn-send {
  width: 106px;
  height: 100%;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s var(--ease-out);
  box-sizing: border-box;
}

.btn-send:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.btn-send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.link {
  text-align: center;
  margin-top: 18px;
  font-size: 12.5px;
  flex-shrink: 0;
}

.link a {
  color: var(--accent);
  text-decoration: none;
}

.link a:hover {
  text-decoration: underline;
}
</style>
