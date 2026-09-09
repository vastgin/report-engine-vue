<script setup lang="ts">
import type { RenderResult } from '@/engine/renderReport'
import ChartCanvas from '@/components/ChartCanvas.vue'
import MetricCardChart from '@/components/MetricCardChart.vue'
import TableChart from '@/components/TableChart.vue'

defineProps<{ result: RenderResult }>()
</script>

<template>
  <div class="report-chart">
    <MetricCardChart v-if="result.metrics" :metrics="result.metrics" />
    <TableChart v-else-if="result.table" :table="result.table" />
    <ChartCanvas v-else :option="result.option" />
  </div>
</template>

<style scoped>
.report-chart {
  width: 100%;
  height: 100%;
}
</style>
