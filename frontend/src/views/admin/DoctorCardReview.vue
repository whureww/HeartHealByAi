<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>{{ $t('admin.doctor.title') }}</h2>
        <p class="subtitle">{{ $t('admin.doctor.subtitle') }}</p>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ $t('admin.doctor.th.doctor') }}</th>
            <th>{{ $t('admin.doctor.th.title') }}</th>
            <th>{{ $t('admin.doctor.th.specialty') }}</th>
            <th>{{ $t('admin.doctor.th.intro') }}</th>
            <th>{{ $t('admin.doctor.th.status') }}</th>
            <th>{{ $t('admin.doctor.th.createdAt') }}</th>
            <th>{{ $t('admin.doctor.th.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="card in cards" :key="card.id">
            <td>
              <div class="user-info">
                <span>{{ card.name }}</span>
                <span class="user-email">{{ card.user_email || $t('admin.doctor.noAccount') }}</span>
              </div>
            </td>
            <td>{{ card.title || '—' }}</td>
            <td class="ellipsis" :title="card.specialty">{{ card.specialty || '—' }}</td>
            <td class="ellipsis" :title="card.intro">{{ card.intro || '—' }}</td>
            <td>
              <span :class="['status-tag', `st-${card.status}`]">{{ statusText(card.status) }}</span>
            </td>
            <td class="date-cell">{{ formatDate(card.created_at) }}</td>
            <td>
              <div class="row-actions">
                <button
                  v-if="card.status !== 1"
                  class="btn-approve"
                  :title="$t('admin.doctor.approveTitle')"
                  @click="review(card, 'approve')"
                >
                  <AppIcon name="check" :size="14" />
                  {{ $t('admin.doctor.approve') }}
                </button>
                <button
                  v-if="card.status !== 0"
                  class="btn-reject"
                  :title="$t('admin.doctor.rejectTitle')"
                  @click="review(card, 'reject')"
                >
                  <AppIcon name="close" :size="14" />
                  {{ $t('admin.doctor.reject') }}
                </button>
                <span v-if="card.status === 0" class="status-tip">{{ $t('admin.doctor.stOff') }}</span>
              </div>
            </td>
          </tr>
          <tr v-if="cards.length === 0">
            <td colspan="7" class="empty-cell">
              <AppIcon name="stethoscope" :size="28" />
              <p>{{ $t('admin.doctor.empty') }}</p>
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
import { getDoctorCards, reviewDoctorCard } from '@/api/admin'
import { success, error, confirm } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

const { t } = useI18n()
const cards = ref<any[]>([])

const statusText = (s: number) =>
  (({ 0: t('admin.doctor.stOff'), 1: t('admin.doctor.stOn'), 2: t('admin.doctor.stPending') } as Record<number, string>)[s] ?? t('admin.doctor.unknown'))

const formatDate = (d: string) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '—')

const load = async () => {
  try {
    const res = await getDoctorCards() as any
    cards.value = res.data || []
  } catch (e: any) {
    await error(e.message || t('admin.doctor.loadFailed'))
  }
}

const review = async (card: any, action: 'approve' | 'reject') => {
  const isApprove = action === 'approve'
  const ok = await confirm(
    isApprove
      ? t('admin.doctor.confirmApprove', { name: card.name })
      : t('admin.doctor.confirmReject', { name: card.name }),
    isApprove ? t('admin.doctor.approveCard') : t('admin.doctor.rejectCard')
  )
  if (!ok) return
  try {
    const res = await reviewDoctorCard(card.id, action) as any
    await success(res.message || t('admin.doctor.opSuccess'))
    await load()
  } catch (e: any) {
    await error(e.message || t('admin.doctor.opFailed'))
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
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: top;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-email {
  font-size: 11.5px;
  color: var(--text-muted);
}

.ellipsis {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.st-1 {
  background: color-mix(in srgb, #3a9e6e 15%, transparent);
  color: #3a9e6e;
}

.st-2 {
  background: color-mix(in srgb, #c9a227 15%, transparent);
  color: #c9a227;
}

.st-0 {
  background: var(--accent-soft);
  color: var(--text-secondary);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-approve,
.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: var(--radius-ctl);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-approve {
  border: 1px solid color-mix(in srgb, #3a9e6e 45%, transparent);
  background: transparent;
  color: #3a9e6e;
}

.btn-approve:hover {
  background: color-mix(in srgb, #3a9e6e 12%, transparent);
}

.btn-reject {
  border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
  background: transparent;
  color: var(--danger);
}

.btn-reject:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.status-tip {
  font-size: 12px;
  color: var(--text-muted);
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
