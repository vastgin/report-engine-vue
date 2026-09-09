import { buildOption } from '@/engine/optionBuilder'
import type { ReportData } from '@/engine/chartModel'
import type { RenderResult } from '@/engine/renderReport'
import type { ReportDefinition, ReportOptions } from '@/types'
import { mockQueryReport } from './mockBackend'
import type { ReportQueryRequest, ReportQueryResponse } from './contract'

/** 对外统一导出接口契约类型，业务代码从 @/api/reportClient 引入即可 */
export type {
  MeasureQuery,
  ReportData,
  ReportErrorCode,
  ReportQueryError,
  ReportQueryRequest,
  ReportQueryResponse
} from './contract'

/** 开启后可在浏览器控制台查看实际的请求 / 响应载荷：localStorage['report-engine:api-debug']='1' */
const DEBUG_KEY = 'report-engine:api-debug'

function debugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 报表定义 → 查询请求（接口输入参数）。
 * 把内部 Encodings（dimensions[] / colors[] / values[]）展开为 API 形态：
 * dimensions、colors 为字段名数组（colors 为可选的图例/拆分维度），measures 为 { field, aggregation } 数组。
 */
export function toQueryRequest(def: ReportDefinition): ReportQueryRequest {
  const colors = (def.encodings.colors ?? []).map((c) => c.field).filter(Boolean)
  return {
    datasetId: def.datasetId,
    chartType: def.chartType,
    dimensions: def.encodings.dimensions.map((d) => d.field).filter(Boolean),
    colors: colors.length ? colors : undefined,
    measures: def.encodings.values
      .filter((v) => v.field)
      .map((v) => ({ field: v.field, aggregation: v.aggregation })),
    options: def.options
  }
}

/**
 * 报表查询接口客户端。
 *
 * 当前指向 mock 后端（前端内存计算 + 模拟网络延迟）。接入真实后端时，仅需把本函数
 * 替换为 HTTP 调用，前端其余部分（composable / 组件）无需改动：
 *
 *   export async function queryReport(request: ReportQueryRequest): Promise<ReportQueryResponse> {
 *     const res = await fetch('/api/report/query', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(request)
 *     })
 *     if (!res.ok) throw new Error(`HTTP ${res.status}`)
 *     return (await res.json()) as ReportQueryResponse
 *   }
 *
 * @param request 报表查询请求（接口输入参数）
 * @returns 报表查询响应（接口输出参数）
 */
export async function queryReport(request: ReportQueryRequest): Promise<ReportQueryResponse> {
  const debug = debugEnabled()
  // 用 console.log（Info 级）而非 console.debug（Verbose 级，Chrome 默认不显示）
  if (debug) console.log('%c[report-api] → request', 'color:#409eff;font-weight:600', request)
  const response = await mockQueryReport(request)
  if (debug)
    console.log(
      `%c[report-api] ← response (${response.success ? 'ok' : 'error'}, ${response.took}ms)`,
      'color:#67c23a;font-weight:600',
      response
    )
  return response
}

/**
 * 后端数据载荷 → 前端渲染结果（接口输出 → 视图）。
 * 所有类型都带共享的 dataset；图表类在前端用 view 组装 ECharts option（渲染职责，随样式即时变化），
 * 指标卡用 view.cards，表格直接透传 dataset 给专用组件。
 * @param data  响应中的 data（成功时）
 * @param options 前端本地样式项，用于组装 option
 * @param error 失败时的错误信息
 */
export function dataToRenderResult(
  data: ReportData | null,
  options: ReportOptions,
  error?: string
): RenderResult {
  if (error) return { error }
  if (!data) return {}
  if (data.type === 'metric') return { metrics: data.view.cards }
  if (data.type === 'table') return { table: data.dataset }
  return { option: buildOption({ model: data.view, options }) }
}
