<template>
  <div class="detail-layout" :class="{ 'user-view': isUserView }">
    <!-- 左侧：用户信息和问卷结果（仅专家可见） -->
    <div v-if="!isUserView" class="left-panel">
      <div class="panel-card">
        <h3>
          <AppIcon name="user" :size="16" />
          预约人信息
        </h3>
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
            <AppIcon name="check" :size="14" />
            确认预约
          </button>
          <button
            v-if="appointment.status === 'confirmed'"
            class="btn-complete"
            @click="updateStatus('completed')"
          >
            <AppIcon name="check" :size="14" />
            标记完成
          </button>
        </div>
      </div>

      <div class="panel-card" v-if="testResults.length > 0">
        <h3>
          <AppIcon name="clipboard" :size="16" />
          问卷结果
        </h3>
        <div v-for="result in testResults" :key="result.id" class="result-item">
          <div class="result-header">
            <span class="test-name">{{ result.test_name }}</span>
            <span class="test-score">{{ result.total_score }}分</span>
          </div>
          <div class="result-level">{{ result.result_level }}</div>
          <p class="result-desc">{{ result.result_desc }}</p>
          <button class="btn-view-detail" @click="openDetailModal(result)">
            <AppIcon name="search" :size="14" />
            查看详细答案
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧：聊天（所有角色都可见） -->
    <div class="right-panel" :class="{ 'full-width': isUserView }">
      <div class="chat-header">
        <h3>
          <AppIcon name="chat" :size="16" />
          {{ chatTitle }}
        </h3>
        <div class="chat-header-actions">
          <button
            v-if="!isChatClosed"
            class="report-toggle-btn"
            :class="{ active: reportMode }"
            @click="toggleReportMode"
          >
            <AppIcon name="warning" :size="13" />
            {{ reportMode ? '退出举报' : '举报' }}
          </button>
          <div class="connection-status" :class="{ online: isOtherOnline, closed: isChatClosed }">
            <span v-if="isChatClosed" class="status-dot"></span>
            <span v-else class="status-dot" :class="{ online: isOtherOnline, offline: !isOtherOnline }"></span>
            {{ connectionStatusText }}
          </div>
        </div>
      </div>
      <div class="chat-messages" ref="chatBox">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="[
            'msg',
            msg.sender_id === currentUserId ? 'msg-me' : 'msg-other',
            { 'msg-selectable': reportMode && canReportMsg(msg), 'msg-selected': selectedIds.includes(msg.id) }
          ]"
          @click="reportMode && canReportMsg(msg) && toggleMsgSelect(msg)"
        >
          <img
            v-if="avatarFor(msg.sender_id)"
            class="msg-avatar"
            :src="avatarFor(msg.sender_id)"
            alt=""
          />
          <span v-else class="msg-avatar msg-avatar-fallback">
            {{ (msg.sender_name || '?').slice(0, 1) }}
          </span>
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
      <!-- 举报选择模式：底部操作条 -->
      <div v-if="reportMode" class="report-bar">
        <span class="report-hint">点击对方的消息进行勾选（已选 {{ selectedIds.length }} 条）</span>
        <div class="report-actions">
          <button class="report-cancel" @click="toggleReportMode">取消</button>
          <button class="report-submit" :disabled="selectedIds.length === 0" @click="showReportPanel = true">
            提交举报
          </button>
        </div>
      </div>
      <!-- 举报信息填写面板 -->
      <div v-if="showReportPanel" class="report-panel">
        <div class="report-panel-title">举报对方的消息（{{ selectedIds.length }} 条）</div>
        <div class="report-reasons">
          <label v-for="r in REPORT_REASONS" :key="r" class="report-reason">
            <input type="radio" :value="r" v-model="reportReason" name="report-reason" />
            <span>{{ r }}</span>
          </label>
        </div>
        <textarea
          v-model="reportDetail"
          class="report-detail"
          rows="2"
          maxlength="500"
          placeholder="补充说明（选填，可描述具体情况）"
        ></textarea>
        <div class="report-panel-actions">
          <button class="report-cancel" @click="closeReportPanel">返回</button>
          <button class="report-submit" :disabled="reportSubmitting" @click="submitReport">
            {{ reportSubmitting ? '提交中...' : '确认提交' }}
          </button>
        </div>
      </div>
      <!-- 已完成或已取消：显示禁止输入提示 -->
      <div v-if="isChatClosed" class="chat-closed-tip">
        <AppIcon name="lock" :size="14" />
        <span>本次咨询已结束，无法继续发送消息</span>
      </div>
      <!-- 被禁言：禁止输入提示（管理员处置实时生效） -->
      <div v-else-if="mutedInfo" class="chat-closed-tip muted-tip">
        <AppIcon name="warning" :size="14" />
        <span>{{ mutedInfo }}</span>
      </div>
      <!-- 发送前预检命中提示：仅提示，不阻塞输入，修改后可直接重发 -->
      <div v-if="precheckWarning" class="precheck-warning">
        <AppIcon name="warning" :size="14" />
        <span>{{ precheckWarning }}</span>
      </div>
      <!-- 正常聊天输入（预检命中时输入框保留，便于直接修改重发） -->
      <div v-if="!isChatClosed && !mutedInfo" class="chat-input">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          @input="precheckWarning = ''"
          placeholder="输入消息..."
          :disabled="!isSelfConnected"
        />
        <button @click="sendMessage" :disabled="!isSelfConnected || !newMessage.trim()">
          <AppIcon name="send" :size="14" />
          发送
        </button>
      </div>
    </div>

    <!-- ===== 详细答案弹窗 ===== -->
    <div v-if="showDetailModal" class="modal-overlay" @click="closeDetailModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>
            <AppIcon name="clipboard" :size="16" />
            {{ currentResult?.test_name }} - 详细答案
          </h3>
          <button class="btn-close" @click="closeDetailModal" title="关闭">
            <AppIcon name="close" :size="16" />
          </button>
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

              <div class="options-list" v-if="answer.hasOptions">
                <div
                  v-for="(opt, idx) in answer.options"
                  :key="idx"
                  :class="['option-item', { 'selected': Number(opt.id) === Number(answer.selected) }]"
                >
                  <span class="opt-radio">
                    <span v-if="Number(opt.id) === Number(answer.selected)" class="radio-checked">
                      <AppIcon name="check" :size="10" />
                    </span>
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
import { SOCKET_URL, getAuthToken } from '@/config'
import { getAppointmentDetail, updateAppointmentStatus, getChatMessages } from '@/api/expert'
import { precheckContent } from '@/api/moderation'
import { submitChatReport } from '@/api/user'
import { showToast } from '@/utils/notify'
import { bindChatNotification, notifyIfBackground } from '@/utils/taskbar'
import { handleSessionExpired } from '@/api/request'
import { success, error, alert as dialogAlert } from '@/utils/dialog'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

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
const precheckWarning = ref('')

