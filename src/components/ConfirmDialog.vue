<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click="onCancel">
      <div class="dialog-box" @click.stop>
        <h3>确认关闭</h3>
        <p>您希望如何操作？</p>
        
        <div class="buttons-row">
          <button class="btn-minimize" @click="onMinimize">最小化</button>
          <button class="btn-exit" @click="onExit">直接退出</button>
        </div>

        <label class="remember">
          <input type="checkbox" v-model="remember" />
          <span>记住我的选择，不再询问</span>
        </label>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'action', action: 'minimize' | 'exit', remember: boolean): void
  (e: 'cancel'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const remember = ref(false)

const onMinimize = () => {
  emit('action', 'minimize', remember.value)
}

const onExit = () => {
  emit('action', 'exit', remember.value)
}

const onCancel = () => {
  emit('cancel')
}
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
  width: 300px;
  padding: 28px;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #1f2937;
  text-align: center;
}

p {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 24px;
  text-align: center;
}

.buttons-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
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

.btn-minimize {
  background: #f3f4f6;
  color: #4b5563;
}

.btn-minimize:hover {
  background: #e5e7eb;
}

.btn-exit {
  background: #ef4444;
  color: #fff;
}

.btn-exit:hover {
  background: #dc2626;
}

.remember {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #9ca3af;
  cursor: pointer;
}

.remember input {
  width: 14px;
  height: 14px;
  accent-color: #3b82f6;
  cursor: pointer;
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
