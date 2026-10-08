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

    <div v-else class="test-list">
      <!-- AI 智能测评：固定置顶，内容由 AI 实时生成 -->
      <div class="test-row ai-row" @click="onStartAiTest">
        <div class="test-icon ai-icon"><AppIcon name="edit" :size="19" /></div>
        <div class="test-body">
          <h3>AI 智能测评<span class="ai-badge">AI</span></h3>
          <p class="desc">由 AI 实时生成专属问卷，并根据你的回答智能评分与解读</p>
          <div class="test-meta">
            <span class="tag ai-tag">每次内容不同</span>
            <span class="tag">AI 评分解读</span>
            <span class="tag ai-tag category">智能生成</span>
          </div>
        </div>
        <div class="test-actions">
          <button class="btn-start btn-ai" @click.stop="onStartAiTest">开始测评</button>
          <AppIcon name="chevronRight" :size="16" class="row-arrow" />
        </div>
      </div>

      <div
        v-for="test in tests"
        :key="test.id"
        class="test-row"
        @click="onStartTest(test.id)"
      >
        <div class="test-icon"><AppIcon name="clipboard" :size="19" /></div>
        <div class="test-body">
          <h3>{{ test.name }}</h3>
          <p class="desc">{{ test.description }}</p>
          <div class="test-meta">
            <span class="tag">{{ test.total_questions }}题</span>
            <span class="tag">约{{ test.estimated_minutes }}分钟</span>
            <span class="tag category">{{ test.category }}</span>
          </div>
        </div>
        <div class="test-actions">
          <button class="btn-start" @click.stop="onStartTest(test.id)">开始测评</button>
          <AppIcon name="chevronRight" :size="16" class="row-arrow" />
        </div>
      </div>
    </div>

    <div class="history-link" @click="onViewHistory">
      <span>查看测评历史</span>
      <AppIcon name="chevronRight" :size="15" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTestList } from '@/api/tests'
import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits(['view-history', 'start-test', 'start-ai-test'])

const tests = ref<any[]>([])
const loading = ref(false)
const errorMsg = ref('')

const loadTests = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getTestList()

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

const onStartAiTest = () => {
  emit('start-ai-test')
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
  margin-bottom: 24px;
}

.header h2 {
  font-size: 20px;
  color: var(--text-primary);
  margin: 0 0 6px;
  font-weight: 600;
}

.header p {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
}

.status-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-secondary);
  font-size: 14px;
}

.status-msg.error {
  color: var(--danger);
}

.status-msg.empty {
  color: var(--text-muted);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
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
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), opacity 0.2s;
}

.btn-retry:hover {
  background: var(--accent-strong);
}

.test-list {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  margin-bottom: 20px;
}

.test-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.test-row:last-child {
  border-bottom: none;
}

.test-row:hover {
  background: var(--accent-soft);
}

/* AI 智能测评卡片 */
.ai-row {
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 65%);
}

.ai-icon {
  background: var(--accent);
  color: var(--on-accent);
}

.ai-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 20px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 10.5px;
  font-weight: 700;
  vertical-align: 2px;
  letter-spacing: 0.5px;
}

.ai-tag {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
  background: var(--accent-soft);
}

.btn-ai {
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
}

.ai-row:hover {
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 14%, transparent), var(--accent-soft) 65%);
}

.test-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.test-body {
  flex: 1;
  min-width: 0;
}

.test-row h3 {
  font-size: 14.5px;
  color: var(--text-primary);
  margin: 0 0 4px;
  font-weight: 600;
  line-height: 1.4;
}

.desc {
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.test-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 2px 10px;
  border-radius: 20px;
}

.tag.category {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
}

.test-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.row-arrow {
  color: var(--text-muted);
}

.btn-start {
  padding: 8px 18px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.btn-start:hover {
  background: var(--accent-strong);
}

.history-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px;
  color: var(--accent);
  font-size: 13.5px;
  cursor: pointer;
  transition: color 0.2s var(--ease-out);
}

.history-link:hover {
  color: var(--accent-strong);
}
</style>
