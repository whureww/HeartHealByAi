<template>
  <div class="page-container">
    <div class="page-header">
      <h2>预约管理</h2>
      <p class="subtitle">查看和管理所有用户预约</p>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户</th>
            <th>专家</th>
            <th>职称</th>
            <th>状态</th>
            <th>预约时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="apt in appointments" :key="apt.id">
            <td class="id-cell">#{{ apt.id }}</td>
            <td>
              <div class="user-info">
                <span>{{ apt.user_name }}</span>
                <span class="user-email">{{ apt.user_email }}</span>
              </div>
            </td>
            <td>{{ apt.doctor_name }}</td>
            <td>{{ apt.doctor_title }}</td>
            <td>
              <span :class="['status-tag', `status-${apt.status}`]">
                {{ statusText(apt.status) }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(apt.created_at) }}</td>
          </tr>
          <tr v-if="appointments.length === 0">
            <td colspan="6" class="empty-cell">
              <AppIcon name="list" :size="28" />
              <p>暂无预约数据</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllAppointments } from '@/api/admin'
import AppIcon from '@/components/AppIcon.vue'

const appointments = ref<any[]>([])

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const loadAppointments = async () => {
  try {
    const res = await getAllAppointments() as any
    appointments.value = res.data
  } catch (e: any) {
    console.error('加载预约失败:', e)
  }
}

onMounted(loadAppointments)
</script>

<style scoped>
.page-container {
  max-width: 1080px;
}

.page-header {
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
  min-width: 700px;
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
  white-space: nowrap;
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

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-email {
  font-size: 12px;
  color: var(--text-muted);
}

.status-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
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

.date-cell {
  color: var(--text-muted);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
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
