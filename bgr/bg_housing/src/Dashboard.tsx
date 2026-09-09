import { useEffect, useMemo, useState } from 'react'
import {
  allQuarters,
  askingMarketPulses,
  askingPriceReferences,
  commissioningRecords,
  priceRows,
  sourceLinks,
  visibleQuarters,
  type AskingPriceReference,
  type City,
  type Metric,
  type PriceRow,
} from './content'
import SoldVsAskingTrend from './SoldVsAskingTrend'

type CityChoice = City | 'All'
type RangeChoice = 'focus' | 'full'
type SortKey = 'quarter' | 'city' | 'index' | 'qoq' | 'yoy'
type AskingSourceChoice = 'All' | 'imot.bg' | 'Yavlena'
type AskingSortKey = 'recordDateIso' | 'source' | 'city' | 'askingPriceEur' | 'eurSqm'

interface CommercialApiResponse {
  records: AskingPriceReference[]
  meta?: {
    refreshedAt?: string | null
    dataSource?: 'runtime' | 'seed'
    refreshEnabled?: boolean
    nextRefreshAllowedAt?: string | null
    warning?: string | null
  }
  refresh?: {
    added?: number
    updated?: number
    unchanged?: number
    rejected?: number
    sources?: Array<{ source: string; status: 'ok' | 'error'; error?: string }>
  }
}

type RefreshPhase = 'checking' | 'ready' | 'refreshing' | 'success' | 'error' | 'unavailable'

const metricMeta: Record<Metric, { label: string; unit: string; description: string }> = {
  index: { label: 'Index', unit: 'index', description: 'NSI new-dwelling HPI, 2025 = 100' },
  yoy: { label: 'YoY', unit: '%', description: 'Change from the same quarter one year earlier' },
  qoq: { label: 'QoQ', unit: '%', description: 'Change from the immediately preceding quarter' },
}

const formatPct = (value: number | null, digits = 1) => {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

const formatEuro = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits }).format(value)

const ExternalIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
    <path d="M6 3h7v7M13 3 6.5 9.5M11 8v5H3V5h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const DownloadIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18">
    <path d="M9 2v9m0 0 3-3m-3 3L6 8M3 14.5h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const RefreshIcon = ({ spinning = false }: { spinning?: boolean }) => (
  <svg className={spinning ? 'refresh-icon spinning' : 'refresh-icon'} aria-hidden="true" viewBox="0 0 18 18" width="18" height="18">
    <path d="M14.8 7.2A6 6 0 0 0 4 4.6L2.7 6M3.2 10.8A6 6 0 0 0 14 13.4l1.3-1.4M2.7 2.9V6h3.1m9.5 9.1V12h-3.1" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SearchIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18">
    <circle cx="8" cy="8" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="m11.5 11.5 3.25 3.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const Logo = () => (
  <a className="brand" href="#top" aria-label="Dwelling Lens home">
    <svg className="brand-mark" aria-hidden="true" viewBox="0 0 42 42">
      <path d="M5 20.5 21 7l16 13.5V37H5Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 37V23h16v14M13 29h16M21 23v14" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32.5" cy="10.5" r="4.5" fill="var(--coral)" stroke="var(--ivory)" strokeWidth="2" />
    </svg>
    <span>
      <strong>Dwelling Lens</strong>
      <small>Bulgaria</small>
    </span>
  </a>
)

function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="control-group">
      <span className="control-label">{label}</span>
      <div className="segment" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? 'active' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ChartPoint {
  city: City
  quarter: string
  value: number
  x: number
  y: number
}

