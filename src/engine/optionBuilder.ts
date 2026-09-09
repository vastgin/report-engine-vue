import type { EChartsOption } from 'echarts'
import type { ReportOptions } from '@/types'
import type { ChartModel } from './chartModel'

export interface BuildOptionParams {
  model: ChartModel
  options: ReportOptions
}

/** 主题对应的调色板 */
const THEME_PALETTES: Record<string, string[]> = {
  default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
  warm: ['#e76f51', '#f4a261', '#e9c46a', '#d62828', '#f77f00', '#fcbf49', '#bc6c25', '#dda15e'],
  cool: ['#003049', '#2a9d8f', '#457b9d', '#1d3557', '#48cae4', '#00b4d8', '#90e0ef', '#0077b6']
}

function paletteFor(theme?: string): string[] {
  return THEME_PALETTES[theme ?? 'default'] ?? THEME_PALETTES.default
}

/** 所有图表共享的基础外壳：调色板 / 标题 / 提示框 */
function baseShell(options: ReportOptions): Record<string, unknown> {
  return {
    color: paletteFor(options.theme),
    title: options.title ? { text: options.title, left: 'center', textStyle: { fontSize: 16, fontWeight: 600 } } : undefined,
    tooltip: { trigger: 'axis' }
  }
}

function legendConfig(options: ReportOptions, names: string[], vertical = false): Record<string, unknown> {
  if (!options.showLegend) return { show: false }
  return vertical
    ? { show: true, orient: 'vertical', left: 'left', top: options.title ? 40 : 12, data: names }
    : { show: true, top: options.title ? 34 : 8, data: names }
}

const HORIZONTAL: Record<string, boolean> = {
  'bar-horizontal': true,
  'stacked-bar-horizontal': true
}
const STACKED: Record<string, boolean> = {
  'stacked-bar': true,
  'stacked-bar-horizontal': true,
  'stacked-area': true
}

function isColumnType(type: string): boolean {
  return type === 'bar' || type === 'bar-horizontal' || type === 'stacked-bar' ||
    type === 'stacked-bar-horizontal' || type === 'pictorial-bar'
}
function isLineType(type: string): boolean {
  return type === 'line' || type === 'step-line' || type === 'area' || type === 'stacked-area'
}

/** 直角坐标系图表：柱/条/折线/面积/象形柱/散点 */
function buildCartesian(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const type = model.chartType
  const horizontal = HORIZONTAL[type] ?? false
  const stacked = STACKED[type] ?? false
  const seriesNames = model.series.map((s) => s.name)
  const echartsSeriesType = isColumnType(type)
    ? type === 'pictorial-bar'
      ? 'pictorialBar'
      : 'bar'
    : 'line'

  const categoryAxis = { type: 'category' as const, data: model.categories, name: model.categoryLabel }
  const valueAxis = {
    type: 'value' as const,
    name: model.isSplit || model.series.length > 1 ? '' : model.measureLabels[0]
  }

  const series = model.series.map((s) => {
    const base: Record<string, unknown> = {
      name: s.name,
      type: echartsSeriesType,
      data: s.data,
      emphasis: { focus: 'series' }
    }
    if (stacked) base.stack = 'total'
    if (isLineType(type)) {
      base.smooth = type === 'line' || type === 'area' || type === 'stacked-area'
      if (type === 'step-line') base.step = 'middle'
      if (type === 'area' || type === 'stacked-area') base.areaStyle = {}
    }
    if (type === 'pictorial-bar') base.symbol = 'roundRect'
    return base
  })

  const option: Record<string, unknown> = {
    ...baseShell(options),
    legend: legendConfig(options, seriesNames),
    grid: { left: '3%', right: '4%', bottom: '3%', top: options.showLegend ? 76 : 52, containLabel: true },
    series
  }
  if (horizontal) {
    option.xAxis = valueAxis
    option.yAxis = categoryAxis
  } else {
    option.xAxis = categoryAxis
    option.yAxis = valueAxis
  }
  return option as unknown as EChartsOption
}

/** 散点 / 涟漪散点 */
function buildScatter(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const isEffect = model.chartType === 'effect-scatter'
  const seriesType = isEffect ? 'effectScatter' : 'scatter'
  const twoMeasures = model.series.length >= 2

  let series: Record<string, unknown>[]
  let xAxis: Record<string, unknown>
  let yAxis: Record<string, unknown>

  if (twoMeasures) {
    // 用前两个指标作为 X / Y 数值
    const [mx, my] = model.series
    xAxis = { type: 'value', name: mx.name }
    yAxis = { type: 'value', name: my.name }
    series = [
      {
        name: `${mx.name} / ${my.name}`,
        type: seriesType,
        symbolSize: 14,
        data: mx.data.map((x, i) => [x, my.data[i] ?? 0])
      }
    ]
  } else {
    xAxis = { type: 'category', data: model.categories, name: model.categoryLabel }
    yAxis = { type: 'value', name: model.measureLabels[0] }
    series = model.series.map((s) => ({
      name: s.name,
      type: seriesType,
      symbolSize: 14,
      data: s.data
    }))
  }

  const option: Record<string, unknown> = {
    ...baseShell(options),
    legend: legendConfig(options, series.map((s) => s.name as string)),
    grid: { left: '3%', right: '6%', bottom: '3%', top: options.showLegend ? 76 : 52, containLabel: true },
    xAxis,
    yAxis,
    series
  }
  return option as unknown as EChartsOption
}

