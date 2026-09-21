<<template>
  <div class="page">
    <div class="card login-card">
      <div class="logo-box">
        <div class="logo-avatar"></div>
        <h2>创建账号</h2>
        <p>注册后即可开始使用</p>
      </div>

      <div class="input-group" :class="{ shake: showError.username }">
        <input v-model="form.username" @focus="showError.username = false" @blur="validateName" placeholder=" " />
        <span class="text" :class="{ red: showError.username }">{{ showError.username ? '用户名至少2位' : '用户名' }}</span>
      </div>

      <div class="input-group" :class="{ shake: showError.email }">
        <input v-model="form.email" type="email" @focus="showError.email = false" @blur="validateEmail" placeholder=" " />
        <span class="text" :class="{ red: showError.email }">{{ showError.email ? '邮箱格式不正确' : '邮箱' }}</span>
      </div>

      <div class="input-group" :class="{ shake: showError.password }">
        <input v-model="form.password" type="password" @focus="showError.password = false" @blur="validatePwd" placeholder=" " />
        <span class="text" :class="{ red: showError.password }">{{ showError.password ? '密码至少6位' : '密码' }}</span>
      </div>

      <div class="code-row" :class="{ shake: showError.code }">
        <div class="code-input-group">
          <input 
            v-model="form.code" 
            @focus="showError.code = false" 
            @blur="validateCode" 
            placeholder=" " 
          />
          <span class="text" :class="{ red: showError.code }">
            {{ showError.code ? '6位验证码' : '验证码' }}
          </span>
        </div>
        <button 
          class="btn-send" 
          @click="sendCode" 
          :disabled="loading.code || codeText !== '发送验证码'"
        >
          {{ codeText }}
        </button>
      </div>

      <button class="btn login-btn" @click="handleRegister" :disabled="loading.register">
        {{ loading.register ? '注册中...' : '注册' }}
      </button>

      <p class="link">
        <a href="#" @click.prevent="goTo('/login')">已有账号？返回登录</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useLoadingStore } from '@/stores/loading'
import { sendRegisterCode } from '@/api/user'
import { alert, success, error } from '@/utils/dialog'

const router = useRouter()
const userStore = useUserStore()
const loadingStore = useLoadingStore()

const form = ref({ username: '', email: '', password: '', code: '' })
const loading = ref({ register: false, code: false })
const codeText = ref('发送验证码')
let countdown: number | null = null

const showError = ref({ username: false, email: false, password: false, code: false })

function autoHideError(field: 'username' | 'email' | 'password' | 'code') {
  setTimeout(() => { showError.value[field] = false }, 3000)
}

const validateName = () => {
  showError.value.username = !form.value.username || form.value.username.length < 2
  if (showError.value.username) autoHideError('username')
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
const validateCode = () => {
  showError.value.code = !form.value.code || form.value.code.length !== 6
  if (showError.value.code) autoHideError('code')
}

const goTo = (path: string) => {
  loadingStore.show('页面切换中...')
  setTimeout(() => { router.push(path); loadingStore.hide() }, 400)
}

const sendCode = async () => {
  validateEmail()
  if (showError.value.email) return
  loading.value.code = true
  try {
    await sendRegisterCode({ email: form.value.email })
    await alert('验证码已发送，请检查邮箱', '已发送')
    let sec = 60
    codeText.value = `${sec}秒后重发`
    countdown = window.setInterval(() => {
      sec--
      codeText.value = `${sec}秒后重发`
      if (sec <= 0) { clearInterval(countdown!); countdown = null; codeText.value = '发送验证码' }
    }, 1000)
  } catch (e: any) { 
    await error(e?.message || '发送失败', '发送失败') 
  }
  finally { loading.value.code = false }
}

const handleRegister = async () => {
  validateName(); validateEmail(); validatePwd(); validateCode()
  if (showError.value.username || showError.value.email || showError.value.password || showError.value.code) return
  
  try {
    loading.value.register = true
    loadingStore.show('注册中...')
    
    const res = await userStore.register(form.value)
    
    if (res.success) {
      await userStore.getInfo()
      setTimeout(async () => { 
        loadingStore.hide(); 
        loading.value.register = false; 
        await success('注册成功', '注册成功'); 
        await router.replace('/dashboard')
      }, 800)
    }
  } catch (e: any) { 
    loadingStore.hide(); 
    loading.value.register = false; 
    await error(e?.message || '注册失败', '注册失败') 
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
  margin-bottom: 16px;
  flex-shrink: 0;
}

.logo-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #73a9d8, #b4d8f0);
  margin: 0 auto 8px;
}

.logo-box h2 {
  font-size: 17px;
  color: #2c3e50;
  margin-bottom: 4px;
}

.logo-box p {
  font-size: 12px;
  color: #999;
}

.input-group {
  position: relative;
  margin-bottom: 10px;
  width: 100%;
  height: 40px;
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

.code-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  width: 100%;
  height: 40px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.code-input-group {
  position: relative;
  flex: 1;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.code-input-group input {
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

.code-input-group input:focus {
  border-color: #73a9d8;
  background: #fff;
}

.code-input-group input:not(:placeholder-shown) + .text,
.code-input-group input:focus + .text {
  display: none;
}

.code-input-group .text {
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

.code-input-group .text.red {
  color: #ef4444;
  display: flex !important;
}

.btn-send {
  width: 100px;
  height: 100%;
  background: #e3f0fc;
  color: #73a9d8;
  font-size: 12px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
  box-sizing: border-box;
}

.btn-send:hover:not(:disabled) {
  background: #73a9d8;
  color: #fff;
}

.btn-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn {
  width: 100%;
  height: 40px;
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

.link {
  text-align: center;
  margin-top: 14px;
  font-size: 12px;
  flex-shrink: 0;
}

.link a {
  color: #73a9d8;
  text-decoration: none;
}

.link a:hover {
  text-decoration: underline;
}
</style>
