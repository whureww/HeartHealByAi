<template>
  <div class="result-detail-page">
    <div class="header">
      <button class="btn-back" @click="onGoBack">
        <AppIcon name="back" :size="15" />
        返回
      </button>
      <h2>测评结果详情</h2>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="result" class="result-content">
      <h3>{{ result.test_name }}</h3>
      <div class="score-box">
        <span class="score">{{ result.total_score }}</span>
        <span class="level" :class="getLevelClass(result.result_level)">
          {{ result.result_level }}
        </span>
      </div>
      <p class="desc">{{ result.result_desc }}</p>
      <div class="time">完成时间：{{ formatTime(result.completed_at) }}</div>
    </div>
    <div v-else class="empty">结果不存在</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTestResult } from '@/api/tests'
import { error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps({
  resultId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['go-back'])

const result = ref<any>(null)
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await getTestResult(props.resultId)
    result.value = res.data
  } catch (e: any) {
    error(e?.message || '获取结果失败')
  } finally {
    loading.value = false
  }
})

const onGoBack = () => {
  emit('go-back')
}

const getLevelClass = (level: string) => {
  if (level?.includes('重度')) return 'level-severe'
  if (level?.includes('中度')) return 'level-moderate'
  if (level?.includes('轻度')) return 'level-mild'
  return 'level-normal'
}

const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style scoped>
.result-detail-page {
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
  background: var(--bg-primary);
}

.header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
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
  margin-right: 14px;
  border-radius: var(--radius-ctl);
  transition: all 0.2s var(--ease-out);
}

.btn-back:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
}

.result-content {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 24px;
}

.result-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text-primary);
}

.score-box {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.score {
  font-size: 40px;
  font-weight: 600;
  color: var(--accent);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.level {
  font-size: 13px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 14px;
}

.level-normal { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.level-mild { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
.level-moderate { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.level-severe { background: color-mix(in srgb, var(--danger) 28%, transparent); color: var(--danger); }

.desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0 0 16px;
}

.time {
  font-size: 12.5px;
  color: var(--text-muted);
}

.empty {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
}
</style>
