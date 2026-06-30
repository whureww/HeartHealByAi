<template>
  <div class="detail-layout" :class="{ 'user-view': isUserView }">
    <!-- 左侧：用户信息和问卷结果（仅专家可见） -->
    <div v-if="!isUserView" class="left-panel">
      <div class="panel-card">
        <h3>👤 预约人信息</h3>
        <div class="info-item">
          <span class="label">姓名：</span>
          <span>{{ appointment.user_name }}</span>
        </div>
        <div class="info-item">
          <span class="label">邮箱：</span>
          <span>{{ appointment.user_email }}</span>
        </div>
        <div class="info-item">
          <span class="label">手机：</span>
          <span>{{ appointment.user_phone || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">状态：</span>
          <span :class="['status-tag', `status-${appointment.status}`]">
            {{ statusText(appointment.status) }}
          </span>
        </div>
        <div class="action-btns">
          <button 
            v-if="appointment.status === 'pending'"
            class="btn-confirm"
            @click="updateStatus('confirmed')"
          >
            ✓ 确认预约
          </button>
          <button 
            v-if="appointment.status === 'confirmed'"
            class="btn-complete"
            @click="updateStatus('completed')"
          >
            ✓ 标记完成
          </button>
        </div>
      </div>

      <div class="panel-card" v-if="testResults.length > 0">
        <h3>📋 问卷结果</h3>
        <div v-for="result in testResults" :key="result.id" class="result-item">
          <div class="result-header">
            <span class="test-name">{{ result.test_name }}</span>
            <span class="test-score">{{ result.total_score }}分</span>
          </div>
          <div class="result-level">{{ result.result_level }}</div>
          <p class="result-desc">{{ result.result_desc }}</p>
          <button class="btn-view-detail" @click="openDetailModal(result)">
            🔍 查看详细答案
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧：聊天（所有角色都可见） -->
    <div class="right-panel" :class="{ 'full-width': isUserView }">
      <div class="chat-header">
        <h3>💬 {{ chatTitle }}</h3>
        <div class="connection-status" :class="{ online: isOtherOnline }">
          {{ connectionStatusText }}
        </div>
      </div>
      <div class="chat-messages" ref="chatBox">
        <div 
          v-for="msg in messages" 
          :key="msg.id" 
          :class="['msg', msg.sender_id === currentUserId ? 'msg-me' : 'msg-other']"
        >
          <div class="msg-bubble">
            <div class="msg-sender">{{ msg.sender_name }}</div>
            <div class="msg-content">{{ msg.content }}</div>
            <div class="msg-time">{{ formatTime(msg.created_at) }}</div>
          </div>
        </div>
        <div v-if="messages.length === 0" class="empty-chat">
          暂无消息，开始聊天吧
        </div>
      </div>
      <!-- 已完成或已取消：显示禁止输入提示 -->
      <div v-if="isChatClosed" class="chat-closed-tip">
        <span>🔒 本次咨询已结束，无法继续发送消息</span>
      </div>
      <!-- 正常聊天输入 -->
      <div v-else class="chat-input">
        <input 
          v-model="newMessage" 
          @keyup.enter="sendMessage"
          placeholder="输入消息..." 
          :disabled="!isSelfConnected"
        />
        <button @click="sendMessage" :disabled="!isSelfConnected || !newMessage.trim()">发送</button>
      </div>
    </div>

    <!-- ===== 详细答案弹窗 ===== -->
    <div v-if="showDetailModal" class="modal-overlay" @click="closeDetailModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📋 {{ currentResult?.test_name }} - 详细答案</h3>
          <button class="btn-close" @click="closeDetailModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="result-summary">
            <span class="score-badge">总分：{{ currentResult?.total_score }}分</span>
            <span class="level-badge" :class="`level-${getLevelType(currentResult?.result_level)}`">
              {{ currentResult?.result_level }}
            </span>
          </div>
          
          <div class="questions-list">
            <div 
              v-for="(answer, index) in parsedAnswers" 
              :key="index"
              class="question-card"
            >
              <div class="question-header">
                <span class="q-num">第 {{ answer.no }} 题</span>
                <span class="q-score" :class="{ 'high-score': answer.score >= 3 }">
                  得分：{{ answer.score }}
                </span>
              </div>
              
              <div class="question-content">{{ answer.question }}</div>
              
              <div class="options-list">
                <div 
                  v-for="(opt, idx) in answer.options" 
                  :key="idx"
                  :class="['option-item', { 'selected': Number(opt.id) === Number(answer.selected) }]"
                >
                  <span class="opt-radio">
                    <span v-if="Number(opt.id) === Number(answer.selected)" class="radio-checked">✓</span>
                    <span v-else class="radio-empty"></span>
                  </span>
                  <span class="opt-label">{{ opt.label }}</span>
                  <span class="opt-text">{{ opt.text }}</span>
                  <span class="opt-score">{{ opt.score }}分</span>
                </div>
              </div>
              
              <div class="user-answer">
                <span class="ua-label">用户选择：</span>
                <span class="ua-value">{{ getSelectedText(answer) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-close-modal" @click="closeDetailModal">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch, shallowRef } from 'vue'
import { io, Socket } from 'socket.io-client'
import { getAppointmentDetail, updateAppointmentStatus, getChatMessages } from '@/api/expert'
import { success, error, alert as dialogAlert } from '@/utils/dialog'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  id: number
}>()

// ===== 修改：新增 status-updated 事件 =====
const emit = defineEmits<{
  (e: 'go-back'): void
  (e: 'status-updated'): void  // 新增：状态更新后通知父组件
}>()

const userStore = useUserStore()
const appointmentId = props.id
const currentUserId = computed(() => userStore.userInfo?.id || 0)

// ===== 判断当前视角：用户还是专家 =====
const isUserView = computed(() => {
  return userStore.userInfo?.role === 1
})

// 聊天标题
const chatTitle = computed(() => {
  if (isUserView.value) {
    return `与 ${appointment.value.doctor_name || '专家'} 的会话`
  }
  return `与 ${appointment.value.user_name || '用户'} 的会话`
})

const otherUserId = ref<number>(0)

const appointment = ref<any>({})
const testResults = ref<any[]>([])
const messages = ref<any[]>([])
const newMessage = ref('')
const chatBox = ref<HTMLElement | null>(null)
const socket = shallowRef<Socket | null>(null)
const isSelfConnected = ref(false)
const isOtherOnline = ref(false)

// ===== 弹窗相关状态 =====
const showDetailModal = ref(false)
const currentResult = ref<any>(null)
const parsedAnswers = ref<any[]>([])

// 聊天是否已关闭
const isChatClosed = computed(() => {
  return appointment.value.status === 'completed' || appointment.value.status === 'cancelled'
})

const connectionStatusText = computed(() => {
  if (isChatClosed.value) return '🔒 会话已结束'
  if (!isSelfConnected.value) return '🔴 连接中...'
  if (isOtherOnline.value) return '🟢 在线'
  return '⚪ 离线'
})

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// ===== 打开弹窗 =====
const openDetailModal = (result: any) => {
  currentResult.value = result
  parsedAnswers.value = parseAnswers(result)
  showDetailModal.value = true
}

// ===== 关闭弹窗 =====
const closeDetailModal = () => {
  showDetailModal.value = false
  currentResult.value = null
  parsedAnswers.value = []
}

// ===== 解析答案 =====
const parseAnswers = (result: any) => {
  if (!result?.answers) return []
  
  try {
    const parsed = JSON.parse(result.answers)
    if (!Array.isArray(parsed)) return []
    
    // 解析 questions
    let questions: any[] = []
    if (result.test_questions) {
      try {
        questions = typeof result.test_questions === 'string' 
          ? JSON.parse(result.test_questions) 
          : result.test_questions
      } catch (e) {
        console.error('解析 questions 失败:', e)
      }
    }
    
    return parsed.map((item: any, index: number) => {
      const question = questions.find((q: any) => q.id === item.question_id)
      const options: any[] = question?.options || []
      
      // 如果没有选项，生成默认选项
      if (options.length === 0) {
        for (let i = 1; i <= 4; i++) {
          options.push({
            id: i,
            label: String.fromCharCode(64 + i),
            text: getDefaultOptionText(i),
            score: i
          })
        }
      }
      
      return {
        no: index + 1,
        question: question?.content || `问题 ${item.question_id}`,
        questionId: item.question_id,
        options: options,
        selected: Number(item.option_id || item.score),
        score: Number(item.score)
      }
    })
  } catch (e) {
    console.error('解析答案失败:', e)
    return []
  }
}

// 默认选项文字
const getDefaultOptionText = (index: number): string => {
  const texts: string[] = ['从不', '偶尔', '有时', '经常', '总是']
  return texts[index - 1] || `选项${index}`
}

// 获取用户选择的文字
const getSelectedText = (answer: any): string => {
  const opt = answer.options.find((o: any) => Number(o.id) === Number(answer.selected))
  if (opt) {
    return `${opt.label}. ${opt.text} (${opt.score}分)`
  }
  return `选项${answer.selected} (${answer.score}分)`
}

// 获取等级类型
const getLevelType = (level: string | undefined): string => {
  if (!level) return 'normal'
  if (level.includes('重') || level.includes('高')) return 'high'
  if (level.includes('中')) return 'medium'
  if (level.includes('轻') || level.includes('低')) return 'low'
  return 'normal'
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) {
      chatBox.value.scrollTop = chatBox.value.scrollHeight
    }
  })
}

