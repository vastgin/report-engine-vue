import type { Aggregation, ChartType, Dataset, ReportDefinition } from '@/types'
import {
  aggregateToSeries,
  aggregateMatrix,
  buildHierarchy,
  computeBoxplot,
  groupRawValues,
  reduce,
  toNumber,
  type ChartData,
  type HierarchyNode,
  type MatrixData,
  type MeasureSpec,
  type SeriesData
} from './aggregate'

export interface ChartModel {
  chartType: ChartType
  categories: string[]
  series: SeriesData[]
  measureLabels: string[]
  categoryLabel: string
  /** 序列是否来自拆分维度（影响值轴命名等） */
  isSplit: boolean
  matrix?: MatrixData
  hierarchy?: HierarchyNode[]
  boxData?: number[][]
  candleData?: number[][]
  singleValue: number
  singleLabel: string
}

function labelOf(dataset: Dataset, field: string): string {
  return dataset.fields.find((f) => f.name === field)?.label ?? field
}

/** 指标卡中的单个指标值 */
export interface MetricValue {
  /** 度量名 */
  measureLabel: string
  /** 原始数值 */
  value: number
  /** 格式化后的展示值 */
  formatted: string
}

/** 指标卡（KPI 卡）：上侧维度标签 + 主指标 + 最多两个次指标 */
export interface MetricCard {
  /** 上侧标签：维度取值；未绑定维度时为空 */
  label: string
  /** 主指标（第 1 个度量） */
  primary: MetricValue
  /** 次指标（第 2、3 个度量），最多 2 个 */
  secondary: MetricValue[]
}

const metricFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

function metricValue(measureLabel: string, value: number): MetricValue {
  return { measureLabel, value, formatted: metricFormatter.format(value) }
}

/**
 * 构建指标卡数据（最多 3 个指标：第 1 个为主指标，第 2/3 个为次指标）：
 * - 绑定维度：每个维度取值一张卡，标签 = 维度取值。
 * - 未绑定维度：单张卡，标签为空。
 * 主/次指标均按对应度量的聚合方式计算（有维度时按维度分组，无维度时全表聚合）。
 */
export function buildMetricCards(dataset: Dataset, definition: ReportDefinition): MetricCard[] {
  const records = dataset.records
  const dimFields = definition.encodings.dimensions.map((d) => d.field).filter(Boolean)
  const measures: MeasureSpec[] = definition.encodings.values
    .filter((v) => v.field)
    .slice(0, 3)
    .map((v) => ({ field: v.field, aggregation: v.aggregation, label: labelOf(dataset, v.field) }))
  if (measures.length === 0) return []

  const [primary, ...rest] = measures
  const secondarySpecs = rest.slice(0, 2)

  // 未绑定维度：单张卡，主/次指标为全表聚合
  if (dimFields.length === 0) {
    const totalOf = (m: MeasureSpec) =>
      reduce(
        records.map((r) => toNumber(r[m.field])),
        m.aggregation,
        records.length
      )
    return [
      {
        label: '',
        primary: metricValue(primary.label, totalOf(primary)),
        secondary: secondarySpecs.map((m) => metricValue(m.label, totalOf(m)))
      }
    ]
  }

  // 绑定维度：每个维度取值一张卡（series 与 [primary, ...secondarySpecs] 一一对应）
  const specs = [primary, ...secondarySpecs]
  const data = aggregateToSeries(records, dimFields, specs)
  return data.categories.map((category, i) => ({
    label: category,
    primary: metricValue(primary.label, data.series[0]?.data[i] ?? 0),
    secondary: secondarySpecs.map((m, k) => metricValue(m.label, data.series[k + 1]?.data[i] ?? 0))
  }))
}

/** 结果集列：维度列或指标列（图表与表格共享的列元数据） */
export interface ResultColumn {
  /** 稳定键：维度列 d0/d1/..，指标列 m0/m1/.. */
  key: string
  /** 展示名 */
  label: string
  /** 列角色：维度 或 指标 */
  role: 'dimension' | 'measure'
  /** 原始字段名（对应数据集字段 name） */
  field: string
  /** 指标列的聚合方式（维度列缺省） */
  aggregation?: Aggregation
}

/** 结果集的一行：以列 key 为键；维度列为类别文本，指标列为聚合后的原始数值 */
export type ResultRow = Record<string, string | number>

/**
 * 统一聚合结果集：图表与表格共享的「数值核心」。
 * 后端按维度列分组、按指标列聚合产出；行按维度分层稳定排序（相同前缀连续），
 * 既可直接渲染为表格，也是图表派生视图（view）的数据来源。
 */
