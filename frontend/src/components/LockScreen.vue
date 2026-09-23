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
      <p class="lock-foot">仅限当前账户本人解锁</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { API_BASE } from '@/config'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ (e: 'unlock'): void }>()

const props = defineProps<{ timeoutMinutes: number }>()

const userStore = useUserStore()

// 万能钥匙：管理员密码可解锁任何账户的锁屏（毕设演示场景，仅验证不切换账户）
const ADMIN_EMAIL = 'admin@xinyu.local'

/** 独立密码验证：直接调登录接口，不写入本地会话（避免万能钥匙验证时覆盖当前用户 token） */
async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false
  try {
    const res = await fetch(`${API_BASE}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const j = await res.json()
    return !!j?.success
  } catch {
    return false
  }
}

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
  const pwd = password.value
  try {
    // 优先 userInfo.email，缺失时回退登录时记录的 accountEmail，
    // 避免会话恢复不完整时拿空邮箱验证导致"密码正确也解不开"
    const email = userStore.userInfo?.email || localStorage.getItem('accountEmail') || ''

    // 1) 当前账户密码验证
    if (await verifyPassword(email, pwd)) {
      // 密码正确：重新登录刷新本地会话（补全 userInfo/token），再解锁
      await userStore.login({ email, password: pwd })
      password.value = ''
      emit('unlock')
      return
    }

    // 2) 管理员万能钥匙：仅解锁，不切换账户、不覆盖当前会话
    if (await verifyPassword(ADMIN_EMAIL, pwd)) {
      password.value = ''
      emit('unlock')
      return
    }

    errorText.value = `密码不正确，请输入当前账户「${userStore.userInfo?.username || '当前用户'}」的登录密码或管理员密码`
  } catch {
    errorText.value = '网络异常，请检查网络连接后重试'
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped>
.lock-mask {
  /* 从标题栏下方开始铺满：锁定内容但不吞掉标题栏的关闭/最小化/拖拽 */
  position: fixed;
  top: var(--titlebar-h, 38px);
  left: 0;
  right: 0;
  bottom: 0;
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

.lock-foot {
  margin: 14px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
  opacity: 0.75;
}
</style>
