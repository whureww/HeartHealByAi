<template>
  <div class="page-container">
    <!-- 页头 -->
    <div class="page-header">
      <div class="ph-left">
        <div class="ph-icon">
          <AppIcon name="shield" :size="20" />
        </div>
        <div>
          <h2>{{ $t('admin.report.title') }}</h2>
          <p class="subtitle">{{ $t('admin.report.subtitle') }}</p>
        </div>
      </div>
      <button class="btn-refresh" :disabled="loading" @click="load">
        <AppIcon name="refresh" :size="14" :class="{ spinning: loading }" />
        {{ $t('admin.report.refresh') }}
      </button>
    </div>

    <!-- 概览卡片 -->
    <div class="stat-row">
      <button
        v-for="s in statCards"
        :key="s.key"
        :class="['stat-card', `stat-${s.key}`, { clickable: true, active: filterStatus === s.value }]"
        @click="switchTab(s.value)"
      >
        <div class="stat-icon">
          <AppIcon :name="s.icon" :size="17" />
          <span v-if="s.key === 'pending' && stats.pending > 0" class="stat-pulse"></span>
        </div>
        <div class="stat-info">
          <b>{{ s.count }}</b>
          <span>{{ $t(s.labelKey) }}</span>
        </div>
      </button>
    </div>

    <!-- 列表卡片 -->
    <div class="list-card">
      <div class="list-toolbar">
        <div class="tab-group">
          <button
            v-for="t in TABS"
            :key="t.value"
            :class="['tab-btn', { active: filterStatus === t.value }]"
            @click="switchTab(t.value)"
          >
            {{ $t(t.labelKey) }}
            <span v-if="t.value === '0' && stats.pending > 0" class="tab-badge">{{ stats.pending }}</span>
          </button>
        </div>
        <div class="toolbar-right">
          <div class="search-wrap">
            <AppIcon name="search" :size="14" class="search-icon" />
            <input
              v-model="keyword"
              :placeholder="$t('admin.report.searchPlaceholder')"
              class="search-input"
            />
          </div>
          <span class="count-tip">{{ $t('admin.report.countTip', { n: filtered.length }) }}</span>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 64px">{{ $t('admin.report.th.id') }}</th>
            <th>{{ $t('admin.report.th.parties') }}</th>
            <th style="width: 110px">{{ $t('admin.report.th.reason') }}</th>
            <th>{{ $t('admin.report.th.message') }}</th>
            <th style="width: 150px">{{ $t('admin.report.th.time') }}</th>
            <th style="width: 96px">{{ $t('admin.report.th.status') }}</th>
            <th style="width: 150px">{{ $t('admin.report.th.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in filtered" :key="r.id">
            <tr :class="{ 'row-open': openId === r.id }" @click="toggleOpen(r)">
              <td class="id-cell">#{{ r.id }}</td>
              <td>
                <div class="party-cell">
                  <div class="party">
                    <span class="avatar">{{ initial(r.reporter_name) }}</span>
                    <span class="party-name">{{ r.reporter_name }}</span>
                  </div>
                  <AppIcon name="chevronRight" :size="13" class="party-arrow" />
                  <div class="party">
                    <span :class="['avatar', { restricted: isActiveRestricted(r) }]">{{ initial(r.reported_name) }}</span>
                    <span class="party-name">{{ r.reported_name }}</span>
                    <span
                      v-if="isActiveRestricted(r)"
                      :class="['mini-tag', r.reported_status === 2 ? 'tag-ban' : 'tag-mute']"
                    >
                      {{ restrictLabel(r) }}
                    </span>
                  </div>
                </div>
              </td>
              <td><span :class="['reason-tag', reasonClass(r.reason)]">{{ r.reason }}</span></td>
              <td class="msg-cell">
                <div class="msg-preview">
                  <AppIcon name="chat" :size="13" class="msg-icon" />
                  <span class="msg-text">{{ firstContent(r) }}</span>
                </div>
              </td>
              <td class="date-cell">{{ formatDate(r.created_at) }}</td>
              <td>
                <span :class="['status-pill', `pill-${r.status}`]">
                  <span class="pill-dot"></span>
                  {{ statusText(r.status) }}
                </span>
              </td>
              <td @click.stop>
                <button v-if="r.status === 0" class="btn-handle" @click="toggleOpen(r)">
                  <AppIcon name="warning" :size="13" />
                  {{ $t('admin.report.handle') }}
                </button>
                <button
                  v-if="r.status !== 0 && isActiveRestricted(r)"
                  class="btn-lift"
                  :title="$t('admin.report.liftTitle')"
                  @click="lift(r)"
                >
                  <AppIcon name="check" :size="13" />
                  {{ $t('admin.report.lift') }}
                </button>
                <span v-if="r.status !== 0 && !isActiveRestricted(r)" class="handled-note" :title="r.handle_note">
                  {{ r.handle_note || $t('admin.report.noNote') }}
                </span>
              </td>
            </tr>

            <!-- 展开行：证据 + 处置 -->
            <tr v-if="openId === r.id" class="expand-row">
              <td colspan="7" class="expand-cell">
                <div class="expand-inner">
                  <!-- 左：举报证据 -->
                  <div class="evidence-panel">
                    <div class="panel-title">
                      <AppIcon name="chat" :size="14" />
                      {{ $t('admin.report.reportedMessages') }}
                      <span class="panel-sub">{{ $t('admin.report.senderInfo', { name: r.reported_name, count: r.messages?.length || 0 }) }}</span>
                    </div>
                    <div class="bubble-list">
                      <div v-for="m in r.messages" :key="m.id" class="bubble-item">
                        <span class="avatar sm">{{ initial(r.reported_name) }}</span>
                        <div class="bubble-body">
                          <div class="bubble-meta">{{ formatDate(m.created_at) }}</div>
                          <div class="bubble">{{ m.content }}</div>
                        </div>
                      </div>
                      <div v-if="!r.messages?.length" class="bubble-empty">{{ $t('admin.report.msgMissing') }}</div>
                    </div>
                    <div v-if="r.detail" class="detail-block">
                      <div class="detail-label">
                        <AppIcon name="info" :size="13" />
                        {{ $t('admin.report.reporterNote') }}
                      </div>
                      <p class="detail-text">{{ r.detail }}</p>
                    </div>
                  </div>

                  <!-- 右：处置面板 / 处置结果 -->
                  <div class="action-panel">
                    <template v-if="r.status === 0">
                      <div class="panel-title">
                        <AppIcon name="warning" :size="14" />
                        {{ $t('admin.report.handleAction') }}
                      </div>
                      <div class="action-cards">
                        <button
                          v-for="a in ACTIONS"
                          :key="a.value"
                          :class="['action-card', `ac-${a.value}`, { selected: form.action === a.value }]"
                          @click="form.action = a.value"
                        >
                          <AppIcon :name="a.icon" :size="16" />
                          <b>{{ $t(a.labelKey) }}</b>
                          <span>{{ $t(a.descKey) }}</span>
                        </button>
                      </div>
                      <div v-if="form.action !== 'dismiss'" class="duration-block">
                        <span class="duration-label">{{ $t('admin.report.durationLabel') }}</span>
                        <div class="duration-pills">
                          <button
                            v-for="d in DURATIONS"
                            :key="d.value"
                            :class="['duration-pill', { selected: form.duration === d.value }]"
                            @click="form.duration = d.value"
                          >
                            {{ $t(d.labelKey) }}
                          </button>
                        </div>
                        <p class="duration-tip">
                          {{ form.action === 'ban' ? $t('admin.report.tipBan') : $t('admin.report.tipMute') }}
                        </p>
                      </div>
                      <textarea
                        v-model="form.note"
                        class="note-input"
                        rows="2"
                        :placeholder="form.action === 'dismiss' ? $t('admin.report.phDismissNote') : $t('admin.report.phNote')"
                        maxlength="255"
                      ></textarea>
                      <div class="action-foot">
                        <button class="btn-ghost" @click="toggleOpen(r)">{{ $t('admin.report.collapse') }}</button>
                        <button class="btn-primary" :disabled="handling" @click="submitHandle(r)">
                          {{ handling ? $t('admin.report.submitting') : $t('admin.report.confirmHandle') }}
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <div class="panel-title">
                        <AppIcon :name="r.status === 1 ? 'check' : 'close'" :size="14" />
                        {{ $t('admin.report.result') }}
                      </div>
                      <div :class="['result-block', r.status === 1 ? 'result-handled' : 'result-dismiss']">
                        <b>{{ statusText(r.status) }}</b>
                        <p>{{ r.handle_note || $t('admin.report.noHandleNote') }}</p>
                        <span v-if="r.handled_at" class="result-time">{{ formatDate(r.handled_at) }}</span>
                      </div>
                      <div v-if="isActiveRestricted(r)" class="lift-block">
                        <p class="lift-tip">{{ $t('admin.report.liftTip') }}</p>
                        <button class="btn-lift full" @click="lift(r)">
                          <AppIcon name="check" :size="13" />
                          {{ $t('admin.report.lift') }}
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <tr v-if="filtered.length === 0">
            <td colspan="7" class="empty-cell">
              <AppIcon name="shield" :size="30" />
              <p>{{ loading ? $t('admin.report.loading') : keyword ? $t('admin.report.emptyFiltered') : $t('admin.report.empty') }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getReports, handleReport, unrestrictUser } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()

const TABS = [
  { labelKey: 'admin.report.statPending', value: '0' },
  { labelKey: 'admin.report.statHandled', value: '1' },
  { labelKey: 'admin.report.statDismissed', value: '2' },
  { labelKey: 'admin.report.tabAll', value: '' }
]
const ACTIONS = [
  { labelKey: 'admin.report.actMute', value: 'mute', icon: 'chat', descKey: 'admin.report.actMuteDesc' },
  { labelKey: 'admin.report.actBan', value: 'ban', icon: 'lock', descKey: 'admin.report.actBanDesc' },
  { labelKey: 'admin.report.actDismiss', value: 'dismiss', icon: 'close', descKey: 'admin.report.actDismissDesc' }
]
const DURATIONS = [
  { labelKey: 'admin.report.dur24h', value: '24h' },
  { labelKey: 'admin.report.dur72h', value: '72h' },
  { labelKey: 'admin.report.dur7d', value: '7d' },
  { labelKey: 'admin.report.durPermanent', value: 'permanent' }
]

const reports = ref<any[]>([])
const loading = ref(false)
const filterStatus = ref('0')
const keyword = ref('')
const openId = ref<number | null>(null)
const handling = ref(false)
const form = ref({ action: 'mute', duration: '24h', note: '' })

// 一次拉全量，本地过滤——保证各页签角标统计准确
const stats = computed(() => {
  const s = { pending: 0, handled: 0, dismissed: 0, total: reports.value.length }
  for (const r of reports.value) {
    if (Number(r.status) === 0) s.pending++
    else if (Number(r.status) === 1) s.handled++
    else s.dismissed++
  }
  return s
})

const statCards = computed(() => [
  { key: 'pending', labelKey: 'admin.report.statPending', icon: 'warning', count: stats.value.pending, value: '0' },
  { key: 'handled', labelKey: 'admin.report.statHandled', icon: 'check', count: stats.value.handled, value: '1' },
  { key: 'dismissed', labelKey: 'admin.report.statDismissed', icon: 'close', count: stats.value.dismissed, value: '2' },
  { key: 'total', labelKey: 'admin.report.statTotal', icon: 'list', count: stats.value.total, value: '' }
])

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return reports.value.filter((r) => {
    if (filterStatus.value && String(r.status) !== filterStatus.value) return false
    if (!kw) return true
    const haystack = [r.reporter_name, r.reported_name, r.reason, r.detail, ...(r.messages || []).map((m: any) => m.content)]
      .join(' ')
      .toLowerCase()
    return haystack.includes(kw)
  })
})

const statusText = (s: number) =>
  ({ 0: t('admin.report.statPending'), 1: t('admin.report.statHandled'), 2: t('admin.report.statDismissed') } as Record<number, string>)[Number(s)] || t('admin.report.unknown')

// 理由标签按类别着色
function reasonClass(reason: string): string {
  if (reason?.includes('辱骂') || reason?.includes('攻击')) return 'reason-danger'
  if (reason?.includes('骚扰')) return 'reason-warning'
  if (reason?.includes('广告') || reason?.includes('推销')) return 'reason-info'
  if (reason?.includes('色情') || reason?.includes('低俗')) return 'reason-pink'
  return 'reason-default'
}

// 被举报账号当前限制状态（含到期判断）：none 正常 / mute 禁言 / ban 封禁
function restrictionCode(r: any): 'none' | 'mute' | 'ban' {
  const status = Number(r.reported_status || 0)
  if (status !== 1 && status !== 2) return 'none'
  if (r.reported_restricted_until && new Date(r.reported_restricted_until).getTime() <= Date.now()) return 'none'
  return status === 2 ? 'ban' : 'mute'
}
function restrictLabel(r: any): string {
  const code = restrictionCode(r)
  return code === 'ban' ? t('admin.report.banned') : code === 'mute' ? t('admin.report.muted') : t('admin.report.normal')
}
function isActiveRestricted(r: any): boolean {
  return restrictionCode(r) !== 'none'
}

function initial(name: string): string {
  return String(name || '?').trim().charAt(0).toUpperCase() || '?'
}

function firstContent(r: any): string {
  const m = r.messages?.[0]
  if (!m) return t('admin.report.msgMissingShort')
  const text = String(m.content || '').replace(/\s+/g, ' ').trim()
  const brief = text.length > 36 ? text.slice(0, 36) + '…' : text
  return (r.messages.length > 1 ? t('admin.report.msgCount', { n: r.messages.length }) : '') + brief
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
    const res = await getReports('') as any
    reports.value = res?.data || []
  } catch (e: any) {
    error(e?.response?.data?.message || t('admin.report.loadFailed'))
  } finally {
    loading.value = false
  }
}

