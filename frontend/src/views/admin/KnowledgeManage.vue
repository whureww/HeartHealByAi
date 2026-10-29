<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>{{ $t('admin.knowledge.title') }}</h2>
        <p class="subtitle">{{ $t('admin.knowledge.subtitle') }}</p>
      </div>
    </div>

    <!-- 新增文档 -->
    <div class="add-card">
      <div class="add-head">
        <AppIcon name="plus" :size="14" />
        {{ $t('admin.knowledge.addTitle') }}
      </div>
      <div class="add-body">
        <div class="form-row">
          <div class="form-item">
            <label>{{ $t('admin.knowledge.fTitle') }} <i>*</i></label>
            <input v-model="form.title" :placeholder="$t('admin.knowledge.phTitle')" maxlength="120" />
          </div>
          <div class="form-item">
            <label>{{ $t('admin.knowledge.fCategory') }}</label>
            <select v-model="form.category">
              <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ $t(c.labelKey) }}</option>
            </select>
          </div>
        </div>
        <div class="form-item">
          <label>{{ $t('admin.knowledge.fContent') }} <i>*</i></label>
          <textarea
            v-model="form.content"
            rows="7"
            :placeholder="$t('admin.knowledge.phContent')"
          ></textarea>
        </div>
        <div class="add-foot">
          <span class="add-tip">{{ $t('admin.knowledge.addTip') }}</span>
          <button class="btn-primary" :disabled="adding || !form.title.trim() || !form.content.trim()" @click="submitAdd">
            {{ adding ? $t('admin.knowledge.adding') : $t('admin.knowledge.addBtn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 文档列表 -->
    <div class="table-card">
      <table class="data-table" :class="{ 'is-empty': list.length === 0 }">
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ $t('admin.knowledge.th.title') }}</th>
            <th>{{ $t('admin.knowledge.th.category') }}</th>
            <th>{{ $t('admin.knowledge.th.chunks') }}</th>
            <th>{{ $t('admin.knowledge.th.chars') }}</th>
            <th>{{ $t('admin.knowledge.th.createdAt') }}</th>
            <th>{{ $t('admin.knowledge.th.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in list" :key="item.article_id">
            <td class="id-cell">#{{ item.article_id }}</td>
            <td class="title-cell">{{ item.title }}</td>
            <td>
              <span class="category-tag">{{ categoryText(item.category) }}</span>
            </td>
            <td class="num-cell">{{ item.chunks }}</td>
            <td class="num-cell">{{ item.chars }}</td>
            <td class="date-cell">{{ formatDate(item.created_at) }}</td>
            <td>
              <button class="btn-del" :title="$t('admin.knowledge.delete')" @click="removeArticle(item)">
                <AppIcon name="trash" :size="14" />
              </button>
            </td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="7" class="empty-cell">
              <AppIcon name="book" :size="28" />
              <p>{{ loading ? $t('admin.knowledge.loading') : $t('admin.knowledge.empty') }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getKnowledgeList, addKnowledge, deleteKnowledge } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()

const CATEGORIES = [
  { value: 'emotion', labelKey: 'admin.knowledge.catEmotion' },
  { value: 'stress', labelKey: 'admin.knowledge.catStress' },
  { value: 'sleep', labelKey: 'admin.knowledge.catSleep' },
  { value: 'relationship', labelKey: 'admin.knowledge.catRelationship' },
  { value: 'crisis', labelKey: 'admin.knowledge.catCrisis' },
  { value: 'general', labelKey: 'admin.knowledge.catGeneral' }
]

const list = ref<any[]>([])
const loading = ref(false)
const adding = ref(false)
const form = ref({ title: '', category: 'emotion', content: '' })

const categoryText = (c: string) => {
  const found = CATEGORIES.find((x) => x.value === c)
  return found ? t(found.labelKey) : c
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await getKnowledgeList() as any
    list.value = res?.data || []
  } catch (e: any) {
    await error(e?.response?.data?.message || t('admin.knowledge.loadFailed'))
  } finally {
    loading.value = false
  }
}

const submitAdd = async () => {
  if (adding.value || !form.value.title.trim() || !form.value.content.trim()) return
  adding.value = true
  try {
    const res = await addKnowledge({
      title: form.value.title.trim(),
      category: form.value.category,
      content: form.value.content.trim()
    }) as any
    await success(res?.message || t('admin.knowledge.added'))
    form.value = { title: '', category: form.value.category, content: '' }
    await loadList()
  } catch (e: any) {
    await error(e?.response?.data?.message || e?.message || t('admin.knowledge.addFailed'))
  } finally {
    adding.value = false
  }
}

const removeArticle = async (item: any) => {
  const ok = await confirm(
    t('admin.knowledge.confirmDelete', { title: item.title }),
    t('admin.knowledge.deleteTitle')
  )
  if (!ok) return
  try {
    await deleteKnowledge(item.article_id)
    await success(t('admin.knowledge.deleted'))
    await loadList()
  } catch (e: any) {
    await error(e?.response?.data?.message || t('admin.knowledge.deleteFailed'))
  }
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

onMounted(loadList)
</script>

<style scoped>
.page-container {
  max-width: 1080px;
}

.page-header {
  margin: 8px 0 20px;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 12.5px;
  margin: 0;
}

/* 新增文档卡片 */
.add-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
  overflow: hidden;
}

.add-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--accent-soft) 40%, transparent);
}

.add-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.form-item label i {
  color: var(--accent);
  font-style: normal;
}

.form-item input,
.form-item select,
.form-item textarea {
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font-ui);
  outline: none;
  resize: vertical;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.form-item input:focus,
.form-item select:focus,
.form-item textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.add-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.add-tip {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-primary {
  padding: 9px 22px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 13.5px;
  font-weight: 500;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 列表 */
.table-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: var(--text-secondary);
}

.data-table th {
  padding: 13px 16px;
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 12.5px;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table.is-empty th {
  white-space: normal;
}

.data-table td {
  padding: 13px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 13.5px;
}

.data-table tbody tr {
  transition: background 0.15s var(--ease-out);
}

.data-table tbody tr:hover {
  background: color-mix(in srgb, var(--accent-soft) 45%, transparent);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.id-cell {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-size: 12.5px;
}

.title-cell {
  font-weight: 500;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-tag {
  padding: 3px 10px;
  background: color-mix(in srgb, var(--info) 12%, transparent);
  color: var(--info);
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.num-cell {
  font-variant-numeric: tabular-nums;
}

.date-cell {
  color: var(--text-muted);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.btn-del {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-ctl);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-del:hover {
  border-color: var(--danger, #c0503a);
  color: var(--danger, #c0503a);
  background: color-mix(in srgb, var(--danger, #c0503a) 10%, transparent);
}

.data-table td.empty-cell {
  text-align: center;
  padding: 56px 16px;
  color: var(--text-muted);
  font-size: 13.5px;
}

.empty-cell svg {
  opacity: 0.55;
}

.empty-cell p {
  margin: 10px 0 0;
}
</style>
