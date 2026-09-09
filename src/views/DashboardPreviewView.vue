<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Back, FullScreen } from '@element-plus/icons-vue'
import { useDashboardStore } from '@/stores/dashboard'
import DashboardWidgetCard from '@/components/DashboardWidgetCard.vue'

const router = useRouter()
const dashboard = useDashboardStore()

function back() {
  router.push('/dashboard')
}

function toggleFullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement) {
    el.requestFullscreen?.().catch(() => {})
  } else {
    document.exitFullscreen?.().catch(() => {})
  }
}
</script>

<template>
  <div class="preview-page">
    <header class="preview-head">
      <el-button text :icon="Back" class="head-side" @click="back">返回编辑</el-button>
      <h1 class="preview-title">{{ dashboard.title || '未命名看板' }}</h1>
      <el-button text :icon="FullScreen" class="head-side right" @click="toggleFullscreen">全屏</el-button>
    </header>

    <el-scrollbar class="preview-scroll">
      <div v-if="dashboard.widgetCount === 0" class="preview-empty">
        <el-empty description="看板暂无图表，请先在「看板」页添加" />
        <el-button type="primary" @click="back">去添加图表</el-button>
      </div>

      <div v-else class="preview-grid">
        <DashboardWidgetCard
          v-for="(widget, i) in dashboard.widgets"
          :key="widget.id"
          readonly
          :widget="widget"
          :index="i"
          :total="dashboard.widgetCount"
        />
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.preview-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.preview-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex: 0 0 auto;
}

.head-side {
  flex: 0 0 auto;
}

.head-side.right {
  margin-left: auto;
}

.preview-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2329;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-scroll {
  flex: 1;
  min-height: 0;
  background: #f2f3f5;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
}

@media (max-width: 900px) {
  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
