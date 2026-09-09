import { describe, expect, it } from 'vitest'
import { buildOption } from '../optionBuilder'
import type { ChartModel } from '../chartModel'
import type { ChartType } from '@/types'

function makeModel(overrides: Partial<ChartModel> & { chartType: ChartType }): ChartModel {
  return {
    categories: ['1月', '2月'],
    series: [{ name: '销售额', data: [150, 500] }],
    measureLabels: ['销售额'],
    categoryLabel: '月份',
    isSplit: false,
    singleValue: 0,
    singleLabel: '销售额',
    ...overrides
  }
}

const options = { title: '销售趋势', showLegend: true, theme: 'default' }

describe('buildOption', () => {
  it('柱状图生成 category 型 xAxis 与 bar 系列', () => {
    const option = buildOption({ model: makeModel({ chartType: 'bar' }), options })
    expect(option.title).toMatchObject({ text: '销售趋势' })
    expect((option.xAxis as { data: string[] }).data).toEqual(['1月', '2月'])
    const series = option.series as { type: string; data: number[] }[]
    expect(series[0].type).toBe('bar')
    expect(series[0].data).toEqual([150, 500])
  })

  it('条形图交换 x/y 轴（yAxis 为 category）', () => {
    const option = buildOption({ model: makeModel({ chartType: 'bar-horizontal' }), options })
    expect((option.yAxis as { type: string }).type).toBe('category')
    expect((option.xAxis as { type: string }).type).toBe('value')
  })

  it('面积图生成带 areaStyle 的 line 系列', () => {
    const option = buildOption({ model: makeModel({ chartType: 'area' }), options })
    const series = option.series as { type: string; areaStyle?: unknown }[]
    expect(series[0].type).toBe('line')
    expect(series[0].areaStyle).toBeTruthy()
  })

  it('堆叠柱状图为系列设置 stack', () => {
    const option = buildOption({ model: makeModel({ chartType: 'stacked-bar' }), options })
    const series = option.series as { stack?: string }[]
    expect(series[0].stack).toBe('total')
  })

  it('饼图把类别映射为 name/value 数据点', () => {
    const option = buildOption({ model: makeModel({ chartType: 'pie' }), options })
    const series = option.series as { type: string; data: { name: string; value: number }[] }[]
    expect(series[0].type).toBe('pie')
    expect(series[0].data).toEqual([
      { name: '1月', value: 150 },
      { name: '2月', value: 500 }
    ])
  })

  it('环形图使用内外半径', () => {
    const option = buildOption({ model: makeModel({ chartType: 'doughnut' }), options })
    const series = option.series as { radius: unknown }[]
    expect(Array.isArray(series[0].radius)).toBe(true)
  })

  it('雷达图以类别为指示器、序列为雷达数据', () => {
    const option = buildOption({ model: makeModel({ chartType: 'radar' }), options })
    const radar = option.radar as { indicator: { name: string }[] }
    expect(radar.indicator.map((i) => i.name)).toEqual(['1月', '2月'])
  })

  it('仪表盘使用单值', () => {
    const option = buildOption({
      model: makeModel({ chartType: 'gauge', singleValue: 42, categories: [], series: [] }),
      options
    })
    const series = option.series as { type: string; data: { value: number }[] }[]
    expect(series[0].type).toBe('gauge')
    expect(series[0].data[0].value).toBe(42)
  })

  it('热力图输出 matrix 数据与 visualMap', () => {
    const option = buildOption({
      model: makeModel({
        chartType: 'heatmap',
        matrix: { xLabels: ['1月', '2月'], yLabels: ['华东'], points: [[0, 0, 100], [1, 0, 500]], min: 100, max: 500 }
      }),
      options
    })
    expect(option.visualMap).toBeTruthy()
    const series = option.series as { type: string; data: unknown[] }[]
    expect(series[0].type).toBe('heatmap')
    expect(series[0].data).toHaveLength(2)
  })

  it('漏斗图按数值降序排列', () => {
    const option = buildOption({ model: makeModel({ chartType: 'funnel' }), options })
    const series = option.series as { type: string; data: { value: number }[] }[]
    expect(series[0].type).toBe('funnel')
    expect(series[0].data[0].value).toBe(500)
  })

  it('不同主题应用不同调色板', () => {
    const warm = buildOption({ model: makeModel({ chartType: 'bar' }), options: { ...options, theme: 'warm' } })
    const cool = buildOption({ model: makeModel({ chartType: 'bar' }), options: { ...options, theme: 'cool' } })
    expect(warm.color).not.toEqual(cool.color)
  })
})
