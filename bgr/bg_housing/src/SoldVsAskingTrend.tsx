import { useEffect, useMemo, useState } from 'react'
import { priceRows, type AskingPriceReference, type City } from './content'
import { buildMarketTrend, comparisonQuarters } from './marketTrends'
import './trend.css'

type ComparisonSeriesKey = 'sold' | 'asking'

interface ComparisonChartPoint {
  series: ComparisonSeriesKey
  quarter: string
  normalized: number
  raw: number
  sampleSize: number
  x: number
  y: number
}

const formatEuro = (value: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

function CityControl({ value, onChange }: { value: City; onChange: (city: City) => void }) {
  return (
    <div className="control-group">
      <span className="control-label">Comparison city</span>
      <div className="segment" role="group" aria-label="Comparison city">
        {(['Sofia', 'Plovdiv'] as const).map((city) => (
          <button
            type="button"
            key={city}
            className={value === city ? 'active' : ''}
            aria-pressed={value === city}
            onClick={() => onChange(city)}
          >
            {city}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SoldVsAskingTrend({ records, snapshotAt }: { records: AskingPriceReference[]; snapshotAt: string | null }) {
  const [city, setCity] = useState<City>('Sofia')
  const [activePoint, setActivePoint] = useState<ComparisonChartPoint | null>(null)
  const trend = useMemo(() => buildMarketTrend(records, priceRows, city), [records, city])
  useEffect(() => setActivePoint(null), [city, records])
  const width = 960
  const height = 390
  const frame = { left: 66, right: 30, top: 32, bottom: 58 }
  const chartWidth = width - frame.left - frame.right
  const chartHeight = height - frame.top - frame.bottom
  const getX = (quarter: string) =>
    frame.left + (comparisonQuarters.indexOf(quarter as (typeof comparisonQuarters)[number]) / Math.max(comparisonQuarters.length - 1, 1)) * chartWidth

  const normalizedValues = trend.points.flatMap((point) =>
    [point.soldComparableIndex, point.askingComparableIndex].filter((value): value is number => value !== null),
  )
  const low = Math.min(100, ...normalizedValues)
  const high = Math.max(100, ...normalizedValues)
  const padding = Math.max((high - low) * 0.16, 2)
  const yMin = Math.floor((low - padding) / 5) * 5
  const yMax = Math.ceil((high + padding) / 5) * 5
  const getY = (value: number) => frame.top + ((yMax - value) / (yMax - yMin)) * chartHeight
  const ticks = Array.from({ length: 5 }, (_, index) => yMax - ((yMax - yMin) / 4) * index)

  const chartPoints = trend.points.flatMap((point) => {
    const points: ComparisonChartPoint[] = []
    if (point.soldComparableIndex !== null && point.soldHpi !== null) {
      points.push({
        series: 'sold',
        quarter: point.quarter,
        normalized: point.soldComparableIndex,
        raw: point.soldHpi,
        sampleSize: 0,
        x: getX(point.quarter),
        y: getY(point.soldComparableIndex),
      })
    }
    if (point.askingComparableIndex !== null && point.askingMedianEurSqm !== null) {
      points.push({
        series: 'asking',
        quarter: point.quarter,
        normalized: point.askingComparableIndex,
        raw: point.askingMedianEurSqm,
        sampleSize: point.askingSampleSize,
        x: getX(point.quarter),
        y: getY(point.askingComparableIndex),
      })
    }
    return points
  })

  const pathFor = (series: ComparisonSeriesKey) => {
    let drawing = false
    return trend.points.map((point) => {
      const value = series === 'sold' ? point.soldComparableIndex : point.askingComparableIndex
      if (value === null) {
        drawing = false
        return ''
      }
      const command = drawing ? 'L' : 'M'
      drawing = true
      return `${command} ${getX(point.quarter)} ${getY(value)}`
    }).join(' ')
  }

  const soldLatest = [...trend.points].reverse().find((point) => point.soldHpi !== null)
  const askingLatest = [...trend.points].reverse().find((point) => point.askingMedianEurSqm !== null)
  const lagZoneStart = (getX('2026 Q1') + getX('2026 Q2')) / 2
  const tooltipX = activePoint ? Math.min(activePoint.x + 14, width - 238) : 0
  const tooltipY = activePoint ? Math.max(activePoint.y - 66, 8) : 0
  const snapshotLabel = snapshotAt
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(snapshotAt))
    : "31 Aug 2026 bundled snapshot"

  return (
    <section className="market-comparison" aria-labelledby="market-comparison-title">
      <div className="market-comparison-heading">
        <div>
          <span className="section-number">Paired market view</span>
          <h3 id="market-comparison-title">Transaction trend +<br /><em>asking-price profile.</em></h3>
          <p>The official sold-market series and current for-sale listing cohorts are shown together, with their different dates and measurement bases kept explicit.</p>
        </div>
        <CityControl value={city} onChange={setCity} />
      </div>

      <div className="chart-shell comparison-chart-shell">
        <div className="chart-title-row comparison-title-row">
          <div>
            <span className="chart-kicker">Diagnostic rebase · {trend.baselineQuarter ?? 'no shared anchor'} = 100</span>
            <strong>{city} · official trend and current cohort profile</strong>
          </div>
          <div className="legend comparison-legend" aria-label="Comparison chart legend">
            <span><i className="sold" />Transaction-price trend · NSI HPI</span>
            <span><i className="asking" />Current asking cohorts · median €/m²</span>
          </div>
        </div>
        <div className="chart-scroll" tabIndex={0} role="region" aria-label={`${city} transaction and asking-price comparison chart; scroll horizontally on smaller screens`}>
          <svg
            className="price-chart comparison-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${city} official transaction-price trend and current asking-price profile. Both series are diagnostically rebased to ${trend.baselineQuarter ?? 'their first shared quarter'} equals 100. The official series ends with ${soldLatest?.quarter ?? 'no observation'}; current listing cohorts extend to ${askingLatest?.quarter ?? 'no observation'}.`}
            onMouseLeave={() => setActivePoint(null)}
          >
            <rect
              className="publication-lag-zone"
              x={lagZoneStart}
              y={frame.top}
              width={width - frame.right - lagZoneStart}
              height={chartHeight}
            />
            <text className="publication-lag-label" x={lagZoneStart + 12} y={frame.top + 18}>NSI HPI not available in this dataset</text>
            {ticks.map((tick) => {
              const y = getY(tick)
              return (
                <g key={tick}>
                  <line x1={frame.left} x2={width - frame.right} y1={y} y2={y} className="grid-line" />
                  <text x={frame.left - 12} y={y + 4} textAnchor="end" className="axis-label">{tick.toFixed(0)}</text>
                </g>
              )
            })}
            <line x1={frame.left} x2={width - frame.right} y1={getY(100)} y2={getY(100)} className="comparison-baseline" />
            {comparisonQuarters.map((quarter) => (
              <text key={quarter} x={getX(quarter)} y={height - 22} textAnchor="middle" className="axis-label x-axis">
                {quarter === '2026 Q3' ? '’26 Q3*' : quarter.replace(/^20/, '’')}
              </text>
            ))}
            {(['sold', 'asking'] as const).map((series) => (
              <g key={series} className={`comparison-series ${series}`}>
                <path d={pathFor(series)} className="comparison-line halo" />
                <path d={pathFor(series)} className="comparison-line" />
              </g>
            ))}
            {chartPoints.map((point) => (
              <circle
                key={`${point.series}-${point.quarter}`}
                cx={point.x}
                cy={point.y}
                r="5"
                className={`comparison-point ${point.series}`}
                aria-label={point.series === 'sold'
                  ? `${city}, ${point.quarter}, transaction comparison index ${point.normalized.toFixed(1)}, official NSI HPI ${point.raw.toFixed(2)}`
                  : `${city}, listing-origin cohort ${point.quarter}, current comparison index ${point.normalized.toFixed(1)}, median asking ${formatEuro(point.raw)} per square metre, ${point.sampleSize} records, prices observed in the ${snapshotLabel} database`}
                onMouseEnter={() => setActivePoint(point)}
              />
            ))}
            {activePoint && (
              <g className="chart-tooltip comparison-tooltip" aria-hidden="true">
                <line x1={activePoint.x} x2={activePoint.x} y1={frame.top} y2={height - frame.bottom} />
                <rect x={tooltipX} y={tooltipY} width="224" height="82" rx="8" />
                <text x={tooltipX + 13} y={tooltipY + 22} className="tooltip-title">
                  {activePoint.series === 'sold' ? 'Transaction-price HPI' : 'Current asking cohort'} · {activePoint.quarter}
                </text>
                <text x={tooltipX + 13} y={tooltipY + 45} className="tooltip-value">{activePoint.normalized.toFixed(1)} comparison index</text>
                <text x={tooltipX + 13} y={tooltipY + 65} className="tooltip-detail">
                  {activePoint.series === 'sold'
                    ? `Official NSI HPI ${activePoint.raw.toFixed(2)}`
                    : `${formatEuro(activePoint.raw)}/m² · n=${activePoint.sampleSize}`}
                </text>
              </g>
            )}
          </svg>
        </div>
        <table className="sr-only">
          <caption>{city} official transaction-price HPI and current asking-price profile by listing-origin quarter</caption>
          <thead><tr><th>Quarter</th><th>NSI transaction HPI</th><th>Transaction comparison index</th><th>Median asking €/m²</th><th>Listing comparison index</th><th>Listing sample</th></tr></thead>
          <tbody>
            {trend.points.map((point) => (
              <tr key={point.quarter}><th>{point.quarter}</th><td>{point.soldHpi?.toFixed(2) ?? 'Not published'}</td><td>{point.soldComparableIndex?.toFixed(1) ?? 'Not published'}</td><td>{point.askingMedianEurSqm?.toFixed(2) ?? 'Insufficient sample'}</td><td>{point.askingComparableIndex?.toFixed(1) ?? 'Insufficient sample'}</td><td>{point.askingSampleSize}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="chart-footnote comparison-footnote">
          <strong>How to read it:</strong> each line is independently rebased to {trend.baselineQuarter ?? 'the first shared quarter'} = 100; vertical gaps do not represent a price discount. The solid line is NSI’s quality-adjusted new-dwelling transaction HPI. The dashed line groups current asking prices by original listing quarter and appears only at n≥10; those prices were observed in the {snapshotLabel} database, not necessarily on the listing date. It is a survivor- and mix-biased cohort profile—not achieved-price history or a repeat-sales index. Q3 2026 is partial.
        </p>
      </div>
    </section>
  )
}
