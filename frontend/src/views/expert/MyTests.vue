<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>{{ $t('expert.myTests.title') }}</h2>
        <p class="subtitle">{{ $t('expert.myTests.subtitle') }}</p>
      </div>
      <button class="btn-primary" @click="goCreate">
        <AppIcon name="plus" :size="15" />
        {{ $t('admin.test.create') }}
      </button>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
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
                <template v-if="test.status === 0">
                  <button class="btn-action" @click="goEdit(test.id)">
                    <AppIcon name="edit" :size="13" />
                    {{ $t('admin.test.editBtn') }}
                  </button>
                  <button class="btn-action btn-action-danger" @click="removeTest(test.id)">
                    <AppIcon name="trash" :size="13" />
                    {{ $t('admin.test.delete') }}
                  </button>
                </template>
                <span v-else class="readonly-hint">{{ $t('expert.myTests.readonlyHint') }}</span>
              </div>
            </td>
          </tr>
          <tr v-if="tests.length === 0">
            <td colspan="6" class="empty-cell">
              <AppIcon name="list" :size="28" />
              <p>{{ $t('expert.myTests.empty') }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getMyTests, deleteMyTest } from '@/api/expert'
import { confirm, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

// embedded：嵌入 Dashboard 专家工作台时为 true，新建/编辑通过事件交由父级切换页面；
// 独立路由（/expert/my-tests）使用时为 false，沿用路由跳转
const props = defineProps<{ embedded?: boolean }>()
const emit = defineEmits<{ (e: 'create'): void; (e: 'edit', id: number): void }>()
const router = useRouter()

const { t } = useI18n()
const tests = ref<any[]>([])

const goCreate = () => {
  if (props.embedded) emit('create')
  else router.push('/expert/my-tests/create')
}
const goEdit = (id: number) => {
  if (props.embedded) emit('edit', id)
  else router.push(`/expert/my-tests/edit/${id}`)
}

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
    const res = await getMyTests() as any
    tests.value = res.data || []
  } catch (e: any) {
    await error(e.message || t('admin.test.loadFailed'))
  }
}

const removeTest = async (id: number) => {
  const ok = await confirm(t('admin.test.confirmDelete'), t('admin.test.confirmDeleteTitle'))
  if (!ok) return

  try {
    await deleteMyTest(id)
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
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.status-0 {
  background: color-mix(in srgb, var(--warning, #f59e0b) 14%, transparent);
  color: var(--warning, #f59e0b);
}

.status-1 {
  background: color-mix(in srgb, #22c55e 14%, transparent);
  color: #16a34a;
}

.status-2 {
  background: color-mix(in srgb, var(--text-muted, #94a3b8) 14%, transparent);
  color: var(--text-muted, #94a3b8);
}

.date-cell {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.action-btns {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 12.5px;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.btn-action:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-action-danger:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.readonly-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.empty-cell {
  text-align: center;
  padding: 48px 0 !important;
  color: var(--text-muted);
}

.empty-cell p {
  margin: 8px 0 0;
  font-size: 13px;
}
</style>