function PriceChart({ city, metric, range }: { city: CityChoice; metric: Metric; range: RangeChoice }) {
  const [activePoint, setActivePoint] = useState<ChartPoint | null>(null)
  const width = 960
  const height = 390
  const frame = { left: 66, right: 30, top: 28, bottom: 58 }
  const chartWidth = width - frame.left - frame.right
  const chartHeight = height - frame.top - frame.bottom
  const quarters = range === 'focus' ? visibleQuarters : allQuarters
  const selectedCities: City[] = city === 'All' ? ['Sofia', 'Plovdiv'] : [city]

  const { series, ticks, yMin, yMax } = useMemo(() => {
    const values = priceRows
      .filter((row) => quarters.includes(row.quarter) && selectedCities.includes(row.city))
      .map((row) => row[metric])
      .filter((value): value is number => value !== null)
    const low = Math.min(...values)
    const high = Math.max(...values)
    const padding = Math.max((high - low) * 0.14, metric === 'index' ? 2 : 1)
    const min = low - padding
    const max = high + padding
    const getX = (quarter: string) =>
      frame.left + (quarters.indexOf(quarter) / Math.max(quarters.length - 1, 1)) * chartWidth
    const getY = (value: number) => frame.top + ((max - value) / (max - min)) * chartHeight
    const builtSeries = selectedCities.map((selectedCity) => ({
      city: selectedCity,
      points: quarters
        .map((quarter) => {
          const row = priceRows.find((item) => item.city === selectedCity && item.quarter === quarter)
          const value = row?.[metric]
          return value === null || value === undefined
            ? null
            : { city: selectedCity, quarter, value, x: getX(quarter), y: getY(value) }
        })
        .filter((point): point is ChartPoint => point !== null),
    }))
    return {
      series: builtSeries,
      ticks: Array.from({ length: 5 }, (_, index) => max - ((max - min) / 4) * index),
      yMin: min,
      yMax: max,
    }
  }, [chartHeight, chartWidth, city, metric, quarters, selectedCities])

  const latestSummary = selectedCities
    .map((selectedCity) => {
      const row = priceRows.find((item) => item.city === selectedCity && item.quarter === '2026 Q1')
      return `${selectedCity} ${row?.[metric] !== null ? (metric === 'index' ? row?.index.toFixed(2) : formatPct(row?.[metric] ?? null)) : 'not available'}`
    })
    .join('; ')

  return (
    <div className="chart-shell">
      <div className="chart-title-row">
        <div>
          <span className="chart-kicker">{metricMeta[metric].description}</span>
          <strong>{range === 'focus' ? 'Q2 2024–Q1 2026' : 'Q1 2024–Q1 2026'}</strong>
        </div>
        <div className="legend" aria-label="Chart legend">
          {selectedCities.map((selectedCity) => (
            <span key={selectedCity}><i className={selectedCity.toLowerCase()} />{selectedCity}</span>
          ))}
        </div>
      </div>
      <div className="chart-scroll">
        <svg
          className="price-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${metricMeta[metric].description}. ${latestSummary}.`}
          onMouseLeave={() => setActivePoint(null)}
        >
          <defs>
            <linearGradient id="sofia-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ed725d" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ed725d" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => {
            const y = frame.top + ((yMax - tick) / (yMax - yMin)) * chartHeight
            return (
              <g key={tick}>
                <line x1={frame.left} x2={width - frame.right} y1={y} y2={y} className="grid-line" />
                <text x={frame.left - 12} y={y + 4} textAnchor="end" className="axis-label">
                  {metric === 'index' ? tick.toFixed(0) : `${tick.toFixed(0)}%`}
                </text>
              </g>
            )
          })}
          {metric !== 'index' && yMin < 0 && yMax > 0 && (
            <line
              x1={frame.left}
              x2={width - frame.right}
              y1={frame.top + (yMax / (yMax - yMin)) * chartHeight}
              y2={frame.top + (yMax / (yMax - yMin)) * chartHeight}
              className="zero-line"
            />
          )}
          {quarters.map((quarter, index) => {
            const x = frame.left + (index / Math.max(quarters.length - 1, 1)) * chartWidth
            return (
              <text key={quarter} x={x} y={height - 22} textAnchor="middle" className="axis-label x-axis">
                {quarter.replace('20', '’')}
              </text>
            )
          })}
          {series.map(({ city: seriesCity, points }) => {
            const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
            return (
              <g key={seriesCity} className={`series ${seriesCity.toLowerCase()}`}>
                <path d={path} className="series-line halo" />
                <path d={path} className="series-line" />
                {points.map((point) => (
                  <circle
                    key={`${seriesCity}-${point.quarter}`}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    className="data-point"
                    tabIndex={0}
                    role="button"
                    aria-label={`${seriesCity}, ${point.quarter}, ${metric === 'index' ? point.value.toFixed(2) : formatPct(point.value)}`}
                    onMouseEnter={() => setActivePoint(point)}
                    onFocus={() => setActivePoint(point)}
                    onBlur={() => setActivePoint(null)}
                  />
                ))}
              </g>
            )
          })}
          {activePoint && (
            <g className="chart-tooltip" aria-hidden="true">
              <line x1={activePoint.x} x2={activePoint.x} y1={frame.top} y2={height - frame.bottom} />
              <rect
                x={Math.min(activePoint.x + 12, width - 176)}
                y={Math.max(activePoint.y - 46, 8)}
                width="164"
                height="62"
                rx="8"
              />
              <text x={Math.min(activePoint.x + 24, width - 164)} y={Math.max(activePoint.y - 22, 32)} className="tooltip-title">
                {activePoint.city} · {activePoint.quarter}
              </text>
              <text x={Math.min(activePoint.x + 24, width - 164)} y={Math.max(activePoint.y - 2, 52)} className="tooltip-value">
                {metric === 'index' ? activePoint.value.toFixed(2) : formatPct(activePoint.value)}
              </text>
            </g>
          )}
        </svg>
      </div>
      <p className="chart-footnote">
        Hover or focus a point for its value. NSI-published one-decimal change rates are shown; they can differ slightly from rates derived from rounded index levels.
      </p>
    </div>
  )
}

function SortButton<T extends string>({ field, active, direction, onSort, children }: {
  field: T
  active: boolean
  direction: 'asc' | 'desc'
  onSort: (field: T) => void
  children: React.ReactNode
}) {
  return (
    <button type="button" className="sort-button" onClick={() => onSort(field)}>
      {children}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
    </button>
  )
}

