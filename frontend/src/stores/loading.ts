import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n } from '@/i18n'

export const useLoadingStore = defineStore('loading', () => {
  const visible = ref(false)
  const text = ref('')

  function show(msg?: string) {
    text.value = msg || i18n.global.t('core.loading')
    visible.value = true
  }

  function hide() {
    visible.value = false
    text.value = ''
  }

  return { visible, text, show, hide }
})
