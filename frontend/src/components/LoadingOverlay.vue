<template>
  <transition name="fade">
    <div v-if="visible" class="loading-overlay">
      <div class="spinner"></div>
      <p class="text">{{ text }}</p>
    </div>
  </transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  text?: string
}>()
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 21, 28, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2.5px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.text {
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  margin-top: 16px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
