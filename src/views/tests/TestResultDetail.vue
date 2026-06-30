<<template>
  <div class="result-detail-page">
    <div class="header">
      <button class="btn-back" @click="onGoBack">← 返回</button>
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
  margin-bottom: 24px;
}

.btn-back {
  background: none;
  border: none;
  color: #73a9d8;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
  margin-right: 12px;
}

.header h2 {
  font-size: 20px;
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
  border-radius: 16px;
  padding: 24px;
  border: 1px solid var(--border-color);
}

.result-content h3 {
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.score-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.score {
  font-size: 36px;
  font-weight: bold;
  color: #73a9d8;
}

.level {
  font-size: 14px;
  padding: 6px 14px;
  border-radius: 20px;
}

.level-normal { background: #d4edda; color: #155724; }
.level-mild { background: #fff3cd; color: #856404; }
.level-moderate { background: #ffe0b2; color: #e65100; }
.level-severe { background: #f8d7da; color: #721c24; }

.desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.time {
  font-size: 12px;
  color: var(--text-muted);
}

.empty {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
}
</style>
