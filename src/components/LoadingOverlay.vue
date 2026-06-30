<template>
  <transition name="fade">
    <div v-if="visible" class="loading-overlay">
      <div class="spinner">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
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
  background: rgba(59, 130, 246, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.spinner {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.text {
  color: #fff;
  font-size: 14px;
  margin-top: 20px;
  opacity: 0.9;
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