const loadDetail = async () => {
  try {
    const res = await getAppointmentDetail(appointmentId) as any
    appointment.value = res.data.appointment
    testResults.value = res.data.testResults || []
    
    if (appointment.value.user_id === currentUserId.value) {
      otherUserId.value = appointment.value.doctor_user_id || appointment.value.doctor_id
    } else {
      otherUserId.value = appointment.value.user_id
    }
  } catch (e: any) {
    await error(e.message || '加载详情失败')
  }
}

const loadMessages = async () => {
  try {
    const res = await getChatMessages(appointmentId) as any
    messages.value = res.data
    scrollToBottom()
  } catch (e) {
    console.error('加载消息失败:', e)
  }
}

// ===== 修改：状态更新后 emit 事件 =====
const updateStatus = async (status: string) => {
  try {
    await updateAppointmentStatus(appointmentId, status)
    await success('状态更新成功')
    appointment.value.status = status
    loadDetail()
    
    // ===== 新增：通知父组件状态已更新，刷新统计 =====
    emit('status-updated')
    console.log('【AppointmentDetail】状态更新已通知父组件')
  } catch (e: any) {
    await error(e.message || '更新失败')
  }
}

const initSocket = () => {
  const globalSocket = (window as any).__globalSocket__ as Socket | undefined
  
  if (globalSocket && globalSocket.connected) {
    socket.value = globalSocket
    isSelfConnected.value = true
    setupSocketListeners(globalSocket)
    globalSocket.emit('join-room', appointmentId)
    
    if (otherUserId.value) {
      setTimeout(() => {
        globalSocket.emit('query-user-status', otherUserId.value)
      }, 500)
    }
    return
  }

  if (socket.value) {
    socket.value.disconnect()
  }

  const newSocket = io('http://162.211.183.129:3001', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })

  ;(window as any).__globalSocket__ = newSocket
  socket.value = newSocket

  newSocket.on('connect', () => {
    isSelfConnected.value = true
    newSocket.emit('authenticate', currentUserId.value)
    newSocket.emit('join-room', appointmentId)
    
    if (otherUserId.value) {
      setTimeout(() => {
        newSocket.emit('query-user-status', otherUserId.value)
      }, 500)
    }
  })

  setupSocketListeners(newSocket)
}

