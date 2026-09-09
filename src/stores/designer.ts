import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import type {
  Aggregation,
  ChartType,
  Dataset,
  Encodings,
  FieldMeta,
  MeasureBinding,
  ReportDefinition,
  ReportOptions
} from '@/types'
import { getDataset, listDatasets } from '@/data/registry'
import { getChartTypeDef, type ChartTypeDef } from '@/engine/chartTypes'

const STORAGE_KEY = 'report-engine:current-definition'

interface DesignerState {
  datasetId: string
  chartType: ChartType
  encodings: Encodings
  options: ReportOptions
}

/** 为状态填充合理默认绑定（首个维度 → 维度列表，首个指标 → 值） */
function applyDefaults(state: DesignerState, dataset: Dataset) {
  const firstDim = dataset.fields.find((f) => f.role === 'dimension')
  const firstMeasure = dataset.fields.find((f) => f.role === 'measure')
  if (firstDim && state.encodings.dimensions.length === 0) {
    state.encodings.dimensions = [{ field: firstDim.name }]
  }
  if (firstMeasure && state.encodings.values.length === 0) {
    state.encodings.values = [
      { field: firstMeasure.name, aggregation: firstMeasure.defaultAggregation ?? 'sum' }
    ]
  }
}

function defaultState(): DesignerState {
  const first = listDatasets()[0]
  const dataset = first ? getDataset(first.id) : undefined
  const state: DesignerState = {
    datasetId: first?.id ?? '',
    chartType: 'bar',
    encodings: { dimensions: [], values: [] },
    options: { title: '', showLegend: true, theme: 'default' }
  }
  if (dataset) applyDefaults(state, dataset)
  return state
}

/** 兼容旧版结构（category 单维度 / value 单指标 / color·series 单拆分维度），统一为新模型 */
function normalizeEncodings(raw: Encodings | undefined, chartType?: ChartType): Encodings {
  if (!raw) return { dimensions: [], values: [] }
  const legacy = raw as Encodings & {
    category?: { field: string }
    value?: MeasureBinding
    series?: { field: string }
    color?: { field: string } | { field: string }[]
  }
  const dimensions = Array.isArray(raw.dimensions)
    ? raw.dimensions
    : legacy.category
      ? [legacy.category]
      : []
  const values = Array.isArray(raw.values) ? raw.values : legacy.value ? [legacy.value] : []
  const colors = normalizeColors(raw.colors, legacy.color, legacy.series)
  // 有子维度时系列通道被拆分占用：仅保留第一个指标（表格除外，其子维度作维度列、多指标作指标列并存）
  const trimMeasures = colors.length > 0 && chartType !== 'table'
  return {
    dimensions,
    colors,
    values: trimMeasures ? values.slice(0, 1) : values
  }
}

/** 把新 colors[] 与旧 color（单个 / 数组）/ series 归一为 colors[]（拆分维度列表） */
function normalizeColors(
  colors: { field: string }[] | undefined,
  legacyColor: { field: string } | { field: string }[] | undefined,
  legacySeries: { field: string } | undefined
): { field: string }[] {
  if (Array.isArray(colors)) return colors.filter((c) => c && c.field)
  if (Array.isArray(legacyColor)) return legacyColor.filter((c) => c && c.field)
  if (legacyColor?.field) return [{ field: legacyColor.field }]
  if (legacySeries?.field) return [{ field: legacySeries.field }]
  return []
}

function loadPersisted(): DesignerState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const def = JSON.parse(raw) as ReportDefinition
    if (!def.datasetId || !getDataset(def.datasetId)) return undefined
    return {
      datasetId: def.datasetId,
      chartType: def.chartType ?? 'bar',
      encodings: normalizeEncodings(def.encodings, def.chartType ?? 'bar'),
      options: def.options ?? { title: '', showLegend: true, theme: 'default' }
    }
  } catch {
    return undefined
  }
}

