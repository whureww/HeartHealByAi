<template>
  <div class="date-select">
    <!-- 年 -->
    <select v-model="yearVal" :aria-label="$t('ui.date.year')">
      <option v-if="!yearVal" value="">{{ yearLabel }}</option>
      <option v-for="y in yearList" :key="y" :value="y">{{ isEn ? y : y + t('ui.date.yearSuffix') }}</option>
    </select>
    <!-- 月 -->
    <select v-model="monthVal" :aria-label="$t('ui.date.month')">
      <option v-if="!monthVal" value="">{{ monthLabel }}</option>
      <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
    </select>
    <!-- 日 -->
    <select v-model="dayVal" :aria-label="$t('ui.date.day')">
      <option v-if="!dayVal" value="">{{ dayLabel }}</option>
      <option v-for="d in dayCount" :key="d" :value="d">{{ isEn ? d : d + t('ui.date.daySuffix') }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// 自定义三段日期选择器：原生 <input type="date"> 的显示格式由 Windows 系统区域决定，
// 页面语言无法控制；此组件的年/月/日文字完全跟随界面语言，值仍以 'YYYY-MM-DD' 字符串对外。
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const { t, locale } = useI18n()
const isEn = computed(() => locale.value === 'en')

const yearLabel = computed(() => t('ui.date.year'))
const monthLabel = computed(() => t('ui.date.month'))
const dayLabel = computed(() => t('ui.date.day'))

// 年份范围：近 6 年（报告分析历史时段）
const currentYear = new Date().getFullYear()
const yearList = computed(() => {
  const list: number[] = []
  for (let y = currentYear; y >= currentYear - 5; y--) list.push(y)
  return list
})

const parts = computed(() => {
  const raw = String(props.modelValue || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { y: 0, m: 0, d: 0 }
  return { y: Number(raw.slice(0, 4)), m: Number(raw.slice(5, 7)), d: Number(raw.slice(8, 10)) }
})

const yearVal = computed({
  get: () => parts.value.y || '',
  set: (v: any) => { emitParts(Number(v) || 0, parts.value.m, parts.value.d) }
})
const monthVal = computed({
  get: () => parts.value.m || '',
  set: (v: any) => { emitParts(parts.value.y, Number(v) || 0, parts.value.d) }
})
const dayVal = computed({
  get: () => parts.value.d || '',
  set: (v: any) => { emitParts(parts.value.y, parts.value.m, Number(v) || 0) }
})

const emitParts = (y: number, m: number, d: number) => {
  // 任一段为空 → 值为空串（等待其余段选择）
  if (!y || !m || !d) {
    // 部分选择时不回写完整值：仅当三段齐备才 emit，避免中间态误触发校验
    if (!y && !m && !d) emit('update:modelValue', '')
    return
  }
  const days = daysInMonth(y, m)
  const dd = Math.min(d, days)
  emit('update:modelValue', `${y}-${pad(m)}-${pad(dd)}`)
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()

// 所选年月的天数（年月未选全时按 31 展示）
const dayCount = computed(() => {
  const { y, m } = parts.value
  return y && m ? daysInMonth(y, m) : 31
})

// 月份名称：中文「10月」、英文「Oct」（Intl 短格式）
const monthName = (m: number): string => {
  const name = new Intl.DateTimeFormat(isEn.value ? 'en-US' : 'zh-CN', { month: 'short' })
    .format(new Date(2000, m - 1, 1))
  return name
}
</script>

<style scoped>
.date-select {
  display: inline-flex;
  gap: 6px;
}

.date-select select {
  padding: 9px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font-ui);
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.date-select select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.date-select select:hover {
  border-color: var(--border-strong);
}
</style>
