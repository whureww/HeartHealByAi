<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>我的名片</h2>
        <p class="subtitle">编辑你的专家名片，提交后由管理员审核决定是否显示在专家列表</p>
      </div>
      <span :class="['status-tag', statusClass]">{{ statusText }}</span>
    </div>

    <div class="card-panel">
      <div class="form-item">
        <label>专家姓名 <i>*</i></label>
        <input v-model="form.name" maxlength="50" placeholder="展示给用户的名字" />
      </div>
      <div class="form-item">
        <label>职称</label>
        <input v-model="form.title" maxlength="50" placeholder="如：国家二级心理咨询师" />
      </div>
      <div class="form-item">
        <label>专长领域</label>
        <input v-model="form.specialty" maxlength="200" placeholder="如：情绪困扰 / 亲密关系 / 学业压力" />
      </div>
      <div class="form-item">
        <label>个人简介</label>
        <textarea v-model="form.intro" rows="5" maxlength="500" placeholder="向用户介绍你的咨询风格与经验（500 字以内）"></textarea>
        <span class="char-count">{{ (form.intro || '').length }}/500</span>
      </div>

      <div class="form-actions">
        <button class="btn-primary" :disabled="saving" @click="submit">
          {{ saving ? '提交中...' : (card?.status === 2 ? '重新提交审核' : '保存并提交审核') }}
        </button>
      </div>

      <p v-if="card?.status === 1" class="status-hint ok">
        名片已上架。修改任何内容后将重新进入审核，期间从专家列表暂时下架。
      </p>
      <p v-else-if="card?.status === 2" class="status-hint pending">
        名片正在审核中，通过后将显示在专家列表。
      </p>
      <p v-else class="status-hint off">
        名片当前未上架，完善信息并提交审核后即可展示。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getMyCard, saveMyCard } from '@/api/expert'
import { success, error } from '@/utils/dialog'

const card = ref<any>(null)
const form = ref({ name: '', title: '', specialty: '', intro: '' })
const saving = ref(false)

const statusText = computed(() => {
  if (!card.value) return '未创建'
  return ({ 0: '未上架', 1: '已上架', 2: '审核中' } as Record<number, string>)[card.value.status] ?? '未知'
})
const statusClass = computed(() => {
  if (!card.value) return 'st-off'
  return ({ 0: 'st-off', 1: 'st-ok', 2: 'st-pending' } as Record<number, string>)[card.value.status] ?? 'st-off'
})

const load = async () => {
  try {
    const res = await getMyCard() as any
    card.value = res.data
    if (res.data) {
      form.value = {
        name: res.data.name || '',
        title: res.data.title || '',
        specialty: res.data.specialty || '',
        intro: res.data.intro || ''
      }
    }
  } catch (e: any) {
    await error(e.message || '名片加载失败')
  }
}

const submit = async () => {
  if (!form.value.name.trim()) {
    await error('请填写专家姓名')
    return
  }
  saving.value = true
  try {
    const res = await saveMyCard(form.value) as any
    await success(res.message || '已提交审核')
    await load()
  } catch (e: any) {
    await error(e.message || '提交失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-container {
  max-width: 720px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.status-tag {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
}

.st-ok {
  background: color-mix(in srgb, #3a9e6e 15%, transparent);
  color: #3a9e6e;
}

.st-pending {
  background: color-mix(in srgb, #c9a227 15%, transparent);
  color: #c9a227;
}

.st-off {
  background: var(--accent-soft);
  color: var(--text-secondary);
}

.card-panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 24px;
}

.form-item {
  margin-bottom: 18px;
  position: relative;
}

.form-item label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-item label i {
  color: var(--danger);
  font-style: normal;
}

.form-item input,
.form-item textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font-ui);
  outline: none;
  transition: border-color 0.2s var(--ease-out);
}

.form-item input:focus,
.form-item textarea:focus {
  border-color: var(--accent);
}

.form-item textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.6;
}

.char-count {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-primary {
  padding: 9px 22px;
  border: none;
  border-radius: var(--radius-ctl);
  background: var(--accent);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-hint {
  margin: 14px 0 0;
  font-size: 12.5px;
  padding: 10px 12px;
  border-radius: var(--radius-ctl);
}

.status-hint.ok {
  background: color-mix(in srgb, #3a9e6e 10%, transparent);
  color: #3a9e6e;
}

.status-hint.pending {
  background: color-mix(in srgb, #c9a227 10%, transparent);
  color: #c9a227;
}

.status-hint.off {
  background: var(--accent-soft);
  color: var(--text-secondary);
}
</style>
