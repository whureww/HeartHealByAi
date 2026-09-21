<template>
  <div class="expert-layout">
    <aside class="expert-sidebar">
      <div class="logo-box">
        <div class="logo-mark"><AppIcon name="stethoscope" :size="18" /></div>
        <div class="logo-text">
          <h2>专家工作台</h2>
          <p>心愈 · 咨询师端</p>
        </div>
      </div>
      <nav>
        <router-link
          to="/expert/appointments"
          :class="{ active: $route.path.startsWith('/expert/appointments') }"
        >
          <AppIcon name="clipboard" :size="17" />
          <span class="menu-text">预约管理</span>
        </router-link>
        <a
          :class="{ active: $route.path === '/dashboard' }"
          @click="goToUserCenter"
          style="cursor: pointer;"
        >
          <AppIcon name="user" :size="17" />
          <span class="menu-text">个人中心</span>
        </a>
      </nav>
    </aside>

    <main class="expert-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()

const goToUserCenter = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.expert-layout {
  display: flex;
  width: 100vw;
  height: calc(100vh - 38px);
  overflow: hidden;
}

.expert-sidebar {
  width: 224px;
  min-width: 224px;
  height: calc(100vh - 38px);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  box-sizing: border-box;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 6px 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text h2 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.logo-text p {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

nav::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 9px 12px;
  border-radius: var(--radius-ctl);
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
  font-size: 13.5px;
  flex-shrink: 0;
}

nav a:hover {
  background: var(--accent-soft);
  color: var(--text-primary);
}

nav a.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.expert-main {
  flex: 1;
  height: calc(100vh - 38px);
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-primary);
  padding: 24px 32px;
  box-sizing: border-box;
}
</style>
