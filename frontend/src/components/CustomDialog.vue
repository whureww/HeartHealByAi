<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click="onOverlayClick">
      <div class="dialog-box" :class="type" @click.stop>
        <div class="dialog-icon" v-if="icon">
          <AppIcon :name="icon" :size="38" :stroke="1.6" />
        </div>
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>

        <div class="buttons-row">
          <button
            v-if="showCancel"
            class="btn-cancel"
            @click="onCancel"
          >
            {{ cancelText }}
          </button>
          <button
            v-if="showConfirm"
            class="btn-confirm"
            :class="confirmClass"
            @click="onConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

interface DialogOptions {
  title?: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  icon?: string
  showCancel?: boolean
  showConfirm?: boolean
  cancelText?: string
  confirmText?: string
  confirmClass?: string
}

const visible = ref(false)
const title = ref('提示')
const message = ref('')
const type = ref('info')
const icon = ref('')
const showCancel = ref(false)
const showConfirm = ref(true)
const cancelText = ref('取消')
const confirmText = ref('确定')
const confirmClass = ref('')
let resolvePromise: ((value: boolean) => void) | null = null

const show = async (options: DialogOptions): Promise<boolean> => {
  if (visible.value) {
    visible.value = false
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  title.value = options.title || '提示'
  message.value = options.message
  type.value = options.type || 'info'
  icon.value = options.icon || getIcon(options.type)
  showCancel.value = options.showCancel ?? false
  showConfirm.value = options.showConfirm ?? true
  cancelText.value = options.cancelText || '取消'
  confirmText.value = options.confirmText || '确定'
  confirmClass.value = options.confirmClass || ''

  await nextTick()
  visible.value = true

  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })
}

const hide = () => {
  visible.value = false
  resolvePromise = null
}

const getIcon = (t?: string) => {
  const map: Record<string, string> = {
    info: 'info',
    success: 'check',
    warning: 'warning',
    error: 'close'
  }
  return map[t || 'info'] || 'info'
}

const onConfirm = () => {
  visible.value = false
  resolvePromise?.(true)
  resolvePromise = null
}

const onCancel = () => {
  visible.value = false
  resolvePromise?.(false)
  resolvePromise = null
}

const onOverlayClick = () => {
  if (!showCancel.value) {
    onConfirm()
  } else {
    onCancel()
  }
}

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
  width: 320px;
  padding: 28px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.dialog-icon {
  color: var(--info);
  margin-bottom: 12px;
  display: flex;
  justify-content: center;
}

.dialog-box.success .dialog-icon {
  color: var(--success);
}

.dialog-box.warning .dialog-icon {
  color: var(--warning);
}

.dialog-box.error .dialog-icon {
  color: var(--danger);
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-primary);
}

p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 24px;
  line-height: 1.5;
}

.buttons-row {
  display: flex;
  gap: 12px;
}

.buttons-row button {
  flex: 1;
  height: 42px;
  border-radius: var(--radius-ctl);
  border: none;
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-confirm {
  background: var(--accent);
  color: var(--on-accent);
}

.btn-confirm:hover {
  background: var(--accent-strong);
}

.dialog-box.error .btn-confirm {
  background: var(--danger);
  color: var(--on-accent);
}

.dialog-box.error .btn-confirm:hover {
  filter: brightness(0.92);
}

.dialog-box.warning .btn-confirm {
  background: var(--warning);
  color: var(--on-accent);
}

.dialog-box.warning .btn-confirm:hover {
  filter: brightness(0.92);
}

.dialog-box.success .btn-confirm {
  background: var(--success);
  color: var(--on-accent);
}

.dialog-box.success .btn-confirm:hover {
  filter: brightness(0.92);
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
