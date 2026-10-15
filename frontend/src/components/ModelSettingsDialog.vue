<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click.self="onClose">
      <div class="dialog-box" @click.stop>
        <div class="dialog-header">
          <h3>
            <AppIcon name="settings" :size="16" />
            模型配置
          </h3>
          <button class="btn-close" @click="onClose" title="关闭">
            <AppIcon name="close" :size="16" />
          </button>
        </div>

        <div class="dialog-body">
          <!-- 模型列表 -->
          <div class="sec-label">模型列表</div>
          <div class="model-list">
            <!-- 默认模型（服务端统一配置，固定不可删） -->
            <div :class="['model-row', { active: !selected }]">
              <div class="mr-main">
                <div class="mr-name">
                  默认模型
                  <span class="mr-tag">服务端</span>
                  <span v-if="!selected" class="mr-cur">使用中</span>
                </div>
                <div class="mr-sub">服务端统一配置，始终可用</div>
              </div>
              <button
                v-if="selected"
                class="mr-use"
                :disabled="busy"
                @click="onSelect('')"
              >使用</button>
            </div>
            <!-- 自定义模型 -->
            <div
              v-for="m in models"
              :key="m.model"
              :class="['model-row', { active: m.model === selected }]"
            >
              <div class="mr-main">
                <div class="mr-name">
                  {{ m.model }}
                  <span :class="['mr-tag', { own: !!m.base_url }]">{{ m.base_url ? '自带' : '服务端网关' }}</span>
                  <span v-if="m.model === selected" class="mr-cur">使用中</span>
                </div>
                <div class="mr-sub">
                  {{ m.base_url || '走服务端模型网关' }}{{ m.key_hint ? ' · Key ' + m.key_hint : '' }}
                </div>
              </div>
              <div class="mr-acts">
                <button class="mr-icon" :disabled="testing === m.model" :title="testing === m.model ? '测试中' : '测试连接'" @click="onTestSaved(m)">
                  <AppIcon name="refresh" :size="13" />
                </button>
                <button class="mr-icon" title="编辑" @click="startEdit(m)">
                  <AppIcon name="edit" :size="13" />
                </button>
                <button class="mr-icon" title="删除" @click="onDelete(m)">
                  <AppIcon name="trash" :size="13" />
                </button>
                <button v-if="m.model !== selected" class="mr-use" :disabled="busy" @click="onSelect(m.model)">使用</button>
              </div>
            </div>
            <div v-if="!models.length" class="list-empty">
              还没有自定义模型，在下方添加（可自带网关地址与 API Key）
            </div>
          </div>

          <!-- 添加 / 编辑表单 -->
          <div class="sec-label">{{ editMode ? '编辑模型' : '添加模型' }}</div>
          <div class="model-form">
            <div class="form-group">
              <label>模型名称</label>
              <input
                v-model="form.model"
                type="text"
                placeholder="如 gpt-4o-mini、deepseek-chat"
                :disabled="busy || editMode"
                maxlength="80"
              />
            </div>
            <div class="form-group">
              <label>API 地址（可选）</label>
              <input
                v-model="form.baseUrl"
                type="text"
                placeholder="OpenAI 兼容网关地址，如 https://api.xx.com/v1"
                :disabled="busy"
              />
            </div>
            <div class="form-group">
              <label>API 密钥（可选）</label>
              <input
                v-model="form.apiKey"
                type="password"
                placeholder="与 API 地址成对填写；都留空则走服务端模型网关"
                autocomplete="off"
                :disabled="busy"
              />
            </div>
            <div class="form-hint">
              {{ formHint }}
            </div>
            <div v-if="testResult" :class="['test-result', testResult.ok ? 'ok' : 'fail']">
              {{ testResult.text }}
            </div>
            <div class="form-actions">
              <button class="btn-ghost" :disabled="!canTest || testing" @click="onTestForm">
                <span v-if="testing" class="spinner dark"></span>
                <span v-else>测试连接</span>
              </button>
              <button v-if="editMode" class="btn-ghost" :disabled="busy" @click="cancelEdit">取消编辑</button>
              <button class="btn-primary" :disabled="!canSave || busy" @click="onSave">
                <span v-if="busy" class="spinner"></span>
                <span v-else>{{ editMode ? '保存修改' : '添加模型' }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-primary" @click="onClose">完成</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getChatModels, addChatModel, deleteChatModel, selectChatModel, testChatModel } from '@/api/user'
import { success, error } from '@/utils/dialog'
import AppIcon from '@/components/AppIcon.vue'

interface CustomModel { model: string; base_url: string; key_hint: string; selected: boolean }

const emit = defineEmits<{ (e: 'changed', selected: string | null): void }>()

const visible = ref(false)
const busy = ref(false)
const testing = ref(false)
const models = ref<CustomModel[]>([])
const selected = ref<string | null>(null)
const gatewayEnabled = ref(true)
const editMode = ref(false)
const testResult = ref<{ ok: boolean; text: string } | null>(null)

const form = ref({ model: '', baseUrl: '', apiKey: '' })

const formHint = computed(() => {
  const hasUrl = !!form.value.baseUrl.trim()
  const hasKey = !!form.value.apiKey.trim()
  if (hasUrl !== hasKey) return 'API 地址与密钥需成对填写；都留空则走服务端模型网关'
  if (!hasUrl && !gatewayEnabled.value) return '服务端模型网关未配置：请填写 API 地址与密钥'
  return 'API 地址与密钥成对填写走自带网关；都留空走服务端模型网关'
})

const pairValid = computed(() => {
  const hasUrl = !!form.value.baseUrl.trim()
  const hasKey = !!form.value.apiKey.trim()
  return hasUrl === hasKey
})

const canSave = computed(() => {
  return !!form.value.model.trim() && pairValid.value && (!form.value.baseUrl.trim() || /^https?:\/\/\S+$/i.test(form.value.baseUrl.trim()))
})

const canTest = computed(() => {
  return !!form.value.model.trim() && pairValid.value
})

const load = async () => {
  try {
    const res: any = await getChatModels()
    if (res?.data) {
      models.value = res.data.custom || []
      selected.value = res.data.selected ?? null
      gatewayEnabled.value = !!res.data.gateway_enabled
    }
  } catch (e) {
    console.error('模型列表加载失败:', e)
  }
}

const show = () => {
  editMode.value = false
  form.value = { model: '', baseUrl: '', apiKey: '' }
  testResult.value = null
  visible.value = true
  load()
}

const onClose = () => {
  visible.value = false
}

const resetForm = () => {
  editMode.value = false
  form.value = { model: '', baseUrl: '', apiKey: '' }
  testResult.value = null
}

const startEdit = (m: CustomModel) => {
  editMode.value = true
  form.value.model = m.model
  form.value.baseUrl = m.base_url || ''
  form.value.apiKey = ''
  testResult.value = null
}

const cancelEdit = () => resetForm()

const onSelect = async (model: string) => {
  busy.value = true
  try {
    await selectChatModel(model)
    selected.value = model || null
    emit('changed', selected.value)
    resetForm()
  } catch (e: any) {
    await error(e?.response?.data?.message || '切换模型失败')
  } finally {
    busy.value = false
  }
}

const onSave = async () => {
  busy.value = true
  try {
    await addChatModel({
      model: form.value.model.trim(),
      base_url: form.value.baseUrl.trim(),
      api_key: form.value.apiKey.trim()
    })
    await load()
    emit('changed', selected.value)
    resetForm()
  } catch (e: any) {
    await error(e?.response?.data?.message || (editMode.value ? '保存失败' : '添加失败'))
  } finally {
    busy.value = false
  }
}

const onDelete = async (m: CustomModel) => {
  busy.value = true
  try {
    await deleteChatModel(m.model)
    if (selected.value === m.model) selected.value = null
    emit('changed', selected.value)
    await load()
  } catch (e: any) {
    await error(e?.response?.data?.message || '删除失败')
  } finally {
    busy.value = false
  }
}

// 表单值直接测试（未保存的配置先测后存）
const onTestForm = async () => {
  testing.value = true
  testResult.value = null
  try {
    const res: any = await testChatModel({
      model: form.value.model.trim(),
      base_url: form.value.baseUrl.trim(),
      api_key: form.value.apiKey.trim()
    })
    const d = res?.data
    testResult.value = d?.success
      ? { ok: true, text: `连接成功${d.latency_ms != null ? '（' + d.latency_ms + 'ms）' : ''}` }
      : { ok: false, text: d?.message || '连接失败' }
  } catch (e: any) {
    testResult.value = { ok: false, text: e?.response?.data?.message || '连接失败' }
  } finally {
    testing.value = false
  }
}

// 列表行测试已保存配置
const onTestSaved = async (m: CustomModel) => {
  testing.value = m.model
  try {
    const res: any = await testChatModel({ model: m.model, use_saved: true })
    const d = res?.data
    if (d?.success) {
      await success(`「${m.model}」连接成功${d.latency_ms != null ? '（' + d.latency_ms + 'ms）' : ''}`)
    } else {
      await error(`「${m.model}」${d?.message || '连接失败'}`)
    }
  } catch (e: any) {
    await error(e?.response?.data?.message || '连接失败')
  } finally {
    testing.value = ''
  }
}

defineExpose({ show })
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 21, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.dialog-box {
  background: var(--card-bg);
  width: 580px;
  max-width: 92vw;
  max-height: 86vh;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 0;
  flex-shrink: 0;
}

.dialog-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.btn-close {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s var(--ease-out);
}

.btn-close:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

.dialog-body {
  padding: 16px 24px;
  overflow-y: auto;
  min-height: 0;
}

.sec-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 18px;
}

