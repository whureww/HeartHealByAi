<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>{{ $t('admin.user.title') }}</h2>
        <p class="subtitle">{{ $t('admin.user.subtitle') }}</p>
      </div>
      <button class="btn-add" @click="openCreate">
        <AppIcon name="plus" :size="15" />
        {{ $t('admin.user.addUser') }}
      </button>
    </div>

    <div class="search-bar">
      <div class="search-input-wrap">
        <AppIcon name="search" :size="16" class="search-icon" />
        <input
          v-model="searchKeyword"
          :placeholder="$t('admin.user.searchPlaceholder')"
          @keyup.enter="loadUsers"
        />
      </div>
      <button class="btn-search" @click="loadUsers">{{ $t('admin.user.search') }}</button>
    </div>

    <div class="table-card">
      <table class="data-table" :class="{ 'is-empty': users.length === 0 }">
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ $t('admin.user.th.username') }}</th>
            <th>{{ $t('admin.user.th.email') }}</th>
            <th>{{ $t('admin.user.th.phone') }}</th>
            <th>{{ $t('admin.user.th.role') }}</th>
            <th>{{ $t('admin.user.th.status') }}</th>
            <th>{{ $t('admin.user.th.createdAt') }}</th>
            <th>{{ $t('admin.user.th.roleAdjust') }}</th>
            <th>{{ $t('admin.user.th.actions') }}</th>
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
            <td>
              <span v-if="activeRestriction(user)" class="restrict-tag">
                {{ activeRestriction(user) }}
              </span>
              <span v-else class="restrict-tag normal">{{ $t('admin.user.normal') }}</span>
            </td>
            <td class="date-cell">{{ formatDate(user.created_at) }}</td>
            <td>
              <select
                v-model="user.newRole"
                class="role-select"
                @change="updateRole(user)"
              >
                <option :value="1">{{ $t('admin.user.roleUser') }}</option>
                <option :value="2">{{ $t('admin.user.roleExpert') }}</option>
                <option :value="3">{{ $t('admin.user.roleAdmin') }}</option>
              </select>
            </td>
            <td>
              <button
                class="btn-info"
                :title="$t('admin.user.viewDetail')"
                @click="openDetail(user)"
              >
                <AppIcon name="eye" :size="14" />
              </button>
              <button
                v-if="activeRestriction(user)"
                class="btn-lift"
                :title="$t('admin.user.liftTitle')"
                @click="liftRestriction(user)"
              >
                <AppIcon name="check" :size="14" />
              </button>
              <button
                class="btn-del"
                :disabled="user.id === userStore.userInfo?.id"
                :title="user.id === userStore.userInfo?.id ? $t('admin.user.cantDeleteSelf') : $t('admin.user.deleteUser')"
                @click="removeUser(user)"
              >
                <AppIcon name="trash" :size="14" />
              </button>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="9" class="empty-cell">
              <AppIcon name="list" :size="28" />
              <p>{{ $t('admin.user.empty') }}</p>
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
        {{ $t('admin.user.prevPage') }}
      </button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button
        :disabled="page >= totalPages"
        @click="page++; loadUsers()"
        class="page-btn"
      >
        {{ $t('admin.user.nextPage') }}
        <AppIcon name="chevronRight" :size="14" />
      </button>
    </div>

    <!-- 新增用户弹窗 -->
    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3>{{ $t('admin.user.addUser') }}</h3>
          <button class="modal-close" @click="showCreate = false"><AppIcon name="close" :size="16" /></button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label>{{ $t('admin.user.th.username') }} <i>*</i></label>
            <input v-model="createForm.username" :placeholder="$t('admin.user.phUsername')" />
          </div>
          <div class="form-item">
            <label>{{ $t('admin.user.th.email') }} <i>*</i></label>
            <input v-model="createForm.email" type="email" placeholder="user@example.com" />
          </div>
          <div class="form-item">
            <label>{{ $t('admin.user.fPassword') }} <i>*</i></label>
            <input v-model="createForm.password" type="password" :placeholder="$t('admin.user.phPassword')" />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>{{ $t('admin.user.fRole') }}</label>
              <select v-model.number="createForm.role">
                <option :value="1">{{ $t('admin.user.roleUser') }}</option>
                <option :value="2">{{ $t('admin.user.roleExpert') }}</option>
                <option :value="3">{{ $t('admin.user.roleAdmin') }}</option>
              </select>
            </div>
            <div class="form-item">
              <label>{{ $t('admin.user.th.phone') }}</label>
              <input v-model="createForm.phone" :placeholder="$t('admin.user.phOptional')" />
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" @click="showCreate = false">{{ $t('admin.user.cancel') }}</button>
          <button class="btn-primary" :disabled="creating" @click="submitCreate">
            {{ creating ? $t('admin.user.creating') : $t('admin.user.submit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 用户详情弹窗：查看信息 + 协助修改账号/重置密码 -->
    <div v-if="showDetail" class="modal-mask" @click.self="showDetail = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3>{{ $t('admin.user.detailTitle') }}</h3>
          <button class="modal-close" @click="showDetail = false"><AppIcon name="close" :size="16" /></button>
        </div>
        <div class="modal-body">
          <!-- 只读概要 -->
          <div class="detail-meta">
            <div class="meta-item">
              <span class="meta-label">ID</span>
              <span>#{{ detailUser?.id }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ $t('admin.user.th.role') }}</span>
              <span :class="['role-tag', `role-${detailUser?.role}`]">{{ roleText(detailUser?.role) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ $t('admin.user.th.status') }}</span>
              <span v-if="detailUser && activeRestriction(detailUser)" class="restrict-tag">{{ activeRestriction(detailUser) }}</span>
              <span v-else class="restrict-tag normal">{{ $t('admin.user.normal') }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ $t('admin.user.th.createdAt') }}</span>
              <span>{{ detailUser ? formatDate(detailUser.created_at) : '' }}</span>
            </div>
          </div>

          <!-- 密码：仅占位展示，不可见 -->
          <div class="pwd-row">
            <span class="meta-label">{{ $t('admin.user.fPassword') }}</span>
            <span class="pwd-dots">· · · · · ·</span>
            <span class="pwd-tip">{{ $t('admin.user.passwordHidden') }}</span>
          </div>

          <!-- 账号资料修改 -->
          <div class="section-title">{{ $t('admin.user.editProfile') }}</div>
          <div class="form-item">
            <label>{{ $t('admin.user.th.username') }}</label>
            <input v-model="detailForm.username" :placeholder="$t('admin.user.phUsername')" />
          </div>
          <div class="form-item">
            <label>{{ $t('admin.user.th.email') }}</label>
            <input v-model="detailForm.email" type="email" placeholder="user@example.com" />
          </div>
          <div class="form-item">
            <label>{{ $t('admin.user.th.phone') }}</label>
            <input v-model="detailForm.phone" :placeholder="$t('admin.user.phOptional')" />
          </div>
          <div class="modal-foot inline">
            <button class="btn-primary" :disabled="savingProfile" @click="saveProfile">
              {{ savingProfile ? $t('admin.user.saving') : $t('admin.user.saveProfile') }}
            </button>
          </div>

          <!-- 重置密码 -->
          <div class="section-title">{{ $t('admin.user.resetPwd') }}</div>
          <div class="form-item">
            <label>{{ $t('admin.user.newPassword') }}</label>
            <input v-model="newPassword" type="password" :placeholder="$t('admin.user.phPassword')" />
          </div>
          <div class="modal-foot inline">
            <button class="btn-primary" :disabled="resettingPwd || !newPassword" @click="submitResetPassword">
              {{ resettingPwd ? $t('admin.user.resetting') : $t('admin.user.resetPwd') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import request from '@/api/request'
import { createUser, deleteUser, unrestrictUser, updateUserProfile, resetUserPassword } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import { useUserStore } from '@/stores/user'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()
const userStore = useUserStore()
const users = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')

const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({ username: '', email: '', password: '', role: 1, phone: '' })

// ===== 用户详情弹窗：查看信息 + 协助修改账号 / 重置密码 =====
const showDetail = ref(false)
const detailUser = ref<any>(null)
const detailForm = ref({ username: '', email: '', phone: '' })
const newPassword = ref('')
const savingProfile = ref(false)
const resettingPwd = ref(false)

const openDetail = (user: any) => {
  detailUser.value = user
  detailForm.value = { username: user.username || '', email: user.email || '', phone: user.phone || '' }
  newPassword.value = ''
  showDetail.value = true
}

const saveProfile = async () => {
  const u = detailUser.value
  if (!u) return
  const f = detailForm.value
  if (!f.username.trim() || !f.email.trim()) {
    await error(t('admin.user.errProfileRequired'))
    return
  }
  // 防误操作：二次确认
  const ok = await confirm(t('admin.user.confirmProfile', { name: u.username }), t('admin.user.confirmProfileTitle'))
  if (!ok) return
  try {
    savingProfile.value = true
    await updateUserProfile(u.id, { username: f.username.trim(), email: f.email.trim(), phone: f.phone.trim() || undefined })
    await success(t('admin.user.profileUpdated'))
    u.username = f.username.trim()
    u.email = f.email.trim()
    u.phone = f.phone.trim() || null
    showDetail.value = false
  } catch (e: any) {
    await error(e?.response?.data?.message || e?.message || t('admin.user.profileSaveFailed'))
  } finally {
    savingProfile.value = false
  }
}

const submitResetPassword = async () => {
  const u = detailUser.value
  if (!u || !newPassword.value) return
  if (newPassword.value.length < 6) {
    await error(t('admin.user.errPasswordMin'))
    return
  }
  // 防误操作：二次确认
  const ok = await confirm(t('admin.user.confirmPasswordReset', { name: u.username }), t('admin.user.confirmPasswordResetTitle'))
  if (!ok) return
  try {
    resettingPwd.value = true
    await resetUserPassword(u.id, newPassword.value)
    await success(t('admin.user.passwordReset'))
    newPassword.value = ''
  } catch (e: any) {
    await error(e?.response?.data?.message || e?.message || t('admin.user.pwdResetFailed'))
  } finally {
    resettingPwd.value = false
  }
}

const openCreate = () => {
  createForm.value = { username: '', email: '', password: '', role: 1, phone: '' }
  showCreate.value = true
}

const submitCreate = async () => {
  const f = createForm.value
  if (!f.username.trim() || !f.email.trim() || !f.password) {
    await error(t('admin.user.errRequired'))
    return
  }
  if (f.password.length < 6) {
    await error(t('admin.user.errPasswordMin'))
    return
  }
  try {
    creating.value = true
    await createUser({ ...f, username: f.username.trim(), email: f.email.trim() })
    await success(t('admin.user.created'))
    showCreate.value = false
    page.value = 1
    await loadUsers()
  } catch (e: any) {
    await error(e.message || t('admin.user.createFailed'))
  } finally {
    creating.value = false
  }
}

const removeUser = async (user: any) => {
  const ok = await confirm(
    t('admin.user.confirmDelete', { name: user.username }),
    t('admin.user.deleteUserTitle')
  )
  if (!ok) return
  try {
    await deleteUser(user.id)
    await success(t('admin.user.deleted'))
    if (users.value.length === 1 && page.value > 1) page.value--
    await loadUsers()
  } catch (e: any) {
    await error(e.message || t('admin.user.deleteFailed'))
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const roleText = (role: number) => {
  const map: Record<number, string> = { 1: t('admin.user.roleUser'), 2: t('admin.user.roleExpert'), 3: t('admin.user.roleAdmin') }
  return map[role] || t('admin.user.unknown')
}

// 账号限制状态展示（含到期自动解除判断）
const activeRestriction = (user: any) => {
  const status = Number(user.status || 0)
  if (status !== 1 && status !== 2) return ''
  if (user.restricted_until && new Date(user.restricted_until).getTime() <= Date.now()) return ''
  return status === 2 ? t('admin.user.banned') : t('admin.user.muted')
}

const liftRestriction = async (user: any) => {
  const ok = await confirm(t('admin.user.confirmLift', { name: user.username }), t('admin.user.liftConfirmTitle'))
  if (!ok) return
  try {
    await unrestrictUser(user.id)
    user.status = 0
    user.restricted_until = null
    success(t('admin.user.lifted'))
  } catch (e: any) {
    await error(e?.response?.data?.message || t('admin.user.liftFailed'))
  }
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
    await error(e.message || t('admin.user.loadFailed'))
  }
}

const updateRole = async (user: any) => {
  if (user.newRole === user.role) return

  // 防误操作：角色调整二次确认
  const ok = await confirm(
    t('admin.user.confirmRoleChange', { name: user.username, role: roleText(user.newRole) }),
    t('admin.user.confirmRoleChangeTitle')
  )
  if (!ok) {
    user.newRole = user.role
    return
  }

  try {
    await request.put(`/admin/users/${user.id}/role`, { role: user.newRole })
    user.role = user.newRole
    await success(t('admin.user.roleUpdated'))
  } catch (e: any) {
    await error(e.message || t('admin.user.updateFailed'))
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

/* 账号限制状态标签与解除按钮 */
.restrict-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.restrict-tag.normal {
  background: color-mix(in srgb, #52c41a 12%, transparent);
  color: #52c41a;
}

.btn-lift {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--accent);
  background: transparent;
  border-radius: var(--radius-ctl);
  color: var(--accent);
  cursor: pointer;
  margin-right: 6px;
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

/* 详情按钮与详情弹窗内容 */
.btn-info {
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
  margin-right: 6px;
  transition: all 0.2s var(--ease-out);
}

.btn-info:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 18px;
  padding: 12px 14px;
  background: var(--accent-soft);
  border-radius: var(--radius-ctl);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  min-width: 0;
}

.meta-label {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 56px;
}

.pwd-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-ctl);
}

.pwd-dots {
  font-size: 14px;
  letter-spacing: 2px;
  color: var(--text-primary);
  font-weight: 600;
}

.pwd-tip {
  font-size: 12px;
  color: var(--text-muted);
}

.section-title {
  margin-top: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-secondary);
  border-left: 3px solid var(--accent);
  padding-left: 8px;
}

.modal-foot.inline {
  padding: 0;
  justify-content: flex-end;
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
