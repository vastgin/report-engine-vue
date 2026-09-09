import type { EChartsOption } from 'echarts'
import type { Dataset, ReportDefinition } from '@/types'
import { getDataset } from '@/data/registry'
import { getChartTypeDef } from './chartTypes'
import { buildChartModel, buildDataSet, buildMetricCards, type MetricCard, type ReportData, type ReportDataSet } from './chartModel'
import { buildOption } from './optionBuilder'

export interface RenderResult {
  /** 成功时的 ECharts option（图表类） */
  option?: EChartsOption
  /** 指标卡类图表的渲染数据（与 option 互斥） */
  metrics?: MetricCard[]
  /** 表格类图表的渲染数据（与 option 互斥）：共享的统一结果集 */
  table?: ReportDataSet
  /** 失败时的明确错误信息（用于设计器提示与展示模式错误页） */
  error?: string
}

/** 依据图表类型的维度/指标约束校验报表定义的绑定完整性 */
export function validateDefinition(definition: ReportDefinition): string | undefined {
  const def = getChartTypeDef(definition.chartType)
  if (!def) return `不支持的图表类型：${definition.chartType}`

  const dimensionCount =
    definition.encodings.dimensions.filter((d) => d.field).length +
    (definition.encodings.colors ?? []).filter((c) => c.field).length
  const measureCount = definition.encodings.values.filter((v) => v.field).length

  if (dimensionCount < def.minDimensions) {
    return def.minDimensions === 2
      ? `「${def.label}」需要绑定 2 个维度字段`
      : `「${def.label}」需要绑定至少 ${def.minDimensions} 个维度字段`
  }
  if (def.maxDimensions > 0 && dimensionCount > def.maxDimensions) {
    return `「${def.label}」最多支持 ${def.maxDimensions} 个维度字段`
  }
  if (measureCount < def.minMeasures) {
    return `「${def.label}」需要绑定 ${def.minMeasures} 个指标字段`
  }
  if (measureCount > def.maxMeasures) {
    return `「${def.label}」最多支持 ${def.maxMeasures} 个指标字段`
  }
  return undefined
}

/** 计算失败的错误码（与报表查询接口的业务错误码对齐） */
export interface ComputeError {
  error: string
  code: 'INVALID_BINDING' | 'UNKNOWN_FIELD'
}

/**
 * 后端计算核心：数据集 + 报表定义 → 图表数据载荷（不含 ECharts option）。
 * 这是「后端计算」的边界：只做绑定校验、按维度分组、按指标聚合与图表数据建模；
 * ECharts option 的组装属于前端渲染职责。mock 后端与本地同步管线（renderReport）
 * 共用此函数，保证两者行为一致。
 */
export function computeReportData(
  dataset: Dataset,
  definition: ReportDefinition
): ReportData | ComputeError {
  const validationError = validateDefinition(definition)
  if (validationError) {
    return { error: validationError, code: 'INVALID_BINDING' }
  }

  const fieldNames = new Set(dataset.fields.map((f) => f.name))
  const boundFields = [
    ...definition.encodings.dimensions.map((d) => d.field),
    ...(definition.encodings.colors ?? []).map((c) => c.field),
    ...definition.encodings.values.map((v) => v.field)
  ].filter((f): f is string => Boolean(f))

  const unknown = boundFields.find((f) => !fieldNames.has(f))
  if (unknown) {
    return { error: `绑定的字段「${unknown}」在当前数据集中不存在，请重新选择`, code: 'UNKNOWN_FIELD' }
  }

  // 统一数值核心：所有类型都先算出共享的 dataset（列 + 数值行）
  const dataSet = buildDataSet(dataset, definition)

  // 指标卡 / 表格不走 ECharts；表格直接渲染 dataset，指标卡附带 cards 视图
  if (definition.chartType === 'metric-card') {
    return { type: 'metric', dataset: dataSet, view: { cards: buildMetricCards(dataset, definition) } }
  }
  if (definition.chartType === 'table') {
    return { type: 'table', dataset: dataSet }
  }

  // 图表：在共享 dataset 之外附带渲染就绪的 ChartModel 视图
  return { type: 'chart', dataset: dataSet, view: buildChartModel(dataset, definition) }
}

/**
 * 本地同步渲染管线（参考实现 / 离线兜底）：数据集 + 报表定义 → RenderResult。
 * 等价于 computeReportData（后端计算） + buildOption（前端渲染）。
 * 应用运行时已改为经报表查询接口异步获取数据（见 @/api），此函数保留用于测试与兜底。
 */
export function renderReport(definition: ReportDefinition): RenderResult {
  const dataset = getDataset(definition.datasetId)
  if (!dataset) {
    return { error: `未找到数据集：${definition.datasetId}` }
  }

  const computed = computeReportData(dataset, definition)
  if ('error' in computed) {
    return { error: computed.error }
  }
  if (computed.type === 'metric') {
    return { metrics: computed.view.cards }
  }
  if (computed.type === 'table') {
    return { table: computed.dataset }
  }
  return { option: buildOption({ model: computed.view, options: definition.options }) }
}
