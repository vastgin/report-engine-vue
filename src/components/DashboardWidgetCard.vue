<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { EditPen, CopyDocument, Delete, ArrowLeft, ArrowRight, MoreFilled, Rank } from '@element-plus/icons-vue'
import type { DashboardWidget, WidgetSpan } from '@/types'
import { getChartLabel } from '@/engine/chartTypes'
import { getDataset } from '@/data/registry'
import { useReportQuery } from '@/composables/useReportQuery'
import { useDashboardStore } from '@/stores/dashboard'
import { useDesignerStore } from '@/stores/designer'
import ReportChart from '@/components/ReportChart.vue'

const props = withDefaults(
  defineProps<{
    widget: DashboardWidget
    index: number
    total: number
    readonly?: boolean
    draggingId?: string | null
    dropTargetId?: string | null
  }>(),
  { readonly: false, draggingId: null, dropTargetId: null }
)

const emit = defineEmits<{
  (e: 'drag-start', id: string): void
  (e: 'drag-over', id: string): void
  (e: 'drop', id: string): void
  (e: 'drag-end'): void
}>()

const router = useRouter()
const dashboard = useDashboardStore()
const designer = useDesignerStore()

const { result, loading } = useReportQuery(() => props.widget.definition)
const chartLabel = computed(() => getChartLabel(props.widget.definition.chartType))
const datasetName = computed(() => getDataset(props.widget.definition.datasetId)?.name ?? '未知数据集')

// 拖拽重排：仅当按住拖动手柄时才开启 draggable，避免与标题输入/按钮交互冲突
const dragReady = ref(false)
const isDragging = computed(() => props.draggingId === props.widget.id)
const isDropTarget = computed(() => props.dropTargetId === props.widget.id && !isDragging.value)

function onDragStart(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', props.widget.id)
  }
  emit('drag-start', props.widget.id)
}

function onDragEnd() {
  dragReady.value = false
  emit('drag-end')
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  emit('drag-over', props.widget.id)
}

function onDrop() {
  emit('drop', props.widget.id)
}

// 交互控件上不启动拖拽（可正常编辑标题、点击按钮/下拉）；其余卡片区域均可拖拽
const DRAG_EXCLUDE = 'input, textarea, button, .el-input, .el-select, .el-dropdown, .widget-tools, .no-drag'

function onMouseDown(e: MouseEvent) {
  if (props.readonly) return
  const target = e.target as HTMLElement | null
  if (target && target.closest(DRAG_EXCLUDE)) {
    dragReady.value = false
    return
  }
  dragReady.value = true
}

// 标题双击重命名：平时以文本展示，使整个卡片头部成为明显的拖拽区
const editingTitle = ref(false)
const titleInputRef = ref()

function startEditTitle() {
  editingTitle.value = true
  nextTick(() => titleInputRef.value?.focus())
}

const spanOptions: { label: string; value: WidgetSpan }[] = [
  { label: '1/3 宽', value: 4 },
  { label: '1/2 宽', value: 6 },
  { label: '2/3 宽', value: 8 },
  { label: '整行', value: 12 }
]

/** 载入设计器进行编辑，并标记为编辑态（保存时回写到本组件） */
function edit() {
  designer.loadDefinition(props.widget.definition)
  dashboard.beginEdit(props.widget.id)
  router.push('/design')
}

function onCommand(command: string) {
  switch (command) {
    case 'left':
      dashboard.moveWidget(props.widget.id, -1)
      break
    case 'right':
      dashboard.moveWidget(props.widget.id, 1)
      break
    case 'copy':
      dashboard.duplicateWidget(props.widget.id)
      break
    case 'del':
      dashboard.removeWidget(props.widget.id)
      break
  }
}
</script>

<template>
  <section
    class="widget"
    :class="{ dragging: isDragging, 'drop-target': isDropTarget, readonly }"
    :style="{ gridColumn: `span ${widget.span}` }"
    :draggable="dragReady"
    @mousedown="onMouseDown"
    @mouseup="dragReady = false"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
  >
    <header class="widget-head">
      <div v-if="readonly" class="widget-title-static">{{ widget.title || '未命名图表' }}</div>
      <template v-else>
        <span class="drag-handle" title="按住卡片任意处拖动可排序">
          <el-icon><Rank /></el-icon>
        </span>
        <el-input
          v-if="editingTitle"
          ref="titleInputRef"
          class="widget-title"
          :model-value="widget.title"
          size="small"
          placeholder="图表标题"
          @update:model-value="dashboard.setWidgetTitle(widget.id, $event)"
          @blur="editingTitle = false"
          @keyup.enter="editingTitle = false"
        />
        <div
          v-else
          class="widget-title-text"
          title="双击重命名"
          @dblclick="startEditTitle"
        >
          {{ widget.title || '未命名图表' }}
        </div>
        <div class="widget-tools">
          <el-select
            class="span-select"
            :model-value="widget.span"
            size="small"
            @update:model-value="dashboard.setSpan(widget.id, $event as WidgetSpan)"
          >
            <el-option v-for="o in spanOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-button size="small" circle :icon="EditPen" title="在设计器中编辑" @click="edit" />
          <el-dropdown trigger="click" @command="onCommand">
            <el-button size="small" circle :icon="MoreFilled" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="left" :icon="ArrowLeft" :disabled="index === 0">左移</el-dropdown-item>
                <el-dropdown-item command="right" :icon="ArrowRight" :disabled="index === total - 1">右移</el-dropdown-item>
                <el-dropdown-item command="copy" :icon="CopyDocument">复制</el-dropdown-item>
                <el-dropdown-item command="del" :icon="Delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>
    </header>

    <div v-if="!readonly" class="widget-meta">
      <el-tag size="small" effect="light">{{ chartLabel }}</el-tag>
      <span class="meta-ds">{{ datasetName }}</span>
    </div>

    <div class="widget-body" v-loading="loading">
      <el-alert
        v-if="result.error"
        :title="result.error"
        type="warning"
        show-icon
        :closable="false"
      />
      <ReportChart v-else :result="result" />
    </div>
  </section>
</template>

<style scoped>
.widget {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  cursor: grab;
  transition: box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.widget.dragging {
  opacity: 0.45;
  border-style: dashed;
  border-color: #409eff;
  cursor: grabbing;
}

.widget.drop-target {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.35);
}

.widget.readonly {
  cursor: default;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 2px;
  color: #a8abb2;
  cursor: grab;
  border-radius: 4px;
}

.drag-handle:hover {
  color: #409eff;
  background: #ecf5ff;
}

.drag-handle:active {
  cursor: grabbing;
}

.widget-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px;
}

.widget-title-static {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  padding-left: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-title-text {
  flex: 1 1 auto;
  min-width: 0;
  padding-left: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-title {
  flex: 1 1 auto;
  min-width: 0;
}

.widget-title :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding-left: 6px;
}

.widget-title :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}

.widget-title :deep(.el-input__inner) {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  cursor: text;
}

.widget-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  cursor: default;
}

.span-select {
  width: 92px;
}

.widget-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 8px;
}

.meta-ds {
  font-size: 12px;
  color: #a8abb2;
}

.widget-body {
  height: 300px;
  padding: 0 8px 8px;
  border-top: 1px solid #f0f2f5;
}

.widget-body :deep(.chart-canvas) {
  min-height: 0;
}

@media (max-width: 900px) {
  .widget {
    grid-column: span 12 !important;
  }
}
</style>