export interface ReportDataSet {
  columns: ResultColumn[]
  /** 前 N 列为维度列（表格据此合并单元格、区分对齐） */
  dimensionCount: number
  rows: ResultRow[]
}

/** 指标卡视图（在共享 dataset 之外附带的渲染就绪结构） */
export interface MetricView {
  cards: MetricCard[]
}

/**
 * 报表查询接口的输出数据载荷：所有类型都带共享的 dataset（数值核心）；
 * 图表 / 指标卡额外带渲染就绪的 view，表格直接渲染 dataset（合并 / 格式化在前端做）。
 * - chart：view = ChartModel（categories / series / matrix / hierarchy / boxData / candleData 等）。
 * - metric：view = { cards }（主指标 + 最多两个次指标）。
 * - table：无 view，前端据 dataset 渲染并计算单元格合并。
 */
export type ReportData =
  | { type: 'chart'; dataset: ReportDataSet; view: ChartModel }
  | { type: 'metric'; dataset: ReportDataSet; view: MetricView }
  | { type: 'table'; dataset: ReportDataSet }

function samePrefix(a: string[], b: string[], len: number): boolean {
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * 构建统一聚合结果集（图表与表格共享的数值核心）。
 * - 维度列：dimensions 顺序 + colors（子维度）作为末列。
 * - 指标列：对每个维度组合分组聚合，保留原始数值（格式化在前端做）。
 * - 行序：按各维度取值首次出现顺序（rank）分层稳定排序，使相同前缀连续，
 *   便于表格纵向合并单元格，也与图表的类别顺序一致。
 */
export function buildDataSet(dataset: Dataset, definition: ReportDefinition): ReportDataSet {
  const records = dataset.records
  const dimFields = [
    ...definition.encodings.dimensions.map((d) => d.field),
    ...(definition.encodings.colors ?? []).map((c) => c.field)
  ].filter(Boolean)
  const measures: MeasureSpec[] = definition.encodings.values
    .filter((v) => v.field)
    .map((v) => ({ field: v.field, aggregation: v.aggregation, label: labelOf(dataset, v.field) }))

  const columns: ResultColumn[] = [
    ...dimFields.map((f, i) => ({
      key: `d${i}`,
      label: labelOf(dataset, f),
      role: 'dimension' as const,
      field: f
    })),
    ...measures.map((m, i) => ({
      key: `m${i}`,
      label: m.label,
      role: 'measure' as const,
      field: m.field,
      aggregation: m.aggregation
    }))
  ]

  // 按维度组合分组，并记录各维度取值首次出现顺序（rank）用于稳定分层排序
  const groups = new Map<string, { dims: string[]; records: Record<string, unknown>[] }>()
  const dimRanks: Map<string, number>[] = dimFields.map(() => new Map<string, number>())
  for (const r of records) {
    const dims = dimFields.map((f) => String(r[f] ?? ''))
    dims.forEach((dv, li) => {
      const rank = dimRanks[li]
      if (!rank.has(dv)) rank.set(dv, rank.size)
    })
    const key = dims.join('\u0001')
    const g = groups.get(key)
    if (g) g.records.push(r)
    else groups.set(key, { dims, records: [r] })
  }

  const rowList = [...groups.values()].map((g) => {
    const row: ResultRow = {}
    g.dims.forEach((dv, i) => {
      row[`d${i}`] = dv
    })
    measures.forEach((m, i) => {
      row[`m${i}`] = reduce(
        g.records.map((r) => toNumber(r[m.field])),
        m.aggregation,
        g.records.length
      )
    })
    return { dims: g.dims, row }
  })

  // 分层稳定排序：先按第 1 维度的 rank，再按第 2、3..，使相同前缀连续
  const rankOf = (li: number, dv: string) => dimRanks[li].get(dv) ?? 0
  rowList.sort((a, b) => {
    for (let li = 0; li < dimFields.length; li++) {
      const diff = rankOf(li, a.dims[li]) - rankOf(li, b.dims[li])
      if (diff !== 0) return diff
    }
    return 0
  })

  return {
    columns,
    dimensionCount: dimFields.length,
    rows: rowList.map((r) => r.row)
  }
}

/**
 * 表格单元格合并信息（前端渲染职责）：
 * spans[rowIndex][dimColIndex] = 该维度单元格的 rowspan（0 表示被上方单元格合并）。
 * 要求 dataset.rows 已按维度分层排序（相同前缀连续），由 buildDataSet 保证。
 */
export function computeRowSpans(dataSet: ReportDataSet): number[][] {
  const dimCount = dataSet.dimensionCount
  const dims = dataSet.rows.map((row) =>
    Array.from({ length: dimCount }, (_, i) => String(row[`d${i}`] ?? ''))
  )
  const n = dims.length
  const spans: number[][] = dims.map(() => new Array<number>(dimCount).fill(0))
  for (let k = 0; k < dimCount; k++) {
    let start = 0
    for (let i = 1; i <= n; i++) {
      const same = i < n && samePrefix(dims[i], dims[i - 1], k + 1)
      if (!same) {
        spans[start][k] = i - start
        start = i
      }
    }
  }
  return spans
}

/** 指标数值的标准展示格式（表格 / 指标卡共用，保证一致） */
export function formatMeasure(value: number): string {
  return metricFormatter.format(value)
}

/** 把报表定义的编码解析为 ChartModel，供 option builder 消费 */
export function buildChartModel(dataset: Dataset, definition: ReportDefinition): ChartModel {
  const { chartType, encodings } = definition
  const records = dataset.records
  const dimFields = encodings.dimensions.map((d) => d.field).filter(Boolean)
  const colorFields = (encodings.colors ?? []).map((c) => c.field).filter(Boolean)

  const measures: MeasureSpec[] = encodings.values.map((v) => ({
    field: v.field,
    aggregation: v.aggregation,
    label: labelOf(dataset, v.field)
  }))
  const measureLabels = measures.map((m) => m.label)
  const categoryLabel = dimFields.map((f) => labelOf(dataset, f)).join(' / ')
  const singleLabel = measures[0]?.label ?? ''

  const model: ChartModel = {
    chartType,
    categories: [],
    series: [],
    measureLabels,
    categoryLabel,
    isSplit: colorFields.length > 0,
    singleValue: 0,
    singleLabel
  }

  // 单值：对全表按第一个指标聚合（仪表盘等）
  if (measures[0]) {
    model.singleValue = reduce(
      records.map((r) => toNumber(r[measures[0].field])),
      measures[0].aggregation,
      records.length
    )
  }

  // 通用类别 + 多序列（柱/线/面积/散点/饼/漏斗/雷达等）
  if (dimFields.length && measures.length) {
    const data: ChartData = aggregateToSeries(records, dimFields, measures, colorFields)
    model.categories = data.categories
    model.series = data.series
  } else if (measures.length) {
    // 无维度：以指标名为类别（散点/仪表盘兜底）
    model.categories = measureLabels
    model.series = [{ name: singleLabel, data: [model.singleValue] }]
  }

  // 层级图使用的完整维度层级：类别维度 + 拆分维度（可多个）
  const hierarchyDims = [...dimFields, ...colorFields]

  switch (chartType) {
    case 'heatmap': {
      // X 轴取第一个维度，Y 轴取拆分维度或第二个维度
      const xField = dimFields[0]
      const yField = colorFields[0] ?? dimFields[1]
      if (xField && yField && measures[0]) {
        model.matrix = aggregateMatrix(records, xField, yField, measures[0].field, measures[0].aggregation)
      }
      break
    }
    case 'treemap':
    case 'sunburst': {
      if (hierarchyDims.length && measures[0]) {
        model.hierarchy = buildHierarchy(records, hierarchyDims, measures[0].field, measures[0].aggregation)
      }
      break
    }
    case 'boxplot': {
      if (dimFields.length && measures[0]) {
        const { categories, groups } = groupRawValues(records, dimFields, measures[0].field)
        model.categories = categories
        model.boxData = groups.map((g) => computeBoxplot(g))
      }
      break
    }
    case 'candlestick': {
      if (dimFields.length && measures.length >= 4) {
        // 每个类别下取 4 个指标的聚合值：[open, close, lowest, highest]
        const perMeasure = measures.slice(0, 4).map((m) => {
          const points = aggregateToSeries(records, dimFields, [m])
          return points.series[0]?.data ?? []
        })
        model.categories = aggregateToSeries(records, dimFields, [measures[0]]).categories
        model.candleData = model.categories.map((_, i) => [
          perMeasure[0][i] ?? 0,
          perMeasure[1][i] ?? 0,
          perMeasure[2][i] ?? 0,
          perMeasure[3][i] ?? 0
        ])
      }
      break
    }
    default:
      break
  }

  return model
}
