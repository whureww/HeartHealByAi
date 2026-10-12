<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>举报管理</h2>
        <p class="subtitle">聊天举报核查与处置，禁言/封禁实时生效（封禁立即踢下线，禁言即时拦截发言）</p>
      </div>
      <button class="btn-refresh" @click="load">刷新</button>
    </div>

    <div class="filter-card">
      <div class="tab-group">
        <button
          v-for="t in TABS"
          :key="t.value"
          :class="['tab-btn', { active: filterStatus === t.value }]"
          @click="switchTab(t.value)"
        >
          {{ t.label }}
          <span v-if="t.value === '0' && pendingCount > 0" class="tab-badge">{{ pendingCount }}</span>
        </button>
      </div>
      <span class="count-tip">共 {{ reports.length }} 条</span>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 60px">编号</th>
            <th>举报人</th>
            <th>被举报人</th>
            <th>理由</th>
            <th>被举报消息</th>
            <th>举报时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in reports" :key="r.id">
            <tr :class="{ 'row-open': openId === r.id }">
              <td>{{ r.id }}</td>
              <td>{{ r.reporter_name }}</td>
              <td>
                <span class="reported-name">{{ r.reported_name }}</span>
                <span v-if="restrictLabel(r) !== '正常'" :class="['status-tag', r.reported_status === 2 ? 'cat-c0' : 'cat-c4']">
                  {{ restrictLabel(r) }}
                </span>
              </td>
              <td><span class="status-tag cat-c1">{{ r.reason }}</span></td>
              <td class="msg-cell" :title="firstContent(r)">
                {{ firstContent(r) }}
              </td>
              <td class="date-cell">{{ formatDate(r.created_at) }}</td>
              <td>
                <span :class="['status-tag', statusClass(r.status)]">{{ statusText(r.status) }}</span>
              </td>
              <td>
                <button v-if="r.status === 0" class="btn-approve" @click="toggleOpen(r)">处置</button>
                <button
                  v-if="r.status !== 0 && isActiveRestricted(r)"
                  class="btn-unrestrict"
                  @click="lift(r)"
                >
                  解除限制
                </button>
                <span v-if="r.status !== 0 && !isActiveRestricted(r)" class="handled-note">{{ r.handle_note || '-' }}</span>
              </td>
            </tr>
            <!-- 展开行：被举报消息全文 + 处置面板 -->
            <tr v-if="openId === r.id">
              <td colspan="8" class="expand-cell">
                <div class="expand-inner">
                  <div class="msg-list-title">
                    被举报的消息（{{ r.messages?.length || 0 }} 条，发送者：{{ r.reported_name }}）
                  </div>
                  <div class="reported-msgs">
                    <div v-for="m in r.messages" :key="m.id" class="reported-msg">
                      <span class="rm-time">{{ formatDate(m.created_at) }}</span>
                      <span class="rm-content">{{ m.content }}</span>
                    </div>
                    <div v-if="!r.messages?.length" class="rm-empty">消息内容缺失（可能已被删除）</div>
                  </div>
                  <div v-if="r.detail" class="report-detail-text">
                    <b>举报补充说明：</b>{{ r.detail }}
                  </div>

                  <div v-if="r.status === 0" class="handle-panel">
                    <div class="hp-row">
                      <label v-for="a in ACTIONS" :key="a.value" class="hp-radio">
                        <input type="radio" :value="a.value" v-model="form.action" />
                        <span>{{ a.label }}</span>
                      </label>
                    </div>
                    <div v-if="form.action !== 'dismiss'" class="hp-row">
                      <span class="hp-label">时长：</span>
                      <select v-model="form.duration" class="cat-select">
                        <option value="24h">24 小时</option>
                        <option value="72h">72 小时</option>
                        <option value="7d">7 天</option>
                        <option value="permanent">永久</option>
                      </select>
                      <span class="hp-tip">{{ form.action === 'ban' ? '封禁期间该账号无法登录' : '禁言期间该账号无法发送消息' }}</span>
                    </div>
                    <input
                      v-model="form.note"
                      class="hp-note"
                      :placeholder="form.action === 'dismiss' ? '驳回备注（选填）' : '处理备注（选填）'"
                      maxlength="255"
                    />
                    <div class="hp-row">
                      <button class="btn-reject" @click="toggleOpen(r)">收起</button>
                      <button class="btn-approve" :disabled="handling" @click="submitHandle(r)">
                        {{ handling ? '提交中...' : '确认处置' }}
                      </button>
                    </div>
                  </div>
                  <div v-else class="handle-done">
                    <b>{{ statusText(r.status) }}：</b>{{ r.handle_note || '-' }}
                    <span v-if="r.handled_at" class="date-cell">（{{ formatDate(r.handled_at) }}）</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="reports.length === 0">
            <td colspan="8" class="empty-cell">
              <AppIcon name="shield" :size="28" />
              <p>{{ loading ? '加载中...' : '暂无举报记录' }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getReports, handleReport, unrestrictUser } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const TABS = [
  { label: '待处理', value: '0' },
  { label: '已处置', value: '1' },
  { label: '已驳回', value: '2' },
  { label: '全部', value: '' }
]
const ACTIONS = [
  { label: '禁言', value: 'mute' },
  { label: '封禁', value: 'ban' },
  { label: '驳回', value: 'dismiss' }
]