function switchTab(v: string) {
  filterStatus.value = v
  openId.value = null
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
  const actionDef = ACTIONS.find((a) => a.value === form.value.action)
  const actionLabel = actionDef ? t(actionDef.labelKey) : ''
  const durRaw = form.value.duration === 'permanent' ? t('admin.report.durPermanent') : form.value.duration
  const durText = form.value.action === 'dismiss' ? '' : t('admin.report.durSuffix', { dur: durRaw })
  const ok = await confirm(
    t('admin.report.confirmHandleMsg', { name: r.reported_name, action: actionLabel, duration: durText }),
    t('admin.report.confirmHandle')
  )
  if (!ok) return
  handling.value = true
  try {
    const res = await handleReport(r.id, {
      action: form.value.action,
      duration: form.value.action === 'dismiss' ? undefined : form.value.duration,
      note: form.value.note
    }) as any
    success(res?.message || t('admin.report.handled'))
    openId.value = null
    await load()
  } catch (e: any) {
    error(e?.response?.data?.message || t('admin.report.handleFailed'))
  } finally {
    handling.value = false
  }
}

async function lift(r: any) {
  const ok = await confirm(t('admin.report.confirmLift', { name: r.reported_name }), t('admin.report.lift'))
  if (!ok) return
  try {
    await unrestrictUser(r.reported_id)
    success(t('admin.report.lifted'))
    await load()
  } catch (e: any) {
    error(e?.response?.data?.message || t('admin.report.liftFailed'))
  }
}

