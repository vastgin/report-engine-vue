<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Delete, View, Rank } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDashboardStore } from '@/stores/dashboard'
import { useDesignerStore } from '@/stores/designer'
import { createDefaultDefinition } from '@/engine/defaults'
import DashboardWidgetCard from '@/components/DashboardWidgetCard.vue'

const dashboard = useDashboardStore()
const designer = useDesignerStore()
const router = useRouter()

/** 新建图表：加入一个默认组件并进入设计器编辑（保存后回写） */
function newChart() {
  const definition = createDefaultDefinition()
  const id = dashboard.addWidget(definition)
  designer.loadDefinition(definition)
  dashboard.beginEdit(id)
  router.push('/design')
}

async function clearAll() {
  try {
    await ElMessageBox.confirm('确定清空看板上的所有图表？此操作不可撤销。', '清空看板', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消'
    })
    dashboard.clear()
    ElMessage.success('看板已清空')
  } catch {
    // 用户取消
  }
}

/** 预览：以只读展示模式打开看板 */
function preview() {
  router.push('/dashboard/preview')
}

// 拖拽重排状态：draggingId 当前拖动的组件，dragOverId 悬停的目标组件
const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onDragStart(id: string) {
  draggingId.value = id
  dragOverId.value = null
}

function onDragOver(id: string) {
  if (id !== draggingId.value) dragOverId.value = id
}

function onDrop(id: string) {
  if (draggingId.value && draggingId.value !== id) {
    dashboard.reorderWidget(draggingId.value, id)
  }
  draggingId.value = null
  dragOverId.value = null
}

function onDragEnd() {
  draggingId.value = null
  dragOverId.value = null
}
</script>

<template>
  <div class="dashboard">
    <header class="dash-toolbar">
      <el-input
        class="dash-title"
        :model-value="dashboard.title"
        placeholder="看板标题"
        @update:model-value="dashboard.setTitle($event)"
      >
        <template #prefix><span class="title-tag">看板</span></template>
      </el-input>
      <div class="dash-actions">
        <span v-if="dashboard.widgetCount > 0" class="drag-hint">
          <el-icon><Rank /></el-icon>
          按住卡片任意处拖动可排序
        </span>
        <span class="widget-count">共 {{ dashboard.widgetCount }} 个图表</span>
        <el-button type="primary" :icon="Plus" @click="newChart">新建图表</el-button>
        <el-button :icon="View" :disabled="dashboard.widgetCount === 0" @click="preview">预览</el-button>
        <el-button :icon="Delete" :disabled="dashboard.widgetCount === 0" @click="clearAll">清空</el-button>
      </div>
    </header>

    <div class="dash-body">
      <el-empty v-if="dashboard.widgetCount === 0" description="看板为空，尚无图表">
        <el-button type="primary" :icon="Plus" @click="newChart">新建图表</el-button>
        <p class="empty-tip">也可以在设计器中点击「加入看板」，把当前图表添加到这里</p>
      </el-empty>

      <div v-else class="grid">
        <DashboardWidgetCard
          v-for="(widget, index) in dashboard.widgets"
          :key="widget.id"
          :widget="widget"
          :index="index"
          :total="dashboard.widgetCount"
          :dragging-id="draggingId"
          :drop-target-id="dragOverId"
          @drag-start="onDragStart"
          @drag-over="onDragOver"
          @drop="onDrop"
          @drag-end="onDragEnd"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
}

.dash-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex: 0 0 auto;
}

.dash-title {
  width: 320px;
}

.title-tag {
  font-size: 12px;
  color: #a8abb2;
}

.dash-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drag-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #a8abb2;
  margin-right: 8px;
}

.widget-count {
  font-size: 12px;
  color: #8a9099;
  margin-right: 4px;
}

.dash-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  align-items: start;
}

.empty-tip {
  margin-top: 12px;
  font-size: 13px;
  color: #a8abb2;
}
</style>
