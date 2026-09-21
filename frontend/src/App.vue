<template>
  <TitleBar />
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
  <LoadingOverlay :visible="loadingStore.visible" :text="loadingStore.text" />
  <CustomDialog ref="dialogRef" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TitleBar from './components/TitleBar.vue'
import LoadingOverlay from './components/LoadingOverlay.vue'
import CustomDialog from './components/CustomDialog.vue'
import { useLoadingStore } from './stores/loading'
import { setDialogInstance } from './utils/dialog'

const loadingStore = useLoadingStore()
const dialogRef = ref()

onMounted(() => {
  setDialogInstance(dialogRef.value)
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.documentElement.style.height = '100vh'
  document.body.style.height = '100vh'
  
})
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
}, { capture: true });
</script>

<style>
/* ===== 全局禁止文字选中 ===== */
* {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* 允许输入框和文本域内文字选中 */
input, textarea {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

/* 允许特定区域文字选中 */
.selectable-text {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

/* ===== 全局基础（设计令牌见 styles/tokens.css）===== */
html, body, #app {
  width: 100vw;
  height: 100vh;
  overflow: hidden !important;
  margin: 0;
  padding: 0;
}

html {
  font-family: var(--font-ui);
  color: var(--text-primary);
  background: var(--bg-primary);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.app-container {
  width: 100vw;
  height: calc(100vh - 38px);
  margin-top: 38px;
  overflow: hidden !important;
  position: relative;
}

/* ===== 台灯光晕（氛围层，全应用唯一的背景签名）===== */
.app-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--lamp-layer), var(--lamp-floor);
  pointer-events: none;
  z-index: 0;
}

.app-container > * {
  position: relative;
  z-index: 1;
}

/* ===== 数字对齐 ===== */
.tabular, time, .num {
  font-variant-numeric: tabular-nums;
}

/* ===== 页面切换动画（指数缓出）===== */
.page-enter-active {
  transition: opacity 0.32s var(--ease-out), transform 0.32s var(--ease-out);
}

.page-leave-active {
  transition: opacity 0.18s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
}

/* ===== 全局控件基调 ===== */
button {
  font-family: var(--font-ui);
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

::-webkit-scrollbar-track {
  background: transparent;
}

/* ===== 键盘焦点 ===== */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
