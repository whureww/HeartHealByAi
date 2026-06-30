<<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>📋 问卷管理</h2>
        <p class="subtitle">管理系统心理测评问卷</p>
      </div>
      <button class="btn-primary" @click="$router.push('/admin/tests/edit')">
        <span class="btn-icon">+</span>
        新建问卷
      </button>
    </div>

    <div class="filter-bar">
      <button 
        v-for="tab in tabs" 
        :key="tab.value ?? 'all'"
        :class="{ active: currentStatus === tab.value }"
        @click="currentStatus = tab.value; loadTests()"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>问卷名称</th>
            <th>分类</th>
            <th>题目数</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="test in tests" :key="test.id">
            <td class="id-cell">#{{ test.id }}</td>
            <td>
              <div class="test-name">
                <span class="test-code">{{ test.code }}</span>
                <span>{{ test.name }}</span>
              </div>
            </td>
            <td>
              <span class="category-tag">{{ categoryText(test.category) }}</span>
            </td>
            <td>{{ test.total_questions }} 题</td>
            <td>
              <span :class="['status-tag', `status-${test.status}`]">
                {{ statusText(test.status) }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(test.created_at) }}</td>
            <td>
              <div class="action-btns">
                <button 
                  v-if="test.status === 0" 
                  class="btn-action btn-approve" 
                  @click="updateStatus(test.id, 1)"
                >
                  ✓ 上架
                </button>
                <button 
                  v-if="test.status === 1" 
                  class="btn-action btn-reject" 
                  @click="updateStatus(test.id, 2)"
                >
                  ↓ 下架
                </button>
                <button 
                  v-if="test.status === 2" 
                  class="btn-action btn-approve" 
                  @click="updateStatus(test.id, 1)"
                >
                  ↻ 重新上架
                </button>
                <button 
                  class="btn-action btn-edit" 
                  @click="$router.push(`/admin/tests/edit/${test.id}`)"
                >
                  ✎ 编辑
                </button>
                <button 
                  class="btn-action btn-delete" 
                  @click="deleteTest(test.id)"
                >
                  🗑 删除
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="tests.length === 0">
            <td colspan="7" class="empty-cell">暂无问卷数据</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '@/api/request'
import { confirm, success, error } from '@/utils/dialog'

const tests = ref<any[]>([])
const currentStatus = ref<number | undefined>(undefined)

const tabs = [
  { label: '全部', value: undefined },
  { label: '待审核', value: 0 },
  { label: '已上架', value: 1 },
  { label: '已下架', value: 2 }
]

const statusText = (status: number) => {
  const map: Record<number, string> = { 0: '待审核', 1: '已上架', 2: '已下架' }
  return map[status] || '未知'
}

const categoryText = (cat: string) => {
  const map: Record<string, string> = { 
    emotion: '情绪测评', 
    stress: '压力测评', 
    personality: '人格测评', 
    cognitive: '认知测评' 
  }
  return map[cat] || cat
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const loadTests = async () => {
  try {
    const params: any = {}
    if (currentStatus.value !== undefined) params.status = currentStatus.value
    
    const res = await request.get('/admin/tests', { params }) as any
    tests.value = res.data
  } catch (e: any) {
    await error(e.message || '加载问卷列表失败')
  }
}

const updateStatus = async (id: number, status: number) => {
  try {
    await request.put(`/admin/tests/${id}/status`, { status })
    await success('状态更新成功')
    loadTests()
  } catch (e: any) {
    await error(e.message || '更新失败')
  }
}

const deleteTest = async (id: number) => {
  const ok = await confirm('确定删除该问卷？此操作不可恢复。', '确认删除')
  if (!ok) return
  
  try {
    await request.delete(`/admin/tests/${id}`)
    await success('删除成功')
    loadTests()
  } catch (e: any) {
    await error(e.message || '删除失败')
  }
}

onMounted(loadTests)
</script>

<style scoped>
.page-container {
  background: #fff;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.subtitle {
  color: #9ca3af;
  font-size: 14px;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(115, 169, 216, 0.3);
}

.btn-icon {
  font-size: 18px;
  font-weight: 300;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.filter-bar button {
  padding: 10px 24px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  transition: all 0.25s;
}

.filter-bar button:hover {
  border-color: #73a9d8;
  color: #73a9d8;
}

.filter-bar button.active {
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(115, 169, 216, 0.3);
}

.table-wrap {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th {
  padding: 16px;
  text-align: left;
  background: #f9fafb;
  color: #6b7280;
  font-weight: 500;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  color: #4b5563;
}

.data-table tbody tr:hover {
  background: #fafbfc;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.id-cell {
  font-family: monospace;
  color: #9ca3af;
  font-size: 13px;
}

.test-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.test-code {
  font-size: 12px;
  color: #9ca3af;
  font-family: monospace;
}

.category-tag {
  padding: 4px 12px;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 20px;
  font-size: 12px;
}

.status-tag {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-0 { background: #fef3c7; color: #92400e; }
.status-1 { background: #d1fae5; color: #065f46; }
.status-2 { background: #fee2e2; color: #991b1b; }

.date-cell {
  color: #9ca3af;
  font-size: 13px;
}

.action-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-action {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-approve { 
  background: #e0f2fe; 
  color: #0369a1; 
}

.btn-approve:hover {
  background: #73a9d8;
  color: #fff;
}

.btn-reject { 
  background: #fef3c7; 
  color: #92400e; 
}

.btn-reject:hover {
  background: #f59e0b;
  color: #fff;
}

.btn-edit {
  background: #f3f4f6;
  color: #4b5563;
}

.btn-edit:hover {
  background: #6b7280;
  color: #fff;
}

.btn-delete { 
  background: #fee2e2; 
  color: #dc2626; 
}

.btn-delete:hover {
  background: #ef4444;
  color: #fff;
}

.empty-cell {
  text-align: center;
  padding: 60px;
  color: #9ca3af;
  font-size: 14px;
}
</style>