const setupSocketListeners = (sock: Socket) => {
  sock.on('disconnect', () => {
    isSelfConnected.value = false
    isOtherOnline.value = false
  })

  sock.on('user-status-change', (data: { userId: number, isOnline: boolean }) => {
    if (data.userId === otherUserId.value) {
      isOtherOnline.value = data.isOnline
    }
  })

  sock.on('user-joined-room', (data: { appointmentId: number, userId: number }) => {
    if (data.appointmentId === appointmentId && data.userId === otherUserId.value) {
      isOtherOnline.value = true
    }
  })

  sock.on('force-logout', (data: { message: string }) => {
    dialogAlert(data.message || '您的账号已登出', '提示').then(() => {
      userStore.logout()
      window.location.href = '/login'
    })
  })

  sock.on('new-message', (msg: any) => {
    messages.value.push(msg)
    scrollToBottom()
  })

  sock.on('error', (err: any) => {
    console.error('Socket 错误:', err)
  })
}

const sendMessage = async () => {
  if (isChatClosed.value) return
  
  const content = newMessage.value.trim()
  if (!content || !socket.value || !isSelfConnected.value) return

  socket.value.emit('send-message', {
    appointmentId,
    senderId: currentUserId.value,
    receiverId: otherUserId.value,
    content
  })

  newMessage.value = ''
}

onMounted(() => {
  loadDetail().then(() => {
    loadMessages()
    initSocket()
  })
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.emit('leave-room', appointmentId)
  }
})

