<template>
  <div v-if="visible" class="modal-overlay" @click="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>编辑资料</h3>
        <button class="btn-close" @click="close">✕</button>
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
              <span>📷 更换</span>
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg, #fff);
  border-radius: 20px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-muted, #6b7280);
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: linear-gradient(135deg, #73a9d8, #b4d8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: #fff;
  font-weight: 600;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  border-radius: 50%;
}

.avatar-overlay span {
  color: #fff;
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
  color: var(--text-secondary, #6b7280);
  margin-bottom: 6px;
}

.form-item input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  font-size: 14px;
  background: var(--input-bg, #fff);
  color: var(--text-primary, #1f2937);
  box-sizing: border-box;
}

.form-item input:focus {
  outline: none;
  border-color: #73a9d8;
}

.form-item input:disabled {
  background: var(--bg-secondary, #f9fafb);
  color: var(--text-muted, #9ca3af);
}

.char-count {
  float: right;
  font-size: 12px;
  color: var(--text-muted, #9ca3af);
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color, #f3f4f6);
}

.btn-cancel {
  padding: 10px 20px;
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-secondary, #4b5563);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}

.btn-confirm {
  padding: 10px 20px;
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
