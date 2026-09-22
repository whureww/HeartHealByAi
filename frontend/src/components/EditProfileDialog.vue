<template>
  <div v-if="visible" class="modal-overlay" @click="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>编辑资料</h3>
        <button class="btn-close" @click="close" title="关闭">
          <AppIcon name="close" :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 头像区域 -->
        <div class="avatar-section">
          <div class="avatar-wrapper" @click="changeAvatar">
            <img
              v-if="userStore.avatarBase64"
              :src="userStore.avatarBase64"
              class="avatar-img"
              alt="头像"
            />
            <div v-else class="avatar-placeholder">
              {{ userStore.userInfo?.username?.[0]?.toUpperCase() || '?' }}
            </div>
            <div class="avatar-overlay">
              <AppIcon name="camera" :size="14" />
              <span>更换</span>
            </div>
          </div>
        </div>

        <!-- 昵称 -->
        <div class="form-item">
          <label>昵称</label>
          <input
            v-model="form.username"
            type="text"
            placeholder="请输入昵称"
            maxlength="20"
          />
          <span class="char-count">{{ form.username.length }}/20</span>
        </div>

        <!-- 邮箱（只读） -->
        <div class="form-item">
          <label>邮箱</label>
          <input :value="userStore.userInfo?.email" disabled type="text" />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="close">取消</button>
        <button
          class="btn-confirm"
          @click="save"
          :disabled="saving || !form.username.trim()"
        >
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'saved'): void
}>()

const userStore = useUserStore()
const saving = ref(false)

const form = ref({
  username: ''
})

// 打开时填充当前数据
watch(() => props.visible, (val) => {
  if (val && userStore.userInfo) {
    form.value.username = userStore.userInfo.username || ''
  }
})

const close = () => {
  emit('update:visible', false)
}

// 更换头像 - 调用 selectAndUpdateAvatar 而不是 updateAvatar
const changeAvatar = async () => {
  const res = await userStore.selectAndUpdateAvatar()
  if (res.success) {
    await success('头像更换成功')
  } else {
    await error(res.message || '头像更换失败')
  }
}

// 保存昵称
const save = async () => {
  const username = form.value.username.trim()
  if (!username || username.length < 2) {
    await error('昵称至少需要2个字符')
    return
  }

  saving.value = true
  try {
    const res = await userStore.updateUsername(username)
    if (res.success) {
      await success('资料更新成功')
      emit('saved')
      close()
    } else {
      await error(res.message || '更新失败')
    }
  } catch (e: any) {
    await error(e.message || '更新失败')
  } finally {
    saving.value = false
  }
}
</script>


<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 21, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  width: 420px;
  max-width: 90vw;
  box-shadow: var(--shadow-lg);
  animation: modalIn 0.25s var(--ease-out);
}

@keyframes modalIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn-close {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s var(--ease-out);
}

.btn-close:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
}

.avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.avatar-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 600;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.3s;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.95);
}

.avatar-overlay span {
  color: rgba(255, 255, 255, 0.95);
  font-size: 13px;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-item input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: var(--font-ui);
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  box-sizing: border-box;
}

.form-item input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.form-item input:disabled {
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: not-allowed;
}

.form-item input::placeholder {
  color: var(--text-muted);
}

.char-count {
  float: right;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.btn-cancel {
  padding: 10px 20px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.btn-cancel:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-confirm {
  padding: 10px 20px;
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

.btn-confirm:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
