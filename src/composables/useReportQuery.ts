import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ReportData } from '@/engine/chartModel'
import type { RenderResult } from '@/engine/renderReport'
import type { ReportDefinition } from '@/types'
import { dataToRenderResult, queryReport, toQueryRequest } from '@/api/reportClient'

/** 输入防抖（毫秒）：合并连续的维度 / 指标调整，避免每次改动都打接口 */
const DEBOUNCE_MS = 180

/**
 * 报表查询组合式函数（前端只负责渲染，计算交给后端接口）。
 *
 * - 监听报表定义中「参与计算」的字段（数据集 / 图表类型 / 维度 / 拆分维度 / 指标及聚合），
 *   变化时防抖调用查询接口；首次挂载立即查询。
 * - 样式项（标题 / 主题 / 图例开关）不进入查询键，仅在前端即时重组渲染结果，不触发请求。
 * - 竞态安全：仅采纳最后一次请求的响应，过期响应被丢弃。
 *
 * @param source 返回当前报表定义的取值函数（如 () => store.reportDefinition）
 */
export function useReportQuery(source: () => ReportDefinition) {
  const data = ref<ReportData | null>(null)
  const error = ref<string | undefined>(undefined)
  const loading = ref(false)

  let seq = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let first = true

  // 仅由计算相关字段构成查询键；样式变化不进入该键，因而不触发后端请求
  const queryKey = computed(() => {
    const def = source()
    return JSON.stringify({
      datasetId: def.datasetId,
      chartType: def.chartType,
      dimensions: def.encodings.dimensions.map((d) => d.field),
      colors: (def.encodings.colors ?? []).map((c) => c.field),
      measures: def.encodings.values.map((v) => [v.field, v.aggregation])
    })
  })

  async function execute() {
    const def = source()
    const current = ++seq
    loading.value = true
    try {
      const resp = await queryReport(toQueryRequest(def))
      if (current !== seq) return // 已有更新的请求，丢弃过期响应
      if (resp.success && resp.data) {
        data.value = resp.data
        error.value = undefined
      } else {
        data.value = null
        error.value = resp.error?.message ?? '报表查询失败'
      }
    } catch (e) {
      if (current !== seq) return
      data.value = null
      error.value = e instanceof Error ? e.message : '报表查询请求失败'
    } finally {
      if (current === seq) loading.value = false
    }
  }

  function schedule() {
    if (first) {
      first = false
      void execute()
      return
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void execute(), DEBOUNCE_MS)
  }

  watch(queryKey, schedule, { immediate: true })

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
    seq++ // 使进行中的请求失效，避免卸载后回写
  })

  /** 前端渲染结果：图表类在前端组装 ECharts option，样式变化即时反映且无需重新请求 */
  const result = computed<RenderResult>(() =>
    dataToRenderResult(data.value, source().options, error.value)
  )

  return { result, loading, refresh: execute }
}
