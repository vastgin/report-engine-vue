import { describe, expect, it } from 'vitest'
import { renderReport, validateDefinition } from '../renderReport'
import { computeRowSpans } from '../chartModel'
import type { ReportDefinition } from '@/types'

const base: ReportDefinition = {
  datasetId: 'monthly-sales',
  chartType: 'bar',
  encodings: {
    dimensions: [{ field: 'month' }],
    values: [{ field: 'revenue', aggregation: 'sum' }]
  },
  options: { title: '', showLegend: true, theme: 'default' }
}

describe('validateDefinition', () => {
  it('绑定完整时无错误', () => {
    expect(validateDefinition(base)).toBeUndefined()
  })

  it('缺少指标时返回提示', () => {
    const def: ReportDefinition = { ...base, encodings: { dimensions: [{ field: 'month' }], values: [] } }
    expect(validateDefinition(def)).toContain('指标')
  })

  it('缺少维度时返回提示', () => {
    const def: ReportDefinition = {
      ...base,
      encodings: { dimensions: [], values: [{ field: 'revenue', aggregation: 'sum' }] }
    }
    expect(validateDefinition(def)).toContain('维度')
  })

  it('热力图需要 2 个维度，仅 1 个时报错', () => {
    const def: ReportDefinition = { ...base, chartType: 'heatmap' }
    expect(validateDefinition(def)).toContain('2 个维度')
  })

  it('K 线图需要 4 个指标', () => {
    const def: ReportDefinition = { ...base, chartType: 'candlestick' }
    expect(validateDefinition(def)).toContain('4 个指标')
  })

  it('仪表盘不需要维度，仅需 1 个指标', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'gauge',
      encodings: { dimensions: [], values: [{ field: 'revenue', aggregation: 'sum' }] }
    }
    expect(validateDefinition(def)).toBeUndefined()
  })

  it('未知图表类型返回错误', () => {
    const def: ReportDefinition = { ...base, chartType: 'unknown' as never }
    expect(validateDefinition(def)).toContain('不支持的图表类型')
  })
})

describe('renderReport', () => {
  it('数据集不存在时返回明确错误', () => {
    const result = renderReport({ ...base, datasetId: 'not-exist' })
    expect(result.error).toContain('未找到数据集')
    expect(result.option).toBeUndefined()
  })

  it('绑定完整时返回 ECharts option', () => {
    const result = renderReport(base)
    expect(result.error).toBeUndefined()
    expect(result.option).toBeTruthy()
  })

  it('绑定字段不在数据集中时返回错误', () => {
    const def: ReportDefinition = {
      ...base,
      encodings: { dimensions: [{ field: 'ghost' }], values: [{ field: 'revenue', aggregation: 'sum' }] }
    }
    expect(renderReport(def).error).toContain('不存在')
  })

  it('饼图完整绑定时成功渲染', () => {
    const def: ReportDefinition = { ...base, chartType: 'pie' }
    expect(renderReport(def).option).toBeTruthy()
  })

  it('热力图绑定两个维度时成功渲染', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'heatmap',
      encodings: {
        dimensions: [{ field: 'month' }],
        colors: [{ field: 'region' }],
        values: [{ field: 'revenue', aggregation: 'sum' }]
      }
    }
    expect(renderReport(def).option).toBeTruthy()
  })

  it('多个拆分维度：系列名为各拆分维度取值的复合键（" / " 连接）', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'bar',
      encodings: {
        dimensions: [{ field: 'month' }],
        colors: [{ field: 'region' }, { field: 'category' }],
        values: [{ field: 'revenue', aggregation: 'sum' }]
      }
    }
    const option = renderReport(def).option as { series?: { name?: string }[] } | undefined
    const names = (option?.series ?? []).map((s) => s.name ?? '')
    expect(names.length).toBeGreaterThan(1)
    expect(names.every((n) => n.includes(' / '))).toBe(true)
  })
})

describe('metric-card 指标卡', () => {
  it('绑定维度 + 单指标：每个维度取值一张卡（上侧标签=维度值，主指标=度量聚合）', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'metric-card',
      encodings: { dimensions: [{ field: 'region' }], values: [{ field: 'revenue', aggregation: 'sum' }] }
    }
    const res = renderReport(def)
    expect(res.error).toBeUndefined()
    expect(res.option).toBeUndefined()
    expect(res.metrics?.map((m) => m.label)).toEqual(['华东', '华北', '华南'])
    expect(res.metrics?.map((m) => m.primary.value)).toEqual([770000, 550000, 534000])
    expect(res.metrics?.[0].primary.formatted).toBe('770,000')
    expect(res.metrics?.[0].primary.measureLabel).toBe('销售额')
    expect(res.metrics?.[0].secondary).toEqual([])
  })

  it('绑定维度 + 3 指标：第 1 个为主指标，第 2/3 个进入次指标区', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'metric-card',
      encodings: {
        dimensions: [{ field: 'region' }],
        values: [
          { field: 'revenue', aggregation: 'sum' },
          { field: 'orders', aggregation: 'sum' },
          { field: 'profit', aggregation: 'sum' }
        ]
      }
    }
    const card = renderReport(def).metrics?.[0]
    expect(card?.label).toBe('华东')
    expect(card?.primary).toEqual({ measureLabel: '销售额', value: 770000, formatted: '770,000' })
    expect(card?.secondary).toEqual([
      { measureLabel: '订单数', value: 2930, formatted: '2,930' },
      { measureLabel: '利润', value: 158100, formatted: '158,100' }
    ])
  })

  it('未绑定维度：单张卡，主/次指标为全表聚合，标签为空', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'metric-card',
      encodings: {
        dimensions: [],
        values: [
          { field: 'revenue', aggregation: 'sum' },
          { field: 'orders', aggregation: 'sum' }
        ]
      }
    }
    const res = renderReport(def)
    expect(res.metrics).toHaveLength(1)
    expect(res.metrics?.[0].label).toBe('')
    expect(res.metrics?.[0].primary).toEqual({ measureLabel: '销售额', value: 1854000, formatted: '1,854,000' })
    expect(res.metrics?.[0].secondary).toEqual([{ measureLabel: '订单数', value: 8235, formatted: '8,235' }])
  })

  it('校验：0 维度 1 指标合法；超过 1 维度或 3 指标报错', () => {
    const ok: ReportDefinition = {
      ...base,
      chartType: 'metric-card',
      encodings: { dimensions: [], values: [{ field: 'revenue', aggregation: 'sum' }] }
    }
    expect(validateDefinition(ok)).toBeUndefined()

    const tooManyDims: ReportDefinition = {
      ...base,
      chartType: 'metric-card',
      encodings: {
        dimensions: [{ field: 'region' }, { field: 'category' }],
        values: [{ field: 'revenue', aggregation: 'sum' }]
      }
    }
    expect(validateDefinition(tooManyDims)).toContain('最多支持 1 个维度')

    const tooManyMeasures: ReportDefinition = {
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
    }
    expect(validateDefinition(tooManyMeasures)).toContain('最多支持 3 个指标')
  })
})

