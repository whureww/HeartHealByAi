<template>
  <div class="appointment-list">
    <div class="list-header">
      <h3>📋 预约管理</h3>
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
      暂无预约记录
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
            💬 进入聊天
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

.appointment-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
  gap: 12px;
  padding: 10px 16px;
  background: #f9fafb;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #f3f4f6;
  align-items: center;
  transition: all 0.3s;
}

.table-row:hover {
  border-color: #e3f0fc;
  box-shadow: 0 2px 8px rgba(115, 169, 216, 0.08);
}

.table-row.status-changed {
  animation: highlight 3s ease-out;
}

@keyframes highlight {
  0% { background: #ecfdf5; border-color: #10b981; }
  100% { background: #fff; border-color: #f3f4f6; }
}

.cell {
  font-size: 13px;
  color: #374151;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 500;
  color: #1f2937;
}

.user-email {
  font-size: 11px;
  color: #9ca3af;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending { background: #fef3c7; color: #92400e; }
.status-confirmed { background: #d1fae5; color: #065f46; }
.status-completed { background: #e0f2fe; color: #0369a1; }
.status-cancelled { background: #fee2e2; color: #991b1b; }

.btn-action {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action.confirm {
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
}

.btn-action.chat {
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
}

.btn-action.view {
  background: #f3f4f6;
  color: #6b7280;
}

.btn-action:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.status-tip {
  font-size: 12px;
  color: #9ca3af;
}
</style>
