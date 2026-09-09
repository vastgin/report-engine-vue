import { getDataset } from '@/data/registry'
import { computeReportData } from '@/engine/renderReport'
import type { ReportDefinition } from '@/types'
import type { ReportErrorCode, ReportQueryRequest, ReportQueryResponse } from './contract'

/**
 * mock 后端：在前端内存中模拟「后端计算 + 网络往返」。
 * 真实后端接入后，本模块由 HTTP 服务替代（见 reportClient.ts 的替换说明），
 * 前端其余部分（composable / 组件）无需改动。
 */

/** 模拟网络 + 计算耗时（毫秒）：基础延迟 + 抖动，让加载态可感知 */
const BASE_LATENCY_MS = 180
const JITTER_MS = 120

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 把接口输入参数还原为引擎可消费的报表定义 */
function toDefinition(req: ReportQueryRequest): ReportDefinition {
  return {
    datasetId: req.datasetId,
    chartType: req.chartType,
    encodings: {
      dimensions: req.dimensions.map((field) => ({ field })),
      colors: req.colors?.length ? req.colors.map((field) => ({ field })) : undefined,
      values: req.measures.map((m) => ({ field: m.field, aggregation: m.aggregation }))
    },
    options: req.options ?? { showLegend: true }
  }
}

/** 引擎计算错误码 → 接口错误码 */
function toErrorCode(code: string): ReportErrorCode {
  return code === 'UNKNOWN_FIELD' ? 'UNKNOWN_FIELD' : 'INVALID_BINDING'
}

/**
 * 处理一次报表查询：校验数据源与绑定 → 分组聚合计算 → 包装为响应（含耗时）。
 * @param req 报表查询请求（接口输入参数）
 * @returns 报表查询响应（接口输出参数）
 */
export async function mockQueryReport(req: ReportQueryRequest): Promise<ReportQueryResponse> {
  const started = Date.now()
  await delay(BASE_LATENCY_MS + Math.random() * JITTER_MS)
  const took = Date.now() - started

  const dataset = getDataset(req.datasetId)
  if (!dataset) {
    return {
      success: false,
      error: { code: 'DATASET_NOT_FOUND', message: `未找到数据集：${req.datasetId}` },
      took
    }
  }

  const computed = computeReportData(dataset, toDefinition(req))
  if ('error' in computed) {
    return {
      success: false,
      error: { code: toErrorCode(computed.code), message: computed.error },
      took
    }
  }

  return { success: true, data: computed, took }
}
