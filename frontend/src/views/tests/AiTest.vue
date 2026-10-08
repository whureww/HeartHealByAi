<template>
  <div class="do-test-page">
    <div class="test-header">
      <button class="btn-back" @click="router.back()">
        <AppIcon name="back" :size="15" />
        返回
      </button>
      <h3>AI 智能测评</h3>
      <span class="progress" v-if="phase === 'answering'">{{ currentIndex + 1 }} / {{ questions.length }}</span>
    </div>
    <div class="progress-track" v-if="phase === 'answering'">
      <div
        class="progress-fill"
        :style="{ transform: 'scaleX(' + (questions.length ? (currentIndex + 1) / questions.length : 0) + ')' }"
      ></div>
    </div>

    <!-- 生成中 -->
    <div v-if="phase === 'generating'" class="status-area">
      <div class="ai-spinner"></div>
      <p class="status-title">AI 正在为你生成专属问卷...</p>
      <p class="status-sub">根据常见心理健康维度实时生成，每次内容都不同</p>
    </div>

    <div v-else-if="phase === 'error'" class="status-area">
      <p class="status-title">{{ errorMsg || '生成失败' }}</p>
      <button class="btn-retry" @click="generate">重新生成</button>
    </div>

    <!-- 作答区 -->
    <div class="question-area" v-else-if="phase === 'answering' && currentQuestion">
      <div class="question-card">
        <div class="question-number">第 {{ currentIndex + 1 }} 题</div>
        <div class="question-content">{{ currentQuestion.content }}</div>

        <div class="options">
          <div
            v-for="option in currentQuestion.options"
            :key="option.label"
            class="option"
            :class="{ selected: currentAnswer?.label === option.label }"
            @click="selectOption(option)"
          >
            <div class="option-label">{{ option.label }}</div>
            <div class="option-text">{{ option.text }}</div>
            <AppIcon
              v-if="currentAnswer?.label === option.label"
              name="check"
              :size="16"
              class="option-check"
            />
          </div>
        </div>
      </div>

      <div class="nav-buttons">
        <button
          class="btn-nav"
          :disabled="currentIndex === 0"
          @click="prevQuestion"
        >
          上一题
        </button>
        <button
          v-if="currentIndex < questions.length - 1"
          class="btn-nav btn-primary"
          :disabled="!currentAnswer"
          @click="nextQuestion"
        >
          下一题
        </button>
        <button
          v-else
          class="btn-nav btn-primary"
          :disabled="!currentAnswer || submitting"
          @click="handleSubmit"
        >
          {{ submitting ? 'AI 分析中...' : '提交' }}
        </button>
      </div>
    </div>

    <!-- AI 评分中 -->
    <div v-else-if="phase === 'scoring'" class="status-area">
      <div class="ai-spinner"></div>
      <p class="status-title">AI 正在分析你的回答...</p>
      <p class="status-sub">结合每一题的选择综合评估，请稍候</p>
    </div>

    <!-- 结果 -->
    <div v-if="phase === 'result'" class="result-modal">
      <div class="result-card">
        <div class="result-icon"><AppIcon name="check" :size="28" /></div>
        <h3>测评完成</h3>
        <div class="result-score">综合评分：{{ resultData?.total_score }}</div>
        <div class="result-level" :class="resultLevelClass">{{ resultData?.result_level }}</div>
        <p class="result-desc">{{ resultData?.result_desc }}</p>
        <div v-if="resultData?.analysis" class="result-analysis">{{ resultData.analysis }}</div>
        <button class="btn-close" @click="closeResult">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { generateAiTest, submitAiTest } from '@/api/tests'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { error, success } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

type Phase = 'generating' | 'answering' | 'scoring' | 'result' | 'error'

const router = useRouter()
const phase = ref<Phase>('generating')
const errorMsg = ref('')
const questions = ref<any[]>([])
const answers = ref<(any | undefined)[]>([])
const paperId = ref<number | undefined>(undefined)
const currentIndex = ref(0)
const submitting = ref(false)
const resultData = ref<any>(null)

const currentQuestion = computed(() => questions.value[currentIndex.value])
const currentAnswer = computed(() => answers.value[currentIndex.value])

