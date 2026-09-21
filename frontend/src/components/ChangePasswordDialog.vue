<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay">
      <div class="dialog-box" @click.stop>
        <div class="dialog-header">
          <h3>🔐 修改密码</h3>
          <button class="btn-close" @click="onCancel">×</button>
        </div>

        <div class="dialog-body">
          <!-- 步骤1：验证邮箱 -->
          <div v-if="step === 1" class="step-content">
            <div class="form-group">
              <label>邮箱地址</label>
              <input
                v-model="form.email"
                type="email"
                placeholder="请输入注册邮箱"
                :disabled="isLoading"
              />
            </div>
            <div class="form-group">
              <label>验证码</label>
              <div class="code-row">
                <input
                  v-model="form.code"
                  type="text"
                  placeholder="请输入验证码"
                  maxlength="6"
                  :disabled="isLoading"
                />
                <button
                  class="btn-code"
                  :disabled="codeCountdown > 0 || isLoading || !form.email"
                  @click="sendCode"
                >
                  {{ codeCountdown > 0 ? `${codeCountdown}s后重发` : '获取验证码' }}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>新密码</label>
              <input
                v-model="form.newPassword"
                type="password"
                placeholder="请输入新密码（至少6位）"
                :disabled="isLoading"
              />
            </div>
            <div class="form-group">
              <label>确认新密码</label>
              <input
                v-model="form.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                :disabled="isLoading"
              />
            </div>
          </div>

          <!-- 步骤2：成功提示 -->
          <div v-else class="step-content success-step">
            <div class="success-icon">✅</div>
            <h4>密码修改成功</h4>
            <p>请使用新密码重新登录</p>
          </div>
        </div>

        <div class="dialog-footer">
          <button v-if="step === 1" class="btn-cancel" @click="onCancel" :disabled="isLoading">
            取消
          </button>
          <button
            v-if="step === 1"
            class="btn-confirm"
            :disabled="isLoading || !canSubmit"
            @click="onSubmit"
          >
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>确认修改</span>
          </button>
          <button v-else class="btn-confirm" @click="onFinish">
            确定
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { sendResetCode, resetPassword } from '@/api/user'
import { alert, success, error } from '@/utils/dialog'

const visible = ref(false)
const step = ref(1)
const isLoading = ref(false)
const codeCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const form = ref({
  email: '',
  code: '',
  newPassword: '',
  confirmPassword: ''
})

const canSubmit = computed(() => {
  return (
    form.value.email &&
    form.value.code &&
    form.value.newPassword &&
    form.value.confirmPassword &&
    form.value.newPassword.length >= 6 &&
    form.value.newPassword === form.value.confirmPassword
  )
})

const show = () => {
  step.value = 1
  form.value = { email: '', code: '', newPassword: '', confirmPassword: '' }
  codeCountdown.value = 0
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  visible.value = true
}

const hide = () => {
  visible.value = false
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const sendCode = async () => {
  if (!form.value.email) {
    await alert('请输入邮箱地址')
    return
  }

  const emailRegex = /^[^\\s@]+@[^\\s@]+\.[^\\s@]+$/
  if (!emailRegex.test(form.value.email)) {
    await alert('请输入有效的邮箱地址')
    return
  }

  isLoading.value = true
  try {
    await sendResetCode({ email: form.value.email })
    await success('验证码已发送，请查收邮件')
    codeCountdown.value = 60
    countdownTimer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0 && countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  } catch (e: any) {
    await error(e?.response?.data?.message || '发送验证码失败')
  } finally {
    isLoading.value = false
  }
}

const onSubmit = async () => {
  if (!canSubmit.value) return

  if (form.value.newPassword !== form.value.confirmPassword) {
    await alert('两次输入的密码不一致')
    return
  }

  isLoading.value = true
  try {
    await resetPassword({
      email: form.value.email,
      code: form.value.code,
      newPassword: form.value.newPassword
    })
    step.value = 2
  } catch (e: any) {
    await error(e?.response?.data?.message || '密码修改失败')
  } finally {
    isLoading.value = false
  }
}

const onCancel = () => {
  hide()
}

const onFinish = () => {
  hide()
  // 触发重新登录
  window.location.reload()
}


onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

defineExpose({ show, hide })
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.dialog-box {
  background: var(--card-bg, #fff);
  width: 400px;
  max-width: 90vw;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 0;
}

.dialog-header h3 {
  font-size: 18px;
  color: var(--text-primary, #1f2937);
  margin: 0;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 24px;
  color: var(--text-muted, #9ca3af);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-close:hover {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.dialog-body {
  padding: 20px 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  font-size: 14px;
  background: var(--input-bg, #f9fafb);
  color: var(--text-primary, #1f2937);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: var(--menu-active, #73a9d8);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.code-row {
  display: flex;
  gap: 10px;
}

.code-row input {
  flex: 1;
}

.btn-code {
  padding: 0 16px;
  border: 1px solid var(--menu-active, #73a9d8);
  background: transparent;
  color: var(--menu-active, #73a9d8);
  border-radius: 10px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  min-width: 100px;
}

.btn-code:hover:not(:disabled) {
  background: var(--menu-active, #73a9d8);
  color: #fff;
}

.btn-code:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: var(--border-color, #e5e7eb);
  color: var(--text-muted, #9ca3af);
}

.dialog-footer {
  display: flex;
  gap: 12px;
  padding: 0 24px 24px;
}

.dialog-footer button {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-secondary, #4b5563);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--border-color, #e5e7eb);
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-confirm {
  background: var(--menu-active, #73a9d8);
  color: #fff;
}

.btn-confirm:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success-step {
  text-align: center;
  padding: 30px 0;
}

.success-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.success-step h4 {
  font-size: 18px;
  color: var(--text-primary, #1f2937);
  margin-bottom: 8px;
}

.success-step p {
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
