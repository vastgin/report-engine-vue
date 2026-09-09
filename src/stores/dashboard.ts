import { defineStore } from 'pinia'
import type { Dashboard, DashboardWidget, ReportDefinition, WidgetSpan } from '@/types'

const STORAGE_KEY = 'report-engine:dashboard'
const DEFAULT_TITLE = '我的看板'

interface DashboardState {
  title: string
  widgets: DashboardWidget[]
  /** 正在设计器中编辑的组件 id（会话态，不持久化） */
  editingWidgetId: string | null
}

function genId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID() as string
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function titleOf(definition: ReportDefinition): string {
  return definition.options.title?.trim() || '未命名图表'
}

function loadPersisted(): { title: string; widgets: DashboardWidget[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { title: DEFAULT_TITLE, widgets: [] }
    const data = JSON.parse(raw) as Dashboard
    return {
      title: data.title || DEFAULT_TITLE,
      widgets: Array.isArray(data.widgets) ? data.widgets : []
    }
  } catch {
    return { title: DEFAULT_TITLE, widgets: [] }
  }
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({ ...loadPersisted(), editingWidgetId: null }),

  getters: {
    widgetCount: (state) => state.widgets.length,
    isEditing: (state) => state.editingWidgetId !== null
  },

  actions: {
    /** 持久化标题与组件（不含会话态 editingWidgetId） */
    persist() {
      try {
        const payload: Dashboard = { title: this.title, widgets: this.widgets }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // localStorage 不可用时忽略（mockup 容错）
      }
    },

    setTitle(title: string) {
      this.title = title
      this.persist()
    },

    /** 新增组件，返回其 id */
    addWidget(definition: ReportDefinition, span: WidgetSpan = 6): string {
      const widget: DashboardWidget = {
        id: genId(),
        title: titleOf(definition),
        span,
        definition: clone(definition)
      }
      this.widgets.push(widget)
      this.persist()
      return widget.id
    },

    updateWidget(id: string, definition: ReportDefinition) {
      const widget = this.widgets.find((w) => w.id === id)
      if (!widget) return
      widget.definition = clone(definition)
      widget.title = titleOf(definition)
      this.persist()
    },

    setWidgetTitle(id: string, title: string) {
      const widget = this.widgets.find((w) => w.id === id)
      if (!widget) return
      widget.title = title
      this.persist()
    },

    setSpan(id: string, span: WidgetSpan) {
      const widget = this.widgets.find((w) => w.id === id)
      if (!widget) return
      widget.span = span
      this.persist()
    },

    removeWidget(id: string) {
      const index = this.widgets.findIndex((w) => w.id === id)
      if (index >= 0) this.widgets.splice(index, 1)
      if (this.editingWidgetId === id) this.editingWidgetId = null
      this.persist()
    },

    duplicateWidget(id: string) {
      const index = this.widgets.findIndex((w) => w.id === id)
      if (index < 0) return
      const source = this.widgets[index]
      const copy: DashboardWidget = {
        ...clone(source),
        id: genId(),
        title: `${source.title} 副本`
      }
      this.widgets.splice(index + 1, 0, copy)
      this.persist()
    },

    /** 按偏移量移动组件顺序（-1 前移，+1 后移） */
    moveWidget(id: string, offset: number) {
      const from = this.widgets.findIndex((w) => w.id === id)
      const to = from + offset
      if (from < 0 || to < 0 || to >= this.widgets.length) return
      const [widget] = this.widgets.splice(from, 1)
      this.widgets.splice(to, 0, widget)
      this.persist()
    },

    /**
     * 拖拽重排：把 dragId 放到 targetId 的位置。
     * 向右拖（from < to）落到目标之后，向左拖落到目标之前，符合「抢占目标格子」的直觉。
     */
    reorderWidget(dragId: string, targetId: string) {
      if (dragId === targetId) return
      const from = this.widgets.findIndex((w) => w.id === dragId)
      const to = this.widgets.findIndex((w) => w.id === targetId)
      if (from < 0 || to < 0) return
      const arr = [...this.widgets]
      const [moved] = arr.splice(from, 1)
      let insertAt = arr.findIndex((w) => w.id === targetId)
      if (from < to) insertAt += 1
      arr.splice(insertAt, 0, moved)
      this.widgets = arr
      this.persist()
    },

    clear() {
      this.widgets = []
      this.editingWidgetId = null
      this.persist()
    },

    beginEdit(id: string) {
      this.editingWidgetId = id
    },

    finishEdit() {
      this.editingWidgetId = null
    },

    /**
     * 设计器提交当前定义：
     * - 处于编辑态 → 更新对应组件并退出编辑态，返回 'updated'
     * - 否则 → 新增组件，返回 'added'
     */
    commitFromDesigner(definition: ReportDefinition): 'updated' | 'added' {
      if (this.editingWidgetId) {
        this.updateWidget(this.editingWidgetId, definition)
        this.editingWidgetId = null
        return 'updated'
      }
      this.addWidget(definition)
      return 'added'
    }
  }
})
