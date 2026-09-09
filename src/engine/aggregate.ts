import type { Aggregation } from '@/types'

/** 单维度聚合后的一个数据点 */
export interface AggregatedPoint {
  category: string
  value: number
}

/** 一条数据序列 */
export interface SeriesData {
  name: string
  data: number[]
}

/** 类别 + 多序列的通用图表数据 */
export interface ChartData {
  categories: string[]
  series: SeriesData[]
}

/** 聚合所用的指标描述 */
export interface MeasureSpec {
  field: string
  aggregation: Aggregation
  label: string
}

/** 热力图矩阵数据 */
export interface MatrixData {
  xLabels: string[]
  yLabels: string[]
  /** [xIndex, yIndex, value] */
  points: [number, number, number][]
  min: number
  max: number
}

/** 层级树节点（矩形树图 / 旭日图） */
export interface HierarchyNode {
  name: string
  value?: number
  children?: HierarchyNode[]
}

const NULL_KEY = '(空)'
const CELL_SEP = '\u0000'

/** 把任意值转为字符串类别键 */
export function toCategoryKey(value: unknown): string {
  if (value === null || value === undefined) return NULL_KEY
  return String(value)
}

/** 把任意值转为数值；无法解析时返回 NaN */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

/** 对一组数值按聚合方式归约 */
export function reduce(values: number[], aggregation: Aggregation, groupSize: number): number {
  const valid = values.filter((v) => !Number.isNaN(v))
  switch (aggregation) {
    case 'count':
      return groupSize
    case 'min':
      return valid.length ? Math.min(...valid) : 0
    case 'max':
      return valid.length ? Math.max(...valid) : 0
    case 'avg':
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
    case 'sum':
    default:
      return valid.reduce((a, b) => a + b, 0)
  }
}

/**
 * 按单维度对单个指标分组聚合。
 * - 仅读取声明字段，其它键被忽略（对齐 report-dataset 规范）。
 * - 维度取值按首次出现顺序稳定排序。
 */
export function aggregate(
  records: Record<string, unknown>[],
  dimensionField: string,
  measureField: string,
  aggregation: Aggregation
): AggregatedPoint[] {
  const order: string[] = []
  const groups = new Map<string, { values: number[]; size: number }>()

  for (const record of records) {
    const key = toCategoryKey(record[dimensionField])
    let group = groups.get(key)
    if (!group) {
      group = { values: [], size: 0 }
      groups.set(key, group)
      order.push(key)
    }
    group.values.push(toNumber(record[measureField]))
    group.size += 1
  }

  return order.map((key) => {
    const group = groups.get(key)!
    return { category: key, value: reduce(group.values, aggregation, group.size) }
  })
}

/** 多维度复合类别键：各维度取值以 " / " 连接 */
function compositeKey(record: Record<string, unknown>, dimensionFields: string[]): string {
  return dimensionFields.map((f) => toCategoryKey(record[f])).join(' / ')
}

/**
 * 通用聚合：按（可多个）维度分组，产出多序列。
 * - 无 colorFields：每个指标一条序列（序列名 = 指标 label）。
 * - 有 colorFields：按拆分维度（可多个）取值的复合拆分，每个复合取值一条序列
 *   （系列名 = 各拆分维度取值以 " / " 连接，使用第一个指标）。
 * - 多维度时，类别为各维度取值的复合键。
 */
export function aggregateToSeries(
  records: Record<string, unknown>[],
  dimensionFields: string[],
  measures: MeasureSpec[],
  colorFields?: string[]
): ChartData {
  if (colorFields && colorFields.length) {
    const measure = measures[0]
    const categoryOrder: string[] = []
    const colorOrder: string[] = []
    const cells = new Map<string, Record<string, unknown>[]>()

    for (const record of records) {
      const category = compositeKey(record, dimensionFields)
      // 多个拆分维度时，系列名为各维度取值的复合键
      const color = compositeKey(record, colorFields)
      if (!categoryOrder.includes(category)) categoryOrder.push(category)
      if (!colorOrder.includes(color)) colorOrder.push(color)
      const cellKey = `${category}${CELL_SEP}${color}`
      if (!cells.has(cellKey)) cells.set(cellKey, [])
      cells.get(cellKey)!.push(record)
    }

    return {
      categories: categoryOrder,
      series: colorOrder.map((color) => ({
        name: color,
        data: categoryOrder.map((category) => {
          const rows = cells.get(`${category}${CELL_SEP}${color}`) ?? []
          return reduce(
            rows.map((r) => toNumber(r[measure.field])),
            measure.aggregation,
            rows.length
          )
        })
      }))
    }
  }

  const categoryOrder: string[] = []
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const record of records) {
    const key = compositeKey(record, dimensionFields)
    if (!groups.has(key)) {
      groups.set(key, [])
      categoryOrder.push(key)
    }
    groups.get(key)!.push(record)
  }

  const series = measures.map((measure) => ({
    name: measure.label,
    data: categoryOrder.map((key) => {
      const rows = groups.get(key)!
      return reduce(
        rows.map((r) => toNumber(r[measure.field])),
        measure.aggregation,
        rows.length
      )
    })
  }))
  return { categories: categoryOrder, series }
}