// ===== 聊天举报：选中对方消息 → 填写理由 → 提交管理员处置 =====
const REPORT_REASONS = ['辱骂攻击', '骚扰', '广告推销', '色情低俗', '其他违规']
const reportMode = ref(false)
const selectedIds = ref<number[]>([])
const showReportPanel = ref(false)
const reportReason = ref(REPORT_REASONS[0])
const reportDetail = ref('')
const reportSubmitting = ref(false)

// 管理员禁言（实时生效）：非空时输入区整体替换为禁言提示
const mutedInfo = ref('')

const canReportMsg = (msg: any) => msg.sender_id !== currentUserId.value
const toggleMsgSelect = (msg: any) => {
  const idx = selectedIds.value.indexOf(msg.id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(msg.id)
}
function toggleReportMode() {
  reportMode.value = !reportMode.value
  selectedIds.value = []
  showReportPanel.value = false
}
function closeReportPanel() {
  showReportPanel.value = false
}
async function submitReport() {
  if (selectedIds.value.length === 0 || reportSubmitting.value) return
  reportSubmitting.value = true
  try {
    await submitChatReport({
      appointment_id: appointmentId,
      message_ids: selectedIds.value,
      reason: reportReason.value,
      detail: reportDetail.value
    })
    success('举报已提交，管理员会尽快核实处理')
    toggleReportMode()
    reportDetail.value = ''
  } catch (e: any) {
    error(e?.message || '举报提交失败，请稍后重试')
  } finally {
    reportSubmitting.value = false
  }
}
const chatBox = ref<HTMLElement | null>(null)
const socket = shallowRef<Socket | null>(null)
const isSelfConnected = ref(false)
const isOtherOnline = ref(false)

// ===== 弹窗相关状态 =====
const showDetailModal = ref(false)
const currentResult = ref<any>(null)
const parsedAnswers = ref<any[]>([])

// 聊天是否已关闭（已完成/已取消/已拒绝均不可再聊天）
const isChatClosed = computed(() => {
  return ['completed', 'cancelled', 'rejected'].includes(appointment.value.status)
})

const connectionStatusText = computed(() => {
  if (isChatClosed.value) return '会话已结束'
  if (!isSelfConnected.value) return '连接中...'
  if (isOtherOnline.value) return '在线'
  return '离线'
})

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
    rejected: '已拒绝'
  }
  return map[status] || status
}

