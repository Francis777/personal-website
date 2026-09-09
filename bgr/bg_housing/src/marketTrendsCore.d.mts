export const comparisonQuarters: readonly string[]

export interface CoreMarketTrendPoint {
  quarter: string
  soldHpi: number | null
  soldComparableIndex: number | null
  askingMedianEurSqm: number | null
  askingComparableIndex: number | null
  askingSampleSize: number
}

export interface CoreMarketTrend {
  city: string
  baselineQuarter: string | null
  points: CoreMarketTrendPoint[]
}

export function quarterFromIsoDate(dateIso: string): string | null

export function buildMarketTrendCore(
  records: Array<{ city: string; eurSqm: number; recordDateIso: string }>,
  soldRows: Array<{ city: string; quarter: string; index: number }>,
  city: string,
  quarters?: readonly string[],
  minimumAskingSample?: number,
): CoreMarketTrend
