<template>
  <div class="app-wrap">
    <!-- 左侧导航栏 -->
    <div class="left-sidebar">
      <div class="logo-box">
        <div class="logo-avatar"></div>
        <h2>心愈 AI心理系统</h2>
        <p>私密倾诉 · 测评 · 专家问诊</p>
      </div>
      <div class="menu-list">
        <button 
          v-for="item in menuItems" 
          :key="item.id"
          :class="{ active: currentPage === item.id }"
          @click="switchPage(item.id)">
          {{ item.icon }} {{ item.name }}
        </button>
      </div>
    </div>

    <!-- 中间主内容区 -->
    <div class="main-content">
      <!-- 空白提示 -->
      <div v-if="!currentPage" class="empty-tip">
        请点击左侧功能菜单开始使用
      </div>

      <!-- 1. AI倾诉页面 -->
      <div v-if="currentPage === 'chat'" class="page show">
        <div class="card chat-card">
          <h3>一对一 AI 私密心理倾诉</h3>
          <div class="chat-box" ref="chatBox">
            <div class="msg-item">
              <div class="msg-ai selectable-text">你好！我是你的专属心理陪伴助手"心愈"，你所有的情绪、压力、困惑都可以安心告诉我，我会耐心倾听并给予疏导。💙</div>
            </div>
            <div v-for="(msg, index) in chatMessages" :key="index" class="msg-item">
              <div :class="[msg.type === 'user' ? 'msg-user' : 'msg-ai', 'selectable-text']">{{ msg.content }}</div>
            </div>
            <!-- 流式输出中的 AI 消息 -->
            <div v-if="streamingContent" class="msg-item">
              <div class="msg-ai selectable-text streaming">{{ streamingContent }}<span class="cursor">|</span></div>
            </div>
          </div>
          <div class="input-row">
            <input 
              v-model="chatInput" 
              type="text" 
              placeholder="输入你的心情与困惑..."
              @keyup.enter="sendChat"
              :disabled="aiLoading">
            <button @click="sendChat" :disabled="aiLoading || !chatInput.trim()">
              {{ aiLoading ? '思考中...' : '发送' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 2. 心理测评页面 -->
      <div v-if="currentPage === 'test'" class="page show">
        <TestList 
          v-if="userStore.currentTestView === 'list'" 
          @view-history="userStore.switchTestView('history')"
          @start-test="onStartTest"
        />
        <TestHistory 
          v-else-if="userStore.currentTestView === 'history'" 
          @go-back="userStore.resetTestView()"
          @view-detail="onViewDetail"
        />
        <TestResultDetail
          v-else-if="userStore.currentTestView === 'detail' && userStore.currentResultId !== null"
          :result-id="userStore.currentResultId"
          @go-back="userStore.switchTestView('history')"
        />
      </div>

      <!-- 3. 专家问诊页面 -->
      <div v-if="currentPage === 'doctor'" class="page show">
        <div class="card">
          <h3>在线心理专家问诊预约</h3>
          <div v-if="loading.doctors" class="loading-text">加载中...</div>
          <div class="scroll-content">
            <div class="doc-list">
              <div v-for="doc in userStore.doctors" :key="doc.id" class="doc-card">
                <div class="doc-header">
                  <h4>{{ doc.name }}｜{{ doc.title }}</h4>
                  <span class="online-badge" :class="{ online: isUserOnline(doc.user_id) }">
                    {{ isUserOnline(doc.user_id) ? '🟢 在线' : '⚪ 离线' }}
                  </span>
                </div>
                <p>{{ doc.specialty }}</p>
                <button @click="bookDoctor(doc)">立即预约问诊</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 周期AI分析报告 -->
      <div v-if="currentPage === 'analysis'" class="page show">
        <div class="card">
          <h3>阶段性心理数据 AI 系统性分析</h3>
          <p class="sub-title">
            系统将汇总【选定时间段内所有AI对话记录 + 所有心理测评数据】，由 AI 生成完整心理状态分析报告
          </p>
          <div class="time-select">
            <input type="date" v-model="startDate">
            <span>至</span>
            <input type="date" v-model="endDate">
            <button @click="createReport" :disabled="reportLoading">
              {{ reportLoading ? 'AI 分析中...' : 'AI 生成综合分析报告' }}
            </button>
          </div>
          <div class="scroll-content">
            <div v-if="reportLoading" class="loading-text">
              🤖 AI 正在分析您的心理数据，请稍候...
            </div>
            <div v-else class="report-result selectable-text" style="white-space: pre-wrap;">{{ reportContent }}</div>
          </div>
          <!-- 导出报告按钮 -->
          <div v-if="reportContent && reportContent !== '报告内容将在此处展示...' && !reportLoading" class="report-actions">
            <button class="btn-export" @click="exportReport">📋 复制报告内容</button>
            <button class="btn-export" @click="downloadReport">💾 导出为 HTML</button>
          </div>
        </div>
      </div>

      <!-- 5. 个人中心页面 -->
      <div v-if="currentPage === 'user'" class="page show">
        <div class="card user-card">
          <!-- 用户信息头部 - 可点击编辑 -->
          <div class="user-info-top" @click="showEditProfile">
            <div class="user-avatar">
              <img 
                v-if="userStore.userInfo?.avatar" 
                :src="userStore.userInfo.avatar" 
                class="avatar-img"
                alt="头像"
              />
              <div v-else class="avatar-placeholder">
                {{ userStore.userInfo?.username?.[0]?.toUpperCase() || '?' }}
              </div>
            </div>
            <div class="user-base-info">
              <h4>{{ userStore.userInfo?.username || '心理用户' }}</h4>
              <p>{{ userRoleText }}</p>
            </div>
            <span class="edit-icon">✏️</span>
          </div>


          <!-- 普通用户统计 -->
          <template v-if="userStore.userInfo?.role === 1">
            <h3>我的数据统计</h3>
            <div v-if="loading.stats" class="loading-text">加载中...</div>
            <div v-else class="user-data-list">
              <div class="data-item">
                <div class="num">{{ userChatCount }}</div>
                <div class="text">累计倾诉次数</div>
              </div>
              <div class="data-item">
                <div class="num">{{ userStore.stats?.testCount || 0 }}</div>
                <div class="text">完成心理测评</div>
              </div>
              <div class="data-item">
                <div class="num">{{ userStore.stats?.doctorCount || 0 }}</div>
                <div class="text">专家问诊次数</div>
              </div>
              <div class="data-item">
                <div class="num">{{ userStore.stats?.reportCount || 0 }}</div>
                <div class="text">生成分析报告</div>
              </div>
            </div>
          </template>

          <!-- 专家统计 -->
          <template v-if="userStore.userInfo?.role === 2">
            <h3>专家工作台统计</h3>
            <div v-if="loading.stats" class="loading-text">加载中...</div>
            <div v-else class="user-data-list expert-stats">
              <div class="data-item">
                <div class="num">{{ expertStats.pendingCount }}</div>
                <div class="text">待处理预约</div>
              </div>
              <div class="data-item">
                <div class="num">{{ expertStats.completedCount }}</div>
                <div class="text">完成咨询次数</div>
              </div>
              <div class="data-item">
                <div class="num">{{ expertStats.unfinishedCount }}</div>
                <div class="text">未完成咨询</div>
              </div>
              <div class="data-item">
                <div class="num">{{ expertStats.totalPatients }}</div>
                <div class="text">累计服务用户</div>
              </div>
            </div>
          </template>

          <!-- 管理员统计 -->
          <template v-if="userStore.userInfo?.role === 3">
            <h3>平台数据统计</h3>
            <div v-if="loading.stats" class="loading-text">加载中...</div>
            <div v-else class="user-data-list admin-stats">
              <div class="data-item">
                <div class="num">{{ adminStats.totalUsers }}</div>
                <div class="text">注册用户</div>
              </div>
              <div class="data-item">
                <div class="num">{{ adminStats.totalExperts }}</div>
                <div class="text">入驻专家</div>
              </div>
              <div class="data-item">
                <div class="num">{{ adminStats.totalAppointments }}</div>
                <div class="text">总预约数</div>
              </div>
              <div class="data-item">
                <div class="num">{{ adminStats.totalTests }}</div>
                <div class="text">测评完成数</div>
              </div>
            </div>
          </template>

          <!-- 外观设置 -->
          <h3>外观设置</h3>
          <div class="setting-list">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>🌙 深色模式</span>
                <span class="setting-desc">切换应用主题颜色</span>
              </div>
              <div class="setting-item-right">
                <select v-model="settingsStore.theme" @change="settingsStore.setTheme(settingsStore.theme)" class="setting-select">
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                  <option value="system">跟随系统</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 通知设置 -->
          <h3>通知设置</h3>
          <div class="setting-list">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>🔔 消息提醒</span>
                <span class="setting-desc">选择接收通知的类型</span>
              </div>
              <div class="setting-item-right">
                <select v-model="settingsStore.notifications" @change="settingsStore.setNotifications(settingsStore.notifications)" class="setting-select">
                  <option value="all">全部通知</option>
                  <option value="important">仅重要</option>
                  <option value="none">关闭通知</option>
                </select>
              </div>
            </div>
            <div class="setting-item" @click="settingsStore.toggleSound()">
              <div class="setting-item-left">
                <span>🔊 提示音</span>
                <span class="setting-desc">{{ settingsStore.soundEnabled ? '已开启' : '已关闭' }}</span>
              </div>
              <div class="setting-item-right">
                <div class="toggle-switch" :class="{ active: settingsStore.soundEnabled }">
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 窗口行为 -->
          <h3>窗口行为</h3>
          <div class="setting-list">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>❌ 关闭窗口时</span>
                <span class="setting-desc">点击右上角关闭按钮的行为</span>
              </div>
              <div class="setting-item-right">
                <select v-model="settingsStore.closeAction" @change="settingsStore.setCloseAction(settingsStore.closeAction)" class="setting-select">
                  <option value="ask">每次询问</option>
                  <option value="minimize">最小化到托盘</option>
                  <option value="exit">直接退出</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 数据管理 -->
          <h3>数据管理</h3>
          <div class="setting-list">
            <div class="setting-item" @click="exportData">
              <div class="setting-item-left">
                <span>📥 导出完整数据备份</span>
                <span class="setting-desc">导出所有聊天记录、测评结果、预约记录和报告</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow">›</span>
              </div>
            </div>
            <div class="setting-item" @click="importData">
              <div class="setting-item-left">
                <span>📤 导入数据备份</span>
                <span class="setting-desc">从备份文件恢复所有数据</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow">›</span>
              </div>
            </div>
            <div class="setting-item" @click="clearData">
              <div class="setting-item-left">
                <span>🗑️ 清空本地记录</span>
                <span class="setting-desc">清空所有对话、测评记录（不可恢复）</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow">›</span>
              </div>
            </div>
          </div>

          <!-- 账号安全 -->
          <h3>账号安全</h3>
          <div class="setting-list">
            <div class="setting-item" @click="showChangePassword">
              <div class="setting-item-left">
                <span>🔐 修改密码</span>
                <span class="setting-desc">通过邮箱验证码修改密码</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow">›</span>
              </div>
            </div>
            <div class="setting-item" @click="logout">
              <div class="setting-item-left">
                <span>🚪 退出登录</span>
                <span class="setting-desc">返回登录页面</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow">›</span>
              </div>
            </div>
          </div>

          <!-- 关于 -->
          <h3>关于</h3>
          <div class="setting-list">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>ℹ️ 版本信息</span>
                <span class="setting-desc">心愈 AI心理系统 v1.1.0 (Powered by DeepSeek)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. 专家工作台 - 预约管理 -->
      <div v-if="currentPage === 'expert'" class="page show">
        <AppointmentList @view-detail="onViewAppointmentDetail" />
      </div>

      <!-- 7. 专家工作台 - 预约详情 -->
      <div v-if="currentPage === 'expert-detail'" class="page show">
        <AppointmentDetail 
          :id="currentAppointmentId" 
          @go-back="switchPage('expert')" 
          @status-updated="onStatusUpdated"
        />
      </div>

      <!-- 8. 用户 - 我的预约 -->
      <div v-if="currentPage === 'my-appointments'" class="page show">
        <UserAppointmentList 
          :online-user-ids="onlineUserIds"
          @view-detail="onViewUserAppointmentDetail" 
        />
      </div>

      <!-- 9. 用户 - 预约详情（聊天） -->
      <div v-if="currentPage === 'user-appointment-detail'" class="page show">
        <AppointmentDetail 
          :id="currentAppointmentId" 
          @go-back="switchPage('my-appointments')" 
        />
      </div>
    </div>

    <!-- 修改密码弹窗 -->
    <ChangePasswordDialog ref="changePasswordRef" />
    
    <!-- 编辑资料弹窗 -->
    <EditProfileDialog 
      v-model:visible="showEditDialog"
      @saved="onProfileSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch, provide, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { io, Socket } from 'socket.io-client'
import { useUserStore } from '@/stores/user'
import { useSettingsStore } from '@/stores/settings'
import { saveChat, saveAnalysisReport, clearAllData, createAppointment } from '@/api/user'
import { chatWithAIStream, generateReport } from '@/api/ai'
import { alert, success, confirm, error } from '@/utils/dialog'
import TestList from './TestList.vue'
import TestHistory from '../tests/TestHistory.vue'
import TestResultDetail from '../tests/TestResultDetail.vue'
import AppointmentList from '../expert/AppointmentList.vue'
import AppointmentDetail from '../expert/AppointmentDetail.vue'
import UserAppointmentList from '../expert/UserAppointmentList.vue'
import ChangePasswordDialog from "../../components/ChangePasswordDialog.vue"
import EditProfileDialog from "../../components/EditProfileDialog.vue"

const streamingContent = ref('')
const isStreaming = ref(false)    
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const settingsStore = useSettingsStore()
const currentPage = ref('')
const currentAppointmentId = ref(0)
const chatInput = ref('')
const chatMessages = ref<{type: string, content: string}[]>([])
const chatBox = ref<HTMLElement | null>(null)
const startDate = ref('')
const endDate = ref('')
const reportContent = ref('报告内容将在此处展示...')
const changePasswordRef = ref<InstanceType<typeof ChangePasswordDialog> | null>(null)

// ===== 新增：编辑资料弹窗 =====
const showEditDialog = ref(false)

import { getExpertStats } from '@/api/expert'
import { getAdminStats } from '@/api/admin'

// 专家统计数据
const expertStats = ref({
  pendingCount: 0,
  completedCount: 0,
  unfinishedCount: 0,
  totalPatients: 0
})

// 管理员统计数据
const adminStats = ref({
  totalUsers: 0,
  totalExperts: 0,
  totalAppointments: 0,
  totalTests: 0
})

// 用户角色文字
const userRoleText = computed(() => {
  const role = userStore.userInfo?.role
  if (role === 2) return '认证心理咨询师 · 专家工作台'
  if (role === 3) return '系统管理员 · 管理后台'
  return '专属心理陪伴用户 · 本地数据私密保存'
})

// 加载专家统计数据
const loadExpertStats = async () => {
  try {
    const res = await getExpertStats() as any
    expertStats.value = res.data
  } catch (e) {
    console.error('获取专家统计失败:', e)
  }
}

// 加载管理员统计数据
const loadAdminStats = async () => {
  try {
    const res = await getAdminStats() as any
    adminStats.value = res.data
  } catch (e) {
    console.error('获取管理员统计失败:', e)
  }
}

// AI 加载状态
const aiLoading = ref(false)
const reportLoading = ref(false)

// ===== Socket.IO 全局连接 =====
const socket = shallowRef<Socket | null>(null)
const onlineUserIds = ref<Set<number>>(new Set())

// 提供给子组件使用
provide('onlineUserIds', onlineUserIds)
provide('socket', socket)

// 判断某个用户是否在线
const isUserOnline = (userId: number | undefined) => {
  if (!userId) return false
  return onlineUserIds.value.has(userId)
}

// 初始化 Socket 连接
const initSocket = () => {
  if (!userStore.userInfo?.id) return
  
  // 如果全局 Socket 已存在且连接中，复用
  const existingSocket = (window as any).__globalSocket__
  if (existingSocket && existingSocket.connected) {
    socket.value = existingSocket
    setupDashboardListeners(existingSocket)
    return
  }
  
  if (socket.value) {
    socket.value.disconnect()
  }

  socket.value = io('http://162.211.183.129:3001', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })

  // 保存为全局 Socket
  ;(window as any).__globalSocket__ = socket.value

  const sock = socket.value

  sock.on('connect', () => {
    console.log('Dashboard Socket 已连接')
    sock.emit('authenticate', userStore.userInfo!.id)
  })

  setupDashboardListeners(sock)
}

const setupDashboardListeners = (sock: Socket) => {
  sock.on('disconnect', () => {
    console.log('Dashboard Socket 已断开')
    onlineUserIds.value.clear()
  })

  // 监听用户在线状态变更
  sock.on('user-status-change', (data: { userId: number, isOnline: boolean }) => {
    if (data.isOnline) {
      onlineUserIds.value.add(data.userId)
    } else {
      onlineUserIds.value.delete(data.userId)
    }
    console.log(`用户 ${data.userId} 状态: ${data.isOnline ? '在线' : '离线'}`)
  })

  // 被强制登出（服务器要求）
  sock.on('force-logout', (data: { message: string }) => {
    alert(data.message || '您的账号已登出')
    disconnectSocket()
    userStore.logout()
    router.replace('/login')
  })

  sock.on('error', (err: any) => {
    console.error('Socket 错误:', err)
  })
}

// 断开 Socket
const disconnectSocket = () => {
  if (socket.value) {
    socket.value.disconnect()
    ;(window as any).__globalSocket__ = null
    socket.value = null
    onlineUserIds.value.clear()
  }
}

// 纯文本提取函数
const stripHtml = (html: string): string => {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

// 显示修改密码弹窗
const showChangePassword = () => {
  changePasswordRef.value?.show()
}

// ===== 新增：显示编辑资料弹窗 =====
const showEditProfile = () => {
  showEditDialog.value = true
}

// ===== 新增：资料保存成功回调 =====
const onProfileSaved = () => {
  // 资料已更新，刷新用户信息
  userStore.getInfo()
}

// 复制纯文本报告
const exportReport = async () => {
  try {
    const plainText = stripHtml(reportContent.value)
      .replace(/\n\s*\n/g, '\n')
      .trim()

    await navigator.clipboard.writeText(plainText)
    await success('报告内容已复制到剪贴板', '复制成功')
  } catch (e) {
    const textarea = document.createElement('textarea')
    textarea.value = stripHtml(reportContent.value)
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    await success('报告内容已复制到剪贴板', '复制成功')
  }
}

// 导出 HTML 文件
const downloadReport = () => {
  if (!reportContent.value || reportContent.value === '报告内容将在此处展示...') {
    alert('请先生成报告')
    return
  }

  const plainText = stripHtml(reportContent.value)

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>心理状态分析报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.8; color: #333; }
    h2 { color: #2c3e50; border-bottom: 2px solid #73a9d8; padding-bottom: 10px; }
    .meta { color: #666; margin-bottom: 30px; font-size: 14px; }
    .section { margin-bottom: 24px; }
    .section h3 { color: #73a9d8; margin-bottom: 12px; }
    .section p, .section li { margin-bottom: 8px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h2>📋 心理状态综合分析报告</h2>
  <div class="meta">
    <p>分析时间段：${startDate.value} 至 ${endDate.value}</p>
    <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
  </div>
  <div class="content">
    ${plainText.split('\n').map(line => {
      if (line.startsWith('一、') || line.startsWith('二、') || line.startsWith('三、')) {
        return `<h3>${line}</h3>`
      }
      if (line.match(/^\d+\./)) {
        return `<p>${line}</p>`
      }
      return `<p>${line}</p>`
    }).join('')}
  </div>
</body>
</html>`

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `心理分析报告_${startDate.value}_${endDate.value}.html`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

const loading = ref({
  stats: false,
  tests: false,
  doctors: false
})

interface MenuItem {
  id: string
  name: string
  icon: string
}

// 普通用户菜单
const baseMenuItems: MenuItem[] = [
  { id: 'chat', name: 'AI心理倾诉', icon: '💬' },
  { id: 'test', name: '心理测评中心', icon: '📋' },
  { id: 'doctor', name: '专家在线问诊', icon: '👩‍⚕️' },
  { id: 'analysis', name: '周期AI分析报告', icon: '📊' },
  { id: 'my-appointments', name: '我的预约', icon: '📅' },
  { id: 'user', name: '个人中心', icon: '👤' }
]

// 管理员菜单项
const adminMenuItem: MenuItem = { 
  id: 'admin', 
  name: '管理后台', 
  icon: '⚙️' 
}

// 动态菜单：根据 role 显示不同入口
const menuItems = computed<MenuItem[]>(() => {
  // role=2 专家：只显示专家工作台 + 个人中心
  if (userStore.userInfo?.role === 2) {
    return [
      { id: 'expert', name: '专家工作台', icon: '👨‍⚕️' },
      { id: 'user', name: '个人中心', icon: '👤' }
    ]
  }

  // 普通用户和管理员：显示基础菜单
  const items = [...baseMenuItems]

  // role=3 管理员：添加管理后台和预约管理
  if (userStore.userInfo?.role === 3) {
    items.push(adminMenuItem)
  }

  return items
})

onMounted(async () => {
  if (userStore.isLoggedIn) {
    try {
      await userStore.getInfo()
      await userStore.loadAvatar()
    } catch (e) {
      console.error('获取用户信息失败:', e)
    }
  }

  initSocket()

  // 根据角色加载不同数据
  loading.value.stats = true
  try {
    if (userStore.userInfo?.role === 2) {
      await loadExpertStats()
    } else if (userStore.userInfo?.role === 3) {
      await loadAdminStats()
    } else {
      await userStore.getStats()
    }
  } catch (e) {
    console.error('获取统计数据失败:', e)
  } finally {
    loading.value.stats = false
  }

  // 加载聊天记录（普通用户和管理员）
  if (userStore.userInfo?.role === 1 || userStore.userInfo?.role === 3) {
    try {
      await userStore.getChatHistory()
      chatMessages.value = userStore.chatHistory.map((msg: any) => ({
        type: msg.type,
        content: msg.content
      }))
    } catch (e) {
      console.error('获取聊天记录失败:', e)
    }
  }

  // 设置默认页面
  if (!currentPage.value) {
    if (userStore.userInfo?.role === 2) {
      switchPage('expert')      // 专家 → 专家工作台页面
    } else if (userStore.userInfo?.role === 3) {
      switchPage('chat')        // 管理员 → AI对话
    } else {
      switchPage('chat')        // 普通用户 → AI对话
    }
  }
})


onUnmounted(() => {
  disconnectSocket()
})

// 监听路由变化
watch(() => route.path, (newPath) => {
  if (newPath === '/dashboard' && userStore.userInfo?.role === 2) {
    switchPage('expert')
  }
})

const userChatCount = computed(() => {
  return userStore.chatHistory?.filter((msg: any) => msg.type === 'user').length || 0
})

const switchPage = async (pageId: string) => {
  // 管理后台跳转到独立路由
  if (pageId === 'admin') {
    router.push('/admin')
    return
  }

  // ===== 新增：从管理后台返回时，清除 from=admin 标记 =====
  if (route.query.from === 'admin') {
    router.replace({ path: '/dashboard', query: {} })
  }

  currentPage.value = pageId

  if (pageId === 'test') {
    userStore.switchTestView('list')
  } else {
    userStore.resetTestView()
  }

  // ===== 修复：切换到个人中心时，根据角色重新加载统计数据 =====
  if (pageId === 'user') {
    loading.value.stats = true
    try {
      if (userStore.userInfo?.role === 2) {
        await loadExpertStats()
      } else if (userStore.userInfo?.role === 3) {
        await loadAdminStats()
      } else {
        await userStore.getStats()
      }
    } catch (e) {
      console.error('刷新统计数据失败:', e)
    } finally {
      loading.value.stats = false
    }
  }

  if (pageId === 'doctor' && userStore.doctors.length === 0) {
    loading.value.doctors = true
    try {
      await userStore.getDoctors()
    } catch (e) {
      console.error('获取专家列表失败:', e)
    } finally {
      loading.value.doctors = false
    }
  }
}

const onViewAppointmentDetail = (id: number) => {
  currentAppointmentId.value = id
  currentPage.value = 'expert-detail'
}

const onViewUserAppointmentDetail = (id: number) => {
  currentAppointmentId.value = id
  currentPage.value = 'user-appointment-detail'
}

// ===== 新增：处理预约状态更新事件 =====
const onStatusUpdated = async () => {
  console.log('【Dashboard】收到状态更新，刷新统计数据')
  if (userStore.userInfo?.role === 2) {
    loading.value.stats = true
    try {
      await loadExpertStats()
    } catch (e) {
      console.error('刷新专家统计失败:', e)
    } finally {
      loading.value.stats = false
    }
  }
}

const onStartTest = (testId: number) => {
  router.push(`/tests/do/${testId}`)
}

const onViewDetail = (resultId: number) => {
  userStore.switchTestView('detail', resultId)
}

// ===== 流式 AI 聊天 =====
const sendChat = async () => {
  const val = chatInput.value.trim()
  if (!val || aiLoading.value || isStreaming.value) return

  // 1. 显示用户消息
  chatMessages.value.push({ type: 'user', content: val })
  chatInput.value = ''
  scrollToBottom()

  // 2. 构建消息历史
  const messageHistory = chatMessages.value.map(msg => ({
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
  }))

  aiLoading.value = true
  isStreaming.value = true
  streamingContent.value = ''

  try {
    // 3. 调用流式 AI 接口
    await chatWithAIStream(
      messageHistory,
      (content: string) => {
        // 逐字接收
        streamingContent.value += content
        scrollToBottom()
      },
      (err: string) => {
        console.error('流式输出错误:', err)
        isStreaming.value = false
        aiLoading.value = false
      },
      () => {
        // 流式输出完成
        console.log('流式输出完成')
        isStreaming.value = false
        aiLoading.value = false
        
        // 把流式内容保存到消息列表
        if (streamingContent.value) {
          const finalContent = streamingContent.value
          chatMessages.value.push({ type: 'ai', content: finalContent })
          streamingContent.value = ''
          
          // 保存到本地
          saveChat({ content: val, type: 'user' })
          saveChat({ content: finalContent, type: 'ai' })
        }
        
        scrollToBottom()
      },
      {
        testCount: userStore.stats?.testCount || 0,
        username: userStore.userInfo?.username
      }
    )

  } catch (e: any) {
    console.error('AI 回复失败:', e)
    isStreaming.value = false
    aiLoading.value = false
    streamingContent.value = ''
    
    chatMessages.value.push({
      type: 'ai',
      content: '抱歉，我暂时遇到了一些问题，请稍后再试。💙'
    })
    scrollToBottom()
  }
}

const bookDoctor = async (doc: any) => {
  try {
    await createAppointment({ doctorId: doc.id })
    await success(`已预约${doc.name}，请等待确认`, '预约成功')
  } catch (e: any) {
    await error(e.message || '预约失败')
  }
}

// ===== AI 生成报告 =====
const createReport = async () => {
  if (!startDate.value || !endDate.value) {
    await alert('请选择完整的起止日期！', '日期错误')
    return
  }

  reportContent.value = 'AI正在分析该时间段内的【对话情绪数据+心理测评数据】，正在生成系统性报告...'
  reportLoading.value = true

  try {
    const res = await generateReport({
      chatHistory: chatMessages.value,
      testResults: [],
      startDate: startDate.value,
      endDate: endDate.value
    })

    // res 直接就是 { success: true, report: '...', usage: {...} }
    const report = res.report

    if (!report) {
      throw new Error('报告生成失败')
    }

    reportContent.value = report

    await saveAnalysisReport({
      startDate: startDate.value,
      endDate: endDate.value,
      content: reportContent.value.replace(/\n/g, '<br/>')
    })
    await userStore.getStats()
  } catch (e: any) {
    console.error('生成报告失败:', e)
    reportContent.value = '报告生成失败，请稍后重试。'
    await error('报告生成失败，请稍后重试')
  } finally {
    reportLoading.value = false
  }
}

const exportData = async () => {
  try {
    const data = {
      chatHistory: chatMessages.value,
      stats: userStore.stats,
      exportTime: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `心愈数据备份_${new Date().toLocaleDateString()}.json`
    a.click()
    URL.revokeObjectURL(url)
    await success('数据导出成功', '导出成功')
  } catch (e) {
    await error('导出失败', '导出失败')
  }
}

const importData = async () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.chatHistory) {
        chatMessages.value = data.chatHistory
      }
      await success('数据导入成功', '导入成功')
    } catch (e) {
      await error('文件格式错误', '导入失败')
    }
  }
  input.click()
}

const clearData = async () => {
  const ok = await confirm('确定要清空所有本地记录吗？此操作不可恢复。', '确认清空')
  if (ok) {
    try {
      await clearAllData()
      chatMessages.value = []
      userStore.chatHistory = []
      await userStore.getStats()
      await success('所有记录已清空', '已清空')
    } catch (e: any) {
      await error(e?.message || '清空失败', '清空失败')
    }
  }
}

const logout = async () => {
  // 断开 Socket 连接
  disconnectSocket()
  await userStore.logout()
  router.replace('/login')
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) {
      chatBox.value.scrollTop = chatBox.value.scrollHeight
    }
  })
}

</script>

<style scoped>
/* 添加流式输出样式 */
.streaming {
  animation: fadeIn 0.1s ease;
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--menu-active);
  margin-left: 2px;
  animation: blink 1s infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0.8; }
  to { opacity: 1; }
}
.report-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.btn-export {
  padding: 8px 20px;
  background: #e3f0fc;
  color: #73a9d8;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-export:hover {
  background: #73a9d8;
  color: #fff;
}

.app-wrap {
  display: flex;
  width: 100vw;
  height: calc(100vh - 36px);
  overflow: hidden !important;
  box-sizing: border-box;
}

.left-sidebar {
  width: 220px;
  min-width: 220px;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden !important;
  box-sizing: border-box;
}

.logo-box {
  text-align: center;
  flex-shrink: 0;
}

.logo-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #73a9d8, #b4d8f0);
  margin: 0 auto 10px;
}

.logo-box h2 {
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.3;
}

.logo-box p {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
}

.menu-list button {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: var(--menu-bg);
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  transition: 0.25s;
  color: var(--text-primary);
  white-space: nowrap;
}

.menu-list button:hover {
  background: #e3f0fc;
}

.menu-list button.active {
  background: var(--menu-active);
  color: #fff;
}

.main-content {
  flex: 1;
  height: 100%;
  padding: 20px 24px;
  overflow: hidden !important;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  min-width: 0;
  box-sizing: border-box;
}

.empty-tip {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 16px;
}

.page {
  display: none;
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
}

.page.show {
  display: flex;
  flex-direction: column;
}

.card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px var(--shadow);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
/* 专家统计样式 */
.expert-stats .data-item:nth-child(1) .num {
  color: #f59e0b;
}

.expert-stats .data-item:nth-child(2) .num {
  color: #10b981;
}

.expert-stats .data-item:nth-child(3) .num {
  color: #ef4444;
}

.expert-stats .data-item:nth-child(4) .num {
  color: #73a9d8;
}

/* 管理员统计样式 */
.admin-stats .data-item .num {
  color: #73a9d8;
}

.card h3 {
  margin-bottom: 16px;
  color: var(--text-primary);
  font-size: 16px;
  flex-shrink: 0;
}

.sub-title {
  margin-bottom: 12px;
  color: var(--text-secondary);
  font-size: 13px;
  flex-shrink: 0;
}

.loading-text {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
  flex-shrink: 0;
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.chat-card {
  padding: 20px 24px;
  max-width: 800px;
}

.chat-box {
  flex: 1;
  overflow-y: auto;
  background: var(--input-bg);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  min-height: 0;
  box-sizing: border-box;
}

.msg-item {
  margin-bottom: 12px;
  clear: both;
  overflow: hidden;
}

.msg-ai {
  float: left;
  max-width: 75%;
  padding: 10px 14px;
  background: var(--msg-ai-bg);
  border-radius: 14px 14px 14px 4px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
}

.msg-user {
  float: right;
  max-width: 75%;
  padding: 10px 14px;
  background: var(--msg-user-bg);
  border-radius: 14px 14px 4px 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
}

/* AI 输入中动画 */
.typing-indicator {
  font-size: 13px;
  color: var(--text-muted);
}

.typing-indicator span {
  animation: blink 1.4s infinite both;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

.input-row {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  height: 44px;
  box-sizing: border-box;
}

.input-row input {
  flex: 1;
  padding: 0 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  outline: none;
  font-size: 14px;
  height: 100%;
  background: var(--input-bg);
  color: var(--text-primary);
  box-sizing: border-box;
}

.input-row input:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.input-row button {
  padding: 0 24px;
  border: none;
  border-radius: 10px;
  background: var(--menu-active);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  height: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
}

.input-row button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-item {
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: 0.2s;
}

.test-item:hover {
  border-color: var(--menu-active);
  background: var(--bg-secondary);
}

.test-item h4 {
  margin-bottom: 4px;
  color: var(--text-primary);
  font-size: 14px;
}

.test-item p {
  font-size: 12px;
  color: var(--text-muted);
}

.doc-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.doc-card {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--card-bg);
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.doc-card h4 {
  color: var(--text-primary);
  font-size: 14px;
  margin: 0;
}

.online-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #9ca3af;
  transition: all 0.3s;
}

.online-badge.online {
  background: #d1fae5;
  color: #065f46;
}

.doc-card p {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.doc-card button {
  border: none;
  padding: 8px 14px;
  background: var(--menu-active);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.time-select {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.time-select input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  background: var(--input-bg);
  color: var(--text-primary);
}

.time-select button {
  padding: 8px 14px;
  background: var(--menu-active);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.time-select button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.report-result {
  padding: 16px;
  background: var(--input-bg);
  border-radius: 12px;
  line-height: 1.7;
  font-size: 13px;
  color: var(--text-primary);
}

.user-card {
  overflow-y: auto;
  max-width: 700px;
}

/* ===== 用户信息头部样式（可点击编辑） ===== */
.user-info-top {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 16px;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.2s;
  border-radius: 12px;
  padding: 12px;
  margin: -12px -12px 16px -12px;
}

.user-info-top:hover {
  background: rgba(115, 169, 216, 0.08);
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #73a9d8, #b4d8f0);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  font-weight: 600;
}

.user-base-info h4 {
  font-size: 16px;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.user-base-info p {
  font-size: 12px;
  color: var(--text-muted);
}

.edit-icon {
  margin-left: auto;
  font-size: 16px;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.user-info-top:hover .edit-icon {
  opacity: 1;
}

.user-data-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.data-item {
  background: var(--input-bg);
  padding: 12px;
  border-radius: 12px;
  text-align: center;
}

.data-item .num {
  font-size: 20px;
  font-weight: bold;
  color: var(--menu-active);
  margin-bottom: 4px;
}

.data-item .text {
  font-size: 12px;
  color: var(--text-secondary);
}

.setting-list {
  flex-shrink: 0;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background: rgba(115, 169, 216, 0.05);
}

.setting-item-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-item-left span:first-child {
  font-size: 14px;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.setting-item-right {
  display: flex;
  align-items: center;
}

.setting-select {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  background: #ccc;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

.toggle-switch.active {
  background: var(--menu-active);
}

.toggle-knob {
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(20px);
}

.arrow {
  font-size: 18px;
  color: var(--text-muted);
}

:global(html.dark) .setting-item:hover {
  background: rgba(255,255,255,0.05);
}

:global(html.dark) .data-item {
  background: var(--bg-secondary);
}

.user-card::-webkit-scrollbar,
.scroll-content::-webkit-scrollbar,
.chat-box::-webkit-scrollbar,
.menu-list::-webkit-scrollbar {
  width: 0px;
  background: transparent;
}

.user-card,
.scroll-content,
.chat-box,
.menu-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

@media (max-width: 900px) {
  .left-sidebar {
    width: 180px;
    min-width: 180px;
  }

  .card {
    max-width: 100%;
  }
}

@media (max-width: 700px) {
  .left-sidebar {
    width: 60px;
    min-width: 60px;
  }

  .logo-box h2, .logo-box p {
    display: none;
  }

  .logo-avatar {
    width: 40px;
    height: 40px;
  }

  .menu-list button {
    padding: 10px;
    text-align: center;
    font-size: 11px;
  }

  .doc-list {
    grid-template-columns: 1fr;
  }

  .user-data-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
