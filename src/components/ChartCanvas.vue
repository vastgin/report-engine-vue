<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  option?: EChartsOption
}>()

const container = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts>()
let resizeObserver: ResizeObserver | undefined

function render() {
  if (!chart.value || !props.option) return
  // notMerge=true：切换图表类型/绑定时彻底替换配置，避免残留旧系列
  chart.value.setOption(props.option, { notMerge: true })
}

onMounted(() => {
  if (!container.value) return
  chart.value = echarts.init(container.value)
  render()

  // 容器尺寸变化时自动重绘（对齐 report-preview 的 Responsive Chart Sizing）
  resizeObserver = new ResizeObserver(() => chart.value?.resize())
  resizeObserver.observe(container.value)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = undefined
  chart.value?.dispose()
  chart.value = undefined
})
</script>

<template>
  <div ref="container" class="chart-canvas"></div>
</template>

<style scoped>
.chart-canvas {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>
