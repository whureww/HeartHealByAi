<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay">
      <div class="dialog-box" @click.stop>
        <div class="dialog-header">
          <h3>
            <AppIcon name="lock" :size="16" />
            修改密码
          </h3>
          <button class="btn-close" @click="onCancel" title="关闭">
            <AppIcon name="close" :size="16" />
          </button>
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
            <div class="success-icon">
              <AppIcon name="check" :size="44" :stroke="1.8" />
            </div>
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
import AppIcon from '@/components/AppIcon.vue'

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
  background: rgba(20, 21, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.dialog-box {
  background: var(--card-bg);
  width: 400px;
  max-width: 90vw;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 0;
}

.dialog-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.btn-close {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s var(--ease-out);
}

.btn-close:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
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
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  outline: none;
  font-family: var(--font-ui);
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
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
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: transparent;
  color: var(--accent);
  border-radius: var(--radius-ctl);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
  min-width: 100px;
}

.btn-code:hover:not(:disabled) {
  background: var(--accent-soft);
}

.btn-code:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: var(--border-color);
  color: var(--text-muted);
}

.dialog-footer {
  display: flex;
  gap: 12px;
  padding: 0 24px 24px;
}

.dialog-footer button {
  flex: 1;
  height: 42px;
  border-radius: var(--radius-ctl);
  border: none;
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-confirm {
  background: var(--accent);
  color: var(--on-accent);
}

.btn-confirm:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid color-mix(in srgb, var(--on-accent) 30%, transparent);
  border-top-color: var(--on-accent);
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
  color: var(--success);
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.success-step h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.success-step p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
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
