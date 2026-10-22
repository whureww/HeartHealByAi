<template>
  <div class="page-container">
    <div class="page-header">
      <h2>{{ isEdit ? $t('admin.test.edit') : $t('admin.test.create') }}</h2>
    </div>

    <!-- 模板栏（仅专家）：套用已存样板 / 把当前问卷存为模板 -->
    <div v-if="isExpert" class="tpl-bar">
      <span class="tpl-label">{{ $t('expert.myTests.tplLabel') }}</span>
      <select v-model="selectedTplId" class="tpl-select" :disabled="templates.length === 0">
        <option value="">{{ templates.length ? $t('expert.myTests.tplSelect') : $t('expert.myTests.tplEmpty') }}</option>
        <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">
          {{ tpl.name }}（{{ $t('admin.test.questionCount', { n: tpl.question_count }) }}）
        </option>
      </select>
      <button class="btn-tpl" :disabled="!selectedTplId" @click="applyTemplate">
        <AppIcon name="check" :size="13" />
        {{ $t('expert.myTests.tplApply') }}
      </button>
      <button class="btn-tpl btn-tpl-danger" :disabled="!selectedTplId" @click="removeTemplate">
        <AppIcon name="trash" :size="13" />
        {{ $t('expert.myTests.tplDelete') }}
      </button>
      <span class="tpl-spacer"></span>
      <button class="btn-tpl btn-tpl-save" :disabled="isSubmitting" @click="saveAsTemplate">
        <AppIcon name="plus" :size="13" />
        {{ $t('expert.myTests.tplSave') }}
      </button>
    </div>

    <div class="form-section">
      <h3>{{ $t('admin.test.basicInfo') }}</h3>
      <div class="form-grid">
        <div class="form-group" v-if="!isExpert">
          <label>{{ $t('admin.test.fCode') }} <span class="required">*</span></label>
          <input v-model="form.code" :placeholder="$t('admin.test.phCode')" :disabled="isEdit" />
        </div>
        <div class="form-group">
          <label>{{ $t('admin.test.fName') }} <span class="required">*</span></label>
          <input v-model="form.name" :placeholder="$t('admin.test.phName')" />
        </div>
        <div class="form-group">
          <label>{{ $t('admin.test.fCategory') }} <span class="required">*</span></label>
          <select v-model="form.category">
            <option value="emotion">{{ $t('admin.test.catEmotion') }}</option>
            <option value="stress">{{ $t('admin.test.catStress') }}</option>
            <option value="personality">{{ $t('admin.test.catPersonality') }}</option>
            <option value="cognitive">{{ $t('admin.test.catCognitive') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('admin.test.fCount') }}</label>
          <div class="count-display">{{ $t('admin.test.questionCount', { n: form.questions.length }) }}</div>
        </div>
        <div class="form-group">
          <label>{{ $t('admin.test.fMinutes') }}</label>
          <input v-model.number="form.estimated_minutes" type="number" placeholder="5" />
        </div>
        <div class="form-group">
          <label>{{ $t('admin.test.fScoring') }}</label>
          <select v-model="form.scoring_method">
            <option value="sum">{{ $t('admin.test.scoringSum') }}</option>
            <option value="average">{{ $t('admin.test.scoringAvg') }}</option>
            <option value="weighted">{{ $t('admin.test.scoringWeighted') }}</option>
          </select>
        </div>
      </div>
      <div class="form-group full-width">
        <label>{{ $t('admin.test.fDesc') }}</label>
        <textarea v-model="form.description" rows="3" :placeholder="$t('admin.test.phDesc')"></textarea>
      </div>
    </div>

    <!-- 结果等级设置 -->
    <div class="form-section">
      <h3>{{ $t('admin.test.levelSection') }}</h3>
      <div v-for="(level, index) in form.result_levels" :key="index" class="level-card">
        <div class="level-header">
          <span>{{ $t('admin.test.levelIndex', { n: index + 1 }) }}</span>
          <button class="btn-icon" @click="removeLevel(index)" :title="$t('admin.test.delLevel')">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('admin.test.fMin') }}</label>
            <input v-model.number="level.min" type="number" placeholder="0" />
          </div>
          <div class="form-group">
            <label>{{ $t('admin.test.fMax') }}</label>
            <input v-model.number="level.max" type="number" placeholder="100" />
          </div>
          <div class="form-group">
            <label>{{ $t('admin.test.fLevelName') }}</label>
            <input v-model="level.level" :placeholder="$t('admin.test.phLevelName')" />
          </div>
        </div>
        <div class="form-group full-width">
          <label>{{ $t('admin.test.fLevelDesc') }}</label>
          <textarea v-model="level.desc" rows="2" :placeholder="$t('admin.test.phLevelDesc')"></textarea>
        </div>
      </div>
      <button class="btn-add" @click="addLevel">
        <AppIcon name="plus" :size="14" />
        {{ $t('admin.test.addLevel') }}
      </button>
    </div>

    <!-- 题目设置 -->
    <div class="form-section">
      <h3>{{ $t('admin.test.questionSection') }}</h3>
      <div v-for="(question, qIndex) in form.questions" :key="qIndex" class="question-card">
        <div class="question-header">
          <span>{{ $t('admin.test.questionIndex', { n: qIndex + 1 }) }}</span>
          <button class="btn-icon" @click="removeQuestion(qIndex)" :title="$t('admin.test.delQuestion')">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
        <div class="form-group full-width">
          <label>{{ $t('admin.test.fContent') }} <span class="required">*</span></label>
          <input v-model="question.content" :placeholder="$t('admin.test.phContent')" />
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('admin.test.fDimension') }}</label>
            <input v-model="question.dimension" :placeholder="$t('admin.test.phDimension')" />
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input v-model="question.reverse_scoring" type="checkbox" />
              {{ $t('admin.test.reverseScoring') }}
            </label>
          </div>
        </div>

        <!-- 选项设置 -->
        <div class="options-section">
          <label>{{ $t('admin.test.optionsSection') }}</label>
          <div v-for="(option, oIndex) in question.options" :key="oIndex" class="option-row">
            <input v-model.number="option.score" type="number" :placeholder="$t('admin.test.phScore')" class="score-input" />
            <input v-model="option.text" :placeholder="$t('admin.test.phOptionText')" class="text-input" />
            <button class="btn-icon" @click="removeOption(qIndex, oIndex)" :title="$t('admin.test.delOption')">
              <AppIcon name="close" :size="14" />
            </button>
          </div>
          <button class="btn-add-small" @click="addOption(qIndex)">
            <AppIcon name="plus" :size="13" />
            {{ $t('admin.test.addOption') }}
          </button>
        </div>
      </div>
      <button class="btn-add" @click="addQuestion">
        <AppIcon name="plus" :size="14" />
        {{ $t('admin.test.addQuestion') }}
      </button>
    </div>

    <div class="form-actions">
      <button class="btn-cancel" @click="handleCancel">{{ $t('admin.test.cancel') }}</button>
      <button class="btn-submit" :disabled="isSubmitting" @click="submit">
        <span v-if="isSubmitting">{{ $t('admin.test.saving') }}</span>
        <span v-else>{{ $t('admin.test.save') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { createTest } from '@/api/admin'
import { createMyTest, getMyTestDetail, updateMyTest, getTestTemplates, saveTestTemplate, deleteTestTemplate } from '@/api/expert'
import { alert, confirm, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()

interface QuestionOption {
  score: number
  text: string
}

interface Question {
  question_number: number
  content: string
  dimension: string
  reverse_scoring: boolean
  options: QuestionOption[]
}

interface ResultLevel {
  min: number
  max: number
  level: string
  desc: string
}

interface TestForm {
  code: string
  name: string
  description: string
  category: string
  total_questions: number
  estimated_minutes: number
  scoring_method: string
  result_levels: ResultLevel[]
  questions: Question[]
}

// mode/testId：嵌入 Dashboard 专家工作台时由父组件传入，避免依赖当前路由 meta
const props = defineProps<{ mode?: 'admin' | 'expert'; testId?: number | null }>()
const emit = defineEmits<{ (e: 'saved'): void; (e: 'cancel'): void }>()

const route = useRoute()
const router = useRouter()
const isEdit = ref(false)
const isSubmitting = ref(false)
// 专家模式：嵌入专家工作台（mode=expert）或独立路由（meta.role=2）。编码由服务端自动生成，提交走 /expert/tests，仅待审核状态可编辑
const isExpert = props.mode === 'expert' || route.meta.role === 2
const isEmbedded = props.mode === 'expert'
const effectiveId = computed<number | null>(() =>
  props.testId != null ? Number(props.testId) : (route.params.id ? Number(route.params.id) : null)
)
const handleCancel = () => {
  if (isEmbedded) emit('cancel')
  else router.back()
}

const form = ref<TestForm>({
  code: '',
  name: '',
  description: '',
  category: 'emotion',
  total_questions: 20,
  estimated_minutes: 5,
  scoring_method: 'sum',
  result_levels: [
    { min: 20, max: 39, level: '正常', desc: '您的心理状态良好。' },
    { min: 40, max: 49, level: '轻度', desc: '您存在轻度问题，建议关注。' },
    { min: 50, max: 59, level: '中度', desc: '建议寻求专业帮助。' },
    { min: 60, max: 80, level: '重度', desc: '强烈建议尽快寻求专业帮助。' }
  ],
  questions: []
})

const addLevel = () => {
  form.value.result_levels.push({ min: 0, max: 100, level: '', desc: '' })
}

const removeLevel = (index: number) => {
  form.value.result_levels.splice(index, 1)
}

const addQuestion = () => {
  const newQuestion: Question = {
    question_number: form.value.questions.length + 1,
    content: '',
    dimension: '',
    reverse_scoring: false,
    options: [
      { score: 1, text: '没有或很少时间' },
      { score: 2, text: '小部分时间' },
      { score: 3, text: '相当多时间' },
      { score: 4, text: '绝大部分或全部时间' }
    ]
  }
  form.value.questions.push(newQuestion)
}

const removeQuestion = (index: number) => {
  form.value.questions.splice(index, 1)
  form.value.questions.forEach((q, i) => q.question_number = i + 1)
}

const addOption = (qIndex: number) => {
  const options = form.value.questions[qIndex].options
  // 分值接着上一个选项递增（默认 1/2/3/4，再加即为 5）
  const lastScore = options.length ? Number(options[options.length - 1]?.score) : 0
  options.push({ score: (Number.isFinite(lastScore) ? lastScore : 0) + 1, text: '' })
}

const removeOption = (qIndex: number, oIndex: number) => {
  form.value.questions[qIndex].options.splice(oIndex, 1)
}

// ===== 问卷模板（仅专家）：套用样板 / 存为模板 / 删除模板 =====
const templates = ref<any[]>([])
const selectedTplId = ref<number | ''>('')

const loadTemplates = async () => {
  try {
    const res: any = await getTestTemplates()
    templates.value = res.data || []
  } catch {
    templates.value = []
  }
}

// 套用模板：整表回填（名称/描述/分级/题目全部以模板为准，专家可在此基础上微调）
const applyTemplate = async () => {
  const tpl = templates.value.find((x) => x.id === selectedTplId.value)
  if (!tpl) return
  form.value = {
    code: '',
    name: tpl.name || '',
    description: tpl.description || '',
    category: tpl.category || 'emotion',
    total_questions: (tpl.questions || []).length,
    estimated_minutes: tpl.estimated_minutes || 5,
    scoring_method: tpl.scoring_method || 'sum',
    result_levels: (tpl.result_levels || []).map((l: any) => ({
      min: Number(l.min) || 0, max: Number(l.max) || 100, level: l.level || '', desc: l.desc || ''
    })),
    questions: (tpl.questions || []).map((q: any, i: number) => ({
      question_number: i + 1,
      content: q.content || '',
      dimension: q.dimension || '',
      reverse_scoring: !!q.reverse_scoring,
      options: (q.options || []).map((o: any) => ({ score: Number(o.score) || 0, text: o.text || '' }))
    }))
  }
  await success(t('expert.myTests.tplApplied'))
}

// 把当前表单存为私人模板（名称 + 至少一题）
const saveAsTemplate = async () => {
  if (!form.value.name || !String(form.value.name).trim()) {
    await alert(t('expert.myTests.nameRequired'))
    return
  }
  if (form.value.questions.length === 0) {
    await alert(t('admin.test.errNeedQuestion'))
    return
  }
  isSubmitting.value = true
  try {
    await saveTestTemplate({
      name: form.value.name,
      description: form.value.description,
      category: form.value.category,
      estimated_minutes: form.value.estimated_minutes,
      scoring_method: form.value.scoring_method,
      result_levels: form.value.result_levels,
      questions: form.value.questions
    })
    await success(t('expert.myTests.tplSaved'))
    await loadTemplates()
  } catch (e: any) {
    await error(e?.response?.data?.message || t('expert.myTests.tplSaveFailed'))
  } finally {
    isSubmitting.value = false
  }
}

const removeTemplate = async () => {
  const tpl = templates.value.find((x) => x.id === selectedTplId.value)
  if (!tpl) return
  const ok = await confirm(t('expert.myTests.tplConfirmDelete', { name: tpl.name }), t('expert.myTests.tplDeleteTitle'))
  if (!ok) return
  try {
    await deleteTestTemplate(tpl.id)
    await success(t('expert.myTests.tplDeleted'))
    selectedTplId.value = ''
    await loadTemplates()
  } catch (e: any) {
    await error(e?.response?.data?.message || t('expert.myTests.tplDeleteFailed'))
  }
}

const submit = async () => {
  if (isExpert) {
    if (!form.value.name) {
      await alert(t('expert.myTests.nameRequired'))
      return
    }
  } else if (!form.value.code || !form.value.name) {
    await alert(t('admin.test.errCodeName'))
    return
  }
  if (form.value.questions.length === 0) {
    await alert(t('admin.test.errNeedQuestion'))
    return
  }

  // 题目数量始终以实际题目数为准（编辑框已移除，避免与题库不一致）
  form.value.total_questions = form.value.questions.length
  isSubmitting.value = true
  try {
    if (isExpert) {
      if (isEdit.value && effectiveId.value != null) {
        await updateMyTest(effectiveId.value, form.value)
        await success(t('expert.myTests.updated'))
      } else {
        await createMyTest(form.value)
        await success(t('expert.myTests.submittedReview'))
      }
      if (isEmbedded) emit('saved')
      else router.push('/expert/my-tests')
    } else {
      await createTest(form.value)
      await success(t('admin.test.created'))
      router.push('/admin/tests')
    }
  } catch (e: any) {
    await error(e.message || t('admin.test.saveFailed'))
  } finally {
    isSubmitting.value = false
  }
}

// 专家编辑回填：拉取自己的待审核问卷详情填充表单
const loadExpertTest = async () => {
  try {
    const res: any = await getMyTestDetail(effectiveId.value as number)
    const test = res.data
    form.value = {
      code: test.code || '',
      name: test.name || '',
      description: test.description || '',
      category: test.category || 'emotion',
      total_questions: test.total_questions || 0,
      estimated_minutes: test.estimated_minutes || 5,
      scoring_method: test.scoring_method || 'sum',
      result_levels: test.result_levels ? JSON.parse(test.result_levels) : [],
      questions: (test.questions || []).map((q: any) => ({
        question_number: q.question_number,
        content: q.content || '',
        dimension: q.dimension || '',
        reverse_scoring: !!q.reverse_scoring,
        options: (q.options || []).map((o: any) => ({ score: Number(o.score) || 0, text: o.text || '' }))
      }))
    }
  } catch (e: any) {
    await error(e.message || t('expert.myTests.loadDetailFailed'))
  }
}

onMounted(() => {
  if (effectiveId.value != null) {
    isEdit.value = true
    if (isExpert) {
      loadExpertTest()
    }
  }
  // 专家模式：加载私人模板列表（套用/删除用）
  if (isExpert) {
    loadTemplates()
  }
})
</script>

<style scoped>
.page-container {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 28px 32px;
  max-width: 900px;
  margin: 0 auto;
}

/* ===== 模板栏（仅专家）===== */
.tpl-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: var(--radius-ctl);
  margin-bottom: 18px;
}

.tpl-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.tpl-select {
  flex: 1;
  min-width: 180px;
  max-width: 320px;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: var(--font-ui);
  outline: none;
  cursor: pointer;
}

.tpl-spacer {
  flex: 1;
}

.btn-tpl {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 12.5px;
  font-family: var(--font-ui);
  white-space: nowrap;
  transition: all 0.2s var(--ease-out);
}

.btn-tpl:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.btn-tpl:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-tpl.btn-tpl-danger {
  border-color: var(--border-color);
  color: var(--text-muted);
}

.btn-tpl.btn-tpl-danger:hover:not(:disabled) {
  border-color: var(--danger, #c0503a);
  color: var(--danger, #c0503a);
  background: color-mix(in srgb, var(--danger, #c0503a) 10%, transparent);
}

.btn-tpl.btn-tpl-save {
  background: var(--accent);
  color: var(--on-accent);
}

.btn-tpl.btn-tpl-save:hover:not(:disabled) {
  background: var(--accent-strong);
}

.page-header {
  margin: 4px 0 20px;
}

h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-section {
  margin-bottom: 26px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--border-color);
}

.form-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
}

.form-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 13px;
  color: var(--text-secondary);
}

.required {
  color: var(--danger);
}

.form-group input,
.form-group select,
.form-group textarea,
.option-row input {
  padding: 9px 13px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: var(--font-ui);
  outline: none;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus,
.option-row input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* 题目数量：只读展示，随题目总数自动更新 */
.count-display {
  padding: 9px 13px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  box-sizing: border-box;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding-top: 8px;
}

.level-card,
.question-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  padding: 18px;
  margin-bottom: 14px;
}

.level-header,
.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-weight: 600;
  font-size: 13.5px;
  color: var(--text-primary);
}

.options-section {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-strong);
}

.options-section > label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  display: block;
}

.option-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}

.score-input {
  width: 84px;
  flex-shrink: 0;
}

.text-input {
  flex: 1;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s var(--ease-out);
}

.btn-icon:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.btn-add {
  width: 100%;
  padding: 12px;
  border: 1.5px dashed color-mix(in srgb, var(--accent) 45%, transparent);
  background: transparent;
  color: var(--accent);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-family: var(--font-ui);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s var(--ease-out);
}

.btn-add:hover {
  background: var(--accent-soft);
}

.btn-add-small {
  padding: 7px 14px;
  border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
  background: transparent;
  color: var(--accent);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-ui);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s var(--ease-out);
}

.btn-add-small:hover {
  background: var(--accent-soft);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
}

.btn-cancel {
  padding: 10px 28px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
}

.btn-cancel:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.btn-submit {
  padding: 10px 28px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  font-family: var(--font-ui);
  transition: background 0.2s var(--ease-out);
}

.btn-submit:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
