<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>用户管理</h2>
        <p class="subtitle">管理系统用户，分配角色权限</p>
      </div>
      <button class="btn-add" @click="openCreate">
        <AppIcon name="plus" :size="15" />
        新增用户
      </button>
    </div>

    <div class="search-bar">
      <div class="search-input-wrap">
        <AppIcon name="search" :size="16" class="search-icon" />
        <input
          v-model="searchKeyword"
          placeholder="搜索用户名 / 邮箱 / 手机号"
          @keyup.enter="loadUsers"
        />
      </div>
      <button class="btn-search" @click="loadUsers">搜索</button>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>手机号</th>
            <th>当前角色</th>
            <th>注册时间</th>
            <th>角色调整</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="id-cell">#{{ user.id }}</td>
            <td>
              <div class="user-info">
                <div class="avatar">{{ user.username?.[0]?.toUpperCase() }}</div>
                <span>{{ user.username }}</span>
              </div>
            </td>
            <td>{{ user.email }}</td>
            <td>{{ user.phone || '-' }}</td>
            <td>
              <span :class="['role-tag', `role-${user.role}`]">
                {{ roleText(user.role) }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(user.created_at) }}</td>
            <td>
              <select
                v-model="user.newRole"
                class="role-select"
                @change="updateRole(user)"
              >
                <option :value="1">普通用户</option>
                <option :value="2">专家</option>
                <option :value="3">管理员</option>
              </select>
            </td>
            <td>
              <button
                class="btn-del"
                :disabled="user.id === userStore.userInfo?.id"
                :title="user.id === userStore.userInfo?.id ? '不能删除当前登录账号' : '删除该用户'"
                @click="removeUser(user)"
              >
                <AppIcon name="trash" :size="14" />
              </button>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="8" class="empty-cell">
              <AppIcon name="list" :size="28" />
              <p>暂无用户数据</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button
        :disabled="page <= 1"
        @click="page--; loadUsers()"
        class="page-btn"
      >
        <AppIcon name="back" :size="14" />
        上一页
      </button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button
        :disabled="page >= totalPages"
        @click="page++; loadUsers()"
        class="page-btn"
      >
        下一页
        <AppIcon name="chevronRight" :size="14" />
      </button>
    </div>

    <!-- 新增用户弹窗 -->
    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3>新增用户</h3>
          <button class="modal-close" @click="showCreate = false"><AppIcon name="close" :size="16" /></button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label>用户名 <i>*</i></label>
            <input v-model="createForm.username" placeholder="2-20 个字符" />
          </div>
          <div class="form-item">
            <label>邮箱 <i>*</i></label>
            <input v-model="createForm.email" type="email" placeholder="user@example.com" />
          </div>
          <div class="form-item">
            <label>初始密码 <i>*</i></label>
            <input v-model="createForm.password" type="password" placeholder="至少 6 位" />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>角色</label>
              <select v-model.number="createForm.role">
                <option :value="1">普通用户</option>
                <option :value="2">专家</option>
                <option :value="3">管理员</option>
              </select>
            </div>
            <div class="form-item">
              <label>手机号</label>
              <input v-model="createForm.phone" placeholder="选填" />
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" @click="showCreate = false">取消</button>
          <button class="btn-primary" :disabled="creating" @click="submitCreate">
            {{ creating ? '创建中...' : '创建用户' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import request from '@/api/request'
import { createUser, deleteUser } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const userStore = useUserStore()
const users = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')

const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({ username: '', email: '', password: '', role: 1, phone: '' })

const openCreate = () => {
  createForm.value = { username: '', email: '', password: '', role: 1, phone: '' }
  showCreate.value = true
}

const submitCreate = async () => {
  const f = createForm.value
  if (!f.username.trim() || !f.email.trim() || !f.password) {
    await error('请填写用户名、邮箱和初始密码')
    return
  }
  if (f.password.length < 6) {
    await error('初始密码至少 6 位')
    return
  }
  try {
    creating.value = true
    await createUser({ ...f, username: f.username.trim(), email: f.email.trim() })
    await success('用户创建成功')
    showCreate.value = false
    page.value = 1
    await loadUsers()
  } catch (e: any) {
    await error(e.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const removeUser = async (user: any) => {
  const ok = await confirm(
    `确定删除用户「${user.username}」吗？其聊天记录、测评结果、预约等关联数据将一并清除，不可恢复。`,
    '删除用户'
  )
  if (!ok) return
  try {
    await deleteUser(user.id)
    await success('用户已删除')
    if (users.value.length === 1 && page.value > 1) page.value--
    await loadUsers()
  } catch (e: any) {
    await error(e.message || '删除失败')
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const roleText = (role: number) => {
  const map: Record<number, string> = { 1: '普通用户', 2: '专家', 3: '管理员' }
  return map[role] || '未知'
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const loadUsers = async () => {
  try {
    const res = await request.get('/admin/users', {
      params: { page: page.value, pageSize: pageSize.value, keyword: searchKeyword.value }
    }) as any
    users.value = res.data.list.map((u: any) => ({ ...u, newRole: u.role }))
    total.value = res.data.total
  } catch (e: any) {
    await error(e.message || '加载用户列表失败')
  }
}

const updateRole = async (user: any) => {
  if (user.newRole === user.role) return

  try {
    await request.put(`/admin/users/${user.id}/role`, { role: user.newRole })
    user.role = user.newRole
    await success('角色修改成功')
  } catch (e: any) {
    await error(e.message || '修改失败')
    user.newRole = user.role
  }
}

onMounted(loadUsers)
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

.btn-del:hover:not(:disabled) {
  border-color: var(--danger, #c0503a);
  color: var(--danger, #c0503a);
  background: color-mix(in srgb, var(--danger, #c0503a) 10%, transparent);
}

.btn-del:disabled {
  opacity: 0.35;
  cursor: not-allowed;
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
  max-height: calc(100vh - 120px);
  overflow-y: auto;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
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

.form-item input,
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

.form-item input:focus,
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

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  padding: 0 14px;
  gap: 8px;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.search-input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input-wrap input {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-ui);
}

.search-input-wrap input::placeholder {
  color: var(--text-muted);
}

.btn-search {
  padding: 10px 24px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  font-family: var(--font-ui);
  transition: background 0.2s var(--ease-out);
}

.btn-search:hover {
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

.id-cell {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-size: 12.5px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.role-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.role-1 {
  background: color-mix(in srgb, var(--info) 14%, transparent);
  color: var(--info);
}

.role-2 {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.role-3 {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}

.date-cell {
  color: var(--text-muted);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.role-select {
  padding: 7px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 13px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  font-family: var(--font-ui);
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.role-select:hover {
  border-color: var(--border-strong);
}

.role-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  font-family: var(--font-ui);
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s var(--ease-out);
}

.page-btn:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: center;
}
</style>