/** 饼 / 环 / 玫瑰 */
function buildPie(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const type = model.chartType
  const primary = model.series[0]?.data ?? []
  const data = model.categories.map((name, i) => ({ name, value: primary[i] ?? 0 }))

  const radius = type === 'doughnut' ? ['42%', '68%'] : '64%'
  const series: Record<string, unknown> = {
    name: model.measureLabels[0] ?? 'pie',
    type: 'pie',
    radius,
    center: ['52%', '55%'],
    data,
    emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.4)' } }
  }
  if (type === 'rose') series.roseType = 'area'

  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: legendConfig(options, model.categories, true),
    series: [series]
  }
  return option as unknown as EChartsOption
}

/** 漏斗图 */
function buildFunnel(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const primary = model.series[0]?.data ?? []
  const data = model.categories
    .map((name, i) => ({ name, value: primary[i] ?? 0 }))
    .sort((a, b) => b.value - a.value)

  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    legend: legendConfig(options, data.map((d) => d.name)),
    series: [
      {
        name: model.measureLabels[0] ?? 'funnel',
        type: 'funnel',
        left: '10%',
        width: '78%',
        top: options.showLegend ? 70 : 40,
        label: { formatter: '{b}: {c}' },
        data
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** 雷达图：指示器为维度取值，每个指标/拆分为一条雷达序列 */
function buildRadar(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const maxVal = Math.max(
    1,
    ...model.series.flatMap((s) => s.data.filter((v) => Number.isFinite(v)))
  )
  const indicator = model.categories.map((name) => ({ name, max: Math.ceil(maxVal * 1.1) }))

  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { trigger: 'item' },
    legend: legendConfig(options, model.series.map((s) => s.name)),
    radar: { indicator, radius: '64%', center: ['52%', '55%'] },
    series: [
      {
        type: 'radar',
        areaStyle: { opacity: 0.15 },
        data: model.series.map((s) => ({ name: s.name, value: s.data }))
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** 热力图 */
function buildHeatmap(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const matrix = model.matrix
  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { position: 'top' },
    grid: { left: '3%', right: '6%', bottom: '10%', top: options.title ? 60 : 30, containLabel: true },
    xAxis: { type: 'category', data: matrix?.xLabels ?? [], splitArea: { show: true } },
    yAxis: { type: 'category', data: matrix?.yLabels ?? [], splitArea: { show: true } },
    visualMap: {
      min: matrix?.min ?? 0,
      max: matrix?.max ?? 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0
    },
    series: [
      {
        name: model.measureLabels[0] ?? 'heatmap',
        type: 'heatmap',
        data: matrix?.points ?? [],
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.4)' } }
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** 矩形树图 */
function buildTreemap(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { formatter: '{b}: {c}' },
    series: [
      {
        name: model.measureLabels[0] ?? 'treemap',
        type: 'treemap',
        top: options.title ? 44 : 12,
        roam: false,
        nodeClick: 'zoomToNode',
        data: model.hierarchy ?? []
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** 旭日图 */
function buildSunburst(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { formatter: '{b}: {c}' },
    series: [
      {
        name: model.measureLabels[0] ?? 'sunburst',
        type: 'sunburst',
        radius: ['12%', '88%'],
        center: ['52%', '54%'],
        data: model.hierarchy ?? [],
        emphasis: { focus: 'ancestor' }
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** 箱线图 */
function buildBoxplot(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { trigger: 'item' },
    grid: { left: '3%', right: '5%', bottom: '3%', top: options.title ? 56 : 30, containLabel: true },
    xAxis: { type: 'category', data: model.categories, name: model.categoryLabel },
    yAxis: { type: 'value', name: model.measureLabels[0] },
    series: [
      {
        name: model.measureLabels[0] ?? 'boxplot',
        type: 'boxplot',
        data: model.boxData ?? []
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** K 线图 */
function buildCandlestick(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: { left: '3%', right: '5%', bottom: '3%', top: options.title ? 56 : 30, containLabel: true },
    xAxis: { type: 'category', data: model.categories, name: model.categoryLabel },
    yAxis: { type: 'value', scale: true },
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: model.candleData ?? []
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** 仪表盘 */
function buildGauge(params: BuildOptionParams): EChartsOption {
  const { model, options } = params
  const value = model.singleValue
  const max = value > 0 ? Math.ceil(value * 1.2) : 100
  const option: Record<string, unknown> = {
    ...baseShell(options),
    tooltip: { formatter: '{b}: {c}' },
    series: [
      {
        name: model.singleLabel || 'gauge',
        type: 'gauge',
        min: 0,
        max,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        detail: { valueAnimation: true, formatter: '{value}', fontSize: 22, offsetCenter: [0, '70%'] },
        data: [{ value, name: model.singleLabel }]
      }
    ]
  }
  return option as unknown as EChartsOption
}

/** 将聚合模型 + 样式配置转换为 ECharts option（覆盖全部支持的图表类型） */
export function buildOption(params: BuildOptionParams): EChartsOption {
  const type = params.model.chartType
  if (isColumnType(type) || isLineType(type)) return buildCartesian(params)
  switch (type) {
    case 'scatter':
    case 'effect-scatter':
      return buildScatter(params)
    case 'pie':
    case 'doughnut':
    case 'rose':
      return buildPie(params)
    case 'funnel':
      return buildFunnel(params)
    case 'radar':
      return buildRadar(params)
    case 'heatmap':
      return buildHeatmap(params)
    case 'treemap':
      return buildTreemap(params)
    case 'sunburst':
      return buildSunburst(params)
    case 'boxplot':
      return buildBoxplot(params)
    case 'candlestick':
      return buildCandlestick(params)
    case 'gauge':
      return buildGauge(params)
    default:
      return buildCartesian(params)
  }
}
