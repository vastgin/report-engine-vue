<script setup lang="ts">
import { computed } from 'vue'
import { useDesignerStore } from '@/stores/designer'
import { getChartLabel } from '@/engine/chartTypes'
import ReportChart from '@/components/ReportChart.vue'
import { useReportQuery } from '@/composables/useReportQuery'

const store = useDesignerStore()

// 展示模式复用 store 中最新的报表定义，经后端查询接口获取数据（与设计画布一致，对齐 report-preview 规范）
const { result: renderResult, loading } = useReportQuery(() => store.reportDefinition)
const error = computed(() => renderResult.value.error)
const title = computed(() => store.options.title || '未命名报表')
const chartLabel = computed(() => getChartLabel(store.chartType))
</script>

<template>
  <div class="preview">
    <div class="preview-card" v-loading="loading">
      <div class="preview-header">
        <h2 class="preview-title">{{ title }}</h2>
        <div class="header-meta">
          <span class="chip">{{ chartLabel }}</span>
          <span class="badge">展示模式 · 只读</span>
        </div>
      </div>

      <el-result
        v-if="error"
        icon="warning"
        title="无法渲染报表"
        :sub-title="error"
        class="preview-error"
      >
        <template #extra>
          <RouterLink to="/design">
            <el-button type="primary">返回设计器修改</el-button>
          </RouterLink>
        </template>
      </el-result>

      <ReportChart v-else :result="renderResult" class="preview-chart" />
    </div>
  </div>
</template>

<style scoped>
.preview {
  height: 100%;
  padding: 20px;
}

.preview-card {
  height: 100%;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex: 0 0 auto;
}

.preview-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.badge {
  font-size: 12px;
  color: #909399;
  background: #f4f4f5;
  border-radius: 10px;
  padding: 3px 10px;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chip {
  font-size: 12px;
  color: #409eff;
  background: #ecf5ff;
  border-radius: 10px;
  padding: 3px 10px;
}

.preview-chart {
  flex: 1 1 auto;
}

.preview-error {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