const resultLevelClass = computed(() => {
  const level = resultData.value?.result_level
  if (level?.includes('重度')) return 'level-severe'
  if (level?.includes('中度')) return 'level-moderate'
  if (level?.includes('轻度')) return 'level-mild'
  return 'level-normal'
})

const generate = async () => {
  phase.value = 'generating'
  errorMsg.value = ''
  try {
    const res = await generateAiTest()
    questions.value = res.data?.questions || []
    paperId.value = res.data?.paper_id
    answers.value = new Array(questions.value.length).fill(undefined)
    currentIndex.value = 0
    phase.value = 'answering'
  } catch (e: any) {
    errorMsg.value = e?.message || 'AI 生成失败，请稍后重试'
    phase.value = 'error'
  }
}

onMounted(generate)

const selectOption = (option: any) => {
  answers.value[currentIndex.value] = { label: option.label, text: option.text, score: option.score }
}

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  }
}

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const handleSubmit = async () => {
  submitting.value = true
  phase.value = 'scoring'
  try {
    const res = await submitAiTest({
      paper_id: paperId.value,
      answers: answers.value.map(a => a || { label: '', text: '', score: 0 })
    })
    resultData.value = res.data
    phase.value = 'result'
    success('AI 测评完成')
  } catch (e: any) {
    error(e?.message || 'AI 评分失败')
    phase.value = 'answering'
  } finally {
    submitting.value = false
  }
}

const closeResult = () => {
  phase.value = 'result'
  router.push('/dashboard')
}
</script>

<style scoped>
.do-test-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.test-header {
  display: flex;
  align-items: center;
  padding: 14px 24px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 7px 14px;
  border-radius: var(--radius-ctl);
  transition: all 0.2s var(--ease-out);
}

.btn-back:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.test-header h3 {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.progress {
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 3px;
  background: var(--accent-soft);
  flex-shrink: 0;
}

.progress-fill {
  height: 100%;
  width: 100%;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  transform-origin: left center;
  transition: transform 0.3s var(--ease-out);
}

.status-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  text-align: center;
}

.ai-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  margin-bottom: 18px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-title {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
  margin: 0 0 8px;
}

.status-sub {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
}

.btn-retry {
  margin-top: 18px;
  padding: 9px 28px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 14px;
  cursor: pointer;
}

.btn-retry:hover {
  background: var(--accent-strong);
}

.question-area {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.question-card {
  background: var(--card-bg);
  border-radius: var(--radius-card);
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.question-number {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 12px;
}

.question-content {
  font-size: 16px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 24px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  display: flex;
  align-items: center;
  padding: 13px 16px;
  background: var(--input-bg);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  border: 1px solid var(--border-color);
}

.option:hover {
  border-color: var(--border-strong);
  background: var(--accent-soft);
}

.option.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.option-label {
  padding: 3px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  margin-right: 14px;
  flex-shrink: 0;
}

.option-text {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.option-check {
  color: var(--accent);
  flex-shrink: 0;
}

.nav-buttons {
  display: flex;
  gap: 12px;
  padding: 0 24px 24px;
}

.btn-nav {
  flex: 1;
  height: 44px;
  border-radius: var(--radius-ctl);
  border: 1px solid var(--border-color);
  font-size: 14px;
  cursor: pointer;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s var(--ease-out);
}

.btn-nav:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-nav:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
  font-weight: 600;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
  color: var(--on-accent);
}

.result-modal {
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

.result-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  padding: 32px;
  width: 90%;
  max-width: 460px;
  max-height: 85vh;
  overflow-y: auto;
  text-align: center;
}

.result-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.result-card h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
}

.result-score {
  font-size: 32px;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  margin-bottom: 10px;
}

.result-level {
  font-size: 16px;
  font-weight: 600;
  padding: 7px 20px;
  border-radius: 16px;
  display: inline-block;
  margin-bottom: 16px;
}

.level-normal { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.level-mild { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
.level-moderate { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.level-severe { background: color-mix(in srgb, var(--danger) 28%, transparent); color: var(--danger); }

.result-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0 0 16px;
}

.result-analysis {
  text-align: left;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  padding: 14px 16px;
  margin-bottom: 20px;
  white-space: pre-wrap;
}

.btn-close {
  width: 100%;
  height: 44px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.btn-close:hover {
  background: var(--accent-strong);
}
</style>
