<script setup lang="ts">
import { computed, ref } from 'vue'
import { CaretBottom } from '@element-plus/icons-vue'
import { CHART_CATEGORIES, CHART_TYPES, getChartTypeDef, type ChartTypeDef } from '@/engine/chartTypes'
import type { ChartType } from '@/types'

const props = withDefaults(
  defineProps<{ modelValue: ChartType; dimensionCount?: number; measureCount?: number }>(),
  { dimensionCount: 0, measureCount: 0 }
)
const emit = defineEmits<{ 'update:modelValue': [ChartType] }>()

const visible = ref(false)
const current = computed(() => getChartTypeDef(props.modelValue))

const grouped = computed(() =>
  CHART_CATEGORIES.map((cat) => ({
    ...cat,
    items: CHART_TYPES.filter((t) => t.category === cat.category)
  })).filter((g) => g.items.length > 0)
)

/** 当前维度 / 指标数量是否满足该图表类型的约束 */
function compatible(def: ChartTypeDef): boolean {
  return (
    props.dimensionCount >= def.minDimensions &&
    props.dimensionCount <= def.maxDimensions &&
    props.measureCount >= def.minMeasures &&
    props.measureCount <= def.maxMeasures
  )
}

function requirementText(def: ChartTypeDef): string {
  const dim =
    def.minDimensions === def.maxDimensions
      ? `${def.minDimensions} 个维度`
      : `${def.minDimensions}~${def.maxDimensions} 个维度`
  const mea =
    def.minMeasures === def.maxMeasures
      ? `${def.minMeasures} 个指标`
      : `${def.minMeasures}~${def.maxMeasures} 个指标`
  return `需要 ${dim}、${mea}`
}

function onTile(def: ChartTypeDef) {
  if (!compatible(def)) return
  emit('update:modelValue', def.type)
  visible.value = false
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-start"
    :width="460"
    trigger="click"
    popper-class="chart-type-popper"
  >
    <template #reference>
      <button class="picker-trigger" type="button">
        <el-icon class="trigger-icon"><component :is="current?.icon" /></el-icon>
        <span class="trigger-label">{{ current?.label ?? '选择图表' }}</span>
        <el-icon class="trigger-caret"><CaretBottom /></el-icon>
      </button>
    </template>

    <div class="picker-body">
      <div class="picker-header">图表类型</div>
      <p class="picker-hint">灰色图表与当前维度 / 指标数量不匹配</p>
      <el-scrollbar max-height="360px">
        <div class="picker-groups">
          <section v-for="group in grouped" :key="group.category" class="picker-group">
            <div class="group-label">{{ group.label }}</div>
            <div class="group-grid">
              <button
                v-for="item in group.items"
                :key="item.type"
                type="button"
                class="tile"
                :class="{ active: item.type === modelValue, disabled: !compatible(item) }"
                :title="requirementText(item)"
                :disabled="!compatible(item)"
                @click="onTile(item)"
              >
                <el-icon class="tile-icon"><component :is="item.icon" /></el-icon>
                <span class="tile-label">{{ item.label }}</span>
              </button>
            </div>
          </section>
        </div>
      </el-scrollbar>
    </div>
  </el-popover>
</template>

<style scoped>
.picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #1f2329;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.picker-trigger:hover {
  border-color: #409eff;
}

.trigger-icon {
  font-size: 16px;
  color: #409eff;
}

.trigger-caret {
  font-size: 12px;
  color: #a8abb2;
}

.picker-body {
  margin: -4px 0;
}

.picker-header {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  padding-bottom: 10px;
  margin-bottom: 6px;
  border-bottom: 1px solid #ebeef5;
}

.picker-hint {
  font-size: 11px;
  color: #a8abb2;
  margin: 0 0 8px;
}

.picker-groups {
  padding: 4px 2px;
}

.picker-group + .picker-group {
  margin-top: 14px;
}

.group-label {
  font-size: 11px;
  font-weight: 600;
  color: #8a9099;
  letter-spacing: 0.6px;
  margin-bottom: 8px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 62px;
  padding: 6px 4px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.tile:hover {
  border-color: #a0cfff;
  background: #f5f9ff;
}

.tile.active {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 0 1px #409eff inset;
}

.tile.disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: #fafafa;
}

.tile.disabled:hover {
  border-color: #ebeef5;
  background: #fafafa;
}

.tile-icon {
  font-size: 20px;
  color: #5a6169;
}

.tile.active .tile-icon {
  color: #409eff;
}

.tile-label {
  font-size: 11px;
  color: #4e5969;
  line-height: 1.2;
  text-align: center;
}
</style>
