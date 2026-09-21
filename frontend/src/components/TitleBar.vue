<template>
  <div class="title-bar" data-tauri-drag-region>
    <div class="title" data-tauri-drag-region>
      <AppIcon name="moon" :size="14" class="title-mark" />
      <span>心愈</span>
      <span class="title-sub">心理健康系统</span>
    </div>
    <div class="window-controls">
      <button class="win-btn" @click="minimize" title="最小化" aria-label="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1.5" y1="6" x2="10.5" y2="6" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
      <button class="win-btn btn-close" @click="onCloseClick" title="关闭" aria-label="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>

  <ConfirmDialog
    :visible="showDialog"
    @action="onAction"
    @cancel="onCancel"
  />
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import ConfirmDialog from './ConfirmDialog.vue'
import AppIcon from './AppIcon.vue'
import { useSettingsStore } from '@/stores/settings'

const window = getCurrentWindow()
const settingsStore = useSettingsStore()

const showDialog = ref(false)

// 点击最小化按钮 → 隐藏窗口到托盘
const minimize = async () => {
  await window.hide()
}

const onCloseClick = async () => {
  if (settingsStore.closeAction === 'minimize') {
    await window.hide()
  } else if (settingsStore.closeAction === 'exit') {
    await window.close()
  } else {
    showDialog.value = true
  }
}

const onAction = async (action: 'minimize' | 'exit', remember: boolean) => {
  showDialog.value = false

  if (remember) {
    settingsStore.setCloseAction(action)
  }

  if (action === 'minimize') {
    await window.hide()
  } else {
    await window.close()
  }
}

const onCancel = () => {
  showDialog.value = false
}
</script>

<style scoped>
/* 桌面原生标题栏：与底色同层、细分割线、矩形 caption 按钮 */
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 38px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 14px;
  -webkit-app-region: drag;
  z-index: 9999;
}

.title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.title-mark {
  color: var(--accent);
}

.title-sub {
  font-weight: 400;
  color: var(--text-muted);
}

.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 46px;
  height: 100%;
  border: none;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  background: transparent;
  transition: background 0.15s ease, color 0.15s ease;
}

.win-btn:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-close:hover {
  background: #c0392b;
  color: #fff;
}
</style>
