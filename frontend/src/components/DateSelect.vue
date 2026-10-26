<template>
  <div class="date-select">
    <!-- 年 -->
    <select v-model="yearVal" :aria-label="$t('ui.date.year')">
      <option v-if="!yearVal" value="">{{ yearLabel }}</option>
      <option v-for="y in yearOptions" :key="y" :value="y">{{ isEn ? y : y + t('ui.date.yearSuffix') }}</option>
    </select>
    <!-- 月 -->
    <select v-model="monthVal" :aria-label="$t('ui.date.month')">
      <option v-if="!monthVal" value="">{{ monthLabel }}</option>
      <option v-for="m in monthOptions" :key="m" :value="m">{{ monthName(m) }}</option>
    </select>
    <!-- 日 -->
    <select v-model="dayVal" :aria-label="$t('ui.date.day')">
      <option v-if="!dayVal" value="">{{ dayLabel }}</option>
      <option v-for="d in dayOptions" :key="d" :value="d">{{ isEn ? d : d + t('ui.date.daySuffix') }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// 自定义三段日期选择器：原生 <input type="date"> 的显示格式由 Windows 系统区域决定，
// 页面语言无法控制；此组件的年/月/日文字完全跟随界面语言，值仍以 'YYYY-MM-DD' 字符串对外。
const props = defineProps<{
  modelValue: string
  /** 可选上限（'YYYY-MM-DD'）：传入后不可选择超过该日期的年/月/日（如报告截止日期不可超过当天） */
  max?: string
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

// 上限日期解析（无效或缺省时不设限）
const maxLimit = computed(() => {
  const s = String(props.max || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? { y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) }
    : null
})

// 逐级约束：上限年内不出现更晚年份；上限年月内不出现更晚月份；上限年月内不出现更晚日
const yearOptions = computed(() => {
  const maxY = maxLimit.value?.y
  return maxY ? yearList.value.filter((y) => y <= maxY) : yearList.value
})
const monthOptions = computed(() => {
  const lim = maxLimit.value
  if (lim && y.value && y.value === lim.y) {
    return Array.from({ length: lim.m }, (_, i) => i + 1)
  }
  return Array.from({ length: 12 }, (_, i) => i + 1)
})
const dayOptions = computed(() => {
  const lim = maxLimit.value
  if (lim && y.value && m.value && y.value === lim.y && m.value === lim.m) {
    return Array.from({ length: lim.d }, (_, i) => i + 1)
  }
  return Array.from({ length: dayCount.value }, (_, i) => i + 1)
})

// 本地三段状态：逐段选择必须先暂存在本地（修复：此前各段 setter 互相从 modelValue
// 读另外两段，而 modelValue 仅在三段齐备时才回写，导致从空状态永远拼不出完整日期）
const y = ref(0)
const m = ref(0)
const d = ref(0)

// 外部值变化（初始回填/清空）时同步本地三段
watch(
  () => props.modelValue,
  (raw) => {
    const s = String(raw || '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      y.value = Number(s.slice(0, 4))
      m.value = Number(s.slice(5, 7))
      d.value = Number(s.slice(8, 10))
    } else {
      y.value = 0
      m.value = 0
      d.value = 0
    }
  },
  { immediate: true }
)

const yearVal = computed({
  get: () => y.value || '',
  set: (v: any) => { y.value = Number(v) || 0; clampByMax(); tryEmit() }
})
const monthVal = computed({
  get: () => m.value || '',
  set: (v: any) => { m.value = Number(v) || 0; clampByMax(); tryEmit() }
})
const dayVal = computed({
  get: () => d.value || '',
  set: (v: any) => { d.value = Number(v) || 0; tryEmit() }
})

// 年/月变化后，已选的月/日可能越界（如上限月为 10 月时先选了 12 月）：
// 按上限与当月天数收敛，避免组合出超过上限的日期
const clampByMax = () => {
  const lim = maxLimit.value
  if (lim && y.value === lim.y) {
    if (m.value > lim.m) m.value = 0
  }
  const days = y.value && m.value ? daysInMonth(y.value, m.value) : 31
  if (d.value > days) d.value = 0
}

// 三段齐备才 emit（部分选择不回写，避免中间态误触发父级校验）
const tryEmit = () => {
  if (!y.value || !m.value || !d.value) return
  const days = daysInMonth(y.value, m.value)
  const dd = Math.min(d.value, days)
  d.value = dd
  // 双保险：上限存在时截断到上限日，绝不允许 emit 出超过 max 的日期
  let out = `${y.value}-${pad(m.value)}-${pad(dd)}`
  const lim = maxLimit.value
  if (lim && out > `${lim.y}-${pad(lim.m)}-${pad(lim.d)}`) {
    out = `${lim.y}-${pad(lim.m)}-${pad(lim.d)}`
    y.value = lim.y
    m.value = lim.m
    d.value = lim.d
  }
  emit('update:modelValue', out)
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()

// 所选年月的天数（年月未选全时按 31 展示）
const dayCount = computed(() => {
  return y.value && m.value ? daysInMonth(y.value, m.value) : 31
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