function MarketDatabase() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'quarter', direction: 'desc' })
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return priceRows
      .filter((row) => visibleQuarters.includes(row.quarter))
      .filter((row) => !normalized || `${row.quarter} ${row.city}`.toLowerCase().includes(normalized))
      .sort((a, b) => {
        const left = a[sort.key]
        const right = b[sort.key]
        if (left === null) return 1
        if (right === null) return -1
        const result = typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))
        return sort.direction === 'asc' ? result : -result
      })
  }, [query, sort])

  const onSort = (key: SortKey) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }))
  }

  const exportCsv = () => {
    const header = ['quarter', 'city', 'new_dwelling_hpi_2025_100', 'qoq_percent', 'yoy_percent', 'scope']
    const body = rows.map((row) => [row.quarter, row.city, row.index.toFixed(2), row.qoq?.toFixed(1) ?? '', row.yoy?.toFixed(1) ?? '', 'NSI quality-adjusted new-dwelling transactions'])
    const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dwelling-lens-new-dwelling-hpi.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="database-card">
      <div className="database-toolbar">
        <label className="search-field">
          <span className="sr-only">Search by city or quarter</span>
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search city or quarter…" />
        </label>
        <span className="row-count" aria-live="polite">{rows.length} rows</span>
        <button type="button" className="button secondary compact" onClick={exportCsv} disabled={!rows.length}>
          <DownloadIcon /> Export CSV
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table market-table">
          <caption className="sr-only">Official NSI quarterly new-dwelling house price indices for Sofia and Plovdiv</caption>
          <thead>
            <tr>
              <th><SortButton field="quarter" active={sort.key === 'quarter'} direction={sort.direction} onSort={onSort}>Quarter</SortButton></th>
              <th><SortButton field="city" active={sort.key === 'city'} direction={sort.direction} onSort={onSort}>City</SortButton></th>
              <th className="numeric"><SortButton field="index" active={sort.key === 'index'} direction={sort.direction} onSort={onSort}>Index</SortButton></th>
              <th className="numeric"><SortButton field="qoq" active={sort.key === 'qoq'} direction={sort.direction} onSort={onSort}>QoQ</SortButton></th>
              <th className="numeric"><SortButton field="yoy" active={sort.key === 'yoy'} direction={sort.direction} onSort={onSort}>YoY</SortButton></th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.city}-${row.quarter}`}>
                <td data-label="Quarter"><strong>{row.quarter}</strong></td>
                <td data-label="City"><span className={`city-chip ${row.city.toLowerCase()}`}>{row.city}</span></td>
                <td data-label="Index" className="numeric mono">{row.index.toFixed(2)}</td>
                <td data-label="QoQ" className={`numeric mono ${row.qoq !== null && row.qoq < 0 ? 'negative' : ''}`}>{formatPct(row.qoq)}</td>
                <td data-label="YoY" className={`numeric mono ${row.yoy !== null && row.yoy < 0 ? 'negative' : ''}`}>{formatPct(row.yoy)}</td>
                <td data-label="Coverage"><span className="scope-chip">New dwellings</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty-state">No rows match “{query}”.</div>}
      </div>
      <div className="database-note">
        <span aria-hidden="true">i</span>
        <p><strong>Official index, not €/m².</strong> This NSI table contains quality-adjusted changes in household transaction prices. Publishing a unit price here would invent a measure the source does not provide.</p>
      </div>
    </div>
  )
}

function AskingPriceReferences() {
  const [city, setCity] = useState<CityChoice>("All")
  const [source, setSource] = useState<AskingSourceChoice>("All")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<{ key: AskingSortKey; direction: "asc" | "desc" }>({ key: "recordDateIso", direction: "desc" })
  const [allRecords, setAllRecords] = useState<AskingPriceReference[]>(() =>
    [...askingPriceReferences].sort((a, b) => b.recordDateIso.localeCompare(a.recordDateIso) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id)),
  )
  const [refreshPhase, setRefreshPhase] = useState<RefreshPhase>("checking")
  const [refreshMessage, setRefreshMessage] = useState("Checking the refresh service…")
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [nextRefreshAllowedAt, setNextRefreshAllowedAt] = useState<string | null>(null)
  const refreshOnCooldown = Boolean(nextRefreshAllowedAt && new Date(nextRefreshAllowedAt).getTime() > Date.now())

  useEffect(() => {
    if (!nextRefreshAllowedAt) return
    const delay = new Date(nextRefreshAllowedAt).getTime() - Date.now()
    if (delay <= 0) {
      setNextRefreshAllowedAt(null)
      return
    }
    const timeout = window.setTimeout(() => setNextRefreshAllowedAt(null), delay)
    return () => window.clearTimeout(timeout)
  }, [nextRefreshAllowedAt])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const loadCommercialRecords = async () => {
      try {
        const response = await fetch("/api/commercial", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Refresh service unavailable")
        const payload = await response.json() as CommercialApiResponse
        if (!Array.isArray(payload.records)) throw new Error("Invalid refresh response")
        if (!active) return
        setAllRecords([...payload.records].sort((a, b) => b.recordDateIso.localeCompare(a.recordDateIso) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id)))
        setLastRefreshedAt(payload.meta?.refreshedAt ?? null)
        setNextRefreshAllowedAt(payload.meta?.nextRefreshAllowedAt ?? null)
        setRefreshPhase(payload.meta?.refreshEnabled === false ? "unavailable" : "ready")
        setRefreshMessage(payload.meta?.refreshEnabled === false ? "Live refresh is disabled on this deployment. The saved database remains available." : payload.meta?.dataSource === "runtime" ? "Saved database loaded · newest records first." : "Curated seed loaded · newest records first.")
      } catch {
        if (!active || controller.signal.aborted) return
        setRefreshPhase("unavailable")
        setRefreshMessage("Live refresh is unavailable on this static host. Showing the bundled snapshot newest first.")
      }
    }

    void loadCommercialRecords()
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const refreshRecords = async () => {
    setRefreshPhase("refreshing")
    setRefreshMessage("Scanning imot.bg and Yavlena for recent qualifying records…")
    try {
      const response = await fetch("/api/commercial/refresh", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
      })
      const payload = await response.json().catch(() => null) as (CommercialApiResponse & { error?: string | { message?: string } }) | null
      if (!response.ok || !payload || !Array.isArray(payload.records)) {
        const apiError = typeof payload?.error === "string" ? payload.error : payload?.error?.message
        throw new Error(apiError || "The refresh service did not return a usable database.")
      }
      const ordered = [...payload.records].sort((a, b) => b.recordDateIso.localeCompare(a.recordDateIso) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id))
      setAllRecords(ordered)
      setSort({ key: "recordDateIso", direction: "desc" })
      setLastRefreshedAt(payload.meta?.refreshedAt ?? new Date().toISOString())
      setNextRefreshAllowedAt(payload.meta?.nextRefreshAllowedAt ?? null)
      const summary = payload.refresh
      const failedSources = summary?.sources?.filter((item) => item.status === "error") ?? []
      const totals = "+" + (summary?.added ?? 0) + " new, " + (summary?.updated ?? 0) + " updated, " + (summary?.rejected ?? 0) + " rejected"
      setRefreshPhase("success")
      setRefreshMessage(failedSources.length ? "Partial refresh: " + totals + ". " + failedSources.map((item) => item.source + " failed").join(", ") + "; previous rows were retained." : "Refresh complete: " + totals + ". Newest records are shown first.")
    } catch (error) {
      setRefreshPhase("error")
      setRefreshMessage((error instanceof Error ? error.message : "Refresh failed") + " Previous records were retained; you can retry.")
    }
  }


  const records = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return allRecords
      .filter((record) => city === "All" || record.city === city)
      .filter((record) => source === "All" || record.source === source)
      .filter((record) => !normalized || [record.id, record.source, record.city, record.district, record.property, record.act16Claim, record.finish, record.caveat ?? ""].join(" ").toLowerCase().includes(normalized))
      .sort((a, b) => {
        const left = a[sort.key]
        const right = b[sort.key]
        const result = typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right))
        return sort.direction === "asc" ? result : -result
      })
  }, [allRecords, city, source, query, sort])

  const sampleStats = useMemo(() => {
    const unitPrices = records.map((record) => record.eurSqm).sort((a, b) => a - b)
    const askingPrices = records.map((record) => record.askingPriceEur).sort((a, b) => a - b)
    const median = (values: number[]) => {
      if (!values.length) return null
      const middle = Math.floor(values.length / 2)
      return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
    }
    return {
      medianUnit: median(unitPrices),
      medianAsking: median(askingPrices),
      lowUnit: unitPrices[0] ?? null,
      highUnit: unitPrices.at(-1) ?? null,
    }
  }, [records])

  const onSort = (key: AskingSortKey) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }))
  }

  const exportCsv = () => {
    const header = ["source", "record_id", "source_record_id", "record_date", "city", "district", "property", "area_sqm", "asking_price_eur", "asking_eur_sqm", "act16_claim_unverified", "finish_vat_note", "record_caveat", "source_url"]
    const body = records.map((record) => [record.source, record.id, record.sourceRecordId ?? record.id, record.recordDateIso, record.city, record.district, record.property, record.areaSqm, record.askingPriceEur, record.eurSqm, record.act16Claim, record.finish, record.caveat ?? "", record.sourceUrl])
    const escapeCsv = (value: unknown) => "\"" + String(value).replaceAll("\"", "\"\"") + "\""
    const csv = [header, ...body].map((line) => line.map(escapeCsv).join(",")).join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "dwelling-lens-commercial-asking-references.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="asking-pulse-grid" aria-label="Commercial asking-price context">
        {askingMarketPulses.map((pulse) => (
          <article className="asking-pulse-card" key={pulse.source + pulse.city}>
            <div className="asking-card-topline">
              <span className={"source-chip " + (pulse.source === "imot.bg" ? "imot" : "yavlena")}>{pulse.source}</span>
              <span className={"city-chip " + pulse.city.toLowerCase()}>{pulse.city}</span>
            </div>
            <strong className="asking-value">{pulse.value}</strong>
            <time dateTime={pulse.dateIso}>{pulse.date}</time>
            <p>{pulse.scope}</p>
            <a href={pulse.sourceUrl} target="_blank" rel="noreferrer" aria-label={"Open " + pulse.source + " " + pulse.city + " asking-price source in a new tab"}>View source <ExternalIcon /></a>
          </article>
        ))}
      </div>

      <SoldVsAskingTrend records={allRecords} snapshotAt={lastRefreshedAt} />

      <div className="database-card asking-database">
        <div className="database-toolbar asking-toolbar">
          <Segment
            label="City"
            options={[{ value: "All", label: "All" }, { value: "Sofia", label: "Sofia" }, { value: "Plovdiv", label: "Plovdiv" }] as const}
            value={city}
            onChange={setCity}
          />
          <Segment
            label="Source"
            options={[{ value: "All", label: "All" }, { value: "imot.bg", label: "imot.bg" }, { value: "Yavlena", label: "Yavlena" }] as const}
            value={source}
            onChange={setSource}
          />
          <label className="search-field asking-search">
            <span className="sr-only">Search commercial asking-price references</span>
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search district, type or ID…" />
          </label>
          <span className="row-count" aria-live="polite">{records.length} of {allRecords.length}</span>
          <button
            type="button"
            className="button primary compact refresh-button"
            onClick={refreshRecords}
            disabled={refreshPhase === "checking" || refreshPhase === "refreshing" || refreshPhase === "unavailable" || refreshOnCooldown}
            aria-busy={refreshPhase === "refreshing"}
            title={refreshPhase === "unavailable" ? "Run the app with its Node server to enable live refresh" : refreshOnCooldown ? "A source-protection cooldown is active; refresh will unlock automatically" : undefined}
          >
            <RefreshIcon spinning={refreshPhase === "refreshing"} /> {refreshPhase === "checking" ? "Checking…" : refreshPhase === "refreshing" ? "Refreshing…" : refreshOnCooldown ? "Available soon" : "Refresh records"}
          </button>
          <button type="button" className="button secondary compact" onClick={exportCsv} disabled={!records.length}>
            <DownloadIcon /> Export CSV
          </button>
        </div>
        <div className={"refresh-status " + refreshPhase} role="status" aria-live="polite">
          <span className="refresh-state-dot" aria-hidden="true" />
          <div>
            <strong>Commercial database</strong>
            <small>{refreshMessage}</small>
          </div>
          {lastRefreshedAt && (
            <time dateTime={lastRefreshedAt}>Saved {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastRefreshedAt))}</time>
          )}
        </div>
        <div className="asking-summary-grid" aria-live="polite">
          <article><span>Filtered records</span><strong>{records.length}</strong><small>linked offers</small></article>
          <article><span>Sample median</span><strong>{sampleStats.medianUnit === null ? "—" : formatEuro(sampleStats.medianUnit, 2) + "/m²"}</strong><small>asking €/m²</small></article>
          <article><span>Median asking</span><strong>{sampleStats.medianAsking === null ? "—" : formatEuro(sampleStats.medianAsking)}</strong><small>per listing</small></article>
          <article><span>Sample spread</span><strong>{sampleStats.lowUnit === null || sampleStats.highUnit === null ? "—" : formatEuro(sampleStats.lowUnit, 2) + "–" + formatEuro(sampleStats.highUnit, 2)}</strong><small>asking €/m²</small></article>
        </div>
        <div className="table-wrap">
          <table className="data-table asking-table">
            <caption className="sr-only">Manually screened asking-price listings that state recent Act 16 status</caption>
            <thead>
              <tr>
                <th><SortButton field="source" active={sort.key === "source"} direction={sort.direction} onSort={onSort}>Source record</SortButton></th>
                <th><SortButton field="recordDateIso" active={sort.key === "recordDateIso"} direction={sort.direction} onSort={onSort}>Date</SortButton></th>
                <th><SortButton field="city" active={sort.key === "city"} direction={sort.direction} onSort={onSort}>City / area</SortButton></th>
                <th>Property</th>
                <th className="numeric"><SortButton field="askingPriceEur" active={sort.key === "askingPriceEur"} direction={sort.direction} onSort={onSort}>Asking price</SortButton></th>
                <th className="numeric"><SortButton field="eurSqm" active={sort.key === "eurSqm"} direction={sort.direction} onSort={onSort}>€/m²</SortButton></th>
                <th>Act 16 claim</th><th>Finish / VAT note</th><th><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.source + (record.sourceRecordId ?? record.id)}>
                  <td data-label="Source"><span className={"source-chip " + (record.source === "imot.bg" ? "imot" : "yavlena")}>{record.source}</span><small className="record-id">ID {record.id}</small></td>
                  <td data-label="Date"><time dateTime={record.recordDateIso}>{record.recordDate}</time></td>
                  <td data-label="City / area"><span className={"city-chip " + record.city.toLowerCase()}>{record.city}</span><small className="record-area">{record.district}</small></td>
                  <td data-label="Property">{record.property}<small className="record-area">{record.areaSqm} m²</small></td>
                  <td data-label="Asking price" className="numeric mono">{formatEuro(record.askingPriceEur)}</td>
                  <td data-label="Asking €/m²" className="numeric mono">{formatEuro(record.eurSqm, 2)}/m²</td>
                  <td data-label="Act 16 claim"><strong>{record.act16Claim}</strong><small className="claim-label">Advertiser-stated</small></td>
                  <td data-label="Finish / VAT" className="muted-cell">{record.finish}{record.caveat && <small className="record-caveat">{record.caveat}</small>}</td>
                  <td data-label="Source link"><a className="icon-link" href={record.sourceUrl} target="_blank" rel="noreferrer" aria-label={"Open " + record.source + " record " + record.id + " in a new tab"}><ExternalIcon /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && <div className="empty-state">No commercial records match the current filters.</div>}
        </div>
        <div className="database-note asking-note">
          <span aria-hidden="true">!</span>
          <p><strong>Asking is not achieved.</strong> These {allRecords.length} linked records are ordered by listing date. Refresh scans only recent public candidates with an explicit completed Act 16 or commissioning claim; wording remains advertiser-supplied and unmatched to a municipal record. Availability, finish, VAT treatment and price can change.</p>
        </div>
      </div>
    </>
  )
}

function CommissioningDatabase() {
  const [city, setCity] = useState<CityChoice>('All')
  const [query, setQuery] = useState('')
  const records = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return commissioningRecords.filter((record) =>
      (city === 'All' || record.city === city) &&
      (!normalized || `${record.certificate} ${record.project} ${record.district} ${record.location}`.toLowerCase().includes(normalized)),
    )
  }, [city, query])

  return (
    <div className="database-card commissioning-card">
      <div className="database-toolbar commissioning-toolbar">
        <Segment
          label="City"
          options={[{ value: 'All', label: 'All' }, { value: 'Sofia', label: 'Sofia' }, { value: 'Plovdiv', label: 'Plovdiv' }] as const}
          value={city}
          onChange={setCity}
        />
        <label className="search-field">
          <span className="sr-only">Search commissioning records</span>
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project or district…" />
        </label>
        <span className="row-count" aria-live="polite">{records.length} records</span>
      </div>
      <div className="table-wrap">
        <table className="data-table records-table">
          <caption className="sr-only">Non-exhaustive sample of recent Sofia and Plovdiv commissioning records</caption>
          <thead>
            <tr><th>Record</th><th>Date</th><th>City</th><th>Project</th><th>District / area</th><th>Site</th><th><span className="sr-only">Open</span></th></tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={`${record.city}-${record.certificate}`}>
                <td data-label="Record"><strong>{record.certificate}</strong>{record.city === 'Plovdiv' && <small>Category {record.category}</small>}</td>
                <td data-label="Date"><time dateTime={record.dateIso}>{record.date}</time></td>
                <td data-label="City"><span className={`city-chip ${record.city.toLowerCase()}`}>{record.city}</span></td>
                <td data-label="Project" className="project-cell">{record.project}</td>
                <td data-label="District">{record.district}</td>
                <td data-label="Site" className="muted-cell">{record.location}</td>
                <td data-label="Source">
                  <a className="icon-link" href={record.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open official record ${record.certificate}`}><ExternalIcon /></a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && <div className="empty-state">No records match the current filters.</div>}
      </div>
    </div>
  )
}

