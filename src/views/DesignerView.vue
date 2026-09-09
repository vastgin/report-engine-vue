<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Download, View, Coin, Collection, FolderAdd } from '@element-plus/icons-vue'
import { useDesignerStore } from '@/stores/designer'
import { useDashboardStore } from '@/stores/dashboard'
import { listDatasets } from '@/data/registry'
import type { Aggregation, ChartType } from '@/types'
import ReportChart from '@/components/ReportChart.vue'
import ChartTypePicker from '@/components/ChartTypePicker.vue'
import { useReportQuery } from '@/composables/useReportQuery'

const store = useDesignerStore()
const dashboard = useDashboardStore()
const router = useRouter()

const datasetOptions = listDatasets()

const themeOptions = [
  { label: '默认', value: 'default' },
  { label: '暖色', value: 'warm' },
  { label: '冷色', value: 'cool' }
]

const aggregationLabels: Record<Aggregation, string> = {
  sum: '求和',
  avg: '平均',
  count: '计数',
  min: '最小',
  max: '最大'
}

const chartTypeDef = computed(() => store.chartTypeDef)
const showCategory = computed(() => (chartTypeDef.value?.maxDimensions ?? 1) >= 1)
const showColor = computed(() => (chartTypeDef.value?.maxDimensions ?? 1) >= 2)
// 是否已添加子维度：有子维度时系列通道被拆分占用，指标仅保留一个且不可新增
const hasSubDimension = computed(() => (store.encodings.colors?.length ?? 0) > 0)
// 表格的子维度作维度列、多指标作指标列，可并存；其余图表有子维度时仅保留一个指标
const measureLockedBySubDimension = computed(
  () => hasSubDimension.value && store.chartType !== 'table'
)
const allowMultiMeasure = computed(
  () => (chartTypeDef.value?.maxMeasures ?? 1) > 1 && !measureLockedBySubDimension.value
)

// 当前已绑定的维度 / 指标个数（维度 = 类别维度 + 拆分维度），用于图表选择框可用性判定
const dimensionCount = computed(
  () =>
    store.encodings.dimensions.filter((d) => d.field).length +
    (store.encodings.colors ?? []).filter((c) => c.field).length
)
const measureCount = computed(() => store.encodings.values.filter((v) => v.field).length)

// 报表数据经后端查询接口异步获取（前端只负责渲染）；样式变化在前端即时重组，不触发请求
const { result: renderResult, loading } = useReportQuery(() => store.reportDefinition)
const configError = computed(() => renderResult.value.error)

function onExport() {
  const definition = store.exportDefinition()
  const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${definition.datasetId || 'definition'}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出报表定义 JSON')
}

function onPreview() {
  store.exportDefinition()
  router.push('/preview')
}

/** 加入看板；若处于看板组件编辑态则回写并返回看板 */
function onAddToDashboard() {
  const result = dashboard.commitFromDesigner(store.reportDefinition)
  if (result === 'updated') {
    ElMessage.success('看板图表已更新')
    router.push('/dashboard')
  } else {
    ElMessage.success('已加入看板')
  }
}
</script>

