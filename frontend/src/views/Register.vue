<template>
  <div class="page">
    <div class="card login-card">
      <div class="brand">
        <div class="brand-mark"><AppIcon name="brand" :size="30" /></div>
        <h2>{{ $t('common.appName') }}</h2>
        <p>{{ $t('register.tagline') }}</p>
      </div>

      <div class="input-group" :class="{ shake: showError.username }">
        <AppIcon name="user" :size="16" class="input-icon" />
        <input v-model="form.username" @focus="showError.username = false" @blur="validateName" placeholder=" " />
        <span class="text" :class="{ red: showError.username }">{{ showError.username ? $t('register.usernameMin') : $t('register.username') }}</span>
      </div>

      <div class="input-group" :class="{ shake: showError.email }">
        <AppIcon name="mail" :size="16" class="input-icon" />
        <input v-model="form.email" type="email" @focus="showError.email = false" @blur="validateEmail" placeholder=" " />
        <span class="text" :class="{ red: showError.email }">{{ showError.email ? $t('register.emailInvalid') : $t('common.email') }}</span>
      </div>

      <div class="input-group" :class="{ shake: showError.password }">
        <AppIcon name="lock" :size="16" class="input-icon" />
        <input v-model="form.password" type="password" @focus="showError.password = false" @blur="validatePwd" placeholder=" " />
        <span class="text" :class="{ red: showError.password }">{{ showError.password ? $t('common.passwordMin') : $t('common.password') }}</span>
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
            {{ showError.code ? $t('common.codeLen') : $t('common.code') }}
          </span>
        </div>
        <button
          class="btn-send"
          @click="sendCode"
          :disabled="loading.code || counting"
        >
          {{ codeLabel }}
        </button>
      </div>

      <button class="btn login-btn" @click="handleRegister" :disabled="loading.register">
        {{ loading.register ? $t('register.submitting') : $t('register.submit') }}
      </button>

      <p class="link">
        <a href="#" @click.prevent="goTo('/login')">{{ $t('register.haveAccount') }}</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/user'
import { useLoadingStore } from '@/stores/loading'
import { sendRegisterCode } from '@/api/user'
import { alert, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const loadingStore = useLoadingStore()

const form = ref({ username: '', email: '', password: '', code: '' })
const loading = ref({ register: false, code: false })
const sec = ref(0)
const counting = computed(() => sec.value > 0)
const codeLabel = computed(() => counting.value ? t('common.resendIn', { sec: sec.value }) : t('common.sendCode'))
let countdown: number | null = null

const showError = ref({ username: false, email: false, password: false, code: false })

function autoHideError(field: 'username' | 'email' | 'password' | 'code') {
  setTimeout(() => { showError.value[field] = false }, 3000)
}

const validateName = () => {
  showError.value.username = !form.value.username || form.value.username.length < 2
  if (showError.value.username) autoHideError('username')
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
const validateCode = () => {
  showError.value.code = !form.value.code || form.value.code.length !== 6
  if (showError.value.code) autoHideError('code')
}

const goTo = (path: string) => {
  loadingStore.show(t('common.pageSwitching'))
  setTimeout(() => { router.push(path); loadingStore.hide() }, 400)
}

const sendCode = async () => {
  validateEmail()
  if (showError.value.email) return
  loading.value.code = true
  try {
    await sendRegisterCode({ email: form.value.email })
    await alert(t('common.codeSentMsg'), t('common.codeSentTitle'))
    sec.value = 60
    countdown = window.setInterval(() => {
      sec.value--
      if (sec.value <= 0) { clearInterval(countdown!); countdown = null; sec.value = 0 }
    }, 1000)
  } catch (e: any) {
    await error(e?.message || t('common.sendFailed'), t('common.sendFailed'))
  }
  finally { loading.value.code = false }
}

const handleRegister = async () => {
  validateName(); validateEmail(); validatePwd(); validateCode()
  if (showError.value.username || showError.value.email || showError.value.password || showError.value.code) return

  try {
    loading.value.register = true
    loadingStore.show(t('register.submitting'))

    const res = await userStore.register(form.value)

    if (res.success) {
      await userStore.getInfo()
      setTimeout(async () => {
        loadingStore.hide();
        loading.value.register = false;
        await success(t('register.successMsg'), t('register.successTitle'));
        await router.replace('/dashboard')
      }, 800)
    }
  } catch (e: any) {
    loadingStore.hide();
    loading.value.register = false;
    await error(e?.message || t('register.failed'), t('register.failed'))
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
  padding: 28px 28px 24px;
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
  margin-bottom: 18px;
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
  margin-bottom: 12px;
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
  margin-bottom: 12px;
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
  margin-top: 16px;
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
