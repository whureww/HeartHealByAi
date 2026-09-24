<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>名片审核</h2>
        <p class="subtitle">审核专家提交的名片，通过后显示在用户端专家列表</p>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>专家</th>
            <th>职称</th>
            <th>专长</th>
            <th>简介</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="card in cards" :key="card.id">
            <td>
              <div class="user-info">
                <span>{{ card.name }}</span>
                <span class="user-email">{{ card.user_email || '未关联账号' }}</span>
              </div>
            </td>
            <td>{{ card.title || '—' }}</td>
            <td class="ellipsis" :title="card.specialty">{{ card.specialty || '—' }}</td>
            <td class="ellipsis" :title="card.intro">{{ card.intro || '—' }}</td>
            <td>
              <span :class="['status-tag', `st-${card.status}`]">{{ statusText(card.status) }}</span>
            </td>
            <td class="date-cell">{{ formatDate(card.created_at) }}</td>
            <td>
              <div class="row-actions">
                <button
                  v-if="card.status !== 1"
                  class="btn-approve"
                  title="通过并上架专家列表"
                  @click="review(card, 'approve')"
                >
                  <AppIcon name="check" :size="14" />
                  通过
                </button>
                <button
                  v-if="card.status !== 0"
                  class="btn-reject"
                  title="拒绝并下架"
                  @click="review(card, 'reject')"
                >
                  <AppIcon name="close" :size="14" />
                  拒绝
                </button>
                <span v-if="card.status === 0" class="status-tip">已下架</span>
              </div>
            </td>
          </tr>
          <tr v-if="cards.length === 0">
            <td colspan="7" class="empty-cell">
              <AppIcon name="stethoscope" :size="28" />
              <p>暂无名片数据</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getDoctorCards, reviewDoctorCard } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const cards = ref<any[]>([])

const statusText = (s: number) =>
  (({ 0: '已下架', 1: '已上架', 2: '待审核' } as Record<number, string>)[s] ?? '未知')

const formatDate = (d: string) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '—')

const load = async () => {
  try {
    const res = await getDoctorCards() as any
    cards.value = res.data || []
  } catch (e: any) {
    await error(e.message || '加载失败')
  }
}

const review = async (card: any, action: 'approve' | 'reject') => {
  const isApprove = action === 'approve'
  const ok = await confirm(
    isApprove
      ? `通过「${card.name}」的名片？通过后立即显示在专家列表。`
      : `拒绝「${card.name}」的名片？拒绝后将从专家列表下架。`,
    isApprove ? '通过名片' : '拒绝名片'
  )
  if (!ok) return
  try {
    const res = await reviewDoctorCard(card.id, action) as any
    await success(res.message || '操作成功')
    await load()
  } catch (e: any) {
    await error(e.message || '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.page-container {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.table-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  padding: 12px 14px;
  background: var(--bg-sidebar);
  color: var(--text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: top;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-email {
  font-size: 11.5px;
  color: var(--text-muted);
}

.ellipsis {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-cell {
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 12.5px;
}

.status-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.st-1 {
  background: color-mix(in srgb, #3a9e6e 15%, transparent);
  color: #3a9e6e;
}

.st-2 {
  background: color-mix(in srgb, #c9a227 15%, transparent);
  color: #c9a227;
}

.st-0 {
  background: var(--accent-soft);
  color: var(--text-secondary);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-approve,
.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: var(--radius-ctl);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-approve {
  border: 1px solid color-mix(in srgb, #3a9e6e 45%, transparent);
  background: transparent;
  color: #3a9e6e;
}

.btn-approve:hover {
  background: color-mix(in srgb, #3a9e6e 12%, transparent);
}

.btn-reject {
  border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
  background: transparent;
  color: var(--danger);
}

.btn-reject:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.status-tip {
  font-size: 12px;
  color: var(--text-muted);
}

.empty-cell {
  text-align: center;
  padding: 48px 0;
  color: var(--text-muted);
}

.empty-cell p {
  margin: 8px 0 0;
  font-size: 13px;
}
</style>
