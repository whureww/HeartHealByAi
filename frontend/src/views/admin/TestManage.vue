<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>{{ $t('admin.test.title') }}</h2>
        <p class="subtitle">{{ $t('admin.test.subtitle') }}</p>
      </div>
      <button class="btn-primary" @click="$router.push('/admin/tests/edit')">
        <AppIcon name="plus" :size="15" />
        {{ $t('admin.test.create') }}
      </button>
    </div>

    <div class="filter-bar">
      <button
        v-for="tab in tabs"
        :key="tab.value ?? 'all'"
        :class="{ active: currentStatus === tab.value }"
        @click="currentStatus = tab.value; loadTests()"
      >
        {{ $t(tab.labelKey) }}
      </button>
    </div>

    <div class="table-card">
      <table class="data-table" :class="{ 'is-empty': tests.length === 0 }">
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ $t('admin.test.th.name') }}</th>
            <th>{{ $t('admin.test.th.category') }}</th>
            <th>{{ $t('admin.test.th.questions') }}</th>
            <th>{{ $t('admin.test.th.status') }}</th>
            <th>{{ $t('admin.test.th.createdAt') }}</th>
            <th>{{ $t('admin.test.th.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="test in tests" :key="test.id">
            <td class="id-cell">#{{ test.id }}</td>
            <td>
              <div class="test-name">
                <span class="test-code">{{ test.code }}</span>
                <span>{{ test.name }}</span>
              </div>
            </td>
            <td>
              <span class="category-tag">{{ categoryText(test.category) }}</span>
            </td>
            <td class="num-cell">{{ $t('admin.test.questionCount', { n: test.total_questions }) }}</td>
            <td>
              <span :class="['status-tag', `status-${test.status}`]">
                {{ statusText(test.status) }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(test.created_at) }}</td>
            <td>
              <div class="action-btns">
                <button
                  v-if="test.status === 0"
                  class="btn-action"
                  @click="updateStatus(test.id, 1)"
                >
                  <AppIcon name="upload" :size="13" />
                  {{ $t('admin.test.publish') }}
                </button>
                <button
                  v-if="test.status === 1"
                  class="btn-action"
                  @click="updateStatus(test.id, 2)"
                >
                  <AppIcon name="download" :size="13" />
                  {{ $t('admin.test.unpublish') }}
                </button>
                <button
                  v-if="test.status === 2"
                  class="btn-action"
                  @click="updateStatus(test.id, 1)"
                >
                  <AppIcon name="refresh" :size="13" />
                  {{ $t('admin.test.republish') }}
                </button>
                <button
                  class="btn-action"
                  @click="$router.push(`/admin/tests/edit/${test.id}`)"
                >
                  <AppIcon name="edit" :size="13" />
                  {{ $t('admin.test.editBtn') }}
                </button>
                <button
                  class="btn-action btn-action-danger"
                  @click="deleteTest(test.id)"
                >
                  <AppIcon name="trash" :size="13" />
                  {{ $t('admin.test.delete') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="tests.length === 0">
            <td colspan="7" class="empty-cell">
              <AppIcon name="list" :size="28" />
              <p>{{ $t('admin.test.empty') }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import request from '@/api/request'
import { confirm, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()
const tests = ref<any[]>([])
const currentStatus = ref<number | undefined>(undefined)

const tabs = [
  { labelKey: 'admin.test.tabAll', value: undefined },
  { labelKey: 'admin.test.stPending', value: 0 },
  { labelKey: 'admin.test.stOn', value: 1 },
  { labelKey: 'admin.test.stOff', value: 2 }
]

const statusText = (status: number) => {
  const map: Record<number, string> = { 0: t('admin.test.stPending'), 1: t('admin.test.stOn'), 2: t('admin.test.stOff') }
  return map[status] || t('admin.test.unknown')
}

const categoryText = (cat: string) => {
  const map: Record<string, string> = {
    emotion: t('admin.test.catEmotion'),
    stress: t('admin.test.catStress'),
    personality: t('admin.test.catPersonality'),
    cognitive: t('admin.test.catCognitive')
  }
  return map[cat] || cat
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const loadTests = async () => {
  try {
    const params: any = {}
    if (currentStatus.value !== undefined) params.status = currentStatus.value

    const res = await request.get('/admin/tests', { params }) as any
    tests.value = res.data
  } catch (e: any) {
    await error(e.message || t('admin.test.loadFailed'))
  }
}

const updateStatus = async (id: number, status: number) => {
  try {
    await request.put(`/admin/tests/${id}/status`, { status })
    await success(t('admin.test.statusUpdated'))
    loadTests()
  } catch (e: any) {
    await error(e.message || t('admin.test.updateFailed'))
  }
}

const deleteTest = async (id: number) => {
  const ok = await confirm(t('admin.test.confirmDelete'), t('admin.test.confirmDeleteTitle'))
  if (!ok) return

  try {
    await request.delete(`/admin/tests/${id}`)
    await success(t('admin.test.deleted'))
    loadTests()
  } catch (e: any) {
    await error(e.message || t('admin.test.deleteFailed'))
  }
}

onMounted(loadTests)
</script>

<style scoped>
.page-container {
  max-width: 1080px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin: 8px 0 20px;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 12.5px;
  margin: 0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 500;
  font-family: var(--font-ui);
  transition: background 0.2s var(--ease-out);
}

.btn-primary:hover {
  background: var(--accent-strong);
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.filter-bar button {
  padding: 7px 18px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.filter-bar button:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.filter-bar button.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  border-color: transparent;
}

.table-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: var(--text-secondary);
}

.data-table th {
  padding: 13px 16px;
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 12.5px;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

/* 空态：表头允许换行，使表格回落到卡片宽度，空状态提示得以在卡片内居中 */
.data-table.is-empty th {
  white-space: normal;
}

.data-table td {
  padding: 13px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 13.5px;
}

.data-table tbody tr {
  transition: background 0.15s var(--ease-out);
}

.data-table tbody tr:hover {
  background: color-mix(in srgb, var(--accent-soft) 45%, transparent);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.id-cell {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-size: 12.5px;
}

.test-name {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.test-code {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.category-tag {
  padding: 3px 10px;
  background: color-mix(in srgb, var(--info) 12%, transparent);
  color: var(--info);
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.num-cell {
  font-variant-numeric: tabular-nums;
}

.status-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-0 {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}

.status-1 {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.status-2 {
  background: color-mix(in srgb, var(--text-muted) 14%, transparent);
  color: var(--text-muted);
}

.date-cell {
  color: var(--text-muted);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.action-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  font-weight: 500;
  font-family: var(--font-ui);
  background: transparent;
  color: var(--text-secondary);
}

.btn-action:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.btn-action-danger {
  color: var(--danger);
}

.btn-action-danger:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.data-table td.empty-cell {
  text-align: center;
  padding: 56px 16px;
  color: var(--text-muted);
  font-size: 13.5px;
}

.empty-cell svg {
  opacity: 0.55;
}

.empty-cell p {
  margin: 10px 0 0;
}
</style>