onMounted(load)
</script>

<style scoped>
.page-container {
  max-width: 1200px;
}

/* ----- 页头 ----- */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0 18px;
}

.ph-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ph-icon {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.subtitle {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: var(--text-muted);
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.18s var(--ease-out);
}

.btn-refresh:hover:not(:disabled) {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

.btn-refresh:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ----- 概览卡片 ----- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s var(--ease-out);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-card.active {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 3px var(--accent-soft), var(--shadow-sm);
}

.stat-icon {
  position: relative;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-pending .stat-icon {
  background: color-mix(in srgb, var(--danger) 13%, transparent);
  color: var(--danger);
}

.stat-handled .stat-icon {
  background: color-mix(in srgb, var(--success) 13%, transparent);
  color: var(--success);
}

.stat-dismissed .stat-icon {
  background: color-mix(in srgb, var(--info) 13%, transparent);
  color: var(--info);
}

.stat-total .stat-icon {
  background: var(--accent-soft);
  color: var(--accent);
}

.stat-pulse {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  animation: pulse 1.6s ease-out infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 45%, transparent); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

.stat-info {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.stat-info b {
  font-size: 21px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-info span {
  font-size: 12px;
  color: var(--text-muted);
}

/* ----- 列表卡片 ----- */
.list-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 13px 18px;
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-sidebar) 45%, transparent);
}

.tab-group {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-ctl);
  background: color-mix(in srgb, var(--bg-primary) 60%, transparent);
}

.tab-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.16s var(--ease-out);
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--card-bg);
  color: var(--accent);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.tab-badge {
  min-width: 17px;
  height: 17px;
  line-height: 17px;
  border-radius: 9px;
  background: var(--danger);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  text-align: center;
  padding: 0 4px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 220px;
  padding: 7px 12px 7px 30px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 12.5px;
  outline: none;
  transition: border-color 0.2s var(--ease-out);
}