// ===== 聊天头像 =====
// 自己取登录态头像；对方按视角取预约数据里的 user_avatar / doctor_avatar
const selfAvatar = computed(() => userStore.userInfo?.avatar || '')

const otherAvatar = computed(() => {
  const ap = appointment.value
  if (!ap) return ''
  return currentUserId.value === ap.user_id ? (ap.doctor_avatar || '') : (ap.user_avatar || '')
})

const avatarFor = (senderId: number): string => {
  return senderId === currentUserId.value ? selfAvatar.value : otherAvatar.value
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
      const questionOptions: any[] = question?.options || []

      // AI 问卷：作答明细内嵌完整选项（label/text/score），与题库选项统一为 {id,label,text,score}
      const embeddedOptions: any[] = Array.isArray(item.options) && item.options.length
        ? item.options.map((o: any, j: number) => ({
            id: j + 1,
            label: String(o.label || String.fromCharCode(65 + j)),
            text: String(o.text || ''),
            score: Number(o.score) || 0
          }))
        : []
      const options = embeddedOptions.length ? embeddedOptions : questionOptions
      const hasOptions = options.length > 0

      // 选中项：AI 问卷按 selected_label 匹配；普通问卷按 option_id/score
      let selected = Number(item.option_id || item.score)
      if (item.selected_label && embeddedOptions.length) {
        const idx = embeddedOptions.findIndex(o => o.label === item.selected_label)
        if (idx >= 0) selected = idx + 1
      }

      return {
        no: index + 1,
        question: question?.content || item.content || `问题 ${item.question_id}`,
        questionId: item.question_id,
        options: options,
        hasOptions,
        selected,
        selectedText: item.selected_text || '',
        score: Number(item.score)
      }
    })
  } catch (e) {
    console.error('解析答案失败:', e)
    return []
  }
}

// 获取用户选择的文字
const getSelectedText = (answer: any): string => {
  // AI 问卷等无题库选项的场景：直接展示存储的用户所选文字
  if (answer.selectedText) {
    return `${answer.selectedText} (${answer.score}分)`
  }
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

  const newSocket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })

  ;(window as any).__globalSocket__ = newSocket
  socket.value = newSocket

  newSocket.on('connect', () => {
    isSelfConnected.value = true
    newSocket.emit('authenticate', { userId: currentUserId.value, token: getAuthToken() })
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
  // 后台私聊消息提醒（幂等绑定；窗口在前台时由页面内 new-message 处理，不重复打扰）
  bindChatNotification(sock)

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
      // 复用 HTTP 侧的会话过期处理：先清凭据（含加密会话文件）再跳转，
      // 避免脏 token 残留导致登录页会话恢复失败多绕一圈
      handleSessionExpired()
    })
  })

  sock.on('new-message', (msg: any) => {
    messages.value.push(msg)
    scrollToBottom()
    // 对方来信且窗口不在前台时提醒（单入口：系统通知 + 任务栏频闪 + 缩略图卡片；
    // 已在本聊天页，不传 appointmentId 避免回前台重复跳转）
    const senderId = msg.sender_id ?? msg.senderId
    if (senderId !== userStore.userInfo?.id) {
      void notifyIfBackground(String(msg.sender_name || '新消息'), String(msg.content || ''), undefined, msg.sender_avatar)
    }
  })

  // 内容审核：被服务端拦截的消息不入库，恢复输入框内容便于修改后重发
  sock.on('message-blocked', (data: { content?: string; reason?: string }) => {
    showToast('发送被拦截', data?.reason || '消息包含不文明或违规内容，已被拦截', false)
    if (data?.content) {
      newMessage.value = data.content
    }
  })

  // 管理员处置实时生效：禁言期间无法发言；封禁由服务端直接断开连接（走重连/登录拦截）
  sock.on('account-restricted', (data: { type?: string; message?: string }) => {
    if (data?.type === 'muted') {
      mutedInfo.value = data.message || '您的账号已被管理员禁言，期间无法发送消息'
    }
    showToast('账号受限', data?.message || '您的账号已被管理员限制', false)
  })
  sock.on('restriction-lifted', (data: { message?: string }) => {
    mutedInfo.value = ''
    showToast('限制解除', data?.message || '您的账号限制已解除', true)
  })

  sock.on('error', (err: any) => {
    console.error('Socket 错误:', err)
  })
}

