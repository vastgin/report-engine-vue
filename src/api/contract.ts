/**
 * 报表查询接口契约（输入参数 / 输出参数）。
 *
 * ── 架构边界 ──────────────────────────────────────────────────────────────
 * 后端（当前为 mock）负责「计算」：按维度分组、按指标聚合，产出与图表类型匹配的
 *   数据模型（chart / metric / table 三选一）。
 * 前端负责「渲染」：把数据模型映射为 ECharts option、指标卡或表格并展示。
 *
 * ── 触发时机 ──────────────────────────────────────────────────────────────
 * 设计器中，只要「参与计算」的字段发生变化（数据集 / 图表类型 / 维度 / 拆分维度 /
 * 指标及其聚合方式），就会发起一次查询（POST）。样式项（标题、主题、图例开关）
 * 仅影响前端渲染，不触发后端请求。
 *
 * ── 传输约定 ──────────────────────────────────────────────────────────────
 * 建议：POST /api/report/query，Content-Type: application/json，
 * 请求体 = ReportQueryRequest，响应体 = ReportQueryResponse。
 */
import type { Aggregation, ChartType, ReportOptions } from '@/types'

/**
 * 后端计算结果的数据载荷（接口输出的 data 字段）。
 * 所有图表类型共享同一数值核心 dataset，再按需附带渲染就绪的 view：
 *   dataset: { columns: ResultColumn[], dimensionCount, rows: ResultRow[] }
 *     — 按维度列分组、按指标列聚合的统一结果集（维度列为文本、指标列为原始数值）。
 * 具体结构定义见 @/engine/chartModel：
 * - { type: 'chart';  dataset; view: ChartModel }   绝大多数 ECharts 图表：view 含 categories / series /
 *                                                  matrix（热力）/ hierarchy（树图·旭日）/
 *                                                  boxData（箱线）/ candleData（K线）等。
 * - { type: 'metric'; dataset; view: { cards } }    指标卡：每张含 label + primary + secondary[]。
 * - { type: 'table';  dataset }                     表格：无 view，前端直接渲染 dataset（合并 / 格式化在前端）。
 */
export type { ReportData } from '@/engine/chartModel'

/** 单个指标的查询描述：字段 + 聚合方式 */
export interface MeasureQuery {
  /** 指标字段名（对应数据集字段的 name） */
  field: string
  /** 聚合方式：sum 求和 / avg 平均 / count 计数 / min 最小 / max 最大 */
  aggregation: Aggregation
}

/**
 * 报表查询请求（接口输入参数）。
 *
 * 示例：
 * {
 *   "datasetId": "monthly-sales",
 *   "chartType": "bar",
 *   "dimensions": ["region", "month"],
 *   "colors": ["category"],
 *   "measures": [{ "field": "revenue", "aggregation": "sum" }],
 *   "options": { "title": "区域销售", "showLegend": true, "theme": "default" }
 * }
 */
export interface ReportQueryRequest {
  /** 数据集标识（必填）。后端据此定位数据源；不存在返回 DATASET_NOT_FOUND */
  datasetId: string
  /** 图表类型（必填）。决定后端返回哪种 data 结构（chart / metric / table） */
  chartType: ChartType
  /**
   * 有序维度字段名列表（分组依据）。顺序即层级/复合分组顺序；
   * 数量受图表类型约束，超出返回 INVALID_BINDING。
   */
  dimensions: string[]
  /**
   * 可选的「图例 / 颜色」拆分维度字段名列表（支持多个）。不计入复合分组：
   * 普通图按这些维度取值的复合拆分系列（系列名以 " / " 连接），热力图首个作为 Y 轴，
   * 层级图作为末级层级；在维度数量校验中与 dimensions 合计。
   */
  colors?: string[]
  /** 指标列表（必填，至少 1 个）。每项含字段名与聚合方式；数量受图表类型约束 */
  measures: MeasureQuery[]
  /**
   * 样式项（可选）。后端计算通常不消费，透传用于服务端导出 / 主题 / 日志等扩展；
   * 前端渲染（组装 ECharts option）使用的是本地样式状态。
   */
  options?: ReportOptions
}

/** 业务错误码 */
export type ReportErrorCode =
  /** 数据集不存在 */
  | 'DATASET_NOT_FOUND'
  /** 不支持的图表类型 */
  | 'UNSUPPORTED_CHART'
  /** 维度 / 指标数量不满足该图表类型的约束 */
  | 'INVALID_BINDING'
  /** 绑定的字段在数据集中不存在 */
  | 'UNKNOWN_FIELD'
  /** 服务端内部错误 */
  | 'INTERNAL'

/** 错误详情 */
export interface ReportQueryError {
  /** 稳定的机器可读错误码，便于前端分类处理 */
  code: ReportErrorCode
  /** 可直接展示给用户的中文错误信息 */
  message: string
}

/**
 * 报表查询响应（接口输出参数）。
 *
 * 成功示例（图表类）：
 * { "success": true, "took": 12, "data": { "type": "chart", "dataset": { ... }, "view": { ... } } }
 * 失败示例：
 * { "success": false, "took": 3, "error": { "code": "INVALID_BINDING", "message": "「饼图」最多支持 1 个维度字段" } }
 */
export interface ReportQueryResponse {
  /** 是否计算成功 */
  success: boolean
  /** 成功时的计算结果（chart / metric / table 三选一）；失败时缺省 */
  data?: import('@/engine/chartModel').ReportData
  /** 失败时的错误信息；成功时缺省 */
  error?: ReportQueryError
  /** 服务端计算耗时（毫秒），便于观测性能（mock 也会返回） */
  took?: number
}
