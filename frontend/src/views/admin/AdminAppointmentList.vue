<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>预约管理</h2>
        <p class="subtitle">查看和管理所有用户预约</p>
      </div>
      <button class="btn-add" @click="openCreate">
        <AppIcon name="plus" :size="15" />
        新增预约
      </button>
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
            <th>操作</th>
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
            <td>
              <button class="btn-del" title="删除该预约" @click="removeAppointment(apt)">
                <AppIcon name="trash" :size="14" />
              </button>
            </td>
          </tr>
          <tr v-if="appointments.length === 0">
            <td colspan="7" class="empty-cell">
              <AppIcon name="list" :size="28" />
              <p>暂无预约数据</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增预约弹窗 -->
    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3>新增预约</h3>
          <button class="modal-close" @click="showCreate = false"><AppIcon name="close" :size="16" /></button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label>用户 <i>*</i></label>
            <select v-model.number="createForm.user_id">
              <option :value="0" disabled>选择用户</option>
              <option v-for="u in userOptions" :key="u.id" :value="u.id">
                {{ u.username }}（{{ u.email }}）
              </option>
            </select>
          </div>
          <div class="form-item">
            <label>专家 <i>*</i></label>
            <select v-model.number="createForm.doctor_id">
              <option :value="0" disabled>选择专家</option>
              <option v-for="d in doctorOptions" :key="d.id" :value="d.id">
                {{ d.name }}｜{{ d.title }}
              </option>
            </select>
          </div>
          <div class="form-item">
            <label>初始状态</label>
            <select v-model="createForm.status">
              <option value="pending">待确认</option>
              <option value="confirmed">已确认</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" @click="showCreate = false">取消</button>
          <button class="btn-primary" :disabled="creating" @click="submitCreate">
            {{ creating ? '创建中...' : '创建预约' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllAppointments, createAppointment, deleteAppointment, getUserList } from '@/api/admin'
import { getDoctors } from '@/api/user'
import { success, error, confirm } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const appointments = ref<any[]>([])
const userOptions = ref<any[]>([])
const doctorOptions = ref<any[]>([])
const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({ user_id: 0, doctor_id: 0, status: 'pending' })

const openCreate = async () => {
  createForm.value = { user_id: 0, doctor_id: 0, status: 'pending' }
  showCreate.value = true
  // 懒加载下拉数据
  if (userOptions.value.length === 0) {
    try {
      const res = await getUserList({ page: 1, pageSize: 500 }) as any
      userOptions.value = res.data.list || []
    } catch { /* 下拉加载失败不阻塞弹窗 */ }
  }
  if (doctorOptions.value.length === 0) {
    try {
      const res = await getDoctors() as any
      doctorOptions.value = res.data || []
    } catch { /* 下拉加载失败不阻塞弹窗 */ }
  }
}

const submitCreate = async () => {
  if (!createForm.value.user_id || !createForm.value.doctor_id) {
    await error('请选择用户和专家')
    return
  }
  try {
    creating.value = true
    await createAppointment(createForm.value)
    await success('预约创建成功')
    showCreate.value = false
    await loadAppointments()
  } catch (e: any) {
    await error(e.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const removeAppointment = async (apt: any) => {
  const ok = await confirm(
    `确定删除预约 #${apt.id}（${apt.user_name} → ${apt.doctor_name}）吗？删除后不可恢复。`,
    '删除预约'
  )
  if (!ok) return
  try {
    await deleteAppointment(apt.id)
    await success('预约已删除')
    await loadAppointments()
  } catch (e: any) {
    await error(e.message || '删除失败')
  }
}

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
    rejected: '已拒绝'
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.btn-add {
  display: inline-flex;
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
  white-space: nowrap;
  transition: background 0.2s var(--ease-out);
}

.btn-add:hover {
  background: var(--accent-strong);
}

.btn-del {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-ctl);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-del:hover {
  border-color: var(--danger, #c0503a);
  color: var(--danger, #c0503a);
  background: color-mix(in srgb, var(--danger, #c0503a) 10%, transparent);
}

/* ===== 弹窗 ===== */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(20, 12, 4, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: mask-in 0.2s var(--ease-out);
}

@keyframes mask-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-card {
  width: 420px;
  max-width: calc(100vw - 48px);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  animation: card-in 0.25s var(--ease-out);
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
}

.modal-head h3 {
  margin: 0;
  font-size: 15.5px;
  color: var(--text-primary);
}

.modal-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-ctl);
  transition: all 0.15s var(--ease-out);
}

.modal-close:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.form-item label i {
  color: var(--accent);
  font-style: normal;
}

.form-item select {
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font-ui);
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.form-item select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 18px;
}

.btn-ghost {
  padding: 9px 18px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-ctl);
  color: var(--text-secondary);
  font-size: 13.5px;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-ghost:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-primary {
  padding: 9px 22px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 13.5px;
  font-weight: 500;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

/* 拒绝：红色调 */
.status-rejected {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
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