<template>
  <div class="designer">
    <!-- 顶部工具栏 -->
    <header class="toolbar">
      <div class="toolbar-left">
        <ChartTypePicker
          :model-value="store.chartType"
          :dimension-count="dimensionCount"
          :measure-count="measureCount"
          @update:model-value="store.setChartType($event as ChartType)"
        />
        <el-input
          class="title-input"
          :model-value="store.options.title"
          placeholder="未命名报表（点击输入标题）"
          @update:model-value="store.setTitle($event)"
        >
          <template #prefix><span class="title-hash">报表</span></template>
        </el-input>
      </div>
      <div class="toolbar-right">
        <el-button :icon="FolderAdd" @click="onAddToDashboard">
          {{ dashboard.isEditing ? '保存到看板' : '加入看板' }}
        </el-button>
        <el-button :icon="View" @click="onPreview">预览</el-button>
        <el-button type="primary" :icon="Download" @click="onExport">导出定义</el-button>
      </div>
    </header>

    <div class="workspace">
      <!-- 左侧：数据与字段 -->
      <aside class="panel panel-left">
        <div class="panel-section">
          <div class="section-title">数据集</div>
          <el-select
            :model-value="store.datasetId"
            placeholder="选择数据集"
            style="width: 100%"
            @update:model-value="store.setDataset($event as string)"
          >
            <el-option v-for="d in datasetOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </div>

        <div class="panel-section grow">
          <div class="section-title">字段</div>
          <el-scrollbar class="field-scroll">
            <div class="field-group">
              <div class="field-group-label">
                <el-icon><Collection /></el-icon>维度
                <span class="count">{{ store.dimensionFields.length }}</span>
              </div>
              <div
                v-for="f in store.dimensionFields"
                :key="f.name"
                class="field-item dimension"
              >
                <span class="dot"></span>
                <span class="field-name">{{ f.label }}</span>
                <span class="field-key">{{ f.name }}</span>
              </div>
            </div>

            <div class="field-group">
              <div class="field-group-label">
                <el-icon><Coin /></el-icon>指标
                <span class="count">{{ store.measureFields.length }}</span>
              </div>
              <div
                v-for="f in store.measureFields"
                :key="f.name"
                class="field-item measure"
              >
                <span class="dot"></span>
                <span class="field-name">{{ f.label }}</span>
                <span class="field-key">{{ f.name }}</span>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </aside>

      <!-- 中间：画布 -->
      <section class="canvas-area">
        <div class="canvas-card">
          <el-alert
            v-if="configError"
            :title="configError"
            type="warning"
            show-icon
            :closable="false"
            class="canvas-alert"
          />
          <div v-show="!configError" v-loading="loading" class="canvas-holder">
            <ReportChart :result="renderResult" />
          </div>
        </div>
      </section>

      <!-- 右侧：编码与样式 -->
      <aside class="panel panel-right">
        <el-scrollbar>
          <div class="panel-section">
            <div class="section-title">编码</div>

            <div v-if="showCategory" class="shelf">
              <div class="shelf-label-row">
                <label class="shelf-label">维度</label>
                <el-button link type="primary" :icon="Plus" @click="store.addDimension()">添加</el-button>
              </div>
              <div v-for="(dim, i) in store.encodings.dimensions" :key="i" class="measure-row">
                <el-select
                  :model-value="dim.field"
                  placeholder="选择维度"
                  style="width: 100%"
                  @update:model-value="store.setDimensionField(i, $event as string)"
                >
                  <el-option v-for="f in store.dimensionFields" :key="f.name" :label="f.label" :value="f.name" />
                </el-select>
                <el-button link type="danger" :icon="Delete" @click="store.removeDimension(i)" />
              </div>
              <div v-if="store.encodings.dimensions.length === 0" class="empty-hint">尚未绑定维度</div>
            </div>

            <div v-if="showColor" class="shelf">
              <div class="shelf-label-row">
                <label class="shelf-label">子维度</label>
                <el-button link type="primary" :icon="Plus" @click="store.addColor()">添加</el-button>
              </div>
              <div v-for="(c, i) in store.encodings.colors || []" :key="i" class="measure-row">
                <el-select
                  :model-value="c.field"
                  placeholder="选择子维度"
                  style="width: 100%"
                  @update:model-value="store.setColorField(i, $event as string)"
                >
                  <el-option v-for="f in store.colorFieldOptions" :key="f.name" :label="f.label" :value="f.name" />
                </el-select>
                <el-button link type="danger" :icon="Delete" @click="store.removeColor(i)" />
              </div>
              <div v-if="!store.encodings.colors || store.encodings.colors.length === 0" class="empty-hint">
                尚未添加子维度（可添加多个）
              </div>
            </div>

            <div class="shelf">
              <div class="shelf-label-row">
                <label class="shelf-label">值 / 指标</label>
                <span v-if="measureLockedBySubDimension" class="lock-hint">有子维度时仅保留一个指标</span>
                <el-button
                  v-if="allowMultiMeasure"
                  link
                  type="primary"
                  :icon="Plus"
                  @click="store.addMeasure()"
                >
                  添加
                </el-button>
              </div>

              <div
                v-for="(m, i) in store.encodings.values"
                :key="i"
                class="measure-row"
              >
                <el-select
                  :model-value="m.field"
                  placeholder="选择指标"
                  style="width: 100%"
                  @update:model-value="store.setMeasureField(i, $event as string)"
                >
                  <el-option v-for="f in store.measureFields" :key="f.name" :label="f.label" :value="f.name" />
                </el-select>
                <el-select
                  :model-value="m.aggregation"
                  style="width: 92px; flex: 0 0 auto"
                  @update:model-value="store.setMeasureAggregation(i, $event as Aggregation)"
                >
                  <el-option
                    v-for="a in store.aggregationsFor(m.field)"
                    :key="a"
                    :label="aggregationLabels[a]"
                    :value="a"
                  />
                </el-select>
                <el-button
                  v-if="allowMultiMeasure"
                  link
                  type="danger"
                  :icon="Delete"
                  @click="store.removeMeasure(i)"
                />
              </div>

              <div v-if="store.encodings.values.length === 0" class="empty-hint">
                尚未绑定指标
              </div>
            </div>
          </div>

          <div class="panel-section">
            <div class="section-title">样式</div>
            <div class="shelf">
              <label class="shelf-label">标题</label>
              <el-input
                :model-value="store.options.title"
                placeholder="图表标题"
                clearable
                @update:model-value="store.setTitle($event)"
              />
            </div>
            <div class="shelf inline">
              <el-switch
                :model-value="store.options.showLegend"
                @update:model-value="store.setShowLegend($event as boolean)"
              />
              <span class="switch-label">显示图例</span>
            </div>
            <div class="shelf">
              <label class="shelf-label">颜色主题</label>
              <el-select
                :model-value="store.options.theme"
                style="width: 100%"
                @update:model-value="store.setTheme($event as string)"
              >
                <el-option v-for="t in themeOptions" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </div>
          </div>
        </el-scrollbar>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.designer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
}

