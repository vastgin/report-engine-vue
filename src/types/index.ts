/**
 * 报表引擎核心数据模型。
 * 参见 openspec/changes/add-echarts-report-engine/design.md「数据模型」。
 */

/** 字段的数据类型 */
export type DataType = 'string' | 'number' | 'date' | 'boolean'

/** 字段角色：维度 或 指标（度量） */
export type FieldRole = 'dimension' | 'measure'

/** 指标可用的聚合方式 */
export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max'

/**
 * 支持的图表类型，覆盖 ECharts 主流图表。
 * 说明：map / graph / sankey / parallel / lines / themeRiver / tree / custom
 * 等需要地理、节点-连线、层级链接等非「维度-指标」表格型数据的图表不在本表格型报表引擎范围内。
 */
export type ChartType =
  // 柱状 / 条形
  | 'bar'
  | 'bar-horizontal'
  | 'stacked-bar'
  | 'stacked-bar-horizontal'
  | 'pictorial-bar'
  // 折线 / 面积
  | 'line'
  | 'step-line'
  | 'area'
  | 'stacked-area'
  // 散点 / 气泡
  | 'scatter'
  | 'effect-scatter'
  // 饼 / 环 / 占比
  | 'pie'
  | 'doughnut'
  | 'rose'
  | 'funnel'
  // 分布 / 关系
  | 'radar'
  | 'heatmap'
  // 金融 / 统计
  | 'candlestick'
  | 'boxplot'
  // 层级
  | 'treemap'
  | 'sunburst'
  // 指标
  | 'gauge'
  | 'metric-card'
  // 表格
  | 'table'

/** 图表分类，用于设计器的图表选择器分组展示 */
export type ChartCategory =
  | 'column'
  | 'line'
  | 'scatter'
  | 'pie'
  | 'distribution'
  | 'finance'
  | 'hierarchy'
  | 'kpi'
  | 'table'

/** 单个字段的元数据 */
export interface FieldMeta {
  /** 字段标识，对应 record 中的键 */
  name: string
  /** 展示名 */
  label: string
  dataType: DataType
  role: FieldRole
  /** measure 必填：可用聚合方式 */
  aggregations?: Aggregation[]
  /** measure 必填：默认聚合方式 */
  defaultAggregation?: Aggregation
}

/** 一个数据集：标识 + 字段元数据 + 行数据 */
export interface Dataset {
  id: string
  name: string
  fields: FieldMeta[]
  records: Record<string, unknown>[]
}

/** 数据集摘要，用于目录枚举 */
export interface DatasetSummary {
  id: string
  name: string
}

/** 指标绑定：字段 + 聚合方式 */
export interface MeasureBinding {
  field: string
  aggregation: Aggregation
}

/**
 * 图表编码通道：
 * - dimensions：有序维度列表（支持多维度）。多个维度构成复合类别分组；
 *   层级图中作为层级；热力图中前两个作为 X / Y 轴。
 * - colors：图例 / 颜色拆分维度列表（支持多个）。按这些维度取值的复合拆分系列
 *   （系列名以 " / " 连接），不计入类别复合分组；在维度数量校验中与 dimensions 合计。
 *   热力图中首个作为 Y 轴，层级图中作为末级层级。
 * - values：指标列表（支持多指标）。
 */
export interface Encodings {
  dimensions: { field: string }[]
  colors?: { field: string }[]
  values: MeasureBinding[]
}

/** 报表样式配置 */
export interface ReportOptions {
  title?: string
  showLegend: boolean
  theme?: string
}

/** 报表定义：设计器序列化产物，展示模式输入 */
export interface ReportDefinition {
  datasetId: string
  chartType: ChartType
  encodings: Encodings
  options: ReportOptions
}

/** 看板组件在 12 栅格中的列跨度（1/3、1/2、2/3、整行） */
export type WidgetSpan = 4 | 6 | 8 | 12

/** 看板中的单个图表组件：一个报表定义 + 标题 + 布局跨度 */
export interface DashboardWidget {
  id: string
  title: string
  span: WidgetSpan
  definition: ReportDefinition
}

/** 看板：组合多个图表组件进行集中展示 */
export interface Dashboard {
  title: string
  widgets: DashboardWidget[]
}