describe('table 表格', () => {
  it('两个维度：dataset 提供列/数值行，合并（rowspan）由前端计算', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'table',
      encodings: {
        dimensions: [{ field: 'region' }, { field: 'month' }],
        values: [{ field: 'revenue', aggregation: 'sum' }]
      }
    }
    const res = renderReport(def)
    expect(res.error).toBeUndefined()
    expect(res.option).toBeUndefined()
    const table = res.table
    expect(table).toBeTruthy()
    expect(table?.dimensionCount).toBe(2)
    expect(table?.columns).toEqual([
      { key: 'd0', label: '区域', role: 'dimension', field: 'region' },
      { key: 'd1', label: '月份', role: 'dimension', field: 'month' },
      { key: 'm0', label: '销售额', role: 'measure', field: 'revenue', aggregation: 'sum' }
    ])
    expect(table?.rows).toHaveLength(18)
    // 按区域分层排序：华东(0-5)、华北(6-11)、华南(12-17)；指标为原始数值
    expect(table?.rows[0]).toEqual({ d0: '华东', d1: '1月', m0: 120000 })
    expect(table?.rows[6]).toEqual({ d0: '华北', d1: '1月', m0: 98000 })
    expect(table?.rows[12]).toEqual({ d0: '华南', d1: '1月', m0: 76000 })
    // 合并信息由前端 computeRowSpans 计算：区域列每 6 行合并一次，月份列不合并
    const spans = computeRowSpans(table!)
    expect(spans[0]).toEqual([6, 1])
    expect(spans[1]).toEqual([0, 1])
    expect(spans[6]).toEqual([6, 1])
    expect(spans[12]).toEqual([6, 1])
  })

  it('单维度 + 多指标：每个维度取值一行，多个指标列（原始数值）', () => {
    const def: ReportDefinition = {
      ...base,
      chartType: 'table',
      encodings: {
        dimensions: [{ field: 'region' }],
        values: [
          { field: 'revenue', aggregation: 'sum' },
          { field: 'orders', aggregation: 'sum' },
          { field: 'profit', aggregation: 'sum' }
        ]
      }
    }
    const table = renderReport(def).table
    expect(table?.dimensionCount).toBe(1)
    expect(table?.columns.map((c) => c.label)).toEqual(['区域', '销售额', '订单数', '利润'])
    expect(table?.rows).toHaveLength(3)
    expect(table?.rows[0]).toEqual({ d0: '华东', m0: 770000, m1: 2930, m2: 158100 })
    expect(computeRowSpans(table!)).toEqual([[1], [1], [1]])
  })

  it('校验：3 维度 5 指标合法；超过 3 维度或 5 指标报错', () => {
    const ok: ReportDefinition = {
      ...base,
      chartType: 'table',
      encodings: {
        dimensions: [{ field: 'region' }, { field: 'month' }, { field: 'category' }],
        values: [
          { field: 'revenue', aggregation: 'sum' },
          { field: 'orders', aggregation: 'sum' },
          { field: 'profit', aggregation: 'sum' },
          { field: 'revenue', aggregation: 'avg' },
          { field: 'orders', aggregation: 'avg' }
        ]
      }
    }
    expect(validateDefinition(ok)).toBeUndefined()

    const tooManyDims: ReportDefinition = {
      ...base,
      chartType: 'table',
      encodings: {
        dimensions: [{ field: 'region' }, { field: 'month' }, { field: 'category' }],
        colors: [{ field: 'region' }],
        values: [{ field: 'revenue', aggregation: 'sum' }]
      }
    }
    expect(validateDefinition(tooManyDims)).toContain('最多支持 3 个维度')

    const tooManyMeasures: ReportDefinition = {
      ...base,
      chartType: 'table',
      encodings: {
        dimensions: [{ field: 'region' }],
        values: [
          { field: 'revenue', aggregation: 'sum' },
          { field: 'orders', aggregation: 'sum' },
          { field: 'profit', aggregation: 'sum' },
          { field: 'revenue', aggregation: 'avg' },
          { field: 'orders', aggregation: 'avg' },
          { field: 'profit', aggregation: 'avg' }
        ]
      }
    }
    expect(validateDefinition(tooManyMeasures)).toContain('最多支持 5 个指标')
  })
})
