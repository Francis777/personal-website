import type { AskingPriceReference, City, PriceRow } from './content'
import {
  buildMarketTrendCore,
  comparisonQuarters,
  quarterFromIsoDate,
  type CoreMarketTrendPoint,
} from './marketTrendsCore.mjs'

export { comparisonQuarters, quarterFromIsoDate }
export type MarketTrendPoint = CoreMarketTrendPoint

export interface MarketTrend {
  city: City
  baselineQuarter: string | null
  points: MarketTrendPoint[]
}

export function buildMarketTrend(
  records: AskingPriceReference[],
  soldRows: PriceRow[],
  city: City,
  quarters: readonly string[] = comparisonQuarters,
  minimumAskingSample = 10,
): MarketTrend {
  return buildMarketTrendCore(records, soldRows, city, quarters, minimumAskingSample) as MarketTrend
}