const events = [
  { date: '01 Oct 2024', label: 'Credit guardrails', text: 'BNB limits take effect: LTV ≤85%, DSTI ≤50%, and maturity ≤30 years, with a 5% volume allowance for deviations.', tone: 'navy' },
  { date: '08 Jul 2025', label: 'Final euro acts', text: 'The Council completes the legal steps for Bulgaria to join the euro area.', tone: 'coral' },
  { date: '08 Aug 2025', label: 'Dual display begins', text: 'Mandatory lev/euro price display starts, making conversion more visible to buyers.', tone: 'gold' },
  { date: '01 Jan 2026', label: 'Euro adopted', text: 'Bulgaria adopts the euro at the fixed rate €1 = BGN 1.95583.', tone: 'coral' },
  { date: '24 Jun 2026', label: 'Q1 HPI released', text: 'NSI publishes the preliminary first-quarter reading used as this dashboard’s latest price observation.', tone: 'green' },
]

export default function Dashboard() {
  const [chartCity, setChartCity] = useState<CityChoice>('All')
  const [metric, setMetric] = useState<Metric>('index')
  const [range, setRange] = useState<RangeChoice>('focus')

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header" id="top">
        <div className="header-inner">
          <Logo />
          <nav aria-label="Primary navigation">
            <a href="#prices">Price pulse</a>
            <a href="#database">Database</a>
            <a href="#asking">Asking prices</a>
            <a href="#commissioning">Commissioning</a>
            <a href="#outlook">Drivers</a>
          </nav>
          <a className="method-link" href="#methodology">Method <span aria-hidden="true">↘</span></a>
        </div>
      </header>

      <main id="main">
        <section className="hero section-shell">
          <div className="hero-copy">
            <div className="eyebrow"><span /> New-build housing · official data + linked market context</div>
            <h1>New homes.<br />Two cities.<br /><em>One honest lens.</em></h1>
            <p className="hero-lede">
              Official price dynamics and recent commissioning evidence for Sofia and Plovdiv, plus a separate asking-price reference layer—clearly dated and never presented as completed sales.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#prices">Explore the data <span aria-hidden="true">↓</span></a>
              <a className="text-link" href="#methodology">Read how to use it <span aria-hidden="true">→</span></a>
            </div>
            <div className="hero-meta">
              <span><i className="status-dot" /> Updated 31 Jul 2026</span>
              <span>Latest price quarter: Q1 2026</span>
            </div>
          </div>

          <div className="hero-panel" aria-label="Latest price readings">
            <div className="panel-topline">
              <span>Latest official reading · preliminary</span>
              <span className="live-pill"><i /> Q1 2026</span>
            </div>
            <div className="hero-city-grid">
              <article>
                <div className="city-heading"><span className="city-symbol sofia">S</span><span>Sofia<small>New dwellings</small></span></div>
                <strong className="hero-number">+16.2%</strong>
                <span className="hero-number-label">year on year</span>
                <div className="micro-stat"><span>Quarter on quarter</span><strong>+4.7%</strong></div>
                <div className="mini-bar"><i style={{ width: '82%' }} /></div>
              </article>
              <article>
                <div className="city-heading"><span className="city-symbol plovdiv">P</span><span>Plovdiv<small>New dwellings</small></span></div>
                <strong className="hero-number">+1.9%</strong>
                <span className="hero-number-label">year on year</span>
                <div className="micro-stat"><span>Quarter on quarter</span><strong className="down">−0.3%</strong></div>
                <div className="mini-bar plovdiv"><i style={{ width: '29%' }} /></div>
              </article>
            </div>
            <div className="panel-footer"><span>NSI new-dwelling HPI</span><span>2025 = 100</span></div>
          </div>
        </section>

        <section className="pulse-strip section-shell" aria-label="Key market indicators">
          <article className="pulse-card featured">
            <span className="card-index">01 / price gap</span>
            <div><strong>14.3 pp</strong><span>Sofia–Plovdiv YoY divergence</span></div>
            <p>Same euro transition, markedly different city outcome.</p>
          </article>
          <article className="pulse-card">
            <span className="card-index">02 / inflation</span>
            <div><strong>2.8%</strong><span>Bulgaria HICP YoY</span></div>
            <p>March 2026, the HPI quarter-end comparator.</p>
          </article>
          <article className="pulse-card">
            <span className="card-index">03 / financing</span>
            <div><strong>+26.4%</strong><span>Housing-credit stock YoY</span></div>
            <p>June 2026 pulse—later than the price quarter.</p>
          </article>
          <article className="pulse-card">
            <span className="card-index">04 / currency</span>
            <div><strong>€1</strong><span>= BGN 1.95583</span></div>
            <p>Fixed conversion; dual display through 8 Aug 2026.</p>
          </article>
        </section>

        <section className="section section-shell" id="prices">
          <div className="section-heading split-heading">
            <div>
              <span className="section-number">01 / Price pulse</span>
              <h2>The cities have <em>split apart.</em></h2>
            </div>
            <p>Sofia accelerated into Q1 2026. Plovdiv’s index was nearly flat year on year after a much more volatile path.</p>
          </div>
          <div className="chart-controls">
            <Segment label="City" options={[{ value: 'All', label: 'All cities' }, { value: 'Sofia', label: 'Sofia' }, { value: 'Plovdiv', label: 'Plovdiv' }] as const} value={chartCity} onChange={setChartCity} />
            <Segment label="Metric" options={[{ value: 'index', label: 'Index' }, { value: 'yoy', label: 'YoY %' }, { value: 'qoq', label: 'QoQ %' }] as const} value={metric} onChange={setMetric} />
            <Segment label="Window" options={[{ value: 'focus', label: 'Latest 8Q' }, { value: 'full', label: '+ baseline' }] as const} value={range} onChange={setRange} />
          </div>
          <PriceChart city={chartCity} metric={metric} range={range} />
          <div className="insight-row">
            <article><span className="insight-mark coral">A</span><p><strong>Sofia’s nominal–HICP gap: +13.4 pp.</strong> Q1 2026 HPI YoY minus March 2026 HICP YoY; a comparison, not a formal real-price index.</p></article>
            <article><span className="insight-mark navy">B</span><p><strong>Plovdiv’s gap: −0.9 pp.</strong> Its new-dwelling HPI trailed the March HICP comparator, underlining that national events do not move every city alike.</p></article>
          </div>
        </section>

        <section className="definition-band">
          <div className="section-shell definition-grid">
            <div className="definition-title">
              <span className="definition-icon" aria-hidden="true">§</span>
              <div><span className="section-number light">Eligibility note</span><h2>“Act 16” is shorthand,<br /><em>not a database key.</em></h2></div>
            </div>
            <div className="definition-copy">
              <p>Final commissioning is evidenced by a <strong>use permit or commissioning certificate</strong>, depending on construction category. Municipal certificate registers principally cover categories IV/V; categories I–III are issued through DNCC/DNSK and require a separate feed.</p>
              <div className="definition-points">
                <span><i>01</i> Register entries confirm commissioning—not sale price.</span>
                <span><i>02</i> “Past two years” cutoff: 31 Jul 2024–31 Jul 2026.</span>
                <span><i>03</i> The curated records below are a sample, not the whole universe.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-shell" id="database">
          <div className="section-heading split-heading database-heading">
            <div><span className="section-number">02 / Market database</span><h2>Quarterly data,<br /><em>ready to inspect.</em></h2></div>
            <div className="heading-side"><span className="verified-pill"><i>✓</i> Official NSI series · Q1 preliminary</span><p>Latest eight published quarters by default. Sort any column, search, or export exactly what is visible.</p></div>
          </div>
          <MarketDatabase />
        </section>

        <section className="section section-shell asking-section" id="asking">
          <div className="section-heading split-heading database-heading">
            <div><span className="section-number">Supplement / commercial references</span><h2>What sellers are<br /><em>asking right now.</em></h2></div>
            <div className="heading-side"><span className="asking-pill">{askingPriceReferences.length} linked baseline records · refreshed 31 Aug 2026</span><p>Server-screened imot.bg and Yavlena offers with a stated 2025–2026 Act 16 or commissioning claim, kept outside the official datasets.</p></div>
          </div>
          <AskingPriceReferences />
        </section>

        <section className="section section-shell commissioning-section" id="commissioning">
          <div className="section-heading split-heading database-heading">
            <div><span className="section-number">03 / Commissioning evidence</span><h2>Recent records,<br /><em>building by building.</em></h2></div>
            <div className="heading-side"><span className="sample-pill">Non-exhaustive sample</span><p>Manually curated municipal register entries inside the two-year cutoff. Every row links back to its official detail page.</p></div>
          </div>
          <CommissioningDatabase />
          <div className="register-notes">
            <article>
              <span className="city-symbol sofia">S</span>
              <p><strong>Sofia sample.</strong> Nine recent residential records from the city’s commissioning-certificate register, checked through 30 Jul 2026.</p>
              <a href="https://nag.sofia.bg/RegisterCertificateForExploitationBuildings" target="_blank" rel="noreferrer">Open Sofia register <ExternalIcon /></a>
            </article>
            <article>
              <span className="city-symbol plovdiv">P</span>
              <p><strong>Plovdiv sample.</strong> Nine manually audited records. At the 31 Jul 2026 data cut, the fragile legacy endpoint’s newest visible record was dated 27 Mar 2026; adjacent record numbers may be separate phases and are not grouped here.</p>
              <a href="https://www.plovdiv.bg/uslugi/registers/" target="_blank" rel="noreferrer">Open municipal directory <ExternalIcon /></a>
            </article>
          </div>
        </section>

        <section className="trend-section" id="outlook">
          <div className="section-shell">
            <div className="section-heading split-heading inverse">
              <div><span className="section-number light">04 / General trend</span><h2>One transition.<br /><em>Several moving parts.</em></h2></div>
              <p>The euro matters—but the fixed lev peg means conversion itself is arithmetic. Credit, inflation, supply and expectations overlap, so this dashboard does not claim a causal “euro effect.”</p>
            </div>
            <div className="driver-grid">
              <article className="driver-card euro-card">
                <span className="driver-label">Currency regime</span>
                <strong className="big-euro">€</strong>
                <h3>Conversion is not appreciation.</h3>
                <p>Prices convert at €1 = BGN 1.95583. Dual display runs 8 Aug 2025–8 Aug 2026. Re-labelling a price in euros does not by itself raise its economic value.</p>
                <div className="conversion-example"><span>BGN 195,583</span><i>÷ 1.95583</i><strong>€100,000</strong></div>
              </article>
              <article className="driver-card">
                <span className="driver-label">Financing pulse · Jun 2026</span>
                <strong className="driver-number">+26.4%</strong>
                <h3>Credit remains a powerful demand signal.</h3>
                <p>Housing-credit stock grew sharply year on year even after borrower limits, which allow 5% of covered volume to deviate. Stock growth is not the same as transaction-price growth.</p>
                <div className="limit-list"><span><b>≤85%</b> LTV</span><span><b>≤50%</b> DSTI</span><span><b>≤30y</b> maturity</span></div>
              </article>
              <article className="driver-card">
                <span className="driver-label">Inflation pulse</span>
                <strong className="driver-number">5.2%</strong>
                <h3>Latest inflation re-accelerated.</h3>
                <p>June 2026 HICP YoY is the newer macro pulse. It must not be paired as though simultaneous with the Q1 housing-price reading.</p>
                <div className="period-compare"><span><i>Mar · Q1 end</i><b>2.8%</b></span><span><i>June latest</i><b>5.2%</b></span></div>
              </article>
            </div>

            <div className="timeline-block">
              <div className="timeline-heading"><span>Policy & market chronology</span><p>Dates shown are effective or publication dates—not inferred price causes.</p></div>
              <ol className="timeline">
                {events.map((event) => (
                  <li key={event.date}>
                    <span className={`timeline-dot ${event.tone}`} />
                    <time>{event.date}</time>
                    <strong>{event.label}</strong>
                    <p>{event.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="section section-shell methodology-section" id="methodology">
          <div className="section-heading split-heading">
            <div><span className="section-number">05 / Methodology</span><h2>What the lens shows—<br /><em>and what it cannot.</em></h2></div>
            <p>Transparent boundaries matter more than false precision. The two official lenses answer related but different questions; commercial asking references form a separate third layer.</p>
          </div>
          <div className="method-grid">
            <article><span>01</span><h3>Price movement</h3><p>NSI’s HPI measures quality-adjusted household transaction-price change for new dwellings; Q1 2026 is preliminary. It is not limited to homes commissioned inside this site’s two-year register cutoff.</p></article>
            <article><span>02</span><h3>Commissioning status</h3><p>Municipal records evidence final commissioning for covered categories. They contain no transaction price, and they cannot be reliably joined to the aggregate HPI.</p></article>
            <article><span>03</span><h3>Asking ≠ achieved</h3><p>Commercial €/m² references are dated seller or broker offers—not deeds, accepted bids or a market average. Listing Act 16 claims remain unverified until matched to an official record.</p></article>
          </div>
          <div className="method-detail-grid">
            <div className="formula-card">
              <span className="section-number">Calculations</span>
              <dl>
                <div><dt>QoQ</dt><dd>(index<sub>t</sub> ÷ index<sub>t−1</sub> − 1) × 100</dd></div>
                <div><dt>YoY</dt><dd>(index<sub>t</sub> ÷ index<sub>t−4</sub> − 1) × 100</dd></div>
                <div><dt>Nominal–HICP gap</dt><dd>HPI YoY − HICP YoY; descriptive only, not a deflated HPI.</dd></div>
              </dl>
              <p><strong>Rate precision:</strong> the site uses NSI’s published one-decimal QoQ and YoY series. Rates recalculated from rounded index levels can differ by 0.1 percentage point.</p>
              <p><strong>Update cadence:</strong> review after each quarterly NSI HPI release; refresh commissioning samples monthly when endpoints allow. Current cut: 31 Jul 2026.</p>
            </div>
            <div className="sources-card">
              <span className="section-number">Primary sources</span>
              <div className="source-list">
                {sourceLinks.map((source, index) => (
                  <a key={source.href} href={source.href} target="_blank" rel="noreferrer">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span><strong>{source.label}</strong><small>{source.detail}</small></span>
                    <ExternalIcon />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <aside className="caveat-banner">
            <span className="caveat-mark">!</span>
            <div><strong>Coverage boundary</strong><p>Municipal samples principally represent categories IV/V. Consult the separate <a href="https://dnsk.bg/registri/publichen-registar-na-razresheniyata-za-polzvane-izdadeni-ot-dnsk/" target="_blank" rel="noreferrer">DNSK use-permit register</a> for categories I–III. The samples are not a count of all commissioned housing.</p></div>
          </aside>
        </section>
      </main>

      <footer>
        <div className="section-shell footer-grid">
          <div><Logo /><p>A public-data view of new-home price dynamics and commissioning evidence in Bulgaria’s two largest cities.</p></div>
          <div><span>Navigate</span><a href="#prices">Price pulse</a><a href="#database">Database</a><a href="#asking">Asking prices</a><a href="#commissioning">Commissioning</a><a href="#outlook">General trend</a></div>
          <div><span>Data note</span><p>Official indices and commercial asking snapshots remain separate. No listing is treated as an achieved sale or registry match.</p></div>
        </div>
        <div className="section-shell footer-bottom"><span>Dwelling Lens / Bulgaria</span><span>Data cut · 31 July 2026</span></div>
      </footer>
    </>
  )
}