const sendMessage = async () => {
  if (isChatClosed.value) return
  if (mutedInfo.value) return // 禁言期间拦截（输入区已隐藏，此处兜底回车发送）

  const content = newMessage.value.trim()
  if (!content) return

  // 连接断开时明确提示，避免消息静默滞留输入框让用户误以为已发出
  if (!socket.value || !isSelfConnected.value) {
    showToast('发送失败', '网络连接已断开，请稍后重试', false)
    return
  }

  // 发送前预检：词库命中即时标红提示，不发出（完整审核仍在服务端强制执行）
  precheckWarning.value = ''
  try {
    const res = await precheckContent(content) as any
    if (res?.data && res.data.ok === false) {
      precheckWarning.value = `消息包含违禁内容（${res.data.hit || '敏感词'}），请修改后重新发送`
      return
    }
  } catch {
    // 预检接口异常不阻塞发送，服务端审核兜底
  }

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
  height: calc(100vh - var(--titlebar-h) - 48px);
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
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-view .right-panel {
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: transparent;
}

.right-panel.full-width {
  width: 100%;
}

.panel-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 20px 22px;
}

.panel-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 7px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 14px;
  color: var(--text-primary);
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  color: var(--text-secondary);
}

.status-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
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

.action-btns {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn-confirm, .btn-complete {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px;
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  font-family: var(--font-ui);
  transition: background 0.2s var(--ease-out);
}

.btn-confirm {
  background: var(--accent);
  color: var(--on-accent);
}

.btn-confirm:hover {
  background: var(--accent-strong);
}

.btn-complete {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
}

.btn-complete:hover {
  background: color-mix(in srgb, var(--success) 24%, transparent);
}

.result-item {
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  margin-bottom: 12px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.test-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13.5px;
}

.test-score {
  font-size: 19px;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.result-level {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.result-desc {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0 0 12px;
}

.btn-view-detail {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 9px;
  background: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-ui);
  justify-content: center;
  transition: all 0.2s var(--ease-out);
}

.btn-view-detail:hover {
  background: var(--accent-soft);
}

/* ===== 弹窗样式 ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 21, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  width: 100%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: modalIn 0.25s var(--ease-out);
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
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
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.btn-close {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s var(--ease-out);
}

.btn-close:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
}

.result-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.score-badge {
  padding: 5px 12px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.level-badge {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 500;
}

.level-high {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.level-medium {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}

.level-low {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.level-normal {
  background: color-mix(in srgb, var(--info) 12%, transparent);
  color: var(--info);
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.question-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  padding: 14px 16px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.q-num {
  font-size: 12.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.q-score {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--success);
}

.q-score.high-score {
  color: var(--danger);
}

.question-content {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
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
  padding: 7px 11px;
  border-radius: var(--radius-ctl);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-secondary);
}

.option-item.selected {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--text-primary);
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
  width: 18px;
  height: 18px;
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-empty {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--border-strong);
  border-radius: 50%;
  box-sizing: border-box;
}

.opt-label {
  width: 22px;
  font-weight: 500;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.opt-text {
  flex: 1;
  color: var(--text-primary);
}

.opt-score {
  color: var(--text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.user-answer {
  padding: 7px 11px;
  background: var(--card-bg);
  border-radius: var(--radius-ctl);
  border: 1px dashed color-mix(in srgb, var(--accent) 40%, transparent);
  font-size: 13px;
}

.ua-label {
  font-size: 12px;
  color: var(--text-muted);
}

.ua-value {
  font-size: 13.5px;
  color: var(--accent);
  font-weight: 500;
}

.modal-footer {
  padding: 14px 22px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.btn-close-modal {
  padding: 9px 22px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.btn-close-modal:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

/* 聊天样式 */
.chat-header {
  padding: 16px 22px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.connection-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  transition: color 0.3s;
}

.connection-status.online {
  color: var(--success);
}

.connection-status.closed {
  color: var(--text-muted);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--success);
}

.status-dot.offline {
  background: var(--text-muted);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-messages::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

.msg {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.msg-me {
  /* 反转排列：头像在气泡右侧（行方向反转后 flex-start 对齐右缘），与对方消息左右分明 */
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.msg-other {
  justify-content: flex-start;
}

.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.msg-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--on-accent);
  background: var(--accent);
  border: none;
}

.msg-bubble {
  max-width: 68%;
  padding: 11px 15px;
  border-radius: 14px;
  font-size: 14px;
}

.msg-me .msg-bubble {
  background: var(--msg-user-bg);
  color: var(--text-primary);
  border-bottom-right-radius: 4px;
}

.msg-other .msg-bubble {
  background: var(--msg-ai-bg);
  color: var(--text-primary);
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
  font-variant-numeric: tabular-nums;
}

.empty-chat {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
  font-size: 13.5px;
}

.chat-closed-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 22px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 13px;
  gap: 8px;
}

.chat-input {
  display: flex;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--border-color);
}

