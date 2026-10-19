<template>
  <div class="user-appointment-list">
    <div class="list-header">
      <h3>
        <AppIcon name="calendar" :size="17" />
        {{ $t('expert.appt.mineTitle') }}
      </h3>
      <div class="header-actions">
        <span class="online-indicator" :class="{ online: isSocketConnected }">
          <span class="status-dot" :class="{ online: isSocketConnected }"></span>
          {{ isSocketConnected ? $t('expert.appt.online') : $t('expert.appt.offline') }}
        </span>
        <button class="btn-refresh" @click="loadAppointments" :disabled="loading">
          <AppIcon name="refresh" :size="14" />
          {{ loading ? $t('expert.appt.refreshing') : $t('expert.appt.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>{{ $t('expert.appt.loading') }}</span>
    </div>

    <div v-else-if="appointments.length === 0" class="empty-state">
      <AppIcon name="list" :size="28" />
      <p>{{ $t('expert.appt.emptyUser') }}</p>
    </div>

    <div v-else class="appointment-cards">
      <div
        v-for="item in appointments"
        :key="item.id"
        class="appointment-card"
        :class="{ 'status-changed': recentlyUpdated.has(item.id), 'clickable': item.status === 'confirmed' }"
        @click="handleViewDetail(item.id)"
      >
        <div class="card-header">
          <div class="expert-info">
            <span class="expert-name">{{ doctorField(item, 'name') || $t('expert.appt.fallbackExpert') }}</span>
            <span class="expert-title">{{ doctorField(item, 'title') || $t('expert.appt.fallbackTitle') }}</span>
          </div>
          <span :class="['status-badge', `status-${item.status}`]">
            {{ statusText(item.status) }}
          </span>
        </div>

        <div class="card-body">
          <div class="info-row">
            <span class="label">{{ $t('expert.appt.timeLabel') }}</span>
            <span class="time-value">{{ formatDate(item.created_at) }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ $t('expert.appt.statusLabel') }}</span>
            <span class="status-desc">{{ statusDesc(item.status) }}</span>
          </div>
        </div>

        <div class="card-footer">
          <button
            v-if="item.status === 'confirmed'"
            class="btn-chat"
          >
            <AppIcon name="chat" :size="14" />
            {{ $t('expert.appt.enterChat') }}
          </button>
          <span v-else class="status-tip">
            {{ statusTip(item.status) }}
          </span>
          <button
            v-if="item.status === 'pending' || item.status === 'confirmed'"
            class="btn-cancel"
            :disabled="canceling === item.id"
            @click.stop="handleCancel(item)"
          >
            {{ canceling === item.id ? $t('expert.appt.canceling') : $t('expert.appt.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'
import { SOCKET_URL, getAuthToken } from '@/config'
import { getUserAppointments, cancelAppointment } from '@/api/user'
import { showToast } from '@/utils/notify'
import { bindChatNotification } from '@/utils/taskbar'
import { confirm, success, error } from '@/utils/dialog'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits<{
  (e: 'view-detail', id: number): void
}>()

const { t, locale } = useI18n()

const userStore = useUserStore()
const appointments = ref<any[]>([])
const loading = ref(false)
const socket = ref<Socket | null>(null)
const isSocketConnected = ref(false)
const recentlyUpdated = ref<Set<number>>(new Set())

// 专家双语展示：英文界面优先 _en 字段（后端返回 doctor_name/doctor_title/name_en/title_en）
const doctorField = (item: any, field: 'name' | 'title'): string => {
  const isEn = locale.value === 'en'
  if (isEn) {
    const en = item[`doctor_${field}_en`]
    if (en) return en
  }
  return item[`doctor_${field}`] || ''
}

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: t('expert.appt.statusPending'),
    confirmed: t('expert.appt.statusConfirmed'),
    completed: t('expert.appt.statusCompleted'),
    cancelled: t('expert.appt.statusCancelled'),
    rejected: t('expert.appt.statusRejected')
  }
  return map[status] || status
}

const statusDesc = (status: string) => {
  const map: Record<string, string> = {
    pending: t('expert.appt.descPending'),
    confirmed: t('expert.appt.descConfirmed'),
    completed: t('expert.appt.descCompleted'),
    cancelled: t('expert.appt.descCancelled'),
    rejected: t('expert.appt.descRejected')
  }
  return map[status] || ''
}

const statusTip = (status: string) => {
  const map: Record<string, string> = {
    pending: t('expert.appt.tipPending'),
    completed: t('expert.appt.tipCompleted'),
    cancelled: t('expert.appt.tipCancelled'),
    rejected: t('expert.appt.tipRejected')
  }
  return map[status] || ''
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadAppointments = async () => {
  loading.value = true
  try {
    const res = await getUserAppointments() as any
    appointments.value = res.data
    console.log('加载用户预约列表:', appointments.value.length, '条')
  } catch (e) {
    console.error('加载预约列表失败:', e)
  } finally {
    loading.value = false
  }
}

const handleViewDetail = (id: number) => {
  if (appointments.value.find(a => a.id === id)?.status === 'confirmed') {
    emit('view-detail', id)
  }
}

// 用户取消自己的预约（待确认/已确认均可取消，后端校验只能操作本人的预约）
const canceling = ref<number | null>(null)

const handleCancel = async (item: any) => {
  const ok = await confirm(
    t('expert.appt.cancelWithExpert', { name: doctorField(item, 'name') || t('expert.appt.fallbackExpert') }),
    t('expert.appt.titleCancel')
  )
  if (!ok) return
  canceling.value = item.id
  try {
    await cancelAppointment(item.id)
    await success(t('expert.appt.cancelledMsg'))
    await loadAppointments()
  } catch (e: any) {
    await error(e?.message || t('expert.appt.cancelFailed'))
  } finally {
    canceling.value = null
  }
}

const updateLocalStatus = (appointmentId: number, status: string) => {
  const index = appointments.value.findIndex(a => a.id === appointmentId)
  if (index !== -1) {
    appointments.value[index].status = status
    appointments.value[index].updated_at = new Date().toISOString()

    recentlyUpdated.value.add(appointmentId)
    setTimeout(() => {
      recentlyUpdated.value.delete(appointmentId)
    }, 3000)
  }
}

const initSocket = () => {
  const globalSocket = (window as any).__globalSocket__ as Socket | undefined

  if (globalSocket && globalSocket.connected) {
    socket.value = globalSocket
    isSocketConnected.value = true
    setupListeners(globalSocket)
    return
  }

  const newSocket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })

  ;(window as any).__globalSocket__ = newSocket
  socket.value = newSocket

  newSocket.on('connect', () => {
    isSocketConnected.value = true
    newSocket.emit('authenticate', { userId: userStore.userInfo!.id, token: getAuthToken() })
  })

  newSocket.on('disconnect', () => {
    isSocketConnected.value = false
  })

  setupListeners(newSocket)
}

const setupListeners = (sock: Socket) => {
  // 后台私聊消息提醒（系统通知 + 任务栏频闪），幂等绑定
  bindChatNotification(sock)

  // 监听预约列表更新（专家端操作后广播）
  sock.on('appointment-list-updated', (data: {
    userId: number
    appointmentId: number
    status: string
    updateTime: string
  }) => {
    console.log('用户端收到列表更新:', data)
    // 只处理自己的预约
    if (data.userId === userStore.userInfo?.id) {
      updateLocalStatus(data.appointmentId, data.status)
      showToast(t('expert.appt.toastTitle'), t('expert.appt.yourStatusChanged', { status: data.status }), true)
    }
  })

  // 监听预约详情更新（自己在聊天页操作时）
  sock.on('appointment-updated', (data: {
    appointmentId: number
    status: string
    updaterId: number
  }) => {
    if (data.updaterId !== userStore.userInfo?.id) {
      updateLocalStatus(data.appointmentId, data.status)
      showToast(t('expert.appt.toastTitle'), t('expert.appt.toastStatusChanged', { id: data.appointmentId, status: data.status }), true)
    }
  })
}

onMounted(() => {
  loadAppointments()
  initSocket()
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.off('appointment-list-updated')
    socket.value.off('appointment-updated')
  }
})
</script>

<style scoped>
.user-appointment-list {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.list-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.online-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  transition: all 0.3s;
}

.online-indicator.online {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
  transition: background 0.3s;
}

.status-dot.online {
  background: var(--success);
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.btn-refresh:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: var(--text-muted);
  gap: 12px;
  font-size: 13.5px;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2.5px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px;
  color: var(--text-muted);
  font-size: 13.5px;
  gap: 4px;
}

.empty-state svg {
  opacity: 0.55;
  margin-bottom: 6px;
}

.empty-state p {
  margin: 0;
}

.appointment-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.appointment-cards::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

.appointment-card {
  background: var(--card-bg);
  border-radius: var(--radius-card);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  padding: 16px;
  cursor: default;
  transition: all 0.3s var(--ease-out);
}

/* 仅已确认（可进入聊天）的卡片呈现可点击手势 */
.appointment-card.clickable {
  cursor: pointer;
}

.appointment-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.appointment-card.status-changed {
  animation: highlight 3s ease-out;
}

@keyframes highlight {
  0% {
    background: color-mix(in srgb, var(--success) 12%, var(--card-bg));
    border-color: color-mix(in srgb, var(--success) 40%, transparent);
  }
  100% {
    background: var(--card-bg);
    border-color: var(--border-color);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.expert-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.expert-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.expert-title {
  font-size: 12px;
  color: var(--text-muted);
}

.status-badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-pending {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}

.status-confirmed {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.status-completed {
  background: color-mix(in srgb, var(--info) 12%, transparent);
  color: var(--info);
}

.status-cancelled {
  background: color-mix(in srgb, var(--text-muted) 14%, transparent);
  color: var(--text-muted);
}

/* 拒绝：红色调，与用户主动取消的灰色区分 */
.status-rejected {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.info-row {
  display: flex;
  font-size: 13px;
  color: var(--text-secondary);
}

.info-row .label {
  color: var(--text-muted);
  margin-right: 4px;
}

.time-value {
  font-variant-numeric: tabular-nums;
}

.status-desc {
  color: var(--accent);
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.btn-chat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-ui);
  transition: background 0.2s var(--ease-out);
}

.btn-chat:hover {
  background: var(--accent-strong);
}

.btn-cancel {
  padding: 8px 14px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
  border-radius: var(--radius-ctl);
  color: var(--danger);
  font-size: 13px;
  cursor: pointer;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.btn-cancel:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.btn-cancel:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.status-tip {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
