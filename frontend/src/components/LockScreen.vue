<template>
  <div class="lock-mask">
    <div class="lock-card">
      <div class="lock-logo"><AppIcon name="brand" :size="26" /></div>
      <h3>心愈已锁定</h3>
      <p class="lock-tip">你离开了 {{ timeoutText }}，为保护隐私请重新验证</p>
      <div class="lock-user">{{ userStore.userInfo?.username || '用户' }}</div>
      <input
        v-model="password"
        type="password"
        class="lock-input"
        placeholder="请输入登录密码"
        autocomplete="current-password"
        @keyup.enter="unlock"
      />
      <p v-if="errorText" class="lock-error">{{ errorText }}</p>
      <button class="lock-btn" :disabled="verifying || !password" @click="unlock">
        {{ verifying ? '验证中...' : '解锁' }}
      </button>
      <button class="lock-logout" @click="relogin">使用其他账号登录</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ (e: 'unlock'): void }>()

const props = defineProps<{ timeoutMinutes: number }>()

const router = useRouter()
const userStore = useUserStore()

const password = ref('')
const verifying = ref(false)
const errorText = ref('')

const timeoutText = computed(() => {
  const m = props.timeoutMinutes
  return m >= 60 ? `${Math.round(m / 60)} 小时` : `${m} 分钟`
})

const unlock = async () => {
  if (!password.value || verifying.value) return
  verifying.value = true
  errorText.value = ''
  try {
    const email = userStore.userInfo?.email || ''
    const res = await userStore.login({ email, password: password.value })
    if (res && res.success) {
      password.value = ''
      emit('unlock')
    } else {
      errorText.value = res?.message || '密码不正确'
    }
  } catch {
    errorText.value = '验证失败，请检查网络后重试'
  } finally {
    verifying.value = false
  }
}

const relogin = async () => {
  await userStore.logout()
  router.replace('/login')
}
</script>

<style scoped>
.lock-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-sidebar);
  backdrop-filter: blur(14px);
}

.lock-card {
  width: 320px;
  padding: 28px 24px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  text-align: center;
  font-family: var(--font-ui);
}

.lock-logo {
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-card h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--text-primary);
}

.lock-tip {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.6;
}

.lock-user {
  display: inline-block;
  padding: 4px 12px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}

.lock-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  box-sizing: border-box;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.lock-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.lock-error {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--danger);
  text-align: left;
}

.lock-btn {
  width: 100%;
  height: 40px;
  margin-top: 14px;
  border: none;
  border-radius: var(--radius-ctl);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.lock-btn:hover {
  background: var(--accent-strong);
}

.lock-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.lock-logout {
  width: 100%;
  height: 34px;
  margin-top: 10px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 12.5px;
  cursor: pointer;
}

.lock-logout:hover {
  color: var(--danger);
}
</style>
