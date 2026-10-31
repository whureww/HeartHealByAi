<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay">
      <div class="dialog-box" @click.stop>
        <div class="dialog-header">
          <h3>
            <AppIcon name="lock" :size="16" />
            {{ $t('ui.changePwd.title') }}
          </h3>
          <button class="btn-close" @click="onCancel" :title="$t('ui.close')">
            <AppIcon name="close" :size="16" />
          </button>
        </div>

        <div class="dialog-body">
          <!-- 步骤1：验证码发送至当前登录账号邮箱（不允许指定其他邮箱，防止越权重置） -->
          <div v-if="step === 1" class="step-content">
            <div class="form-group">
              <label>{{ $t('ui.changePwd.codeSentTo', { email: accountEmail || '-' }) }}</label>
              <div class="code-row">
                <input
                  v-model="form.code"
                  type="text"
                  :placeholder="$t('ui.changePwd.codePlaceholder')"
                  maxlength="6"
                  :disabled="isLoading"
                />
                <button
                  class="btn-code"
                  :disabled="codeCountdown > 0 || isLoading || !accountEmail"
                  @click="sendCode"
                >
                  {{ codeCountdown > 0 ? $t('common.resendIn', { sec: codeCountdown }) : $t('ui.changePwd.getCode') }}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>{{ $t('ui.changePwd.newPwdLabel') }}</label>
              <input
                v-model="form.newPassword"
                type="password"
                :placeholder="$t('ui.changePwd.newPwdPlaceholder')"
                :disabled="isLoading"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('ui.changePwd.confirmPwdLabel') }}</label>
              <input
                v-model="form.confirmPassword"
                type="password"
                :placeholder="$t('ui.changePwd.confirmPwdPlaceholder')"
                :disabled="isLoading"
              />
            </div>
          </div>

          <!-- 步骤2：成功提示 -->
          <div v-else class="step-content success-step">
            <div class="success-icon">
              <AppIcon name="check" :size="44" :stroke="1.8" />
            </div>
            <h4>{{ $t('ui.changePwd.successTitle') }}</h4>
            <p>{{ $t('ui.changePwd.successMsg') }}</p>
          </div>
        </div>

        <div class="dialog-footer">
          <button v-if="step === 1" class="btn-cancel" @click="onCancel" :disabled="isLoading">
            {{ $t('ui.dialog.cancel') }}
          </button>
          <button
            v-if="step === 1"
            class="btn-confirm"
            :disabled="isLoading || !canSubmit"
            @click="onSubmit"
          >
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>{{ $t('ui.changePwd.submit') }}</span>
          </button>
          <button v-else class="btn-confirm" @click="onFinish">
            {{ $t('ui.dialog.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { sendResetCode, resetPassword } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { alert, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()
const userStore = useUserStore()

const visible = ref(false)
const step = ref(1)
const isLoading = ref(false)
const codeCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 验证码固定发送至当前登录账号邮箱：不允许自行填写其他邮箱，
// 杜绝「在个人中心用他人邮箱重置密码」的越权入口
const accountEmail = computed(() => {
  return userStore.userInfo?.email || localStorage.getItem('accountEmail') || ''
})

const form = ref({
  code: '',
  newPassword: '',
  confirmPassword: ''
})

const canSubmit = computed(() => {
  return (
    accountEmail.value &&
    form.value.code &&
    form.value.newPassword &&
    form.value.confirmPassword &&
    form.value.newPassword.length >= 6 &&
    form.value.newPassword === form.value.confirmPassword
  )
})

const show = () => {
  step.value = 1
  form.value = { code: '', newPassword: '', confirmPassword: '' }
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
  if (!accountEmail.value) return

  isLoading.value = true
  try {
    await sendResetCode({ email: accountEmail.value })
    await success(t('ui.changePwd.codeSent'))
    codeCountdown.value = 60
    countdownTimer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0 && countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  } catch (e: any) {
    await error(e?.response?.data?.message || t('ui.changePwd.sendCodeFailed'))
  } finally {
    isLoading.value = false
  }
}

const onSubmit = async () => {
  if (!canSubmit.value) return

  if (form.value.newPassword !== form.value.confirmPassword) {
    await alert(t('ui.changePwd.pwdMismatch'))
    return
  }

  isLoading.value = true
  try {
    await resetPassword({
      email: accountEmail.value,
      code: form.value.code,
      newPassword: form.value.newPassword
    })
    step.value = 2
  } catch (e: any) {
    await error(e?.response?.data?.message || t('ui.changePwd.failed'))
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
