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
      <button class="lock-switch" :disabled="verifying" @click="switchAccount">切换账户重新登录</button>
      <p class="lock-foot">锁定期间会话已注销，解锁将换取新登录凭据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { API_BASE } from '@/config'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ (e: 'unlock'): void }>()

const props = defineProps<{ timeoutMinutes: number }>()

const userStore = useUserStore()
const router = useRouter()

// 万能钥匙：管理员密码可解锁任何账户的锁屏（毕设演示场景，解锁后需本人重新登录）
const ADMIN_EMAIL = 'admin@xinyu.local'

// 切换账户：清掉账户痕迹并回到登录页（锁屏遮罩随路由守卫卸载）
const switchAccount = async () => {
  localStorage.removeItem('accountEmail')
  await userStore.logoutForLock()
  router.replace('/login')
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

    if (!email) {
      errorText.value = '无法识别当前账户，请点击「切换账户」重新登录'
      verifying.value = false
      return
    }

    // 1) 当前账户密码验证：锁定时旧 token 已被注销，密码正确即重新登录换取新 token
    const rel = await userStore.login({ email, password: pwd })
    if (rel?.success) {
      password.value = ''
      emit('unlock')
      return
    }

    // 2) 管理员万能钥匙：以管理员身份登录换发新 token，解锁后恢复为本人会话
    const adminRel = await userStore.login({ email: ADMIN_EMAIL, password: pwd })
    if (adminRel?.success) {
      // 万能钥匙只是"钥匙"：登录态立刻交还给原账户（accountEmail 仍指向本人）
      // 退出管理员会话（服务端注销 admin token），恢复本地凭据为空，由本人下次登录重新建立
      await userStore.logoutForLock()
      password.value = ''
      emit('unlock')
      return
    }

    errorText.value = `密码不正确，请输入当前账户「${userStore.userInfo?.username || localStorage.getItem('accountEmail') || '当前用户'}」的登录密码或管理员密码`
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

.lock-switch {
  width: 100%;
  height: 34px;
  margin-top: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.lock-switch:hover {
  color: var(--accent);
}

.lock-foot {
  margin: 14px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
  opacity: 0.75;
}
</style>
