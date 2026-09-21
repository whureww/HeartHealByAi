import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLoadingStore = defineStore('loading', () => {
  const visible = ref(false)
  const text = ref('')

  function show(msg = '加载中...') {
    text.value = msg
    visible.value = true
  }

  function hide() {
    visible.value = false
    text.value = ''
  }

  return { visible, text, show, hide }
})
