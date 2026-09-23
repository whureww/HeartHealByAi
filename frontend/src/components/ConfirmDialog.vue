<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click="onCancel">
      <div class="dialog-box" @click.stop>
        <button class="dialog-close" @click="onCancel" title="取消" aria-label="取消">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
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
  background: rgba(20, 21, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.dialog-box {
  position: relative;
  background: var(--card-bg);
  width: 300px;
  padding: 28px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
}

/* 右上角取消按钮：与标题栏 caption 按钮同款，省去独立取消按钮占位 */
.dialog-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-ctl);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.dialog-close:hover {
  background: #c0392b;
  color: #fff;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-primary);
  text-align: center;
}

p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 24px;
  text-align: center;
}

.buttons-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
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

.btn-minimize {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-minimize:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-exit {
  background: var(--danger);
  color: var(--on-accent);
}

.btn-exit:hover {
  filter: brightness(0.92);
}

.remember {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
}

.remember input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
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
