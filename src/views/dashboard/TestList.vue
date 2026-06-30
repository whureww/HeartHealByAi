<template>
  <div class="test-list-page">
    <div class="header">
      <h2>心理测评中心</h2>
      <p>选择适合您的专业心理测评，了解当下心理状态</p>
    </div>

    <div v-if="loading" class="status-msg">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="errorMsg" class="status-msg error">
      <p>{{ errorMsg }}</p>
      <button class="btn-retry" @click="loadTests">重新加载</button>
    </div>

    <div v-else-if="tests.length === 0" class="status-msg empty">
      <p>暂无可用的测评</p>
      <button class="btn-retry" @click="loadTests">刷新</button>
    </div>

    <div v-else class="test-grid">
      <div 
        v-for="test in tests" 
        :key="test.id" 
        class="test-card"
        @click="onStartTest(test.id)"
      >
        <div class="test-icon">📝</div>
        <h3>{{ test.name }}</h3>
        <p class="desc">{{ test.description }}</p>
        <div class="test-meta">
          <span class="tag">{{ test.total_questions }}题</span>
          <span class="tag">约{{ test.estimated_minutes }}分钟</span>
          <span class="tag category">{{ test.category }}</span>
        </div>
        <button class="btn-start">开始测评</button>
      </div>
    </div>

    <div class="history-link" @click="onViewHistory">
      <span>查看测评历史 →</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTestList } from '@/api/tests'

const emit = defineEmits(['view-history', 'start-test'])

const tests = ref<any[]>([])
const loading = ref(false)
const errorMsg = ref('')

const loadTests = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getTestList()
    console.log('API 返回:', res)         
    console.log('res.data:', res?.data)    
    
    
    if (res && res.data) {
      tests.value = res.data
    } else if (Array.isArray(res)) {
      tests.value = res
    } else {
      tests.value = []
    }
  } catch (e: any) {
    console.error('获取测评列表失败:', e)
    errorMsg.value = e?.message || '获取失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTests()
})

const onStartTest = (testId: number) => {
  emit('start-test', testId)
}

const onViewHistory = () => {
  emit('view-history')
}
</script>

<style scoped>
.test-list-page {
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
  background: var(--bg-primary);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.test-list-page::-webkit-scrollbar {
  width: 0px;
  background: transparent;
}


.header {
  margin-bottom: 28px;
}

.header h2 {
  font-size: 24px;
  color: var(--text-primary);
  margin-bottom: 8px;
  font-weight: 600;
}

.header p {
  font-size: 14px;
  color: var(--text-secondary);
}

.status-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-secondary);
  font-size: 15px;
}

.status-msg.error {
  color: #ef4444;
}

.status-msg.empty {
  color: var(--text-muted);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: #73a9d8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-retry {
  margin-top: 16px;
  padding: 8px 24px;
  background: #73a9d8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-retry:hover {
  opacity: 0.9;
}

.test-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.test-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.test-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  border-color: #73a9d8;
}

.test-icon {
  font-size: 40px;
  margin-bottom: 16px;
  line-height: 1;
}

.test-card h3 {
  font-size: 17px;
  color: var(--text-primary);
  margin-bottom: 10px;
  font-weight: 600;
  line-height: 1.4;
}

.desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.test-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.tag {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--menu-bg);
  padding: 4px 12px;
  border-radius: 20px;
}

.tag.category {
  background: #e3f0fc;
  color: #73a9d8;
}

.btn-start {
  width: 100%;
  height: 40px;
  background: #73a9d8;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-start:hover {
  background: #5a94c7;
}

.history-link {
  text-align: center;
  padding: 20px;
  color: #73a9d8;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-link:hover {
  text-decoration: underline;
}

:deep(html.dark) .test-card:hover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
}

:deep(html.dark) .tag.category {
  background: #1e3a5f;
  color: #73a9d8;
}
</style>
