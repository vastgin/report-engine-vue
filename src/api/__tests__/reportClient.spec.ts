import { describe, expect, it } from 'vitest'
import { queryReport, toQueryRequest } from '@/api/reportClient'
import type { ReportDefinition } from '@/types'

const base: ReportDefinition = {
  datasetId: 'monthly-sales',
  chartType: 'bar',
  encodings: {
    dimensions: [{ field: 'region' }],
    values: [{ field: 'revenue', aggregation: 'sum' }]
  },
  options: { title: '', showLegend: true, theme: 'default' }
}

describe('toQueryRequest 输入参数映射', () => {
  it('把 Encodings 展开为接口输入参数（dimensions[] / colors[] / measures[]）', () => {
    const req = toQueryRequest({
      datasetId: 'monthly-sales',
      chartType: 'bar',
      encodings: {
        dimensions: [{ field: 'region' }, { field: 'month' }],
        colors: [{ field: 'category' }],
        values: [{ field: 'revenue', aggregation: 'sum' }]
      },
      options: { showLegend: true }
    })
    expect(req.datasetId).toBe('monthly-sales')
    expect(req.chartType).toBe('bar')
    expect(req.dimensions).toEqual(['region', 'month'])
    expect(req.colors).toEqual(['category'])
    expect(req.measures).toEqual([{ field: 'revenue', aggregation: 'sum' }])
  })

  it('无拆分维度时 colors 缺省（undefined）', () => {
    const req = toQueryRequest(base)
    expect(req.colors).toBeUndefined()
  })
})

describe('queryReport 输出参数', () => {
  it('图表类：success=true，data.type=chart，带共享 dataset 与 view 及耗时', async () => {
    const resp = await queryReport(toQueryRequest(base))
    expect(resp.success).toBe(true)
    expect(resp.error).toBeUndefined()
    expect(typeof resp.took).toBe('number')
    expect(resp.data?.type).toBe('chart')
    expect(resp.data?.dataset.rows.length).toBeGreaterThan(0)
    if (resp.data?.type === 'chart') {
      expect(resp.data.view.categories.length).toBeGreaterThan(0)
      expect(resp.data.view.series[0]?.data.length).toBeGreaterThan(0)
    }
  })

  it('指标卡：data.type=metric，view.cards 返回主/次指标卡片', async () => {
    const resp = await queryReport(toQueryRequest({ ...base, chartType: 'metric-card' }))
    expect(resp.success).toBe(true)
    expect(resp.data?.type).toBe('metric')
    if (resp.data?.type === 'metric') {
      expect(resp.data.view.cards.map((c) => c.label)).toEqual(['华东', '华北', '华南'])
    }
  })

  it('表格：data.type=table，无 view，仅带共享 dataset（列/数值行）', async () => {
    const resp = await queryReport(
      toQueryRequest({
        ...base,
        chartType: 'table',
        encodings: {
          dimensions: [{ field: 'region' }, { field: 'month' }],
          values: [{ field: 'revenue', aggregation: 'sum' }]
        }
      })
    )
    expect(resp.success).toBe(true)
    expect(resp.data?.type).toBe('table')
    expect(resp.data?.dataset.dimensionCount).toBe(2)
    expect(resp.data?.dataset.rows.length).toBe(18)
  })

  it('结构统一：相同编码下图表/表格/指标卡共享同一 dataset（仅 view 不同）', async () => {
    const chart = await queryReport(toQueryRequest({ ...base, chartType: 'bar' }))
    const table = await queryReport(toQueryRequest({ ...base, chartType: 'table' }))
    const metric = await queryReport(toQueryRequest({ ...base, chartType: 'metric-card' }))
    const chartDs = chart.data?.dataset
    expect(chartDs?.rows.map((r) => r.d0)).toEqual(['华东', '华北', '华南'])
    expect(table.data?.dataset).toEqual(chartDs)
    expect(metric.data?.dataset).toEqual(chartDs)
  })

  it('数据集不存在：success=false，code=DATASET_NOT_FOUND', async () => {
    const resp = await queryReport(toQueryRequest({ ...base, datasetId: 'not-exist' }))
    expect(resp.success).toBe(false)
    expect(resp.data).toBeUndefined()
    expect(resp.error?.code).toBe('DATASET_NOT_FOUND')
  })

  it('维度/指标超出约束：success=false，code=INVALID_BINDING', async () => {
    const resp = await queryReport(
      toQueryRequest({
        ...base,
        chartType: 'metric-card',
        encodings: {
          dimensions: [],
          values: [
            { field: 'revenue', aggregation: 'sum' },
            { field: 'orders', aggregation: 'sum' },
            { field: 'profit', aggregation: 'sum' },
            { field: 'revenue', aggregation: 'avg' }
          ]
        }
      })
    )
    expect(resp.success).toBe(false)
    expect(resp.error?.code).toBe('INVALID_BINDING')
    expect(resp.error?.message).toContain('最多支持 3 个指标')
  })

  it('绑定字段不存在：success=false，code=UNKNOWN_FIELD', async () => {
    const resp = await queryReport(
      toQueryRequest({
        ...base,
        encodings: { dimensions: [{ field: 'ghost' }], values: [{ field: 'revenue', aggregation: 'sum' }] }
      })
    )
    expect(resp.success).toBe(false)
    expect(resp.error?.code).toBe('UNKNOWN_FIELD')
  })
})
