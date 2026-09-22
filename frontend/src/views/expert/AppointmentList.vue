<template>
  <div class="appointment-list">
    <div class="list-header">
      <h3>
        <AppIcon name="clipboard" :size="17" />
        预约管理
      </h3>
      <div class="header-actions">
        <span class="online-indicator" :class="{ online: isSocketConnected }">
          <span class="status-dot" :class="{ online: isSocketConnected }"></span>
          {{ isSocketConnected ? '实时连接' : '离线' }}
        </span>
        <button class="btn-refresh" @click="loadAppointments" :disabled="loading">
          <AppIcon name="refresh" :size="14" />
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="appointments.length === 0" class="empty-state">
      <AppIcon name="list" :size="28" />
      <p>暂无预约记录</p>
    </div>

    <div v-else class="appointment-table">
      <div class="table-header">
        <span>预约人</span>
        <span>联系方式</span>
        <span>预约时间</span>
        <span>状态</span>
        <span>操作</span>
      </div>

      <div
        v-for="item in appointments"
        :key="item.id"
        class="table-row"
        :class="{ 'status-changed': recentlyUpdated.has(item.id) }"
      >
        <div class="cell user-info">
          <span class="user-name">{{ item.user_name }}</span>
          <span class="user-email">{{ item.user_email }}</span>
        </div>

        <div class="cell contact">
          <span>{{ item.user_phone || '未填写' }}</span>
        </div>

        <div class="cell time">
          {{ formatDate(item.created_at) }}
        </div>

        <div class="cell status">
          <span :class="['status-badge', `status-${item.status}`]">
            {{ statusText(item.status) }}
          </span>
        </div>

        <div class="cell actions">
          <button
            v-if="item.status === 'pending'"
            class="btn-action confirm"
            @click.stop="handleConfirm(item.id)"
          >
            确认
          </button>
          <button
            v-else-if="item.status === 'confirmed'"
            class="btn-action chat"
            @click.stop="emit('view-detail', item.id)"
          >
            <AppIcon name="chat" :size="13" />
            进入聊天
          </button>
          <button
            v-else-if="item.status === 'completed'"
            class="btn-action view"
            @click.stop="emit('view-detail', item.id)"
          >
            查看
          </button>
          <span v-else class="status-tip">—</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { SOCKET_URL, getAuthToken } from '@/config'
import { getExpertAppointments, updateAppointmentStatus } from '@/api/expert'
import { success, error } from '@/utils/dialog'
import { showToast } from '@/utils/notify'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits<{
  (e: 'view-detail', id: number): void
}>()

const userStore = useUserStore()
const appointments = ref<any[]>([])
const loading = ref(false)
const socket = ref<Socket | null>(null)
const isSocketConnected = ref(false)
const recentlyUpdated = ref<Set<number>>(new Set())

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
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
    const res = await getExpertAppointments() as any
    appointments.value = res.data
    console.log('加载预约列表:', appointments.value.length, '条')
  } catch (e) {
    console.error('加载预约列表失败:', e)
  } finally {
    loading.value = false
  }
}

const handleConfirm = async (id: number) => {
  try {
    await updateAppointmentStatus(id, 'confirmed')
    await success('预约已确认')
    updateLocalStatus(id, 'confirmed')
  } catch (e: any) {
    await error(e.message || '确认失败')
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
  sock.on('appointment-updated', (data: {
    appointmentId: number
    status: string
    updaterId: number
    updateTime: string
  }) => {
    console.log('收到预约更新:', data)
    if (data.updaterId !== userStore.userInfo?.id) {
      loadAppointments()
      showToast('预约状态更新', `预约 #${data.appointmentId} 状态变更为「${data.status}」`, true)
    } else {
      updateLocalStatus(data.appointmentId, data.status)
    }
  })

  sock.on('appointment-list-updated', (data: {
    userId: number
    appointmentId: number
    status: string
    updateTime: string
  }) => {
    console.log('收到列表更新广播:', data)
    const exists = appointments.value.some(a => a.id === data.appointmentId)
    if (exists) {
      updateLocalStatus(data.appointmentId, data.status)
    } else {
      loadAppointments()
    }
  })
}

onMounted(() => {
  loadAppointments()
  initSocket()
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.off('appointment-updated')
    socket.value.off('appointment-list-updated')
  }
})
</script>

<style scoped>
.appointment-list {
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

.appointment-table {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1.2fr;
  gap: 12px;
  padding: 12px 18px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1.2fr;
  gap: 12px;
  padding: 14px 18px;
  align-items: center;
  transition: background 0.2s var(--ease-out);
}

.table-row + .table-row {
  border-top: 1px solid var(--border-color);
}

.table-row:hover {
  background: color-mix(in srgb, var(--accent-soft) 45%, transparent);
}

.table-row.status-changed {
  animation: highlight 3s ease-out;
}

@keyframes highlight {
  0% {
    background: color-mix(in srgb, var(--success) 12%, transparent);
  }
  100% {
    background: transparent;
  }
}

.cell {
  font-size: 13.5px;
  color: var(--text-secondary);
  min-width: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 500;
  color: var(--text-primary);
}

.user-email {
  font-size: 11.5px;
  color: var(--text-muted);
}

.time {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.status-badge {
  display: inline-block;
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

.actions {
  display: flex;
  justify-content: flex-start;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-ui);
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s var(--ease-out);
}

.btn-action.confirm {
  background: var(--accent);
  color: var(--on-accent);
}

.btn-action.confirm:hover {
  background: var(--accent-strong);
}

.btn-action.chat:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.btn-action.view:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.status-tip {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
