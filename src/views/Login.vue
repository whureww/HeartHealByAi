<<template>
  <div class="page">
    <div class="card login-card">
      <div class="logo-box">
        <div class="logo-avatar"></div>
        <h2>心愈 AI心理系统</h2>
        <p>私密倾诉 · 测评 · 专家问诊 · 数据分析</p>
      </div>

      <div class="input-group" :class="{ shake: showError.email }">
        <input
          v-model="form.email"
          type="email"
          @focus="showError.email = false"
          @blur="validateEmail"
          placeholder=" "
        />
        <span class="text" :class="{ red: showError.email }">
          {{ showError.email ? '请输入有效邮箱' : '邮箱' }}
        </span>
      </div>

      <div class="input-group" :class="{ shake: showError.password }">
        <input
          v-model="form.password"
          type="password"
          @focus="showError.password = false"
          @blur="validatePwd"
          placeholder=" "
        />
        <span class="text" :class="{ red: showError.password }">
          {{ showError.password ? '密码至少6位' : '密码' }}
        </span>
      </div>

      <button class="btn login-btn" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <div class="links">
        <a href="#" @click.prevent="goTo('/register')">注册账号</a>
        <a href="#" @click.prevent="goTo('/forget-password')">忘记密码</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useLoadingStore } from '@/stores/loading'
import { error } from '@/utils/dialog'

const router = useRouter()
const userStore = useUserStore()
const loadingStore = useLoadingStore()

const form = ref({ email: '', password: '' })
const loading = ref(false)
const showError = ref({ email: false, password: false })

function autoHideError(field: 'email' | 'password') {
  setTimeout(() => {
    showError.value[field] = false
  }, 3000)
}

const validateEmail = () => {
  const reg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/
  showError.value.email = !form.value.email || !reg.test(form.value.email)
  if (showError.value.email) autoHideError('email')
}
const validatePwd = () => {
  showError.value.password = !form.value.password || form.value.password.length < 6
  if (showError.value.password) autoHideError('password')
}

const goTo = (path: string) => {
  loadingStore.show('页面切换中...')
  setTimeout(() => {
    router.push(path)
    loadingStore.hide()
  }, 400)
}

const handleLogin = async () => {
  console.log('========== 登录流程开始 ==========')
  
  validateEmail()
  validatePwd()
  if (showError.value.email || showError.value.password) {
    console.log('表单验证失败')
    return
  }

  try {
    loading.value = true
    loadingStore.show('登录中...')
    
    console.log('1. 准备调用 userStore.login:', form.value)
    
    const res = await userStore.login(form.value)
    console.log('2. userStore.login 返回:', res)
    
    if (res && res.success) {
      console.log('3. 登录成功，准备获取用户信息')
      await userStore.getInfo()
      console.log('4. 用户信息:', userStore.userInfo)
      
      setTimeout(async () => {
        await router.replace('/dashboard')
        loadingStore.hide()
        loading.value = false
        console.log('========== 登录流程完成 ==========')
      }, 800)
    } else {
      console.log('登录失败，响应:', res)
      loadingStore.hide()
      loading.value = false
      await error(res?.message || '登录失败', '登录失败')
    }
  } catch (e: any) {
    console.error('========== 登录异常 ==========')
    console.error('错误对象:', e)
    console.error('错误消息:', e?.message)
    console.error('错误响应:', e?.response)
    console.error('错误配置:', e?.config)
    loadingStore.hide()
    loading.value = false
    await error(e?.message || '登录失败，请检查网络连接', '登录失败')
  }
}
</script>

<style scoped>
.page {
  width: 100vw;
  height: calc(100vh - 36px);
  background: #f6f8fc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden !important;
  box-sizing: border-box;
  padding: 16px;
}

.login-card {
  background: #fff;
  width: 100%;
  max-width: 340px;
  max-height: calc(100vh - 36px - 32px);
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  text-align: center;
  margin: auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

.logo-box {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.logo-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #73a9d8, #b4d8f0);
  margin: 0 auto 10px;
}

.logo-box h2 {
  font-size: 18px;
  color: #2c3e50;
  margin-bottom: 4px;
}

.logo-box p {
  font-size: 12px;
  color: #999;
}

.input-group {
  position: relative;
  margin-bottom: 12px;
  width: 100%;
  height: 42px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.input-group input {
  width: 100%;
  height: 100%;
  padding: 0 14px;
  background: #f5f7fa;
  border-radius: 10px;
  border: 1.5px solid #e5e9f2;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-group input:focus {
  border-color: #73a9d8;
  background: #fff;
}

.input-group input:not(:placeholder-shown) + .text,
.input-group input:focus + .text {
  display: none;
}

.input-group .text {
  position: absolute;
  left: 14px;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #9ca3af;
  pointer-events: none;
}

.input-group .text.red {
  color: #ef4444;
  display: flex !important;
}

.input-group.shake {
  animation: shake 0.28s ease-in-out;
}

@keyframes shake {
  0%,100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.btn {
  width: 100%;
  height: 42px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
  font-weight: 500;
  flex-shrink: 0;
  box-sizing: border-box;
}

.btn:disabled {
  opacity: 0.6;
}

.login-btn {
  background: #73a9d8;
  color: #fff;
  margin-top: 4px;
}

.login-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.links {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 12px;
  flex-shrink: 0;
}

.links a {
  color: #73a9d8;
  text-decoration: none;
}

.links a:hover {
  text-decoration: underline;
}
</style>
