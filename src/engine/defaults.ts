import type { ReportDefinition } from '@/types'
import { getAllDatasets } from '@/data/registry'

/**
 * 基于首个数据集创建一个默认可渲染的报表定义。
 * 用于看板「新建图表」时提供合理初始状态（首个维度 + 首个指标 + 柱状图）。
 */
export function createDefaultDefinition(title = '新建图表'): ReportDefinition {
  const dataset = getAllDatasets()[0]
  const dim = dataset?.fields.find((f) => f.role === 'dimension')
  const measure = dataset?.fields.find((f) => f.role === 'measure')
  return {
    datasetId: dataset?.id ?? '',
    chartType: 'bar',
    encodings: {
      dimensions: dim ? [{ field: dim.name }] : [],
      values: measure
        ? [{ field: measure.name, aggregation: measure.defaultAggregation ?? 'sum' }]
        : []
    },
    options: { title, showLegend: true, theme: 'default' }
  }
}
