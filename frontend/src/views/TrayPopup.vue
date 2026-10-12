<template>
  <div class="tray-popup-card" @mouseenter="onEnter" @mouseleave="onLeave" @click="openChat">
    <div class="tp-avatar">{{ avatarChar }}</div>
    <div class="tp-main">
      <div class="tp-row">
        <span class="tp-sender">{{ msg?.sender || '新消息' }}</span>
        <span v-if="msg && msg.unread > 1" class="tp-badge">共 {{ msg.unread }} 条未读</span>
      </div>
      <div class="tp-content">{{ msg?.content || '点击查看新消息' }}</div>
      <div class="tp-hint">点击查看消息</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

interface TrayMsg {
  sender: string
  content: string
  unread: number
  appointment_id?: number | null
}

const msg = ref<TrayMsg | null>(null)
const avatarChar = computed(() => (msg.value?.sender || '消').trim().charAt(0) || '消')

onMounted(async () => {
  // Rust 侧在托盘悬浮时 emit 最新未读消息；弹窗期间来新消息也会推送刷新
  try {
    await listen<TrayMsg>('tray-msg', ({ payload }) => {
      msg.value = payload
    })
  } catch (e) {
    console.error('托盘卡片事件监听失败:', e)
  }
})

function onEnter() {
  invoke('tray_popup_hover', { hover: true }).catch(() => {})
}
function onLeave() {
  invoke('tray_popup_hover', { hover: false }).catch(() => {})
}
function openChat() {
  invoke('tray_popup_open_chat').catch(() => {})
}
</script>

<style>
/* 弹窗窗口本体透明：卡片浮在透明窗口上（仅托盘卡片路由加载时生效） */
html, body, #app {
  background: transparent !important;
}
</style>

<style scoped>
.tray-popup-card {
  width: 336px;
  height: 144px;
  box-sizing: border-box;
  margin: 4px;
  display: flex;
  gap: 12px;
  align-items: stretch;
  padding: 14px 16px;
  background: rgba(24, 30, 42, 0.97);
  border: 1px solid rgba(122, 156, 245, 0.35);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  font-family: var(--font-ui);
}
.tray-popup-card:hover {
  border-color: rgba(122, 156, 245, 0.65);
}

.tp-avatar {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: linear-gradient(135deg, #7a9cf5, #5a7ce0);
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin-top: 2px;
}

.tp-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tp-sender {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tp-badge {
  flex: none;
  font-size: 11px;
  line-height: 1.4;
  color: #ffe1e1;
  background: rgba(214, 69, 56, 0.92);
  border-radius: 9px;
  padding: 1px 8px;
}

.tp-content {
  color: #c6cde0;
  font-size: 12.5px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  min-height: 38px;
}

.tp-hint {
  color: #7f88a3;
  font-size: 11px;
  margin-top: auto;
}
</style>
