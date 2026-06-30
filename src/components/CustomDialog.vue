<<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click="onOverlayClick">
      <div class="dialog-box" :class="type" @click.stop>
        <div class="dialog-icon" v-if="icon">
          {{ icon }}
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
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  }
  return map[t || 'info'] || 'ℹ️'
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.dialog-box {
  background: #fff;
  width: 320px;
  padding: 28px;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.dialog-box.error .btn-confirm {
  background: #ef4444;
}

.dialog-box.warning .btn-confirm {
  background: #f59e0b;
}

.dialog-box.success .btn-confirm {
  background: #10b981;
}

.dialog-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #1f2937;
}

p {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 24px;
  line-height: 1.5;
}

.buttons-row {
  display: flex;
  gap: 12px;
}

.buttons-row button {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f3f4f6;
  color: #4b5563;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.btn-confirm {
  background: #73a9d8;
  color: #fff;
}

.btn-confirm:hover {
  opacity: 0.9;
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
