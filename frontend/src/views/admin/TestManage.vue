<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>问卷管理</h2>
        <p class="subtitle">管理系统心理测评问卷</p>
      </div>
      <button class="btn-primary" @click="$router.push('/admin/tests/edit')">
        <AppIcon name="plus" :size="15" />
        新建问卷
      </button>
    </div>

    <div class="filter-bar">
      <button
        v-for="tab in tabs"
        :key="tab.value ?? 'all'"
        :class="{ active: currentStatus === tab.value }"
        @click="currentStatus = tab.value; loadTests()"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>问卷名称</th>
            <th>分类</th>
            <th>题目数</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
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
            <td class="num-cell">{{ test.total_questions }} 题</td>
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
                  上架
                </button>
                <button
                  v-if="test.status === 1"
                  class="btn-action"
                  @click="updateStatus(test.id, 2)"
                >
                  <AppIcon name="download" :size="13" />
                  下架
                </button>
                <button
                  v-if="test.status === 2"
                  class="btn-action"
                  @click="updateStatus(test.id, 1)"
                >
                  <AppIcon name="refresh" :size="13" />
                  重新上架
                </button>
                <button
                  class="btn-action"
                  @click="$router.push(`/admin/tests/edit/${test.id}`)"
                >
                  <AppIcon name="edit" :size="13" />
                  编辑
                </button>
                <button
                  class="btn-action btn-action-danger"
                  @click="deleteTest(test.id)"
                >
                  <AppIcon name="trash" :size="13" />
                  删除
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="tests.length === 0">
            <td colspan="7" class="empty-cell">
              <AppIcon name="list" :size="28" />
              <p>暂无问卷数据</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '@/api/request'
import { confirm, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const tests = ref<any[]>([])
const currentStatus = ref<number | undefined>(undefined)

const tabs = [
  { label: '全部', value: undefined },
  { label: '待审核', value: 0 },
  { label: '已上架', value: 1 },
  { label: '已下架', value: 2 }
]

const statusText = (status: number) => {
  const map: Record<number, string> = { 0: '待审核', 1: '已上架', 2: '已下架' }
  return map[status] || '未知'
}

const categoryText = (cat: string) => {
  const map: Record<string, string> = {
    emotion: '情绪测评',
    stress: '压力测评',
    personality: '人格测评',
    cognitive: '认知测评'
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
    await error(e.message || '加载问卷列表失败')
  }
}

const updateStatus = async (id: number, status: number) => {
  try {
    await request.put(`/admin/tests/${id}/status`, { status })
    await success('状态更新成功')
    loadTests()
  } catch (e: any) {
    await error(e.message || '更新失败')
  }
}

const deleteTest = async (id: number) => {
  const ok = await confirm('确定删除该问卷？此操作不可恢复。', '确认删除')
  if (!ok) return

  try {
    await request.delete(`/admin/tests/${id}`)
    await success('删除成功')
    loadTests()
  } catch (e: any) {
    await error(e.message || '删除失败')
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

.empty-cell {
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