.precheck-warning {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 22px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  border-radius: var(--radius-ctl);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--danger);
  font-size: 12.5px;
}

/* ===== 聊天举报 ===== */
.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.report-toggle-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s;
}

.report-toggle-btn:hover,
.report-toggle-btn.active {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}

.msg.msg-selectable {
  cursor: pointer;
}

.msg.msg-selectable .msg-bubble {
  transition: box-shadow 0.15s, outline-color 0.15s;
  outline: 2px solid transparent;
  outline-offset: 1px;
}

.msg.msg-selectable:hover .msg-bubble {
  outline-color: color-mix(in srgb, var(--danger) 35%, transparent);
}

.msg.msg-selected .msg-bubble {
  outline: 2px solid var(--danger);
}

.msg.msg-selected::after {
  content: '已选';
  font-size: 11px;
  color: #fff;
  background: var(--danger);
  border-radius: 4px;
  padding: 1px 6px;
  align-self: center;
  margin: 0 4px;
}

.report-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 22px 10px;
  padding: 9px 14px;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  border-radius: var(--radius-ctl);
  background: color-mix(in srgb, var(--danger) 6%, transparent);
}

.report-hint {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.report-actions,
.report-panel-actions {
  display: flex;
  gap: 8px;
}

.report-cancel,
.report-submit {
  padding: 6px 16px;
  border-radius: var(--radius-ctl);
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
}

.report-submit {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}

.report-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.report-panel {
  margin: 0 22px 10px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.report-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.report-reason {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
}

.report-detail {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: inherit;
  resize: none;
}

.muted-tip {
  border-color: color-mix(in srgb, var(--warning, #e6a23c) 45%, transparent);
  background: color-mix(in srgb, var(--warning, #e6a23c) 10%, transparent);
  color: var(--warning, #e6a23c);
}

.chat-input input {
  flex: 1;
  padding: 11px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: var(--font-ui);
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.chat-input input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.chat-input input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-input input::placeholder {
  color: var(--text-muted);
}

.chat-input button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 11px 20px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  font-family: var(--font-ui);
  transition: background 0.2s var(--ease-out);
}

.chat-input button:hover:not(:disabled) {
  background: var(--accent-strong);
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
