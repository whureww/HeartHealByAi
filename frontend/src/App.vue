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
  <LockScreen v-if="isLocked" :timeout-minutes="settingsStore.lockTimeout" @unlock="isLocked = false" />
  <CustomDialog ref="dialogRef" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import TitleBar from './components/TitleBar.vue'
import LoadingOverlay from './components/LoadingOverlay.vue'
import LockScreen from './components/LockScreen.vue'
import CustomDialog from './components/CustomDialog.vue'
import { useLoadingStore } from './stores/loading'
import { useSettingsStore } from './stores/settings'
import { setDialogInstance } from './utils/dialog'

const loadingStore = useLoadingStore()
const settingsStore = useSettingsStore()
const dialogRef = ref()

// ===== 离开自动锁定：闲置超时后显示锁屏（pointerdown/keydown 任意活动即重置） =====
const isLocked = ref(false)
let idleTimer: number | undefined

function resetIdle() {
  window.clearTimeout(idleTimer)
  if (isLocked.value) return
  if (!settingsStore.lockOnLeave || !settingsStore.lockTimeout) return
  idleTimer = window.setTimeout(() => {
    isLocked.value = true
  }, settingsStore.lockTimeout * 60 * 1000)
}

watch(() => [settingsStore.lockOnLeave, settingsStore.lockTimeout], resetIdle)

onMounted(() => {
  setDialogInstance(dialogRef.value)
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.documentElement.style.height = '100vh'
  document.body.style.height = '100vh'
  window.addEventListener('pointerdown', resetIdle, true)
  window.addEventListener('keydown', resetIdle, true)
  resetIdle()
})

onUnmounted(() => {
  window.clearTimeout(idleTimer)
  window.removeEventListener('pointerdown', resetIdle, true)
  window.removeEventListener('keydown', resetIdle, true)
})
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
}, { capture: true });

// ===== 禁用浏览器式快捷键（WebView 本质是网页，需拦截导航/刷新/缩放类操作） =====
// 防止用户误触或利用快捷键离开当前流程：侧键前进回退、刷新、缩放、打印等
const BLOCKED_KEYS = new Set(['F5', 'F12'])
const BLOCKED_CTRL_KEYS = new Set(['KeyR', 'KeyP', 'KeyH', 'KeyU', 'KeyJ', 'KeyD', 'Equal', 'Minus', 'Digit0'])

function onBlockKeydown(e: KeyboardEvent) {
  // 放行功能键给正常输入（如表单里的 F2 等不在名单内）
  if (BLOCKED_KEYS.has(e.code)) {
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && BLOCKED_CTRL_KEYS.has(e.code)) {
    e.preventDefault()
    return
  }
  // Alt+←/→ 浏览器式前进回退
  if (e.altKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    e.preventDefault()
  }
}

// 鼠标侧键（XButton1/2 = 回退/前进）
function onBlockMouseNav(e: MouseEvent) {
  if (e.button === 3 || e.button === 4) {
    e.preventDefault()
  }
}

// Ctrl+滚轮缩放
function onBlockWheelZoom(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onBlockKeydown, true)
  window.addEventListener('mousedown', onBlockMouseNav, true)
  window.addEventListener('mouseup', onBlockMouseNav, true)
  window.addEventListener('wheel', onBlockWheelZoom, { capture: true, passive: false })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onBlockKeydown, true)
  window.removeEventListener('mousedown', onBlockMouseNav, true)
  window.removeEventListener('mouseup', onBlockMouseNav, true)
  window.removeEventListener('wheel', onBlockWheelZoom, { capture: true })
})
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

/* ===== 应用内轻提示（消息通知） ===== */
#xinyu-toasts {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9500;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.xinyu-toast {
  min-width: 220px;
  max-width: 320px;
  padding: 12px 14px;
  box-sizing: border-box;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-ctl);
  box-shadow: var(--shadow-lg);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out);
}

.xinyu-toast.show {
  opacity: 1;
  transform: translateY(0);
}

.xinyu-toast-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.xinyu-toast-body {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-all;
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
  height: calc(100vh - var(--titlebar-h));
  margin-top: 38px;
  overflow: hidden !important;
  position: relative;
}

/* ===== 台灯光晕（氛围层，全应用唯一的背景签名）===== */
.app-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--lamp-layer), var(--lamp-floor), var(--lamp-vignette);
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
