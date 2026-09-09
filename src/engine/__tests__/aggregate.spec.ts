import { describe, expect, it } from 'vitest'
import {
  aggregate,
  aggregateToSeries,
  aggregateMatrix,
  buildHierarchy,
  computeBoxplot
} from '../aggregate'

const records = [
  { month: '1月', region: '华东', revenue: 100, orders: 10, note: 'x' },
  { month: '1月', region: '华北', revenue: 50, orders: 5, note: 'y' },
  { month: '2月', region: '华东', revenue: 200, orders: 20, note: 'z' },
  { month: '2月', region: '华东', revenue: 300, orders: 30, note: 'w' }
]

describe('aggregate', () => {
  it('按维度分组求和，并保持维度首次出现顺序', () => {
    expect(aggregate(records, 'month', 'revenue', 'sum')).toEqual([
      { category: '1月', value: 150 },
      { category: '2月', value: 500 }
    ])
  })

  it('支持 avg / min / max / count 聚合', () => {
    expect(aggregate(records, 'month', 'revenue', 'avg')[1].value).toBe(250)
    expect(aggregate(records, 'month', 'revenue', 'min')[1].value).toBe(200)
    expect(aggregate(records, 'month', 'revenue', 'max')[1].value).toBe(300)
    expect(aggregate(records, 'month', 'revenue', 'count')[0].value).toBe(2)
  })

  it('忽略未参与聚合的其它键', () => {
    expect(aggregate(records, 'month', 'revenue', 'sum')[0].value).toBe(150)
  })
})

describe('aggregateToSeries', () => {
  it('无次维度、单指标：输出一条以指标 label 命名的序列', () => {
    const data = aggregateToSeries(records, ['month'], [
      { field: 'revenue', aggregation: 'sum', label: '销售额' }
    ])
    expect(data.categories).toEqual(['1月', '2月'])
    expect(data.series).toHaveLength(1)
    expect(data.series[0].name).toBe('销售额')
    expect(data.series[0].data).toEqual([150, 500])
  })

  it('无次维度、多指标：每个指标一条序列', () => {
    const data = aggregateToSeries(records, ['month'], [
      { field: 'revenue', aggregation: 'sum', label: '销售额' },
      { field: 'orders', aggregation: 'sum', label: '订单数' }
    ])
    expect(data.series.map((s) => s.name)).toEqual(['销售额', '订单数'])
    expect(data.series[1].data).toEqual([15, 50])
  })

  it('有拆分维度：按拆分维度取值拆分序列（使用第一个指标）', () => {
    const data = aggregateToSeries(
      records,
      ['month'],
      [{ field: 'revenue', aggregation: 'sum', label: '销售额' }],
      ['region']
    )
    expect(data.categories).toEqual(['1月', '2月'])
    expect(data.series.map((s) => s.name)).toEqual(['华东', '华北'])
    expect(data.series[0].data).toEqual([100, 500])
    expect(data.series[1].data).toEqual([50, 0])
  })

  it('多个拆分维度：系列名为各拆分维度取值的复合键', () => {
    const data = aggregateToSeries(
      records,
      ['month'],
      [{ field: 'revenue', aggregation: 'sum', label: '销售额' }],
      ['region', 'note']
    )
    expect(data.series.map((s) => s.name)).toContain('华东 / x')
    expect(data.series.every((s) => s.name.includes(' / '))).toBe(true)
  })

  it('多维度：以各维度取值的复合键作为类别', () => {
    const data = aggregateToSeries(records, ['month', 'region'], [
      { field: 'revenue', aggregation: 'sum', label: '销售额' }
    ])
    expect(data.categories).toEqual(['1月 / 华东', '1月 / 华北', '2月 / 华东'])
    expect(data.series[0].data).toEqual([100, 50, 500])
  })
})

describe('aggregateMatrix', () => {
  it('二维交叉聚合产出热力图矩阵', () => {
    const m = aggregateMatrix(records, 'month', 'region', 'revenue', 'sum')
    expect(m.xLabels).toEqual(['1月', '2月'])
    expect(m.yLabels).toEqual(['华东', '华北'])
    expect(m.min).toBe(0)
    expect(m.max).toBe(500)
    // [xIndex, yIndex, value]
    expect(m.points).toContainEqual([1, 0, 500]) // 2月 × 华东
  })
})

describe('buildHierarchy', () => {
  it('按多维度构建层级树，叶子带聚合值', () => {
    const tree = buildHierarchy(records, ['month', 'region'], 'revenue', 'sum')
    expect(tree.map((n) => n.name)).toEqual(['1月', '2月'])
    expect(tree[1].children?.map((c) => c.name)).toEqual(['华东'])
    expect(tree[1].children?.[0].value).toBe(500)
  })
})

describe('computeBoxplot', () => {
  it('计算五数概括', () => {
    expect(computeBoxplot([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([1, 3, 5, 7, 9])
  })

  it('空数组返回全 0', () => {
    expect(computeBoxplot([])).toEqual([0, 0, 0, 0, 0])
  })
})