const reports = ref<any[]>([])
const loading = ref(false)
const filterStatus = ref('0')
const openId = ref<number | null>(null)
const handling = ref(false)
const form = ref({ action: 'mute', duration: '24h', note: '' })

const pendingCount = computed(() => reports.value.filter((r) => Number(r.status) === 0).length)

const statusText = (s: number) => ({ 0: '待处理', 1: '已处置', 2: '已驳回' })[Number(s)] || '未知'
const statusClass = (s: number) => ({ 0: 'cat-c4', 1: 'cat-c2', 2: 'cat-c3' })[Number(s)] || ''

// 被举报账号当前限制状态（含到期判断）
function restrictLabel(r: any): string {
  const status = Number(r.reported_status || 0)
  if (status !== 1 && status !== 2) return '正常'
  if (r.reported_restricted_until && new Date(r.reported_restricted_until).getTime() <= Date.now()) return '正常'
  return status === 2 ? '已封禁' : '禁言中'
}
function isActiveRestricted(r: any): boolean {
  return restrictLabel(r) !== '正常'
}

function firstContent(r: any): string {
  const m = r.messages?.[0]
  if (!m) return '（消息内容缺失）'
  const text = String(m.content || '').replace(/\s+/g, ' ').trim()
  const brief = text.length > 30 ? text.slice(0, 30) + '…' : text
  return (r.messages.length > 1 ? `[${r.messages.length}条] ` : '') + brief
}

function formatDate(d: string): string {
  if (!d) return '-'
  const dt = new Date(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

async function load() {
  loading.value = true
  try {
    const res = await getReports(filterStatus.value) as any
    reports.value = res?.data || []
  } catch (e: any) {
    error(e?.response?.data?.message || '加载举报列表失败')
  } finally {
    loading.value = false
  }
}

function switchTab(v: string) {
  filterStatus.value = v
  openId.value = null
  load()
}

function toggleOpen(r: any) {
  if (openId.value === r.id) {
    openId.value = null
    return
  }
  openId.value = r.id
  form.value = { action: 'mute', duration: '24h', note: '' }
}

async function submitHandle(r: any) {
  if (handling.value) return
  const actionLabel = ACTIONS.find((a) => a.value === form.value.action)?.label || ''
  const ok = await confirm(
    `确定对「${r.reported_name}」执行「${actionLabel}」${form.value.action !== 'dismiss' ? `（${form.value.duration === 'permanent' ? '永久' : form.value.duration}）` : ''}吗？处置实时生效。`,
    '确认处置'
  )
  if (!ok) return
  handling.value = true
  try {
    const res = await handleReport(r.id, {
      action: form.value.action,
      duration: form.value.action === 'dismiss' ? undefined : form.value.duration,
      note: form.value.note
    }) as any
    success(res?.message || '处置完成')
    openId.value = null
    load()
  } catch (e: any) {
    error(e?.response?.data?.message || '处置失败，请稍后重试')
  } finally {
    handling.value = false
  }
}

async function lift(r: any) {
  const ok = await confirm(`确定解除「${r.reported_name}」的禁言/封禁限制吗？`, '解除限制')
  if (!ok) return
  try {
    await unrestrictUser(r.reported_id)
    success('已解除该账号的限制')
    load()
  } catch (e: any) {
    error(e?.response?.data?.message || '解除失败，请稍后重试')
  }
}

onMounted(load)
</script>

<style scoped>
.btn-refresh {
  padding: 8px 18px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--card-bg);
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-refresh:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.tab-group {
  display: flex;
  gap: 6px;
}

.tab-btn {
  padding: 7px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.tab-badge {
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  border-radius: 9px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  text-align: center;
  padding: 0 4px;
}

.reported-name {
  margin-right: 6px;
}

.msg-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.handled-note {
  font-size: 12px;
  color: var(--text-muted);
}

.row-open {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.expand-cell {
  padding: 0 !important;
}

.expand-inner {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: color-mix(in srgb, var(--accent) 3%, transparent);
}

.msg-list-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.reported-msgs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--card-bg);
}

.reported-msg {
  display: flex;
  gap: 10px;
  font-size: 12.5px;
}

.rm-time {
  flex: none;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.rm-content {
  color: var(--text-primary);
  word-break: break-all;
}

.rm-empty {
  font-size: 12.5px;
  color: var(--text-muted);
}

.report-detail-text {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.handle-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-ctl);
}

.hp-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.hp-radio {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.hp-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.hp-tip {
  font-size: 12px;
  color: var(--text-muted);
}

.hp-note {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
}

.handle-done {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.btn-approve,
.btn-unrestrict {
  padding: 5px 14px;
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 12.5px;
}

.btn-approve {
  background: var(--accent);
  color: #fff;
}

.btn-approve:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-unrestrict {
  background: transparent;
  border: 1px solid var(--accent);
  color: var(--accent);
}
</style>
