<template>
  <div class="page-container">
    <div class="page-header">
      <h2>👥 用户管理</h2>
      <p class="subtitle">管理系统用户，分配角色权限</p>
    </div>
    
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input 
          v-model="searchKeyword" 
          placeholder="搜索用户名 / 邮箱 / 手机号" 
          @keyup.enter="loadUsers" 
        />
      </div>
      <button class="btn-search" @click="loadUsers">搜索</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>手机号</th>
            <th>当前角色</th>
            <th>注册时间</th>
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
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="7" class="empty-cell">暂无用户数据</td>
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
        ← 上一页
      </button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button 
        :disabled="page >= totalPages" 
        @click="page++; loadUsers()"
        class="page-btn"
      >
        下一页 →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import request from '@/api/request'
import { success, error } from '@/utils/dialog'

const users = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')

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

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #f3f4f6;
  border-radius: 12px;
  padding: 0 16px;
  gap: 10px;
}

.search-icon {
  font-size: 16px;
  opacity: 0.5;
}

.search-input-wrap input {
  flex: 1;
  padding: 12px 0;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
  color: #374151;
}

.btn-search {
  padding: 12px 28px;
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-search:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(115, 169, 216, 0.3);
}

.table-wrap {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th {
  padding: 16px;
  text-align: left;
  background: #f9fafb;
  color: #6b7280;
  font-weight: 500;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  color: #4b5563;
}

.data-table tbody tr:hover {
  background: #fafbfc;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.id-cell {
  font-family: monospace;
  color: #9ca3af;
  font-size: 13px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #73a9d8, #b4d8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.role-tag {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.role-1 { background: #e0f2fe; color: #0369a1; }
.role-2 { background: #fef3c7; color: #92400e; }
.role-3 { background: #fce7f3; color: #be185d; }

.date-cell {
  color: #9ca3af;
  font-size: 13px;
}

.role-select {
  padding: 8px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 13px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.role-select:hover {
  border-color: #73a9d8;
}

.role-select:focus {
  border-color: #73a9d8;
  box-shadow: 0 0 0 3px rgba(115, 169, 216, 0.15);
}

.empty-cell {
  text-align: center;
  padding: 60px;
  color: #9ca3af;
  font-size: 14px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 28px;
}

.page-btn {
  padding: 10px 20px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  color: #4b5563;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #73a9d8;
  color: #73a9d8;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
  min-width: 60px;
  text-align: center;
}
</style>
