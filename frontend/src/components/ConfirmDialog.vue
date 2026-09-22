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
  background: rgba(20, 21, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.dialog-box {
  background: var(--card-bg);
  width: 300px;
  padding: 28px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
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
