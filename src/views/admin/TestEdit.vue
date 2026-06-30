<template>
  <div class="page-container">
    <h2>{{ isEdit ? '编辑问卷' : '新建问卷' }}</h2>

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
          <button class="btn-icon" @click="removeLevel(index)">×</button>
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
      <button class="btn-add" @click="addLevel">+ 添加等级</button>
    </div>

    <!-- 题目设置 -->
    <div class="form-section">
      <h3>题目设置</h3>
      <div v-for="(question, qIndex) in form.questions" :key="qIndex" class="question-card">
        <div class="question-header">
          <span>第 {{ qIndex + 1 }} 题</span>
          <button class="btn-icon" @click="removeQuestion(qIndex)">×</button>
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
            <button class="btn-icon" @click="removeOption(qIndex, oIndex)">×</button>
          </div>
          <button class="btn-add-small" @click="addOption(qIndex)">+ 添加选项</button>
        </div>
      </div>
      <button class="btn-add" @click="addQuestion">+ 添加题目</button>
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
  background: #fff;
  border-radius: 16px;
  padding: 30px;
  max-width: 900px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 24px;
  font-size: 20px;
  color: var(--text-primary);
}

.form-section {
  margin-bottom: 30px;
  padding-bottom: 30px;
  border-bottom: 1px solid #f0f0f0;
}

.form-section h3 {
  font-size: 16px;
  color: var(--text-primary);
  margin-bottom: 16px;
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
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 13px;
  color: var(--text-secondary);
}

.required {
  color: #ef4444;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #73a9d8;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.level-card,
.question-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.level-header,
.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 500;
}

.options-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #e5e7eb;
}

.option-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}

.score-input {
  width: 80px;
}

.text-input {
  flex: 1;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: none;
  background: #fee2e2;
  color: #ef4444;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add {
  width: 100%;
  padding: 14px;
  border: 2px dashed #73a9d8;
  background: transparent;
  color: #73a9d8;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  transition: 0.2s;
}

.btn-add:hover {
  background: #e3f0fc;
}

.btn-add-small {
  padding: 8px 16px;
  border: 1px dashed #73a9d8;
  background: transparent;
  color: #73a9d8;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 40px;
}

.btn-cancel {
  padding: 12px 32px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
}

.btn-submit {
  padding: 12px 32px;
  background: #73a9d8;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
