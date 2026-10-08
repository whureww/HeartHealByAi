<template>
  <div class="app-wrap">
    <!-- 左侧导航栏 -->
    <aside class="left-sidebar">
      <div class="logo-box">
        <div class="logo-mark"><AppIcon name="brand" :size="19" /></div>
        <div class="logo-text">
          <h2>心愈</h2>
          <p>AI 心理系统</p>
        </div>
      </div>
      <nav class="menu-list">
        <button
          v-for="item in menuItems"
          :key="item.id"
          :class="{ active: currentPage === item.id }"
          @click="switchPage(item.id)">
          <AppIcon :name="item.icon" :size="17" />
          <span class="menu-text">{{ item.name }}</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="footer-user">
          <div class="footer-avatar">
            <img
              v-if="userStore.userInfo?.avatar"
              :src="userStore.userInfo.avatar"
              alt="头像"
            />
            <span v-else class="footer-avatar-text">{{ userStore.userInfo?.username?.[0]?.toUpperCase() || '?' }}</span>
          </div>
          <span class="footer-name">{{ userStore.userInfo?.username || '心理用户' }}</span>
          <button class="btn-logout" title="退出登录" @click="logout">
            <AppIcon name="logout" :size="16" />
          </button>
        </div>
      </div>
    </aside>

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
              <div class="msg-ai selectable-text">你好！我是你的专属心理陪伴助手"心愈"，你所有的情绪、压力、困惑都可以安心告诉我，我会耐心倾听并给予疏导。</div>
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
            <button class="btn-send-chat" @click="sendChat" :disabled="aiLoading || !chatInput.trim()">
              <AppIcon v-if="!aiLoading" name="send" :size="15" />
              <AppIcon v-else name="spark" :size="15" class="spin" />
              <span>{{ aiLoading ? '思考中...' : '发送' }}</span>
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
          @start-ai-test="onStartAiTest"
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
              <div v-for="doc in userStore.doctors" :key="doc.id" class="doc-row">
                <div class="doc-info">
                  <h4>{{ doc.name }}｜{{ doc.title }}</h4>
                  <p>{{ doc.specialty }}</p>
                </div>
                <div class="doc-side">
                  <span class="online-badge" :class="{ online: isUserOnline(doc.user_id) }">
                    <span class="status-dot" :class="{ online: isUserOnline(doc.user_id) }"></span>
                    {{ isUserOnline(doc.user_id) ? '在线' : '离线' }}
                  </span>
                  <button class="btn-book" @click="bookDoctor(doc)">立即预约问诊</button>
                </div>
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
              <AppIcon name="spark" class="spin" /> AI 正在分析您的心理数据，请稍候...
            </div>
            <div v-else-if="!reportContent || reportContent === '报告内容将在此处展示...'" class="report-empty">
              <div class="report-empty-mark"><AppIcon name="moon" :size="22" /></div>
              <p class="report-empty-title">报告会在台灯下等你</p>
              <p class="report-empty-sub">选择时间段后生成，AI 将综合你的倾诉与测评，写下一份只有你能看见的分析</p>
            </div>
            <div v-else class="report-result selectable-text" style="white-space: pre-wrap;">{{ reportContent }}</div>
          </div>
          <!-- 导出报告按钮 -->
          <div v-if="reportContent && reportContent !== '报告内容将在此处展示...' && !reportLoading" class="report-actions">
            <button class="btn-export" @click="exportReport"><AppIcon name="fileText" :size="15" /> 复制报告内容</button>
            <button class="btn-export" @click="downloadReport"><AppIcon name="download" :size="15" /> 导出为 HTML</button>
          </div>
        </div>
      </div>

      <!-- 5. 个人中心页面 -->
      <div v-if="currentPage === 'user'" class="page show">
        <div class="settings-page">

          <!-- 用户信息头部 - 可点击编辑 -->
          <div class="settings-profile" @click="showEditProfile">
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
            <span class="edit-icon"><AppIcon name="edit" :size="16" /></span>
          </div>

          <!-- 普通用户统计 -->
          <div v-if="userStore.userInfo?.role === 1" class="settings-group">
            <div class="settings-group-head"><AppIcon name="chart" :size="15" /><h3>我的数据统计</h3></div>
            <div class="settings-group-body">
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
            </div>
          </div>

          <!-- 专家统计 -->
          <div v-if="userStore.userInfo?.role === 2" class="settings-group">
            <div class="settings-group-head"><AppIcon name="chart" :size="15" /><h3>专家工作台统计</h3></div>
            <div class="settings-group-body">
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
            </div>
          </div>

          <!-- 管理员统计 -->
          <div v-if="userStore.userInfo?.role === 3" class="settings-group">
            <div class="settings-group-head"><AppIcon name="chart" :size="15" /><h3>平台数据统计</h3></div>
            <div class="settings-group-body">
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
            </div>
          </div>

          <!-- 外观设置 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="sun" :size="15" /><h3>外观设置</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>外观主题</span>
                <span class="setting-desc">选择应用主题颜色</span>
              </div>
              <div class="setting-item-right">
                <div class="theme-options">
                  <button class="theme-option" :class="{ selected: settingsStore.theme === 'light' }" @click="settingsStore.setTheme('light')">
                    <AppIcon name="sun" :size="15" /><span>浅色</span>
                  </button>
                  <button class="theme-option" :class="{ selected: settingsStore.theme === 'dark' }" @click="settingsStore.setTheme('dark')">
                    <AppIcon name="moon" :size="15" /><span>深色</span>
                  </button>
                  <button class="theme-option" :class="{ selected: settingsStore.theme === 'system' }" @click="settingsStore.setTheme('system')">
                    <AppIcon name="monitor" :size="15" /><span>跟随系统</span>
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>

          <!-- 通知设置 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="bell" :size="15" /><h3>通知设置</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>消息提醒</span>
                <span class="setting-desc">新消息将通过系统通知中心弹出提醒</span>
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
                <span>提示音</span>
                <span class="setting-desc">{{ settingsStore.soundEnabled ? '已开启' : '已关闭' }}</span>
              </div>
              <div class="setting-item-right">
                <div class="toggle-switch" :class="{ active: settingsStore.soundEnabled }">
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
            <div v-if="userStore.userInfo?.role === 3" class="setting-item" @click="sendTestNotification">
              <div class="setting-item-left">
                <span>测试系统通知</span>
                <span class="setting-desc">发送一条 Windows 通知中心弹窗验证效果</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            </div>
          </div>

          <!-- 窗口行为 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="monitor" :size="15" /><h3>窗口行为</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>关闭窗口时</span>
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
          </div>

          <!-- 数据管理 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="fileText" :size="15" /><h3>数据管理</h3></div>
            <div class="settings-group-body">
            <div class="setting-item" @click="exportData">
              <div class="setting-item-left">
                <span>导出完整数据备份</span>
                <span class="setting-desc">导出所有聊天记录、测评结果、预约记录和报告</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="importData">
              <div class="setting-item-left">
                <span>导入数据备份</span>
                <span class="setting-desc">从备份文件恢复所有数据</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="clearData">
              <div class="setting-item-left">
                <span>清空本地记录</span>
                <span class="setting-desc">清空所有对话、测评记录（不可恢复）</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="settingsStore.toggleAutoBackup()">
              <div class="setting-item-left">
                <span>自动备份</span>
                <span class="setting-desc">按所选周期自动生成加密快照（本地设置数据）</span>
              </div>
              <div class="setting-item-right">
                <div class="toggle-switch" :class="{ active: settingsStore.autoBackup }">
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
            <div class="setting-item" v-if="settingsStore.autoBackup">
              <div class="setting-item-left">
                <span>备份周期</span>
                <span class="setting-desc">自动备份的时间间隔</span>
              </div>
              <div class="setting-item-right">
                <select v-model.number="settingsStore.backupInterval" class="setting-select">
                  <option :value="1">每天</option>
                  <option :value="3">每 3 天</option>
                  <option :value="7">每周</option>
                  <option :value="14">每两周</option>
                  <option :value="30">每月</option>
                </select>
              </div>
            </div>
            </div>
          </div>

          <!-- 隐私安全 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="shield" :size="15" /><h3>隐私安全</h3></div>
            <div class="settings-group-body">
            <div class="setting-item" @click="settingsStore.toggleLockOnLeave()">
              <div class="setting-item-left">
                <span>离开自动锁定</span>
                <span class="setting-desc">无操作超过设定时长后锁定应用，需密码解锁</span>
              </div>
              <div class="setting-item-right">
                <div class="toggle-switch" :class="{ active: settingsStore.lockOnLeave }">
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
            <div class="setting-item" v-if="settingsStore.lockOnLeave">
              <div class="setting-item-left">
                <span>锁定时长</span>
                <span class="setting-desc">无操作多久后自动锁定</span>
              </div>
              <div class="setting-item-right">
                <select v-model.number="settingsStore.lockTimeout" class="setting-select">
                  <option :value="1">1 分钟</option>
                  <option :value="5">5 分钟</option>
                  <option :value="10">10 分钟</option>
                  <option :value="30">30 分钟</option>
                </select>
              </div>
            </div>
            </div>
          </div>

          <!-- 账号安全 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="lock" :size="15" /><h3>账号安全</h3></div>
            <div class="settings-group-body">
            <div class="setting-item" @click="showChangePassword">
              <div class="setting-item-left">
                <span>修改密码</span>
                <span class="setting-desc">通过邮箱验证码修改密码</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            <div class="setting-item" @click="logout">
              <div class="setting-item-left">
                <span>退出登录</span>
                <span class="setting-desc">返回登录页面</span>
              </div>
              <div class="setting-item-right">
                <span class="arrow"><AppIcon name="chevronRight" :size="15" /></span>
              </div>
            </div>
            </div>
          </div>

          <!-- 关于 -->
          <div class="settings-group">
            <div class="settings-group-head"><AppIcon name="info" :size="15" /><h3>关于</h3></div>
            <div class="settings-group-body">
            <div class="setting-item">
              <div class="setting-item-left">
                <span>版本信息</span>
                <span class="setting-desc">{{ updateDesc }}</span>
                <!-- 下载进度条（仅下载中显示） -->
                <div v-if="updatePhase === 'downloading'" class="update-progress">
                  <div class="update-progress-track">
                    <div class="update-progress-fill" :style="{ width: updateProgress.percent + '%' }"></div>
                  </div>
                  <span class="update-progress-text">{{ updateProgressText }}</span>
                  <button class="btn-cancel-download" @click="onCancelDownload">取消</button>
                </div>
              </div>
              <button
                class="btn-check-update"
                :class="{ 'btn-install-ready': updatePhase === 'ready' }"
                :disabled="updatePhase === 'checking' || updatePhase === 'downloading'"
                @click="onUpdateAction"
              >
                {{ updatePhaseText }}
              </button>
            </div>
            <div class="setting-item">
              <div class="setting-item-left">
                <span>全局快捷键</span>
                <span class="setting-desc">Ctrl + Alt + H 任意界面一键呼出 / 隐藏窗口（含锁屏与托盘后台）</span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. 专家工作台 - 预约管理 -->
      <div v-if="currentPage === 'expert'" class="page show">
        <AppointmentList @view-detail="onViewAppointmentDetail" />
      </div>

      <!-- 6.1 专家工作台 - 我的名片 -->
      <div v-if="currentPage === 'expert-card'" class="page show">
        <MyCard />
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
import { SOCKET_URL, getAuthToken } from '@/config'
import { useUserStore } from '@/stores/user'
import { useSettingsStore } from '@/stores/settings'
import { saveChat, saveAnalysisReport, clearAllData, createAppointment } from '@/api/user'
import { chatWithAIStream, generateReport } from '@/api/ai'
import { alert, success, confirm, error } from '@/utils/dialog'
import TestList from './TestList.vue'
import TestHistory from '../tests/TestHistory.vue'
import TestResultDetail from '../tests/TestResultDetail.vue'
import AppointmentList from '../expert/AppointmentList.vue'
import MyCard from '../expert/MyCard.vue'
import AppointmentDetail from '../expert/AppointmentDetail.vue'
import UserAppointmentList from '../expert/UserAppointmentList.vue'
import ChangePasswordDialog from "../../components/ChangePasswordDialog.vue"
import EditProfileDialog from "../../components/EditProfileDialog.vue"
import AppIcon from '@/components/AppIcon.vue'
import { showToast } from '@/utils/notify'
import { checkUpdate, downloadUpdate, cancelDownload, installUpdate, onUpdateProgress, hasRemindedUpdate, markUpdateReminded, type UpdateInfo, type UpdatePhase, type DownloadProgress } from '@/utils/updater'
import { isTauri } from '@/utils/secureStore'

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

  socket.value = io(SOCKET_URL, {
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
    sock.emit('authenticate', { userId: userStore.userInfo!.id, token: getAuthToken() })
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

  // 管理员上下架专家名片 → 实时刷新专家列表
  sock.on('doctor-list-updated', () => {
    userStore.getDoctors().catch(() => {})
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

// 发送一条真实系统通知，验证通知中心效果
const sendTestNotification = () => {
  showToast('心愈提醒', '这是一条测试系统通知——窗口最小化时你也能在通知中心看到它', true)
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
    h2 { color: #332e27; border-bottom: 2px solid #a96a2c; padding-bottom: 10px; }
    .meta { color: #666; margin-bottom: 30px; font-size: 14px; }
    .section { margin-bottom: 24px; }
    .section h3 { color: #a96a2c; margin-bottom: 12px; }
    .section p, .section li { margin-bottom: 8px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h2>心理状态综合分析报告</h2>
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
  { id: 'chat', name: 'AI心理倾诉', icon: 'chat' },
  { id: 'test', name: '心理测评中心', icon: 'clipboard' },
  { id: 'doctor', name: '专家在线问诊', icon: 'stethoscope' },
  { id: 'analysis', name: '周期AI分析报告', icon: 'chart' },
  { id: 'my-appointments', name: '我的预约', icon: 'calendar' },
  { id: 'user', name: '个人中心', icon: 'user' }
]

// 管理员菜单项
const adminMenuItem: MenuItem = {
  id: 'admin',
  name: '管理后台',
  icon: 'settings'
}

// 动态菜单：根据 role 显示不同入口
const menuItems = computed<MenuItem[]>(() => {
  // role=2 专家：只显示专家工作台 + 我的名片 + 个人中心
  if (userStore.userInfo?.role === 2) {
    return [
      { id: 'expert', name: '专家工作台', icon: 'stethoscope' },
      { id: 'expert-card', name: '我的名片', icon: 'fileText' },
      { id: 'user', name: '个人中心', icon: 'user' }
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

// ===== 检查更新（Gitee Releases） =====
// 流程：检查 → 发现新版停下来等用户决定 → 下载（进度条+可取消）→ 安装
const updatePhase = ref<UpdatePhase>('idle')
const updateInfo = ref<UpdateInfo | null>(null)
const updateError = ref('')
const updateProgress = ref<DownloadProgress>({ received: 0, total: 0, percent: 0 })
const downloadedPath = ref('') // 已下载完成的安装包本地路径
let unlistenProgress: (() => void) | null = null

const formatMB = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
const updateProgressText = computed(() => {
  const p = updateProgress.value
  if (p.total > 0) return `${formatMB(p.received)} / ${formatMB(p.total)}（${p.percent}%）`
  return `已下载 ${formatMB(p.received)}`
})

const updateDesc = computed(() => {
  const cur = updateInfo.value?.current_version || '0.1.5'
  const base = `心愈 AI心理系统 v${cur}`
  if (updatePhase.value === 'available' && updateInfo.value?.has_update) {
    return `发现新版本 v${updateInfo.value.latest_version}（当前 v${cur}）· 点击右侧下载更新`
  }
  if (updatePhase.value === 'downloading' && updateInfo.value) {
    return `正在下载 v${updateInfo.value.latest_version} · 下载完成后可安装`
  }
  if (updatePhase.value === 'ready' && updateInfo.value) {
    return `v${updateInfo.value.latest_version} 安装包已就绪 · 点击右侧立即安装（会关闭程序并启动安装向导）`
  }
  if (updatePhase.value === 'idle' && updateInfo.value && !updateInfo.value.has_update) {
    return `${base} (Powered by DeepSeek) · 已是最新版本`
  }
  if (updateError.value) {
    return `${base} · ${updateError.value}`
  }
  return `${base} (Powered by DeepSeek)`
})

const updatePhaseText = computed(() => {
  switch (updatePhase.value) {
    case 'checking': return '检查中...'
    case 'available': return '下载更新'
    case 'downloading': return '下载中...'
    case 'ready': return '立即安装'
    default: return '检查更新'
  }
})

const onUpdateAction = async () => {
  if (!isTauri()) {
    updateError.value = '浏览器模式暂不支持'
    return
  }
  switch (updatePhase.value) {
    case 'ready':
      await doInstall()
      break
    case 'available':
      await startDownload()
      break
    default:
      await doCheck()
  }
}

const doCheck = async () => {
  updatePhase.value = 'checking'
  updateError.value = ''
  try {
    const info = await checkUpdate()
    updateInfo.value = info
    if (info.has_update) {
      if (info.download_url) {
        // 发现新版：不自动下载，交给用户决定
        updatePhase.value = 'available'
      } else {
        updateError.value = '新版本缺少安装包附件'
        updatePhase.value = 'idle'
      }
    } else {
      updatePhase.value = 'idle'
    }
  } catch (e: any) {
    updateError.value = (typeof e === 'string' ? e : e?.message) || '检查失败'
    updatePhase.value = 'idle'
  }
}

const startDownload = async () => {
  if (!updateInfo.value?.download_url) return
  updatePhase.value = 'downloading'
  updateError.value = ''
  updateProgress.value = { received: 0, total: 0, percent: 0 }
  unlistenProgress = await onUpdateProgress((p) => { updateProgress.value = p })
  try {
    downloadedPath.value = await downloadUpdate(updateInfo.value.download_url)
    updatePhase.value = 'ready'
  } catch (e: any) {
    const msg = typeof e === 'string' ? e : e?.message || ''
    if (msg.includes('__CANCELLED__')) {
      // 用户取消：删除临时文件后回到「可下载」状态
      updatePhase.value = 'available'
    } else {
      updateError.value = msg || '下载失败'
      updatePhase.value = 'available'
    }
  } finally {
    unlistenProgress?.()
    unlistenProgress = null
  }
}

const onCancelDownload = async () => {
  try {
    await cancelDownload()
  } catch {
    // Rust 侧中断时 invoke 可能随任务取消一起失败，忽略即可
  }
}

const doInstall = async () => {
  if (!downloadedPath.value) {
    // 没有本地安装包（异常情况），退回可下载状态
    updatePhase.value = 'available'
    return
  }
  updateError.value = ''
  try {
    await installUpdate(downloadedPath.value) // 内部会退出程序并唤起安装器
  } catch (e: any) {
    updateError.value = (typeof e === 'string' ? e : e?.message) || '安装失败'
    updatePhase.value = 'available'
  }
}

// 启动静默检查：有新版时仅提示文案与「下载更新」按钮，不自动下载
const silentCheckUpdate = async () => {
  if (!isTauri()) return
  try {
    const info = await checkUpdate()
    updateInfo.value = info
    if (info.has_update) {
      updatePhase.value = info.download_url ? 'available' : 'idle'
      // 每次运行只弹一次提醒：从管理后台返回前台会重新挂载本组件，
      // 但模块级标记保证 toast 不再重复
      if (!hasRemindedUpdate()) {
        markUpdateReminded()
        await showToast(`发现新版本 v${info.latest_version}，请到 设置-关于 下载更新`, '')
      }
    }
  } catch {
    // 静默失败不打扰用户
  }
}

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

  // 启动静默检查更新（后台执行，不阻塞首屏）
  void silentCheckUpdate()

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

  // 每次进入专家列表页都重新拉取：管理员可能已下架/上架名片，不能用缓存
  if (pageId === 'doctor') {
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

const onStartAiTest = () => {
  router.push('/tests/ai')
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
      content: '抱歉，我暂时遇到了一些问题，请稍后再试。'
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
/* 流式输出样式：全页唯一的"呼吸光"时刻 */
.streaming {
  animation: fadeIn 0.1s ease;
  box-shadow: 0 0 24px var(--glow);
}

.spin {
  animation: spin 1.2s linear infinite;
  vertical-align: -0.15em;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--accent);
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-export:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.app-wrap {
  display: flex;
  width: 100vw;
  height: calc(100vh - var(--titlebar-h));
  overflow: hidden !important;
  box-sizing: border-box;
}

.left-sidebar {
  width: 232px;
  min-width: 232px;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
  box-sizing: border-box;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 6px 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text h2 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.logo-text p {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.menu-list button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  border-radius: var(--radius-ctl);
  background: transparent;
  text-align: left;
  font-size: 13.5px;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.menu-list button:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.menu-list button.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.footer-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
}

.footer-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.footer-avatar-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.footer-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.btn-logout {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-muted);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s var(--ease-out);
}

.btn-logout:hover {
  background: var(--accent-soft);
  color: var(--danger);
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
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 24px;
  box-shadow: var(--shadow-sm);
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
  color: var(--warning);
}

.expert-stats .data-item:nth-child(2) .num {
  color: var(--success);
}

.expert-stats .data-item:nth-child(3) .num {
  color: var(--danger);
}

.expert-stats .data-item:nth-child(4) .num {
  color: var(--accent);
}

/* 管理员统计样式 */
.admin-stats .data-item .num {
  color: var(--accent);
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
  box-sizing: border-box;
  flex-shrink: 0;
}

/* 仅报告生成区保留预留高度（滚动容器内），其余加载态自然收拢 */
.scroll-content .loading-text {
  min-height: 132px;
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
  background: transparent;
  border-radius: 12px;
  padding: 8px 4px 12px;
  margin-bottom: 12px;
  min-height: 0;
  box-sizing: border-box;
}

.msg-item {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.msg-item:has(.msg-user) {
  justify-content: flex-end;
}

.msg-ai {
  max-width: 68%;
  padding: 10px 14px;
  background: var(--msg-ai-bg);
  border-radius: 14px 14px 14px 4px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

.msg-user {
  max-width: 68%;
  padding: 10px 14px;
  background: var(--msg-user-bg);
  border-radius: 14px 14px 4px 14px;
  font-size: 14px;
  line-height: 1.6;
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
  border-radius: var(--radius-ctl);
  outline: none;
  font-size: 14px;
  height: 100%;
  background: var(--input-bg);
  color: var(--text-primary);
  box-sizing: border-box;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.input-row input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.input-row input:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.btn-send-chat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 22px;
  border: none;
  border-radius: var(--radius-ctl);
  background: var(--accent);
  color: var(--on-accent);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  height: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
}

.btn-send-chat:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-send-chat:disabled {
  opacity: 0.55;
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
  border-color: var(--accent);
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
  display: flex;
  flex-direction: column;
}

.doc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border-color);
}

.doc-row:last-child {
  border-bottom: none;
}

.doc-info h4 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
}

.doc-info p {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0;
}

.doc-side {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.online-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  transition: color 0.3s;
}

.online-badge.online {
  color: var(--success);
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

.btn-book {
  border: none;
  padding: 8px 14px;
  background: var(--accent);
  color: var(--on-accent);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
}

.btn-book:hover {
  background: var(--accent-strong);
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
  border-radius: var(--radius-ctl);
  font-size: 13px;
  background: var(--input-bg);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.time-select input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.time-select button {
  padding: 8px 16px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
}

.time-select button:hover:not(:disabled) {
  background: var(--accent-strong);
}

.time-select button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.report-empty {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  gap: 4px;
}

.report-empty-mark {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  box-shadow: 0 0 28px var(--glow);
}

.report-empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.report-empty-sub {
  margin: 0;
  max-width: 340px;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.report-result {
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  line-height: 1.7;
  font-size: 13.5px;
  color: var(--text-primary);
}

/* ===== 个人中心/设置页：分组卡片布局 ===== */
.settings-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  max-width: 720px;
  /* 弹性列布局中让固定最大宽度的内容列水平居中，不再贴左 */
  margin: 0 auto;
  padding: 18px 22px 32px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.settings-page::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

/* ===== 用户信息头部卡片（可点击编辑） ===== */
.settings-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 18px 20px;
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 0.2s var(--ease-out);
}

.settings-profile:hover {
  border-color: var(--border-strong);
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
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
  color: var(--accent);
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
  display: inline-flex;
  color: var(--text-muted);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.settings-profile:hover .edit-icon {
  opacity: 1;
}

/* ===== 统计 ===== */
.user-data-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 18px;
}

.data-item {
  background: var(--input-bg);
  padding: 12px;
  border-radius: 12px;
  text-align: center;
}

.data-item .num {
  font-size: 20px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.data-item .text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ===== 设置分组卡片 ===== */
.settings-group {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  flex-shrink: 0;
}

.settings-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 18px 11px;
  border-bottom: 1px solid var(--border-color);
}

.settings-group-head svg {
  color: var(--accent);
}

.settings-group-head h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-primary);
}

/* 条目自带左右内边距：hover 高亮铺满整行，不再出现贴文字的残缺色块 */
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background: var(--accent-soft);
}

/* 悬浮时条目标题同步染上琥珀色，形成明确的方向感 */
.setting-item:hover .setting-item-left span:first-child {
  color: var(--accent);
}

.setting-item-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-item-left span:first-child {
  font-size: 14px;
  color: var(--text-primary);
  transition: color 0.15s var(--ease-out);
}

.setting-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.setting-item-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 检查更新按钮 */
.btn-check-update {
  padding: 6px 14px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-check-update:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.btn-check-update:disabled {
  opacity: 0.6;
  cursor: default;
}

/* 下载就绪态：主色高亮，明确可点击 */
.btn-check-update.btn-install-ready {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.btn-check-update.btn-install-ready:hover:not(:disabled) {
  background: var(--accent-hover, var(--accent));
  color: #fff;
  opacity: 0.9;
}

/* 下载进度条 */
.update-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  max-width: 340px;
}

.update-progress-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.2s ease;
}

.update-progress-text {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.btn-cancel-download {
  padding: 2px 10px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-cancel-download:hover {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}

.setting-select {
  padding: 6px 12px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.setting-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.theme-options {
  display: flex;
  gap: 8px;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  white-space: nowrap;
}

.theme-option:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.theme-option.selected {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  background: var(--border-strong);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

.toggle-switch.active {
  background: var(--accent);
}

.toggle-knob {
  width: 20px;
  height: 20px;
  background: var(--on-accent);
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
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
}

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
    width: 190px;
    min-width: 190px;
  }

  .card {
    max-width: 100%;
  }
}

@media (max-width: 700px) {
  .left-sidebar {
    width: 60px;
    min-width: 60px;
    padding: 16px 8px;
  }

  .logo-text {
    display: none;
  }

  .logo-box {
    justify-content: center;
    margin-left: 0;
    margin-right: 0;
  }

  .footer-name,
  .btn-logout {
    display: none;
  }

  .footer-user {
    justify-content: center;
  }

  .menu-list button {
    padding: 10px;
    justify-content: center;
  }

  .menu-list button .menu-text {
    display: none;
  }

  .doc-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .user-data-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
