import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDashboardStore } from '../dashboard'
import type { ReportDefinition } from '@/types'

const STORAGE_KEY = 'report-engine:dashboard'

function makeDefinition(title: string): ReportDefinition {
  return {
    datasetId: 'monthly-sales',
    chartType: 'bar',
    encodings: {
      dimensions: [{ field: 'month' }],
      values: [{ field: 'revenue', aggregation: 'sum' }]
    },
    options: { title, showLegend: true, theme: 'default' }
  }
}

describe('dashboard store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('addWidget 生成组件并以报表标题命名', () => {
    const store = useDashboardStore()
    const id = store.addWidget(makeDefinition('销售概览'))
    expect(store.widgets).toHaveLength(1)
    expect(store.widgets[0].id).toBe(id)
    expect(store.widgets[0].title).toBe('销售概览')
    expect(store.widgets[0].span).toBe(6)
  })

  it('无标题时回退为「未命名图表」', () => {
    const store = useDashboardStore()
    store.addWidget(makeDefinition(''))
    expect(store.widgets[0].title).toBe('未命名图表')
  })

  it('commitFromDesigner 非编辑态执行新增', () => {
    const store = useDashboardStore()
    expect(store.commitFromDesigner(makeDefinition('A'))).toBe('added')
    expect(store.widgetCount).toBe(1)
  })

  it('commitFromDesigner 编辑态回写对应组件并退出编辑态', () => {
    const store = useDashboardStore()
    const id = store.addWidget(makeDefinition('旧标题'))
    store.beginEdit(id)
    expect(store.isEditing).toBe(true)

    const result = store.commitFromDesigner(makeDefinition('新标题'))
    expect(result).toBe('updated')
    expect(store.widgetCount).toBe(1)
    expect(store.widgets[0].title).toBe('新标题')
    expect(store.editingWidgetId).toBeNull()
  })

  it('moveWidget 交换相邻组件顺序，越界不改变', () => {
    const store = useDashboardStore()
    const a = store.addWidget(makeDefinition('A'))
    const b = store.addWidget(makeDefinition('B'))
    store.moveWidget(b, -1)
    expect(store.widgets.map((w) => w.id)).toEqual([b, a])
    store.moveWidget(b, -1) // 已在首位，越界
    expect(store.widgets.map((w) => w.id)).toEqual([b, a])
  })

  it('reorderWidget 拖拽重排：向右拖抢占目标格、向左拖回到目标格', () => {
    const store = useDashboardStore()
    const a = store.addWidget(makeDefinition('A'))
    const b = store.addWidget(makeDefinition('B'))
    const c = store.addWidget(makeDefinition('C'))
    // 向右拖：A 放到 C 的位置 → [B, C, A]
    store.reorderWidget(a, c)
    expect(store.widgets.map((w) => w.id)).toEqual([b, c, a])
    // 向左拖：A 放到 B 的位置 → [A, B, C]
    store.reorderWidget(a, b)
    expect(store.widgets.map((w) => w.id)).toEqual([a, b, c])
  })

  it('reorderWidget 自身或无效 id 不改变顺序', () => {
    const store = useDashboardStore()
    const a = store.addWidget(makeDefinition('A'))
    const b = store.addWidget(makeDefinition('B'))
    store.reorderWidget(a, a)
    expect(store.widgets.map((w) => w.id)).toEqual([a, b])
    store.reorderWidget(a, 'nope')
    expect(store.widgets.map((w) => w.id)).toEqual([a, b])
  })

  it('duplicateWidget 复制组件并追加「副本」后缀', () => {
    const store = useDashboardStore()
    const a = store.addWidget(makeDefinition('销售'))
    store.duplicateWidget(a)
    expect(store.widgetCount).toBe(2)
    expect(store.widgets[1].title).toBe('销售 副本')
    expect(store.widgets[1].id).not.toBe(a)
  })

  it('setSpan 调整栅格跨度', () => {
    const store = useDashboardStore()
    const id = store.addWidget(makeDefinition('A'))
    store.setSpan(id, 12)
    expect(store.widgets[0].span).toBe(12)
  })

  it('removeWidget 移除组件并清理其编辑态', () => {
    const store = useDashboardStore()
    const id = store.addWidget(makeDefinition('A'))
    store.beginEdit(id)
    store.removeWidget(id)
    expect(store.widgetCount).toBe(0)
    expect(store.editingWidgetId).toBeNull()
  })

  it('持久化到 localStorage，并可被新的 store 实例读取', () => {
    const store = useDashboardStore()
    store.setTitle('季度看板')
    store.addWidget(makeDefinition('销售概览'))
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()

    setActivePinia(createPinia())
    const reloaded = useDashboardStore()
    expect(reloaded.title).toBe('季度看板')
    expect(reloaded.widgetCount).toBe(1)
    expect(reloaded.widgets[0].title).toBe('销售概览')
    // 会话态不持久化
    expect(reloaded.editingWidgetId).toBeNull()
  })

  it('clear 清空全部组件', () => {
    const store = useDashboardStore()
    store.addWidget(makeDefinition('A'))
    store.addWidget(makeDefinition('B'))
    store.clear()
    expect(store.widgetCount).toBe(0)
  })
})
