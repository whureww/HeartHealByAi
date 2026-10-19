<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>{{ $t('admin.words.title') }}</h2>
        <p class="subtitle">{{ $t('admin.words.subtitle') }}</p>
      </div>
    </div>

    <div class="add-card">
      <div class="add-row">
        <input
          v-model="newWord"
          class="word-input"
          :placeholder="$t('admin.words.phAdd')"
          maxlength="64"
          @keyup.enter="add"
        />
        <select v-model="newCategory" class="cat-select">
          <option v-for="c in categories" :key="c" :value="c">{{ catLabel(c) }}</option>
        </select>
        <label class="short-check" :title="$t('admin.words.shortTitle')">
          <input v-model="newShort" type="checkbox" />
          {{ $t('admin.words.shortMatch') }}
        </label>
        <button class="btn-add" :disabled="adding || !newWord.trim()" @click="add">{{ $t('admin.words.add') }}</button>
      </div>
      <p class="add-tip">{{ $t('admin.words.shortTip') }}</p>
    </div>

    <div class="filter-card">
      <input v-model="keyword" class="search-input" :placeholder="$t('admin.words.phSearch')" />
      <select v-model="filterCategory" class="cat-select">
        <option value="">{{ $t('admin.words.allCategories') }}</option>
        <option v-for="c in categories" :key="c" :value="c">{{ catLabel(c) }}</option>
      </select>
      <span class="count-tip">{{ $t('admin.words.countTip', { n: filtered.length }) }}</span>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ $t('admin.words.th.word') }}</th>
            <th>{{ $t('admin.words.th.category') }}</th>
            <th>{{ $t('admin.words.th.match') }}</th>
            <th>{{ $t('admin.words.th.createdAt') }}</th>
            <th>{{ $t('admin.words.th.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in paged" :key="w.id">
            <td class="word-cell">{{ w.word }}</td>
            <td>
              <span :class="['status-tag', catClass(w.category)]">{{ catLabel(w.category) }}</span>
            </td>
            <td>{{ w.is_short ? $t('admin.words.matchShort') : $t('admin.words.matchContains') }}</td>
            <td class="date-cell">{{ formatDate(w.created_at) }}</td>
            <td>
              <button class="btn-reject" @click="remove(w)">{{ $t('admin.words.delete') }}</button>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="5" class="empty-cell">
              <AppIcon name="clipboard" :size="28" />
              <p>{{ loading ? $t('admin.words.loading') : $t('admin.words.empty') }}</p>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="totalPages > 1" class="pager">
        <button :disabled="page <= 1" @click="page--">{{ $t('admin.words.prevPage') }}</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="page++">{{ $t('admin.words.nextPage') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSensitiveWords, addSensitiveWord, deleteSensitiveWord } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()

// 分类值为后端存储数据（中文原样提交/返回），仅展示时按语言映射
const CAT_KEYS: Record<string, string> = { '侮辱': 'insult', '色情': 'porn', '违禁': 'banned', '自伤': 'selfHarm', '缩写': 'abbr', '其他': 'other' }
const catLabel = (c: string) => {
  const k = CAT_KEYS[c]
  return k ? t(`admin.words.cat.${k}`) : c
}

const categories = ['侮辱', '色情', '违禁', '自伤', '缩写', '其他']

const catClass = (c: string) => `cat-c${Math.max(0, categories.indexOf(c))}`

const words = ref<any[]>([])
const loading = ref(false)
const adding = ref(false)

const newWord = ref('')
const newCategory = ref('侮辱')
const newShort = ref(false)

const keyword = ref('')
const filterCategory = ref('')
const page = ref(1)
const PAGE_SIZE = 50

const filtered = computed(() =>
  words.value.filter(w => {
    const kw = keyword.value.trim().toLowerCase()
    if (kw && !String(w.word).toLowerCase().includes(kw)) return false
    if (filterCategory.value && w.category !== filterCategory.value) return false
    return true
  })
)

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
)

const formatDate = (d: string) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '—')

const load = async () => {
  loading.value = true
  try {
    const res = await getSensitiveWords() as any
    words.value = res.data || []
  } catch (e: any) {
    await error(e.message || t('admin.words.loadFailed'))
  } finally {
    loading.value = false
  }
}

const add = async () => {
  const w = newWord.value.trim()
  if (!w || adding.value) return
  adding.value = true
  try {
    const res = await addSensitiveWord({ word: w, category: newCategory.value, is_short: newShort.value }) as any
    await success(res.message || t('admin.words.added'))
    newWord.value = ''
    page.value = 1
    await load()
  } catch (e: any) {
    await error(e.message || t('admin.words.addFailed'))
  } finally {
    adding.value = false
  }
}

const remove = async (w: any) => {
  const ok = await confirm(t('admin.words.confirmDelete', { word: w.word }), t('admin.words.deleteTitle'))
  if (!ok) return
  try {
    const res = await deleteSensitiveWord(w.id) as any
    await success(res.message || t('admin.words.deleted'))
    await load()
  } catch (e: any) {
    await error(e.message || t('admin.words.deleteFailed'))
  }
}

onMounted(load)
</script>

<style scoped>
.page-container {
  max-width: 1100px;
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

.add-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 14px 16px;
  margin-bottom: 14px;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.word-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s var(--ease-out);
}

.word-input:focus {
  border-color: var(--accent);
}

.cat-select {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.short-check {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
}

.btn-add {
  padding: 8px 18px;
  border: none;
  border-radius: var(--radius-ctl);
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s var(--ease-out);
}

.btn-add:hover {
  opacity: 0.88;
}

.btn-add:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.add-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.filter-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.search-input {
  flex: 0 1 260px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s var(--ease-out);
}

.search-input:focus {
  border-color: var(--accent);
}

.count-tip {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--text-muted);
}

.table-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  padding: 12px 14px;
  background: var(--bg-sidebar);
  color: var(--text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: top;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.word-cell {
  font-weight: 600;
}

.date-cell {
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 12.5px;
}

.status-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.cat-c0 {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.cat-c1 {
  background: color-mix(in srgb, #c2649a 14%, transparent);
  color: #c2649a;
}

.cat-c2 {
  background: color-mix(in srgb, #c9a227 15%, transparent);
  color: #c9a227;
}

.cat-c3 {
  background: color-mix(in srgb, #d0782f 14%, transparent);
  color: #d0782f;
}

.cat-c4 {
  background: color-mix(in srgb, #3a9e6e 15%, transparent);
  color: #3a9e6e;
}

.cat-c5 {
  background: var(--accent-soft);
  color: var(--text-secondary);
}

.btn-reject {
  padding: 5px 12px;
  border-radius: var(--radius-ctl);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
  background: transparent;
  color: var(--danger);
}

.btn-reject:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 12px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.pager button {
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.pager button:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.pager button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.empty-cell {
  text-align: center;
  padding: 48px 0;
  color: var(--text-muted);
}

.empty-cell p {
  margin: 8px 0 0;
  font-size: 13px;
}
</style>
