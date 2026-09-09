<script setup lang="ts">
import type { MetricCard } from '@/engine/chartModel'

defineProps<{ metrics: MetricCard[] }>()
</script>

<template>
  <div class="metric-cards">
    <div v-for="(card, i) in metrics" :key="i" class="metric-card">
      <!-- 上侧：维度标签 -->
      <div v-if="card.label" class="metric-label">{{ card.label }}</div>

      <!-- 主指标 -->
      <div class="metric-primary">
        <span class="primary-value">{{ card.primary.formatted }}</span>
        <span class="primary-name">{{ card.primary.measureLabel }}</span>
      </div>

      <!-- 下侧：两个次指标展示区域 -->
      <div v-if="card.secondary.length" class="metric-secondary">
        <div v-for="(s, j) in card.secondary" :key="j" class="secondary-item">
          <span class="secondary-value">{{ s.formatted }}</span>
          <span class="secondary-name">{{ s.measureLabel }}</span>
        </div>
      </div>
    </div>

    <div v-if="metrics.length === 0" class="metric-empty">请绑定度量以生成指标卡</div>
  </div>
</template>

<style scoped>
.metric-cards {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  align-content: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
}

.metric-card {
  flex: 1 1 180px;
  max-width: 300px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 8px;
  padding: 16px 18px;
  background: #f7f9fc;
  border: 1px solid #ebeef5;
  border-top: 3px solid #409eff;
  border-radius: 8px;
}

/* 上侧维度标签 */
.metric-label {
  font-size: 14px;
  font-weight: 600;
  color: #4e5969;
  text-align: center;
  word-break: break-word;
}

/* 主指标 */
.metric-primary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.primary-value {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.15;
  color: #1f2329;
  font-variant-numeric: tabular-nums;
}

.primary-name {
  font-size: 12px;
  color: #a8abb2;
}

/* 次指标区：两个并列展示区域 */
.metric-secondary {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px dashed #dcdfe6;
}

.secondary-item {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.secondary-value {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  font-variant-numeric: tabular-nums;
}

.secondary-name {
  font-size: 11px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.metric-empty {
  font-size: 13px;
  color: #a8abb2;
  align-self: center;
}
</style>
