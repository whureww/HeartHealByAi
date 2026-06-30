<template>
  <div class="page-container">
    <div class="page-header">
      <h2>📋 预约管理</h2>
      <p class="subtitle">查看和管理所有用户预约</p>
    </div>

    <div class="table-wrap">
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
            <td colspan="6" class="empty-cell">暂无预约数据</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllAppointments } from '@/api/admin'

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
  background: #fff;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.subtitle {
  color: #9ca3af;
  font-size: 14px;
}

.table-wrap {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  min-width: 700px;
}

.data-table th {
  padding: 16px;
  text-align: left;
  background: #f9fafb;
  color: #6b7280;
  font-weight: 500;
  font-size: 13px;
}

.data-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  color: #4b5563;
  white-space: nowrap;
}

.data-table tbody tr:hover {
  background: #fafbfc;
}

.id-cell {
  font-family: monospace;
  color: #9ca3af;
  font-size: 13px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-email {
  font-size: 12px;
  color: #9ca3af;
}

.status-tag {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending { background: #fef3c7; color: #92400e; }
.status-confirmed { background: #d1fae5; color: #065f46; }
.status-completed { background: #e0f2fe; color: #0369a1; }
.status-cancelled { background: #fee2e2; color: #991b1b; }

.date-cell {
  color: #9ca3af;
  font-size: 13px;
}

.empty-cell {
  text-align: center;
  padding: 60px;
  color: #9ca3af;
  font-size: 14px;
}
</style>