/* 顶部工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex: 0 0 auto;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-input {
  width: 300px;
}

.title-hash {
  font-size: 12px;
  color: #a8abb2;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

/* 工作区三栏 */
.workspace {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

.panel {
  background: #fff;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-left {
  width: 240px;
  flex: 0 0 auto;
  border-right: 1px solid #e4e7ed;
}

.panel-right {
  width: 320px;
  flex: 0 0 auto;
  border-left: 1px solid #e4e7ed;
}

.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid #f0f2f5;
}

.panel-section.grow {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-bottom: none;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: #8a9099;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

/* 字段列表 */
.field-scroll {
  flex: 1 1 auto;
}

.field-group + .field-group {
  margin-top: 16px;
}

.field-group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #4e5969;
  margin-bottom: 8px;
}

.field-group-label .count {
  margin-left: auto;
  font-size: 11px;
  color: #a8abb2;
  background: #f2f3f5;
  border-radius: 8px;
  padding: 0 7px;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border-radius: 5px;
  font-size: 13px;
  color: #1f2329;
  cursor: default;
  transition: background 0.15s;
}

.field-item:hover {
  background: #f5f7fa;
}

.field-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.field-item.dimension .dot {
  background: #409eff;
}

.field-item.measure .dot {
  background: #67c23a;
}

.field-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-key {
  margin-left: auto;
  font-size: 11px;
  color: #c0c4cc;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

/* 画布 */
.canvas-area {
  flex: 1 1 auto;
  padding: 16px;
  min-width: 0;
  display: flex;
}

.canvas-card {
  flex: 1 1 auto;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  padding: 14px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.canvas-alert {
  margin-bottom: 12px;
  flex: 0 0 auto;
}

.canvas-holder {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

/* 右侧配置 */
.shelf + .shelf {
  margin-top: 14px;
}

.shelf-label {
  display: block;
  font-size: 12px;
  color: #4e5969;
  margin-bottom: 6px;
  font-weight: 500;
}

.shelf-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.shelf-label-row .shelf-label {
  margin-bottom: 0;
}

.required {
  color: #f56c6c;
  font-size: 11px;
  margin-left: 4px;
}

.shelf.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-label {
  font-size: 13px;
  color: #4e5969;
}

.measure-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 12px;
  color: #a8abb2;
  padding: 8px 0;
}

.lock-hint {
  font-size: 12px;
  color: #a8abb2;
}
</style>
