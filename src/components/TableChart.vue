<script setup lang="ts">
import { computed } from 'vue'
import { computeRowSpans, formatMeasure, type ReportDataSet } from '@/engine/chartModel'

const props = defineProps<{ table: ReportDataSet }>()

// 合并信息与数值格式化属于前端渲染职责：dataset 只提供列 + 原始数值行
const spans = computed(() => computeRowSpans(props.table))

// el-table 以列 key 取值；指标列格式化为文本展示，维度列原样文本
const rows = computed(() =>
  props.table.rows.map((row) => {
    const out: Record<string, string> = {}
    for (const col of props.table.columns) {
      const cell = row[col.key]
      out[col.key] = col.role === 'measure' ? formatMeasure(Number(cell)) : String(cell ?? '')
    }
    return out
  })
)

/**
 * el-table 合并单元格：前 dimensionCount 列（维度列）按 spans 做纵向合并，
 * rowspan=0 的单元格被上方单元格吞并；指标列不合并。
 */
function spanMethod({ rowIndex, columnIndex }: { rowIndex: number; columnIndex: number }) {
  if (columnIndex < props.table.dimensionCount) {
    const rowspan = spans.value[rowIndex]?.[columnIndex] ?? 1
    return { rowspan, colspan: rowspan > 0 ? 1 : 0 }
  }
  return { rowspan: 1, colspan: 1 }
}
</script>

<template>
  <div class="table-chart">
    <el-table
      class="pivot-table"
      :data="rows"
      :span-method="spanMethod"
      border
      stripe
      size="small"
      height="100%"
    >
      <el-table-column
        v-for="col in table.columns"
        :key="col.key"
        :prop="col.key"
        :label="col.label"
        :align="col.role === 'measure' ? 'right' : 'left'"
        :min-width="col.role === 'measure' ? 96 : 110"
        show-overflow-tooltip
      />
      <template #empty>暂无数据</template>
    </el-table>
  </div>
</template>

<style scoped>
.table-chart {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.pivot-table {
  width: 100%;
}

/* 合并后的维度单元格垂直居中，强调分层结构 */
.pivot-table :deep(.el-table__cell) {
  vertical-align: middle;
  padding: 4px 0;
}

.pivot-table :deep(.el-table__header th) {
  background: #f5f7fa;
  color: #1f2329;
  font-weight: 600;
}
</style>
