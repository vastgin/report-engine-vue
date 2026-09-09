import type { Component } from 'vue'
import {
  Histogram,
  TrendCharts,
  DataLine,
  DataAnalysis,
  PieChart,
  Odometer,
  Grid,
  Discount,
  Menu,
  Sunny,
  Share,
  DataBoard
} from '@element-plus/icons-vue'
import type { ChartCategory, ChartType } from '@/types'

export interface ChartTypeDef {
  type: ChartType
  label: string
  category: ChartCategory
  icon: Component
  /** 需要的维度数量范围 */
  minDimensions: number
  maxDimensions: number
  /** 需要的指标数量范围 */
  minMeasures: number
  maxMeasures: number
}

export interface ChartCategoryDef {
  category: ChartCategory
  label: string
}

/** 分类展示顺序与中文名 */
export const CHART_CATEGORIES: ChartCategoryDef[] = [
  { category: 'column', label: '柱状 / 条形' },
  { category: 'line', label: '折线 / 面积' },
  { category: 'scatter', label: '散点' },
  { category: 'pie', label: '饼 / 占比' },
  { category: 'distribution', label: '分布 / 关系' },
  { category: 'finance', label: '金融 / 统计' },
  { category: 'hierarchy', label: '层级' },
  { category: 'kpi', label: '指标' },
  { category: 'table', label: '表格' }
]

/**
 * 全部图表类型定义。维度/指标的数量约束用于设计器校验与
 * 「配置不完整」提示（对齐 report-designer 规范）。
 */
export const CHART_TYPES: ChartTypeDef[] = [
  // 柱状 / 条形
  { type: 'bar', label: '柱状图', category: 'column', icon: Histogram, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  { type: 'bar-horizontal', label: '条形图', category: 'column', icon: Histogram, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  { type: 'stacked-bar', label: '堆叠柱状图', category: 'column', icon: Histogram, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  { type: 'stacked-bar-horizontal', label: '堆叠条形图', category: 'column', icon: Histogram, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  { type: 'pictorial-bar', label: '象形柱图', category: 'column', icon: Histogram, minDimensions: 1, maxDimensions: 1, minMeasures: 1, maxMeasures: 1 },
  // 折线 / 面积
  { type: 'line', label: '折线图', category: 'line', icon: TrendCharts, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  { type: 'step-line', label: '阶梯折线图', category: 'line', icon: DataLine, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  { type: 'area', label: '面积图', category: 'line', icon: DataLine, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  { type: 'stacked-area', label: '堆叠面积图', category: 'line', icon: DataLine, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 },
  // 散点
  { type: 'scatter', label: '散点图', category: 'scatter', icon: Share, minDimensions: 0, maxDimensions: 2, minMeasures: 1, maxMeasures: 3 },
  { type: 'effect-scatter', label: '涟漪散点图', category: 'scatter', icon: Share, minDimensions: 0, maxDimensions: 2, minMeasures: 1, maxMeasures: 3 },
  // 饼 / 占比
  { type: 'pie', label: '饼图', category: 'pie', icon: PieChart, minDimensions: 1, maxDimensions: 1, minMeasures: 1, maxMeasures: 1 },
  { type: 'doughnut', label: '环形图', category: 'pie', icon: PieChart, minDimensions: 1, maxDimensions: 1, minMeasures: 1, maxMeasures: 1 },
  { type: 'rose', label: '玫瑰图', category: 'pie', icon: PieChart, minDimensions: 1, maxDimensions: 1, minMeasures: 1, maxMeasures: 1 },
  { type: 'funnel', label: '漏斗图', category: 'pie', icon: Discount, minDimensions: 1, maxDimensions: 1, minMeasures: 1, maxMeasures: 1 },
  // 分布 / 关系
  { type: 'radar', label: '雷达图', category: 'distribution', icon: DataAnalysis, minDimensions: 1, maxDimensions: 1, minMeasures: 1, maxMeasures: 5 },
  { type: 'heatmap', label: '热力图', category: 'distribution', icon: Grid, minDimensions: 2, maxDimensions: 2, minMeasures: 1, maxMeasures: 1 },
  // 金融 / 统计
  { type: 'candlestick', label: 'K 线图', category: 'finance', icon: TrendCharts, minDimensions: 1, maxDimensions: 1, minMeasures: 4, maxMeasures: 4 },
  { type: 'boxplot', label: '箱线图', category: 'finance', icon: DataAnalysis, minDimensions: 1, maxDimensions: 1, minMeasures: 1, maxMeasures: 1 },
  // 层级
  { type: 'treemap', label: '矩形树图', category: 'hierarchy', icon: Menu, minDimensions: 1, maxDimensions: 4, minMeasures: 1, maxMeasures: 1 },
  { type: 'sunburst', label: '旭日图', category: 'hierarchy', icon: Sunny, minDimensions: 1, maxDimensions: 4, minMeasures: 1, maxMeasures: 1 },
  // 指标
  { type: 'metric-card', label: '指标卡', category: 'kpi', icon: DataBoard, minDimensions: 0, maxDimensions: 1, minMeasures: 1, maxMeasures: 3 },
  { type: 'gauge', label: '仪表盘', category: 'kpi', icon: Odometer, minDimensions: 0, maxDimensions: 0, minMeasures: 1, maxMeasures: 1 },
  // 表格
  { type: 'table', label: '表格', category: 'table', icon: Grid, minDimensions: 1, maxDimensions: 3, minMeasures: 1, maxMeasures: 5 }
]

const registry = new Map<ChartType, ChartTypeDef>(CHART_TYPES.map((c) => [c.type, c]))

export function getChartTypeDef(type: ChartType): ChartTypeDef | undefined {
  return registry.get(type)
}

export function getChartLabel(type: ChartType): string {
  return registry.get(type)?.label ?? type
}
