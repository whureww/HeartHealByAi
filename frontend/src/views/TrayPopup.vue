<template>
  <div class="tray-popup-card" @mouseenter="onEnter" @mouseleave="onLeave" @click="openChat">
    <div class="tp-avatar">
      <img v-if="avatarSrc" :src="avatarSrc" alt="" @error="avatarFailed = true" />
      <span v-else>{{ avatarChar }}</span>
      <i class="tp-avatar-ring"></i>
    </div>
    <div class="tp-main">
      <div class="tp-row">
        <span class="tp-sender">{{ msg?.sender || $t('ui.tray.newMessage') }}</span>
        <span v-if="msg && msg.unread > 1" class="tp-badge">{{ $t('ui.tray.unreadCount', { n: msg.unread }) }}</span>
      </div>
      <div class="tp-content">{{ msg?.content || $t('ui.tray.clickToView') }}</div>
      <div class="tp-foot">
        <span class="tp-hint">{{ $t('ui.tray.hint') }}</span>
        <span class="tp-brand">{{ $t('common.appName') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

const { t } = useI18n()

interface TrayMsg {
  sender: string
  content: string
  unread: number
  appointment_id?: number | null
  avatar?: string | null
}

const msg = ref<TrayMsg | null>(null)
const avatarFailed = ref(false)

const avatarSrc = computed(() => {
  const a = msg.value?.avatar
  return a && !avatarFailed.value ? a : ''
})
const avatarChar = computed(() => {
  const fallback = t('ui.tray.avatarChar')
  return (msg.value?.sender || fallback).trim().charAt(0) || fallback
})

// 主题跟随：本窗口启动时已由 main.ts 按 localStorage 应用明暗主题；
// 主窗口运行中切换主题后，经 storage 事件同步到本窗口
function syncTheme() {
  const t = localStorage.getItem('theme') || 'system'
  const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

let offTheme = () => {}
const onStorage = (e: StorageEvent) => {
  if (e.key === 'theme' || e.key === null) syncTheme()
}

onMounted(async () => {
  syncTheme()
  window.addEventListener('storage', onStorage)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme)
  offTheme = () => {
    window.removeEventListener('storage', onStorage)
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', syncTheme)
  }

  // Rust 侧在托盘悬浮时 emit 最新未读消息；弹窗期间来新消息也会推送刷新
  try {
    await listen<TrayMsg>('tray-msg', ({ payload }) => {
      msg.value = payload
      avatarFailed.value = false
    })
  } catch (e) {
    console.error('托盘卡片事件监听失败:', e)
  }
})

onUnmounted(() => offTheme())

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
  width: 340px;
  height: 148px;
  box-sizing: border-box;
  margin: 10px;
  display: flex;
  gap: 14px;
  align-items: stretch;
  padding: 16px 18px 14px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  font-family: var(--font-ui);
  animation: tp-in 0.22s var(--ease-out, ease-out);
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.tray-popup-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

@keyframes tp-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tp-avatar {
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  flex: none;
  margin-top: 2px;
  overflow: visible;
}

.tp-avatar img,
.tp-avatar span {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 20px;
  font-weight: 600;
  border: 2px solid var(--card-bg);
}

.tp-avatar-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  opacity: 0.85;
  pointer-events: none;
}

.tp-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tp-sender {
  color: var(--text-primary);
  font-size: 14.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tp-badge {
  flex: none;
  font-size: 11px;
  line-height: 1.5;
  color: #fff;
  background: var(--danger);
  border-radius: 9px;
  padding: 1px 8px;
  font-weight: 600;
}

.tp-content {
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  min-height: 39px;
}

.tp-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tp-hint {
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 500;
}

.tp-brand {
  color: var(--text-muted);
  font-size: 10.5px;
  letter-spacing: 1px;
}
</style>
