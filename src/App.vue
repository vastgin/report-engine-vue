<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="title">维思勤报表引擎</span>
        <span class="subtitle">ECharts + Vue 3</span>
      </div>
      <nav class="nav">
        <RouterLink to="/design" :class="{ active: route.name === 'design' }">设计器</RouterLink>
        <RouterLink to="/dashboard" :class="{ active: route.name === 'dashboard' }">看板</RouterLink>
        <RouterLink to="/preview" :class="{ active: route.name === 'preview' }">展示模式</RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background: #fff;
  color: #1f2329;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  flex: 0 0 auto;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.brand .logo {
  font-size: 20px;
}

.brand .title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.brand .subtitle {
  font-size: 12px;
  color: #8a9099;
}

.nav {
  display: flex;
  gap: 8px;
}

.nav a {
  padding: 6px 14px;
  border-radius: 6px;
  color: #4e5969;
  text-decoration: none;
  font-size: 14px;
  transition: background 0.2s, color 0.2s;
}

.nav a:hover {
  background: #f2f3f5;
  color: #409eff;
}

.nav a.active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}

.app-main {
  flex: 1 1 auto;
  overflow: hidden;
}
</style>
