<template>
  <div class="expert-layout">
    <aside class="expert-sidebar">
      <div class="logo-box">
        <div class="logo-icon">👨‍⚕️</div>
        <h2>专家工作台</h2>
      </div>
      <nav>
        <router-link 
          to="/expert/appointments"
          :class="{ active: $route.path.startsWith('/expert/appointments') }"
        >
          <span class="menu-icon">📋</span>
          <span class="menu-text">预约管理</span>
        </router-link>
        <a 
        :class="{ active: $route.path === '/dashboard' }"
        @click="goToUserCenter"
        style="cursor: pointer;"
        >
        <span class="menu-icon">👤</span>
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

const router = useRouter()

const goToUserCenter = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.expert-layout {
  display: flex;
  width: 100vw;
  height: calc(100vh - 36px);
  overflow: hidden;
}

.expert-sidebar {
  width: 220px;
  min-width: 220px;
  height: calc(100vh - 36px);
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  box-sizing: border-box;
}

.logo-box {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.logo-icon {
  font-size: 32px;
  margin-bottom: 6px;
}

.logo-box h2 {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  color: rgba(255,255,255,0.6);
  text-decoration: none;
  padding: 10px 14px;
  border-radius: 10px;
  transition: all 0.25s;
  font-size: 14px;
  flex-shrink: 0;
}

nav a:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
}

nav a.active {
  background: linear-gradient(135deg, #73a9d8, #4a90c2);
  color: #fff;
  box-shadow: 0 4px 12px rgba(115, 169, 216, 0.3);
}

.menu-icon {
  font-size: 16px;
}

.expert-main {
  flex: 1;
  height: calc(100vh - 36px);
  overflow-y: auto;
  overflow-x: hidden;
  background: #f6f8fc;
  padding: 24px 32px;
  box-sizing: border-box;
}

.expert-main::-webkit-scrollbar {
  width: 6px;
}

.expert-main::-webkit-scrollbar-track {
  background: transparent;
}

.expert-main::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 3px;
}

.expert-main::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.2);
}
</style>