.search-input:focus {
  border-color: var(--accent);
  width: 250px;
}

.count-tip {
  font-size: 12.5px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ----- 表格 ----- */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  padding: 11px 16px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: middle;
}

.data-table tbody tr:not(.expand-row) {
  cursor: pointer;
  transition: background 0.15s var(--ease-out);
}

.data-table tbody tr:not(.expand-row):hover {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.row-open {
  background: color-mix(in srgb, var(--accent) 5%, transparent) !important;
}

.id-cell {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
}

/* 当事双方 */
.party-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 230px;
}

.party {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.party-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 88px;
}

.party-arrow {
  flex: none;
  color: var(--text-muted);
}

.avatar {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  box-shadow: var(--shadow-sm);
}

.avatar.sm {
  width: 24px;
  height: 24px;
  font-size: 11px;
}

.avatar.restricted {
  background: linear-gradient(135deg, var(--danger), color-mix(in srgb, var(--danger) 70%, #000));
}

.mini-tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.tag-ban {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.tag-mute {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  color: var(--warning);
}

/* 理由标签 */
.reason-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.reason-danger {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.reason-warning {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  color: var(--warning);
}

.reason-info {
  background: color-mix(in srgb, var(--info) 14%, transparent);
  color: var(--info);
}

.reason-pink {
  background: color-mix(in srgb, #c2649a 14%, transparent);
  color: #c2649a;
}

.reason-default {
  background: var(--accent-soft);
  color: var(--accent);
}

/* 消息预览 */
.msg-cell {
  max-width: 280px;
}

.msg-preview {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.msg-icon {
  flex: none;
  color: var(--text-muted);
}

.msg-text {
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-cell {
  color: var(--text-muted);
  font-size: 12.5px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* 状态胶囊 */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3.5px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.pill-0 {
  background: color-mix(in srgb, var(--danger) 13%, transparent);
  color: var(--danger);
}

.pill-1 {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.pill-2 {
  background: color-mix(in srgb, var(--info) 13%, transparent);
  color: var(--info);
}

/* 操作 */
.btn-handle,
.btn-lift {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 13px;
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  transition: all 0.16s var(--ease-out);
}

.btn-handle {
  background: var(--accent);
  color: var(--on-accent);
  box-shadow: var(--shadow-sm);
}

.btn-handle:hover {
  background: var(--accent-strong);
  transform: translateY(-1px);
}

.btn-lift {
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  color: var(--accent);
}

.btn-lift:hover {
  background: var(--accent-soft);
}

.btn-lift.full {
  width: 100%;
  justify-content: center;
  padding: 8px 13px;
}

.handled-note {
  font-size: 12px;
  color: var(--text-muted);
  display: inline-block;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

/* ----- 展开区 ----- */
.expand-row td {
  padding: 0 !important;
}

.expand-inner {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 16px;
  padding: 16px 18px;
  background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
  border-bottom: 1px solid var(--border-color);
  animation: expandIn 0.22s var(--ease-out);
}

@keyframes expandIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.evidence-panel,
.action-panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.panel-title svg {
  color: var(--accent);
}

.panel-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
  margin-left: 2px;
}

/* 消息气泡 */
.bubble-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}

.bubble-item {
  display: flex;
  gap: 9px;
}

.bubble-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.bubble-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.bubble {
  padding: 8px 12px;
  border-radius: 4px 12px 12px 12px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 12.5px;
  line-height: 1.55;
  word-break: break-all;
  width: fit-content;
  max-width: 100%;
}

.bubble-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  padding: 8px 0;
}

/* 补充说明 */
.detail-block {
  border-top: 1px dashed var(--border-color);
  padding-top: 10px;
}

.detail-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.detail-text {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 处置操作卡片 */
.action-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 11px 6px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  cursor: pointer;
  transition: all 0.16s var(--ease-out);
  color: var(--text-secondary);
}

.action-card svg {
  color: var(--text-muted);
}

.action-card b {
  font-size: 13px;
  color: var(--text-primary);
}

.action-card span {
  font-size: 10.5px;
  color: var(--text-muted);
}

.action-card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.action-card.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.action-card.selected svg,
.action-card.selected b {
  color: var(--accent);
}

.action-card.ac-ban.selected {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 9%, transparent);
}

.action-card.ac-ban.selected svg,
.action-card.ac-ban.selected b {
  color: var(--danger);
}

/* 时长选择 */
.duration-block {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.duration-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.duration-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.duration-pill {
  padding: 5.5px 13px;
  border: 1.5px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s var(--ease-out);
}

.duration-pill:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.duration-pill.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.duration-tip {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

/* 备注 */
.note-input {
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: var(--font-ui);
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.2s var(--ease-out);
}

.note-input:focus {
  border-color: var(--accent);
}

.action-foot {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: auto;
}

.btn-ghost {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s var(--ease-out);
}

.btn-ghost:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.btn-primary {
  padding: 8px 18px;
  border: none;
  border-radius: var(--radius-ctl);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.16s var(--ease-out);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 处置结果 */
.result-block {
  padding: 12px 14px;
  border-radius: var(--radius-ctl);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.result-handled {
  background: color-mix(in srgb, var(--success) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
}

.result-handled b {
  color: var(--success);
  font-size: 13px;
}

.result-dismiss {
  background: color-mix(in srgb, var(--info) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 25%, transparent);
}

.result-dismiss b {
  color: var(--info);
  font-size: 13px;
}

.result-block p {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  word-break: break-all;
}

.result-time {
  font-size: 11.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.lift-block {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lift-tip {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* 空状态 */
.empty-cell {
  padding: 48px 16px !important;
  text-align: center;
  color: var(--text-muted);
  cursor: default !important;
}

.empty-cell svg {
  opacity: 0.4;
  margin-bottom: 8px;
}

.empty-cell p {
  margin: 0;
  font-size: 13px;
}
</style>
