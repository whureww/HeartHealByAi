<template>
  <div class="do-test-page">
    <div class="test-header">
      <button class="btn-back" @click="router.back()">
        <AppIcon name="back" :size="15" />
        返回
      </button>
      <h3>{{ testInfo?.name }}</h3>
      <span class="progress">{{ currentIndex + 1 }} / {{ questions.length }}</span>
    </div>
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ transform: 'scaleX(' + (questions.length ? (currentIndex + 1) / questions.length : 0) + ')' }"
      ></div>
    </div>

    <div class="question-area" v-if="currentQuestion">
      <div class="question-card">
        <div class="question-number">第 {{ currentIndex + 1 }} 题</div>
        <div class="question-content">{{ currentQuestion.content }}</div>

        <div class="options">
          <div
            v-for="option in currentQuestion.options"
            :key="option.score"
            class="option"
            :class="{ selected: answers[currentIndex] === option.score }"
            @click="selectOption(option.score)"
          >
            <div class="option-score">{{ option.score }}分</div>
            <div class="option-text">{{ option.text }}</div>
            <AppIcon
              v-if="answers[currentIndex] === option.score"
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
          :disabled="answers[currentIndex] === undefined"
          @click="nextQuestion"
        >
          下一题
        </button>
        <button
          v-else
          class="btn-nav btn-primary"
          :disabled="answers[currentIndex] === undefined || submitting"
          @click="handleSubmit"
        >
          {{ submitting ? '提交中...' : '提交' }}
        </button>
      </div>
    </div>

    <!-- 结果弹窗 -->
    <div v-if="showResult" class="result-modal">
      <div class="result-card">
        <div class="result-icon"><AppIcon name="check" :size="28" /></div>
        <h3>测评完成</h3>
        <div class="result-score">得分：{{ resultData?.total_score }}</div>
        <div class="result-level" :class="resultLevelClass">{{ resultData?.result_level }}</div>
        <p class="result-desc">{{ resultData?.result_desc }}</p>
        <button class="btn-close" @click="closeResult">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTestQuestions, submitTest as submitTestApi } from '@/api/tests'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { error, success } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'


const route = useRoute()
const router = useRouter()
const testId = parseInt(route.params.id as string)
const testInfo = ref<any>(null)
const questions = ref<any[]>([])
const answers = ref<number[]>([])
const currentIndex = ref(0)
const submitting = ref(false)
const showResult = ref(false)
const resultData = ref<any>(null)

const currentQuestion = computed(() => questions.value[currentIndex.value])

const resultLevelClass = computed(() => {
  const level = resultData.value?.result_level
  if (level?.includes('重度')) return 'level-severe'
  if (level?.includes('中度')) return 'level-moderate'
  if (level?.includes('轻度')) return 'level-mild'
  return 'level-normal'
})

onMounted(async () => {
  try {
    const res = await getTestQuestions(testId)
    testInfo.value = res.data?.test
    questions.value = res.data?.questions || []
    answers.value = new Array(questions.value.length).fill(undefined)
  } catch (e: any) {
    error(e?.message || '获取题目失败')
    router.back()
  }
})

const selectOption = (score: number) => {
  answers.value[currentIndex.value] = score
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
  const unanswered = answers.value.findIndex(a => a === undefined)
  if (unanswered !== -1) {
    currentIndex.value = unanswered
    error(`第 ${unanswered + 1} 题未作答`)
    return
  }

  submitting.value = true
  try {
    const submitData = {
      test_id: testId,
      answers: questions.value.map((q, i) => ({
        question_id: q.id,
        score: answers.value[i]
      }))
    }

    const res = await submitTestApi(submitData)
    resultData.value = res.data
    showResult.value = true
    success('测评提交成功')
  } catch (e: any) {
    error(e?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}


const closeResult = () => {
  showResult.value = false
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

.option-score {
  padding: 3px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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
  background: rgba(0,0,0,0.5);
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
  max-width: 360px;
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
  font-size: 36px;
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
  margin: 0 0 24px;
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
