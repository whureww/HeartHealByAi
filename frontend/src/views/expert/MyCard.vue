<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2>{{ $t('expert.card.title') }}</h2>
        <p class="subtitle">{{ $t('expert.card.subtitle') }}</p>
      </div>
      <span :class="['status-tag', statusClass]">{{ statusText }}</span>
    </div>

    <div class="card-panel">
      <div class="form-item">
        <label>{{ $t('expert.card.name') }} <i>*</i></label>
        <input v-model="form.name" maxlength="50" :placeholder="$t('expert.card.namePh')" />
      </div>
      <div class="form-item">
        <label>{{ $t('expert.card.jobTitle') }}</label>
        <input v-model="form.title" maxlength="50" :placeholder="$t('expert.card.jobTitlePh')" />
      </div>
      <div class="form-item">
        <label>{{ $t('expert.card.specialty') }}</label>
        <input v-model="form.specialty" maxlength="200" :placeholder="$t('expert.card.specialtyPh')" />
      </div>
      <div class="form-item">
        <label>{{ $t('expert.card.intro') }}</label>
        <textarea v-model="form.intro" rows="5" maxlength="500" :placeholder="$t('expert.card.introPh')"></textarea>
        <span class="char-count">{{ (form.intro || '').length }}/500</span>
      </div>

      <div class="form-actions">
        <button class="btn-primary" :disabled="saving" @click="submit">
          {{ saving ? $t('expert.card.submitting') : (card?.status === 2 ? $t('expert.card.resubmit') : $t('expert.card.saveSubmit')) }}
        </button>
      </div>

      <p v-if="card?.status === 1" class="status-hint ok">
        {{ $t('expert.card.hintOn') }}
      </p>
      <p v-else-if="card?.status === 2" class="status-hint pending">
        {{ $t('expert.card.hintReview') }}
      </p>
      <p v-else class="status-hint off">
        {{ $t('expert.card.hintOff') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMyCard, saveMyCard } from '@/api/expert'
import { success, error } from '@/utils/dialog'

const { t } = useI18n()

const card = ref<any>(null)
const form = ref({ name: '', title: '', specialty: '', intro: '' })
const saving = ref(false)

const statusText = computed(() => {
  if (!card.value) return t('expert.card.stNotCreated')
  return ({ 0: t('expert.card.stOff'), 1: t('expert.card.stOn'), 2: t('expert.card.stReview') } as Record<number, string>)[card.value.status] ?? t('expert.card.stUnknown')
})
const statusClass = computed(() => {
  if (!card.value) return 'st-off'
  return ({ 0: 'st-off', 1: 'st-ok', 2: 'st-pending' } as Record<number, string>)[card.value.status] ?? 'st-off'
})

const load = async () => {
  try {
    const res = await getMyCard() as any
    card.value = res.data
    if (res.data) {
      form.value = {
        name: res.data.name || '',
        title: res.data.title || '',
        specialty: res.data.specialty || '',
        intro: res.data.intro || ''
      }
    }
  } catch (e: any) {
    await error(e.message || t('expert.card.loadFailed'))
  }
}

const submit = async () => {
  if (!form.value.name.trim()) {
    await error(t('expert.card.nameRequired'))
    return
  }
  saving.value = true
  try {
    const res = await saveMyCard(form.value) as any
    await success(res.message || t('expert.card.submitted'))
    await load()
  } catch (e: any) {
    await error(e.message || t('expert.card.submitFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-container {
  max-width: 720px;
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

.status-tag {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
}

.st-ok {
  background: color-mix(in srgb, #3a9e6e 15%, transparent);
  color: #3a9e6e;
}

.st-pending {
  background: color-mix(in srgb, #c9a227 15%, transparent);
  color: #c9a227;
}

.st-off {
  background: var(--accent-soft);
  color: var(--text-secondary);
}

.card-panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 24px;
}

.form-item {
  margin-bottom: 18px;
  position: relative;
}

.form-item label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-item label i {
  color: var(--danger);
  font-style: normal;
}

.form-item input,
.form-item textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font-ui);
  outline: none;
  transition: border-color 0.2s var(--ease-out);
}

.form-item input:focus,
.form-item textarea:focus {
  border-color: var(--accent);
}

.form-item textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.6;
}

.char-count {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-primary {
  padding: 9px 22px;
  border: none;
  border-radius: var(--radius-ctl);
  background: var(--accent);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s var(--ease-out);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-hint {
  margin: 14px 0 0;
  font-size: 12.5px;
  padding: 10px 12px;
  border-radius: var(--radius-ctl);
}

.status-hint.ok {
  background: color-mix(in srgb, #3a9e6e 10%, transparent);
  color: #3a9e6e;
}

.status-hint.pending {
  background: color-mix(in srgb, #c9a227 10%, transparent);
  color: #c9a227;
}

.status-hint.off {
  background: var(--accent-soft);
  color: var(--text-secondary);
}
</style>