export const useDesignerStore = defineStore('designer', {
  state: (): DesignerState => loadPersisted() ?? defaultState(),

  getters: {
    currentDataset(state): Dataset | undefined {
      return getDataset(state.datasetId)
    },
    dimensionFields(): FieldMeta[] {
      return this.currentDataset?.fields.filter((f) => f.role === 'dimension') ?? []
    },
    measureFields(): FieldMeta[] {
      return this.currentDataset?.fields.filter((f) => f.role === 'measure') ?? []
    },
    /** 可作为「颜色/图例」拆分维度的候选（排除已用作类别维度的字段） */
    colorFieldOptions(state): FieldMeta[] {
      const used = new Set(state.encodings.dimensions.map((d) => d.field))
      return this.dimensionFields.filter((f) => !used.has(f.name))
    },
    chartTypeDef(state): ChartTypeDef | undefined {
      return getChartTypeDef(state.chartType)
    },
    reportDefinition(state): ReportDefinition {
      return {
        datasetId: state.datasetId,
        chartType: state.chartType,
        encodings: JSON.parse(JSON.stringify(state.encodings)),
        options: { ...state.options }
      }
    }
  },

  actions: {
    setDataset(id: string) {
      if (id === this.datasetId) return
      const dataset = getDataset(id)
      if (!dataset) return

      const hadBindings =
        this.encodings.dimensions.length > 0 ||
        (this.encodings.colors?.length ?? 0) > 0 ||
        this.encodings.values.length > 0

      const nextFields = new Set(dataset.fields.map((f) => f.name))
      let reset = false

      this.datasetId = id
      const keptDims = this.encodings.dimensions.filter((d) => nextFields.has(d.field))
      if (keptDims.length !== this.encodings.dimensions.length) reset = true
      this.encodings.dimensions = keptDims

      const keptColors = (this.encodings.colors ?? []).filter((c) => nextFields.has(c.field))
      if (keptColors.length !== (this.encodings.colors?.length ?? 0)) reset = true
      this.encodings.colors = keptColors

      const keptValues = this.encodings.values.filter((v) => nextFields.has(v.field))
      if (keptValues.length !== this.encodings.values.length) reset = true
      this.encodings.values = keptValues

      applyDefaults(this.$state, dataset)

      if (hadBindings && reset) {
        ElMessage.warning('已切换数据集，失效的字段绑定已被重置')
      }
    },

    setChartType(chartType: ChartType) {
      // 切换图表类型保留已有字段绑定（对齐 report-designer 规范）
      this.chartType = chartType
      // 从表格切到其它图表时，若存在子维度则多指标不再适用，仅保留第一个
      if (
        chartType !== 'table' &&
        (this.encodings.colors?.length ?? 0) > 0 &&
        this.encodings.values.length > 1
      ) {
        this.encodings.values = this.encodings.values.slice(0, 1)
      }
    },

    /** 新增一个维度（选取首个未使用的维度字段） */
    addDimension() {
      const def = this.chartTypeDef
      if (def && this.encodings.dimensions.length + (this.encodings.colors?.length ?? 0) >= def.maxDimensions) {
        ElMessage.warning(`「${def.label}」最多支持 ${def.maxDimensions} 个维度`)
        return
      }
      const used = new Set(this.encodings.dimensions.map((d) => d.field))
      for (const c of this.encodings.colors ?? []) used.add(c.field)
      const next = this.dimensionFields.find((f) => !used.has(f.name))
      this.encodings.dimensions.push({ field: next?.name ?? '' })
    },

    removeDimension(index: number) {
      this.encodings.dimensions.splice(index, 1)
    },

    setDimensionField(index: number, field: string) {
      const target = this.encodings.dimensions[index]
      if (target) target.field = field
    },

    /** 新增一个「子维度」（拆分维度，选取首个未使用的维度字段）。
     *  子维度占用系列通道，新增后仅保留第一个指标，其余指标被移除。 */
    addColor() {
      const def = this.chartTypeDef
      if (def && this.encodings.dimensions.length + (this.encodings.colors?.length ?? 0) >= def.maxDimensions) {
        ElMessage.warning(`「${def.label}」最多支持 ${def.maxDimensions} 个维度`)
        return
      }
      const used = new Set(this.encodings.dimensions.map((d) => d.field))
      for (const c of this.encodings.colors ?? []) used.add(c.field)
      const next = this.dimensionFields.find((f) => !used.has(f.name))
      if (!this.encodings.colors) this.encodings.colors = []
      this.encodings.colors.push({ field: next?.name ?? '' })
      // 有子维度时系列通道被拆分占用：仅保留第一个指标，删除其余指标（表格除外）
      if (this.chartType !== 'table' && this.encodings.values.length > 1) {
        this.encodings.values = this.encodings.values.slice(0, 1)
        ElMessage.info('已添加子维度，指标仅保留第一个')
      }
    },

    removeColor(index: number) {
      this.encodings.colors?.splice(index, 1)
    },

    setColorField(index: number, field: string) {
      const target = this.encodings.colors?.[index]
      if (target) target.field = field
    },

    addMeasure() {
      // 有子维度时不允许多指标（系列通道已被拆分占用；表格除外）
      if (this.chartType !== 'table' && (this.encodings.colors?.length ?? 0) > 0) {
        ElMessage.warning('已添加子维度，指标仅支持一个')
        return
      }
      const def = this.chartTypeDef
      if (def && this.encodings.values.length >= def.maxMeasures) {
        ElMessage.warning(`「${def.label}」最多支持 ${def.maxMeasures} 个指标`)
        return
      }
      const used = new Set(this.encodings.values.map((v) => v.field))
      const next = this.measureFields.find((f) => !used.has(f.name))
      this.encodings.values.push({
        field: next?.name ?? '',
        aggregation: next?.defaultAggregation ?? 'sum'
      })
    },

    removeMeasure(index: number) {
      this.encodings.values.splice(index, 1)
    },

    setMeasureField(index: number, field: string) {
      const target = this.encodings.values[index]
      if (!target) return
      const meta = this.measureFields.find((f) => f.name === field)
      target.field = field
      target.aggregation = meta?.defaultAggregation ?? target.aggregation
    },

    setMeasureAggregation(index: number, aggregation: Aggregation) {
      const target = this.encodings.values[index]
      if (target) target.aggregation = aggregation
    },

    /** 返回某指标字段可用的聚合方式 */
    aggregationsFor(field: string): Aggregation[] {
      const meta = this.measureFields.find((f) => f.name === field)
      return meta?.aggregations ?? ['sum', 'avg', 'count', 'min', 'max']
    },

    setTitle(title: string) {
      this.options.title = title
    },
    setShowLegend(showLegend: boolean) {
      this.options.showLegend = showLegend
    },
    setTheme(theme: string) {
      this.options.theme = theme
    },

    exportDefinition(): ReportDefinition {
      const definition = this.reportDefinition
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(definition))
      } catch {
        // localStorage 不可用时忽略（mockup 容错）
      }
      return definition
    },

    loadDefinition(definition: ReportDefinition) {
      this.datasetId = definition.datasetId
      this.chartType = definition.chartType
      this.encodings = normalizeEncodings(definition.encodings, definition.chartType)
      this.options = { ...definition.options }
    }
  }
})
