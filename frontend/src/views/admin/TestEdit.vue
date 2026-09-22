<template>
  <div class="page-container">
    <div class="page-header">
      <h2>{{ isEdit ? '编辑问卷' : '新建问卷' }}</h2>
    </div>

    <div class="form-section">
      <h3>基本信息</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>问卷编码 <span class="required">*</span></label>
          <input v-model="form.code" placeholder="如：anxiety" :disabled="isEdit" />
        </div>
        <div class="form-group">
          <label>问卷名称 <span class="required">*</span></label>
          <input v-model="form.name" placeholder="如：焦虑自评量表 (SAS)" />
        </div>
        <div class="form-group">
          <label>分类 <span class="required">*</span></label>
          <select v-model="form.category">
            <option value="emotion">情绪测评</option>
            <option value="stress">压力测评</option>
            <option value="personality">人格测评</option>
            <option value="cognitive">认知测评</option>
          </select>
        </div>
        <div class="form-group">
          <label>题目数量</label>
          <input v-model.number="form.total_questions" type="number" placeholder="20" />
        </div>
        <div class="form-group">
          <label>预计时长（分钟）</label>
          <input v-model.number="form.estimated_minutes" type="number" placeholder="5" />
        </div>
        <div class="form-group">
          <label>计分方式</label>
          <select v-model="form.scoring_method">
            <option value="sum">求和</option>
            <option value="average">平均</option>
            <option value="weighted">加权</option>
          </select>
        </div>
      </div>
      <div class="form-group full-width">
        <label>问卷描述</label>
        <textarea v-model="form.description" rows="3" placeholder="描述该问卷的用途和适用人群"></textarea>
      </div>
    </div>

    <!-- 结果等级设置 -->
    <div class="form-section">
      <h3>结果等级设置</h3>
      <div v-for="(level, index) in form.result_levels" :key="index" class="level-card">
        <div class="level-header">
          <span>等级 {{ index + 1 }}</span>
          <button class="btn-icon" @click="removeLevel(index)" title="删除该等级">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>最低分</label>
            <input v-model.number="level.min" type="number" placeholder="0" />
          </div>
          <div class="form-group">
            <label>最高分</label>
            <input v-model.number="level.max" type="number" placeholder="100" />
          </div>
          <div class="form-group">
            <label>等级名称</label>
            <input v-model="level.level" placeholder="如：轻度焦虑" />
          </div>
        </div>
        <div class="form-group full-width">
          <label>结果描述</label>
          <textarea v-model="level.desc" rows="2" placeholder="该等级的结果描述和建议"></textarea>
        </div>
      </div>
      <button class="btn-add" @click="addLevel">
        <AppIcon name="plus" :size="14" />
        添加等级
      </button>
    </div>

    <!-- 题目设置 -->
    <div class="form-section">
      <h3>题目设置</h3>
      <div v-for="(question, qIndex) in form.questions" :key="qIndex" class="question-card">
        <div class="question-header">
          <span>第 {{ qIndex + 1 }} 题</span>
          <button class="btn-icon" @click="removeQuestion(qIndex)" title="删除该题">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
        <div class="form-group full-width">
          <label>题目内容 <span class="required">*</span></label>
          <input v-model="question.content" placeholder="请输入题目内容" />
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>维度</label>
            <input v-model="question.dimension" placeholder="如：精神性焦虑" />
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input v-model="question.reverse_scoring" type="checkbox" />
              反向计分
            </label>
          </div>
        </div>

        <!-- 选项设置 -->
        <div class="options-section">
          <label>选项设置</label>
          <div v-for="(option, oIndex) in question.options" :key="oIndex" class="option-row">
            <input v-model.number="option.score" type="number" placeholder="分值" class="score-input" />
            <input v-model="option.text" placeholder="选项文字" class="text-input" />
            <button class="btn-icon" @click="removeOption(qIndex, oIndex)" title="删除该选项">
              <AppIcon name="close" :size="14" />
            </button>
          </div>
          <button class="btn-add-small" @click="addOption(qIndex)">
            <AppIcon name="plus" :size="13" />
            添加选项
          </button>
        </div>
      </div>
      <button class="btn-add" @click="addQuestion">
        <AppIcon name="plus" :size="14" />
        添加题目
      </button>
    </div>

    <div class="form-actions">
      <button class="btn-cancel" @click="$router.back()">取消</button>
      <button class="btn-submit" :disabled="isSubmitting" @click="submit">
        <span v-if="isSubmitting">保存中...</span>
        <span v-else>保存问卷</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createTest } from '@/api/admin'
import { alert, success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

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

const route = useRoute()
const router = useRouter()
const isEdit = ref(false)
const isSubmitting = ref(false)

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
  form.value.questions[qIndex].options.push({ score: 1, text: '' })
}

const removeOption = (qIndex: number, oIndex: number) => {
  form.value.questions[qIndex].options.splice(oIndex, 1)
}

const submit = async () => {
  if (!form.value.code || !form.value.name) {
    await alert('请填写问卷编码和名称')
    return
  }
  if (form.value.questions.length === 0) {
    await alert('请至少添加一道题目')
    return
  }

  isSubmitting.value = true
  try {
    await createTest(form.value)
    await success('问卷创建成功，等待审核')
    router.push('/admin/tests')
  } catch (e: any) {
    await error(e.message || '保存失败')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  if (route.params.id) {
    isEdit.value = true
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
.form-group textarea {
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
.form-group textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
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
