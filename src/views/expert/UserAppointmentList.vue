<template>
  <div class="user-appointment-list">
    <div class="list-header">
      <h3>📅 我的预约</h3>
      <div class="header-actions">
        <span class="online-indicator" :class="{ online: isSocketConnected }">
          {{ isSocketConnected ? '🟢 实时连接' : '🔴 离线' }}
        </span>
        <button class="btn-refresh" @click="loadAppointments" :disabled="loading">
          {{ loading ? '刷新中...' : '🔄 刷新' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="appointments.length === 0" class="empty-state">
      暂无预约记录，快去预约专家吧～
    </div>

    <div v-else class="appointment-cards">
      <div 
        v-for="item in appointments" 
        :key="item.id"
        class="appointment-card"
        :class="{ 'status-changed': recentlyUpdated.has(item.id) }"
        @click="handleViewDetail(item.id)"
      >
        <div class="card-header">
          <div class="expert-info">
            <span class="expert-name">{{ item.expert_name || '专家' }}</span>
            <span class="expert-title">{{ item.expert_title || '心理咨询师' }}</span>
          </div>
          <span :class="['status-badge', `status-${item.status}`]">
            {{ statusText(item.status) }}
          </span>
        </div>
        
        <div class="card-body">
          <div class="info-row">
            <span class="label">预约时间：</span>
            <span>{{ formatDate(item.created_at) }}</span>
          </div>
          <div class="info-row">
            <span class="label">当前状态：</span>
            <span class="status-desc">{{ statusDesc(item.status) }}</span>
          </div>
        </div>
        
        <div class="card-footer">
          <button 
            v-if="item.status === 'confirmed'"
            class="btn-chat"
          >
            💬 进入聊天
          </button>
          <span v-else class="status-tip">
            {{ statusTip(item.status) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { getUserAppointments } from '@/api/user'
import { useUserStore } from '@/stores/user'

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

const statusDesc = (status: string) => {
  const map: Record<string, string> = {
    pending: '专家正在处理您的预约',
    confirmed: '专家已确认，可以开始聊天',
    completed: '本次咨询已完成',
    cancelled: '预约已取消'
  }
  return map[status] || ''
}

const statusTip = (status: string) => {
  const map: Record<string, string> = {
    pending: '请耐心等待专家确认...',
    completed: '咨询已完成，感谢使用',
    cancelled: '如有需要请重新预约'
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

  const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })
  
  ;(window as any).__globalSocket__ = newSocket
  socket.value = newSocket

  newSocket.on('connect', () => {
    isSocketConnected.value = true
    newSocket.emit('authenticate', userStore.userInfo!.id)
  })

  newSocket.on('disconnect', () => {
    isSocketConnected.value = false
  })

  setupListeners(newSocket)
}

const setupListeners = (sock: Socket) => {
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
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.list-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.online-indicator {
  font-size: 12px;
  color: #ef4444;
  padding: 4px 10px;
  background: #fef2f2;
  border-radius: 20px;
  transition: all 0.3s;
}

.online-indicator.online {
  color: #10b981;
  background: #ecfdf5;
}

.btn-refresh {
  padding: 6px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover {
  background: #f9fafb;
  border-color: #73a9d8;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: #6b7280;
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #73a9d8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #9ca3af;
  font-size: 14px;
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
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f3f4f6;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.appointment-card:hover {
  border-color: #e3f0fc;
  box-shadow: 0 2px 12px rgba(115, 169, 216, 0.1);
}

.appointment-card.status-changed {
  animation: highlight 3s ease-out;
}

@keyframes highlight {
  0% { background: #ecfdf5; border-color: #10b981; }
  100% { background: #fff; border-color: #f3f4f6; }
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
  color: #1f2937;
}

.expert-title {
  font-size: 12px;
  color: #9ca3af;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending { background: #fef3c7; color: #92400e; }
.status-confirmed { background: #d1fae5; color: #065f46; }
.status-completed { background: #e0f2fe; color: #0369a1; }
.status-cancelled { background: #fee2e2; color: #991b1b; }

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.info-row {
  display: flex;
  font-size: 13px;
  color: #6b7280;
}

.info-row .label {
  color: #9ca3af;
  margin-right: 4px;
}

.status-desc {
  color: #73a9d8;
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.btn-chat {
  padding: 8px 20px;
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-chat:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.status-tip {
  font-size: 12px;
  color: #9ca3af;
}
</style>
