<template>
  <div class="history-page">
    <div class="header">
      <button class="btn-back" @click="onGoBack">
        <AppIcon name="back" :size="15" />
        返回
      </button>
      <h2>测评历史</h2>
    </div>

    <div class="history-list" v-if="history.length > 0">
      <div
        v-for="item in history"
        :key="item.id"
        class="history-item"
        @click="onViewDetail(item.id)"
      >
        <div class="history-info">
          <h4>{{ item.name }}</h4>
          <span class="time">{{ formatTime(item.completed_at) }}</span>
        </div>
        <div class="history-result">
          <span class="score">{{ item.total_score }}分</span>
          <span class="level" :class="getLevelClass(item.result_level)">
            {{ item.result_level }}
          </span>
        </div>
        <AppIcon name="chevronRight" :size="16" class="row-arrow" />
      </div>
    </div>

    <div v-else class="empty">
      <p>暂无测评记录</p>
      <button class="btn-go" @click="onGoBack">去测评</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTestHistory } from '@/api/tests'
import { error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits(['go-back', 'view-detail'])

const history = ref<any[]>([])

onMounted(async () => {
  try {
    const res = await getTestHistory()
    history.value = res.data || []
  } catch (e: any) {
    error(e?.message || '获取历史记录失败')
  }
})

const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN')
}

const getLevelClass = (level: string) => {
  if (level?.includes('重度')) return 'level-severe'
  if (level?.includes('中度')) return 'level-moderate'
  if (level?.includes('轻度')) return 'level-mild'
  return 'level-normal'
}

const onGoBack = () => {
  emit('go-back')
}

const onViewDetail = (id: number) => {
  emit('view-detail', id)
}
</script>

<style scoped>
.history-page {
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

.history-list {
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.history-item:last-child {
  border-bottom: none;
}

.history-item:hover {
  background: var(--accent-soft);
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-info h4 {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.time {
  font-size: 12px;
  color: var(--text-muted);
}

.history-result {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.score {
  font-size: 18px;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.level {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}

.level-normal { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.level-mild { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
.level-moderate { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.level-severe { background: color-mix(in srgb, var(--danger) 28%, transparent); color: var(--danger); }

.row-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
}

.empty {
  text-align: center;
  padding: 60px 20px;
}

.empty p {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 20px;
}

.btn-go {
  padding: 10px 28px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-ctl);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.btn-go:hover {
  background: var(--accent-strong);
}
</style>
