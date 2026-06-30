<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="logo-box">
        <div class="logo-icon">⚙️</div>
        <h2>管理后台</h2>
      </div>
      <nav>
        <router-link 
          v-for="item in menuItems" 
          :key="item.path"
          :to="item.path"
          :class="{ active: $route.path.startsWith(item.path) }"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span class="menu-text">{{ item.name }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="btn-back" @click="goBack">
          ← 返回前台
        </button>
      </div>
    </aside>
    
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const menuItems = [
  { path: '/admin/users', name: '用户管理', icon: '👥' },
  { path: '/admin/tests', name: '问卷管理', icon: '📋' },
  { path: '/admin/appointments', name: '预约管理', icon: '📅' }  // ← 新增
]

const goBack = () => {
  router.push({ path: '/dashboard', query: { from: 'admin' } })
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  width: 100vw;
  height: calc(100vh - 36px);  /* 减去标题栏高度 */
  overflow: hidden;
}

.admin-sidebar {
  width: 220px;
  min-width: 220px;
  height: calc(100vh - 36px);  /* 减去标题栏高度 */
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  padding: 20px 16px;  /* 稍微减小 padding */
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

.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.btn-back {
  width: 100%;
  padding: 10px;
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.8);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.25s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-back:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.admin-main {
  flex: 1;
  height: calc(100vh - 36px);  /* 减去标题栏高度 */
  overflow-y: auto;
  overflow-x: hidden;
  background: #f6f8fc;
  padding: 24px 32px;
  box-sizing: border-box;
}

.admin-main::-webkit-scrollbar {
  width: 6px;
}

.admin-main::-webkit-scrollbar-track {
  background: transparent;
}

.admin-main::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 3px;
}

.admin-main::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.2);
}
</style>
