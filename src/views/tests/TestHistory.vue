<<template>
  <div class="history-page">
    <div class="header">
      <button class="btn-back" @click="onGoBack">← 返回</button>
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

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  background: var(--card-bg);
  border-radius: 14px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.history-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px var(--shadow);
}

.history-info h4 {
  font-size: 15px;
  color: var(--text-primary);
  margin: 0 0 6px 0;
}

.time {
  font-size: 12px;
  color: var(--text-muted);
}

.history-result {
  text-align: right;
}

.score {
  font-size: 20px;
  font-weight: bold;
  color: #73a9d8;
  display: block;
  margin-bottom: 4px;
}

.level {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.level-normal { background: #d4edda; color: #155724; }
.level-mild { background: #fff3cd; color: #856404; }
.level-moderate { background: #ffe0b2; color: #e65100; }
.level-severe { background: #f8d7da; color: #721c24; }

.empty {
  text-align: center;
  padding: 60px 20px;
}

.empty p {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.btn-go {
  padding: 10px 28px;
  background: #73a9d8;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}
</style>
