<<template>
  <TitleBar />
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
  <LoadingOverlay :visible="loadingStore.visible" :text="loadingStore.text" />
  <CustomDialog ref="dialogRef" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TitleBar from './components/TitleBar.vue'
import LoadingOverlay from './components/LoadingOverlay.vue'
import CustomDialog from './components/CustomDialog.vue'
import { useLoadingStore } from './stores/loading'
import { setDialogInstance } from './utils/dialog'

const loadingStore = useLoadingStore()
const dialogRef = ref()

onMounted(() => {
  setDialogInstance(dialogRef.value)
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.documentElement.style.height = '100vh'
  document.body.style.height = '100vh'
  
  // 将 contextmenu 事件监听移入 onMounted
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });
})
</script>

<style>
/* ===== 全局禁止文字选中 ===== */
* {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* 允许输入框和文本域内文字选中 */
input, textarea {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

/* 允许特定区域文字选中 */
.selectable-text {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

/* ===== 全局样式，不使用 scoped ===== */
html, body, #app {
  width: 100vw;
  height: 100vh;
  overflow: hidden !important;
  margin: 0;
  padding: 0;
}

.app-container {
  width: 100vw;
  height: calc(100vh - 36px);
  margin-top: 36px;
  overflow: hidden !important;
  position: relative;
}

/* ===== CSS 变量定义 - 必须在全局 ===== */
:root {
  --bg-primary: #f6f8fc;
  --bg-secondary: #fff;
  --bg-sidebar: #fff;
  --text-primary: #2c3e50;
  --text-secondary: #666;
  --text-muted: #999;
  --border-color: #e8ecf3;
  --card-bg: #fff;
  --input-bg: #f5f7fa;
  --menu-bg: #f5f7fa;
  --menu-active: #73a9d8;
  --shadow: rgba(0,0,0,0.08);
  --msg-ai-bg: #e6f2fc;
  --msg-user-bg: #f8d8e7;
}

/* ===== 深色模式变量 ===== */
html.dark {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-sidebar: #0f3460;
  --text-primary: #eaeaea;
  --text-secondary: #b8b8b8;
  --text-muted: #888;
  --border-color: #2a2a4a;
  --card-bg: #16213e;
  --input-bg: #1a1a2e;
  --menu-bg: #1a1a2e;
  --menu-active: #e94560;
  --shadow: rgba(0,0,0,0.3);
  --msg-ai-bg: #1e3a5f;
  --msg-user-bg: #5c2a42;
}

/* 页面切换动画 */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
