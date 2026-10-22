<template>
  <div class="page-container">
    <!-- ===== 列表模式 ===== -->
    <template v-if="!detail">
      <div class="page-header">
        <div>
          <h2>{{ $t('admin.chats.title') }}</h2>
          <p class="subtitle">{{ $t('admin.chats.subtitle') }}</p>
        </div>
      </div>

      <div class="search-bar">
        <div class="search-input-wrap">
          <AppIcon name="search" :size="16" class="search-icon" />
          <input
            v-model="searchKeyword"
            :placeholder="$t('admin.chats.searchPlaceholder')"
            @keyup.enter="onSearch"
          />
        </div>
        <button class="btn-search" @click="onSearch">{{ $t('admin.chats.search') }}</button>
      </div>

      <div v-if="loading && !sessions.length" class="loading-row">
        <AppIcon name="spark" class="spin" /> {{ $t('admin.chats.loading') }}
      </div>

      <div class="table-card" v-else>
        <table class="data-table" :class="{ 'is-empty': sessions.length === 0 }">
          <thead>
            <tr>
              <th>ID</th>
              <th>{{ $t('admin.chats.th.user') }}</th>
              <th>{{ $t('admin.chats.th.email') }}</th>
              <th>{{ $t('admin.chats.th.title') }}</th>
              <th>{{ $t('admin.chats.th.messages') }}</th>
              <th>{{ $t('admin.chats.th.createdAt') }}</th>
              <th>{{ $t('admin.chats.th.lastTime') }}</th>
              <th>{{ $t('admin.chats.th.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sessions" :key="`${s.user_id}-${s.session_id}`">
              <td class="id-cell">#{{ s.user_id }}</td>
              <td>
                <div class="user-info">
                  <div class="avatar">{{ s.username?.[0]?.toUpperCase() }}</div>
                  <span>{{ s.username }}</span>
                </div>
              </td>
              <td>{{ s.email }}</td>
              <td class="title-cell" :title="s.title">{{ s.title || '-' }}</td>
              <td>{{ s.message_count }}</td>
              <td class="date-cell">{{ formatDate(s.created_at) }}</td>
              <td class="date-cell">{{ formatDate(s.last_time) }}</td>
              <td>
                <button class="btn-view" @click="openDetail(s)">
                  <AppIcon name="search" :size="14" />
                  {{ $t('admin.chats.view') }}
                </button>
              </td>
            </tr>
            <tr v-if="sessions.length === 0">
              <td colspan="8" class="empty-cell">
                <AppIcon name="chat" :size="28" />
                <p>{{ $t('admin.chats.empty') }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="sessions.length">
        <button :disabled="page <= 1" class="page-btn" @click="page--; loadSessions()">
          <AppIcon name="back" :size="14" />
          {{ $t('admin.chats.prevPage') }}
        </button>
        <span class="page-info">{{ page }} / {{ totalPages }}（{{ $t('admin.chats.countTip', { n: total }) }}）</span>
        <button :disabled="page >= totalPages" class="page-btn" @click="page++; loadSessions()">
          {{ $t('admin.chats.nextPage') }}
          <AppIcon name="chevronRight" :size="14" />
        </button>
      </div>
    </template>

    <!-- ===== 详情模式：会话全文 + 审查留痕 ===== -->
    <template v-else>
      <div class="page-header">
        <div>
          <h2>{{ $t('admin.chats.title') }}</h2>
          <p class="subtitle">
            {{ $t('admin.chats.createdBy', { time: formatFull(detail.session.created_at) }) }}
            · {{ $t('admin.chats.lastActive', { time: formatFull(detail.session.last_time) }) }}
          </p>
        </div>
        <button class="btn-back-list" @click="closeDetail">
          <AppIcon name="back" :size="14" />
          {{ $t('admin.chats.backToList') }}
        </button>
      </div>

      <!-- 会话归属信息 -->
      <div class="session-meta">
        <div class="user-info">
          <div class="avatar">{{ detail.session.username?.[0]?.toUpperCase() }}</div>
          <div class="meta-text">
            <span class="meta-name">{{ detail.session.username }}</span>
            <span class="meta-email">{{ detail.session.email }}</span>
          </div>
        </div>
        <div class="meta-right">
          <span class="meta-title" :title="detail.session.title">{{ detail.session.title || '-' }}</span>
          <span class="meta-count">{{ $t('admin.chats.msgCount', { n: detail.messages.length }) }}</span>
        </div>
      </div>

      <!-- 会话全文（透明化：角色 + 完整内容 + 逐条时间） -->
      <div class="transcript-card">
        <div
          v-for="msg in detail.messages"
          :key="msg.id"
          :class="['t-msg', msg.type === 'user' ? 't-user' : 't-ai']"
        >
          <div class="t-head">
            <span :class="['t-role', msg.type === 'user' ? 'role-user' : 'role-ai']">
              {{ msg.type === 'user' ? $t('admin.chats.me') : $t('admin.chats.ai') }}
            </span>
            <span class="t-time">{{ formatFull(msg.created_at) }}</span>
          </div>
          <div class="t-content">{{ msg.content }}</div>
        </div>
        <div v-if="detail.messages.length === 0" class="empty-cell transcript-empty">
          <AppIcon name="chat" :size="24" />
          <p>{{ $t('admin.chats.empty') }}</p>
        </div>
      </div>

      <!-- 审查留痕（可追溯：管理员查看行为全记录，含本次） -->
      <div class="audit-card">
        <h3>
          <AppIcon name="shield" :size="15" />
          {{ $t('admin.chats.auditTitle') }}
        </h3>
        <p class="audit-sub">{{ $t('admin.chats.auditSubtitle') }}</p>
        <table class="data-table" :class="{ 'is-empty': auditLogs.length === 0 }">
          <thead>
            <tr>
              <th>{{ $t('admin.chats.auditTh.admin') }}</th>
              <th>{{ $t('admin.chats.auditTh.target') }}</th>
              <th>{{ $t('admin.chats.auditTh.session') }}</th>
              <th>{{ $t('admin.chats.auditTh.time') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in auditLogs" :key="log.id">
              <td>{{ log.admin_name }}</td>
              <td>{{ log.target_name }}</td>
              <td class="session-id-cell">{{ log.session_id }}</td>
              <td class="date-cell">{{ formatFull(log.created_at) }}</td>
            </tr>
            <tr v-if="auditLogs.length === 0">
              <td colspan="4" class="empty-cell"><p>{{ $t('admin.chats.auditEmpty') }}</p></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAdminChats, getAdminChatDetail, getChatAuditLogs } from '@/api/admin'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()

const sessions = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const loading = ref(false)

const detail = ref<{ session: any; messages: any[] } | null>(null)
const auditLogs = ref<any[]>([])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const loadSessions = async () => {
  loading.value = true
  try {
    const res = await getAdminChats({ page: page.value, pageSize: pageSize.value, keyword: searchKeyword.value }) as any
    sessions.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  page.value = 1
  loadSessions()
}

// 查看会话全文：拉取消息 + 审查留痕（后端同时自动落一条本次查看的审计记录）
const openDetail = async (s: any) => {
  const res = await getAdminChatDetail(s.user_id, s.session_id) as any
  detail.value = { session: res.data.session, messages: res.data.messages }
  await loadAuditLogs()
}

const closeDetail = () => {
  detail.value = null
  auditLogs.value = []
}

const loadAuditLogs = async () => {
  try {
    const res = await getChatAuditLogs({ page: 1, pageSize: 50 }) as any
    auditLogs.value = res.data.list
  } catch {
    auditLogs.value = []
  }
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

const formatFull = (date: string) => {
  if (!date) return '-'
  const d = new Date(date)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(loadSessions)
</script>

<style scoped>
.page-container {
  max-width: 1080px;
}

.page-header {
  margin: 8px 0 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.btn-back-list {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-ui);
  transition: border-color 0.2s var(--ease-out);
}

.btn-back-list:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ===== 搜索 ===== */
.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
}

.search-input-wrap input {
  flex: 1;
  padding: 10px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font-ui);
}

.btn-search {
  padding: 9px 20px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13.5px;
  font-family: var(--font-ui);
  transition: background 0.2s var(--ease-out);
}

.btn-search:hover {
  background: var(--accent-strong);
}

.loading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--text-muted);
  font-size: 13px;
}

/* ===== 表格 ===== */
.table-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  padding: 12px 14px;
  color: var(--text-muted);
  font-weight: 500;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.id-cell {
  color: var(--text-muted);
  white-space: nowrap;
}

.title-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-cell {
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 12.5px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.btn-view {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 12.5px;
  font-family: var(--font-ui);
  white-space: nowrap;
  transition: background 0.2s var(--ease-out);
}

.btn-view:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.empty-cell {
  text-align: center;
  padding: 36px 14px !important;
  color: var(--text-muted);
}

.empty-cell p {
  margin: 8px 0 0;
  font-size: 13px;
}

/* ===== 分页 ===== */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 12.5px;
  font-family: var(--font-ui);
  transition: border-color 0.2s var(--ease-out);
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-info {
  color: var(--text-muted);
  font-size: 12.5px;
}

/* ===== 会话元信息 ===== */
.session-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  margin-bottom: 14px;
}

.meta-text {
  display: flex;
  flex-direction: column;
}

.meta-name {
  font-weight: 600;
  font-size: 13.5px;
}

.meta-email {
  color: var(--text-muted);
  font-size: 12px;
}

.meta-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 0;
}

.meta-title {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.meta-count {
  color: var(--text-muted);
  font-size: 12px;
}

/* ===== 会话全文 ===== */
.transcript-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 18px;
  margin-bottom: 14px;
  max-height: 52vh;
  overflow-y: auto;
}

.t-msg {
  margin-bottom: 14px;
}

.t-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.t-role {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}

.t-role.role-user {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

.t-role.role-ai {
  background: color-mix(in srgb, #52c41a 14%, transparent);
  color: #52c41a;
}

.t-time {
  color: var(--text-muted);
  font-size: 11.5px;
}

.t-content {
  padding: 10px 13px;
  border-radius: var(--radius-ctl);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  border: 1px solid var(--border-color);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
}

.t-ai .t-content {
  background: var(--input-bg);
}

.transcript-empty {
  padding: 28px 0 !important;
}

/* ===== 审查留痕 ===== */
.audit-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 16px 18px;
}

.audit-card h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 4px;
  font-size: 14.5px;
}

.audit-sub {
  margin: 0 0 12px;
  color: var(--text-muted);
  font-size: 12.5px;
}

.session-id-cell {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
