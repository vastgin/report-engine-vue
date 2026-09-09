import type { Dataset, DatasetSummary } from '@/types'
import monthlySales from '@/mock/datasets/monthly-sales.json'
import websiteTraffic from '@/mock/datasets/website-traffic.json'

/**
 * 数据集目录（registry）。
 * 参见 report-dataset 规范：枚举全部数据集、按 id 获取、未找到返回明确结果。
 */
const datasets: Dataset[] = [monthlySales as Dataset, websiteTraffic as Dataset]

const byId = new Map<string, Dataset>(datasets.map((d) => [d.id, d]))

/** 枚举全部可用数据集的摘要信息 */
export function listDatasets(): DatasetSummary[] {
  return datasets.map((d) => ({ id: d.id, name: d.name }))
}

/** 按 id 获取完整数据集；不存在时返回 undefined（明确的「未找到」结果） */
export function getDataset(id: string): Dataset | undefined {
  return byId.get(id)
}

/** 获取全部数据集（完整对象） */
export function getAllDatasets(): Dataset[] {
  return datasets
}
