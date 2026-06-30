<template>
  <div class="title-bar" data-tauri-drag-region>
    <div class="title">心愈 · 心理系统</div>
    <div class="window-controls">
      <button class="btn-minimize" @click="minimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="5" width="10" height="2" fill="currentColor"/>
        </svg>
      </button>
      <button class="btn-close" @click="onCloseClick" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" stroke-width="1.5"/>
        </svg>
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
import { useSettingsStore } from '@/stores/settings'

const window = getCurrentWindow()
const settingsStore = useSettingsStore()

const showDialog = ref(false)

// ✅ 修改：点击最小化按钮 → 隐藏窗口到托盘
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
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  background: var(--menu-active, #73a9d8);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  -webkit-app-region: drag;
  z-index: 9999;
}

.title {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.9;
}

.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.window-controls button {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  background: transparent;
  transition: background 0.2s;
}

.btn-minimize:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-close:hover {
  background: #ef4444;
}
</style>