/** 二维交叉聚合，用于热力图 */
export function aggregateMatrix(
  records: Record<string, unknown>[],
  xField: string,
  yField: string,
  measureField: string,
  aggregation: Aggregation
): MatrixData {
  const xLabels: string[] = []
  const yLabels: string[] = []
  const cells = new Map<string, { values: number[]; size: number }>()

  for (const record of records) {
    const x = toCategoryKey(record[xField])
    const y = toCategoryKey(record[yField])
    if (!xLabels.includes(x)) xLabels.push(x)
    if (!yLabels.includes(y)) yLabels.push(y)
    const key = `${x}${CELL_SEP}${y}`
    let cell = cells.get(key)
    if (!cell) {
      cell = { values: [], size: 0 }
      cells.set(key, cell)
    }
    cell.values.push(toNumber(record[measureField]))
    cell.size += 1
  }

  const points: [number, number, number][] = []
  let min = Infinity
  let max = -Infinity
  xLabels.forEach((x, xi) => {
    yLabels.forEach((y, yi) => {
      const cell = cells.get(`${x}${CELL_SEP}${y}`)
      const value = cell ? reduce(cell.values, aggregation, cell.size) : 0
      points.push([xi, yi, value])
      if (value < min) min = value
      if (value > max) max = value
    })
  })
  if (!Number.isFinite(min)) min = 0
  if (!Number.isFinite(max)) max = 0

  return { xLabels, yLabels, points, min, max }
}

/** 按多个维度构建层级树，叶子节点值为聚合后的指标 */
export function buildHierarchy(
  records: Record<string, unknown>[],
  dimFields: string[],
  measureField: string,
  aggregation: Aggregation
): HierarchyNode[] {
  function buildLevel(rows: Record<string, unknown>[], level: number): HierarchyNode[] {
    const field = dimFields[level]
    const order: string[] = []
    const groups = new Map<string, Record<string, unknown>[]>()
    for (const row of rows) {
      const key = toCategoryKey(row[field])
      if (!groups.has(key)) {
        groups.set(key, [])
        order.push(key)
      }
      groups.get(key)!.push(row)
    }
    return order.map((key) => {
      const groupRows = groups.get(key)!
      const node: HierarchyNode = { name: key }
      if (level < dimFields.length - 1) {
        node.children = buildLevel(groupRows, level + 1)
      } else {
        node.value = reduce(
          groupRows.map((r) => toNumber(r[measureField])),
          aggregation,
          groupRows.length
        )
      }
      return node
    })
  }

  if (dimFields.length === 0) return []
  return buildLevel(records, 0)
}

/** 按（可多个）维度分组，返回每组的原始数值数组（用于箱线图等分布图） */
export function groupRawValues(
  records: Record<string, unknown>[],
  dimensionFields: string[],
  measureField: string
): { categories: string[]; groups: number[][] } {
  const order: string[] = []
  const groups = new Map<string, number[]>()
  for (const record of records) {
    const key = compositeKey(record, dimensionFields)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    const n = toNumber(record[measureField])
    if (!Number.isNaN(n)) groups.get(key)!.push(n)
  }
  return { categories: order, groups: order.map((k) => groups.get(k)!) }
}

/** 计算分位数（线性插值），sorted 需为升序 */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/** 计算箱线图五数概括：[min, Q1, median, Q3, max] */
export function computeBoxplot(values: number[]): [number, number, number, number, number] {
  if (values.length === 0) return [0, 0, 0, 0, 0]
  const sorted = [...values].sort((a, b) => a - b)
  return [
    sorted[0],
    quantile(sorted, 0.25),
    quantile(sorted, 0.5),
    quantile(sorted, 0.75),
    sorted[sorted.length - 1]
  ]
}