watch(() => appointment.value, (newVal) => {
  if (newVal && newVal.user_id) {
    if (newVal.user_id === currentUserId.value) {
      otherUserId.value = newVal.doctor_user_id || newVal.doctor_id
    } else {
      otherUserId.value = newVal.user_id
    }
  }
})


</script>

<style scoped>
.detail-layout {
  display: flex;
  gap: 24px;
  height: calc(100vh - 84px);
}

.detail-layout.user-view {
  gap: 0;
}

.left-panel {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.left-panel::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

.user-view .left-panel {
  display: none;
}

.right-panel {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.user-view .right-panel {
  border-radius: 0;
  box-shadow: none;
}

.right-panel.full-width {
  width: 100%;
}

.panel-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.panel-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  color: #6b7280;
}

.status-tag {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending { background: #fef3c7; color: #92400e; }
.status-confirmed { background: #d1fae5; color: #065f46; }
.status-completed { background: #e0f2fe; color: #0369a1; }

.action-btns {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn-confirm, .btn-complete {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-confirm {
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
}

.btn-complete {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
}

.result-item {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  margin-bottom: 12px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.test-name {
  font-weight: 600;
  color: #374151;
}

.test-score {
  font-size: 20px;
  font-weight: 700;
  color: #73a9d8;
}

.result-level {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.result-desc {
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.5;
  margin-bottom: 12px;
}

.btn-view-detail {
  width: 100%;
  padding: 10px;
  background: #e3f0fc;
  color: #73a9d8;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-view-detail:hover {
  background: #73a9d8;
  color: #fff;
}

/* ===== 弹窗样式 ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f3f4f6;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #e5e7eb;
  color: #374151;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.result-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.score-badge {
  padding: 6px 14px;
  background: #e3f0fc;
  color: #73a9d8;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.level-badge {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.level-high {
  background: #fee2e2;
  color: #991b1b;
}

.level-medium {
  background: #fef3c7;
  color: #92400e;
}

.level-low {
  background: #d1fae5;
  color: #065f46;
}

.level-normal {
  background: #e0f2fe;
  color: #0369a1;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #f3f4f6;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.q-num {
  font-size: 13px;
  color: #9ca3af;
  font-weight: 500;
}

.q-score {
  font-size: 14px;
  font-weight: 600;
  color: #10b981;
}

.q-score.high-score {
  color: #ef4444;
}

.question-content {
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.6;
  margin-bottom: 12px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  font-size: 13px;
}

.option-item.selected {
  background: #e3f0fc;
  border-color: #73a9d8;
}

.opt-radio {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.radio-checked {
  width: 20px;
  height: 20px;
  background: #73a9d8;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.radio-empty {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 50%;
}

.opt-label {
  width: 24px;
  font-weight: 500;
  color: #6b7280;
  flex-shrink: 0;
}

.opt-text {
  flex: 1;
  color: #4b5563;
}

.opt-score {
  color: #9ca3af;
  font-size: 12px;
  flex-shrink: 0;
}

.user-answer {
  padding: 8px 12px;
  background: #fff;
  border-radius: 8px;
  border: 1px dashed #73a9d8;
}

.ua-label {
  font-size: 12px;
  color: #9ca3af;
}

.ua-value {
  font-size: 14px;
  color: #73a9d8;
  font-weight: 500;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: flex-end;
}

.btn-close-modal {
  padding: 10px 24px;
  background: #f3f4f6;
  color: #4b5563;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-close-modal:hover {
  background: #e5e7eb;
}

/* 聊天样式 */
.chat-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.connection-status {
  font-size: 12px;
  color: #9ca3af;
  transition: color 0.3s;
}

.connection-status.online {
  color: #10b981;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-messages::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

.msg {
  display: flex;
}

.msg-me {
  justify-content: flex-end;
}

.msg-other {
  justify-content: flex-start;
}

.msg-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
}

.msg-me .msg-bubble {
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.msg-other .msg-bubble {
  background: #f3f4f6;
  color: #374151;
  border-bottom-left-radius: 4px;
}

.msg-sender {
  font-size: 12px;
  margin-bottom: 4px;
  opacity: 0.7;
}

.msg-content {
  line-height: 1.5;
}

.msg-time {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.6;
}

.empty-chat {
  text-align: center;
  color: #9ca3af;
  padding: 40px;
}

.chat-closed-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 13px;
  gap: 8px;
}

.chat-input {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
}

.chat-input input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  outline: none;
}

.chat-input input:focus {
  border-color: #73a9d8;
}

.chat-input input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.chat-input button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