.model-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: transparent;
  transition: border-color 0.15s, background 0.15s;
}

.model-row:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.model-row.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.mr-main {
  flex: 1;
  min-width: 0;
}

.mr-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mr-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--text-muted) 15%, transparent);
  border-radius: 6px;
}

.mr-tag.own {
  color: var(--accent);
  background: var(--accent-soft);
}

.mr-cur {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--accent);
}

.mr-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mr-acts {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mr-icon {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.mr-icon:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent);
}

.mr-icon:hover[title="删除"]:not(:disabled) {
  color: var(--danger);
}

.mr-use {
  padding: 4px 12px;
  margin-left: 4px;
  font-size: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: transparent;
  color: var(--accent);
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.mr-use:hover:not(:disabled) {
  background: var(--accent-soft);
}

.mr-use:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.list-empty {
  padding: 14px 12px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
}

.model-form {
  border-top: 1px solid var(--border-color);
  padding-top: 14px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 9px 13px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-ctl);
  font-size: 13px;
  background: var(--input-bg);
  color: var(--text-primary);
  outline: none;
  font-family: var(--font-ui);
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-hint {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 10px;
}

.test-result {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.test-result.ok {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.test-result.fail {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.form-actions {
  display: flex;
  gap: 10px;
}

.form-actions button {
  flex: 1;
  height: 38px;
  border-radius: var(--radius-ctl);
  font-size: 13px;
  cursor: pointer;
  font-family: var(--font-ui);
  transition: all 0.2s var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  border: none;
  color: var(--on-accent);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  padding: 0 24px 20px;
  flex-shrink: 0;
}

.dialog-footer button {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-ctl);
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font-ui);
}

.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid color-mix(in srgb, var(--on-accent) 30%, transparent);
  border-top-color: var(--on-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.dark {
  border-color: color-mix(in srgb, var(--text-muted) 30%, transparent);
  border-top-color: var(--text-secondary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
