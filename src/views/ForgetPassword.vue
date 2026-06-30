<template>
  <div class="page">
    <div class="card login-card">
      <div class="logo-box">
        <div class="logo-avatar"></div>
        <h2>找回密码</h2>
        <p>输入邮箱重置密码</p>
      </div>

      <div class="input-group" :class="{ shake: showError.email }">
        <input v-model="form.email" type="email" @focus="showError.email = false" @blur="validateEmail" placeholder=" " />
        <span class="text" :class="{ red: showError.email }">{{ showError.email ? '请输入有效邮箱' : '邮箱' }}</span>
      </div>

      <div class="code-row" :class="{ shake: showError.code }">
        <div class="code-input-group">
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
  const reg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/
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
  height: calc(100vh - 36px);
  background: #f6f8fc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden !important;
  box-sizing: border-box;
  padding: 16px;
}

.login-card {
  background: #fff;
  width: 100%;
  max-width: 340px;
  max-height: calc(100vh - 36px - 32px);
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  text-align: center;
  margin: auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

.logo-box {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.logo-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #73a9d8, #b4d8f0);
  margin: 0 auto 8px;
}

.logo-box h2 {
  font-size: 17px;
  color: #2c3e50;
  margin-bottom: 4px;
}

.logo-box p {
  font-size: 12px;
  color: #999;
}

.input-group {
  position: relative;
  margin-bottom: 10px;
  width: 100%;
  height: 40px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.input-group input {
  width: 100%;
  height: 100%;
  padding: 0 14px;
  background: #f5f7fa;
  border-radius: 10px;
  border: 1.5px solid #e5e9f2;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-group input:focus {
  border-color: #73a9d8;
  background: #fff;
}

.input-group input:not(:placeholder-shown) + .text,
.input-group input:focus + .text {
  display: none;
}

.input-group .text {
  position: absolute;
  left: 14px;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #9ca3af;
  pointer-events: none;
}

.input-group .text.red {
  color: #ef4444;
  display: flex !important;
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
  margin-bottom: 10px;
  width: 100%;
  height: 40px;
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
  padding: 0 14px;
  background: #f5f7fa;
  border-radius: 10px;
  border: 1.5px solid #e5e9f2;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.code-input-group input:focus {
  border-color: #73a9d8;
  background: #fff;
}

.code-input-group input:not(:placeholder-shown) + .text,
.code-input-group input:focus + .text {
  display: none;
}

.code-input-group .text {
  position: absolute;
  left: 14px;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #9ca3af;
  pointer-events: none;
}

.code-input-group .text.red {
  color: #ef4444;
  display: flex !important;
}

.btn-send {
  width: 100px;
  height: 100%;
  background: #e3f0fc;
  color: #73a9d8;
  font-size: 12px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
  box-sizing: border-box;
}

.btn-send:hover:not(:disabled) {
  background: #73a9d8;
  color: #fff;
}

.btn-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn {
  width: 100%;
  height: 40px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
  font-weight: 500;
  flex-shrink: 0;
  box-sizing: border-box;
}

button:disabled {
  opacity: 0.6;
}

.login-btn {
  background: #73a9d8;
  color: #fff;
  margin-top: 4px;
}

.login-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.link {
  text-align: center;
  margin-top: 14px;
  font-size: 12px;
  flex-shrink: 0;
}

.link a {
  color: #73a9d8;
  text-decoration: none;
}

.link a:hover {
  text-decoration: underline;
}
</style>
