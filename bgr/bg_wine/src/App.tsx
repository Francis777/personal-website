import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  experienceOptions,
  regionById,
  regions,
  wineries,
  wineStyles,
  type Experience,
  type RegionId,
  type Winery,
  type WineStyle,
} from './data'

type PrimaryView = 'explore' | 'database'
type MobileView = 'list' | 'map'
type SortMode = 'recommended' | 'name' | 'region'
type Panel = 'filters' | 'regions' | 'about' | 'detail' | null

// Simplified Natural Earth 1:110m boundary, projected to a 760 × 500 SVG.
const bulgariaPath = 'M68.8,24 L100.7,85.9 L143.5,74.9 L228.6,98.4 L391.1,106.3 L445.9,67.9 L576.2,32.9 L656.7,87.6 L721.8,103.5 L664.3,165.9 L623.9,273.6 L659.7,359.6 L564.4,339.4 L451.7,386.8 L450.5,461.8 L349.9,476 L271.9,423.4 L183.4,464.8 L101.5,460.4 L93.6,360.8 L38.2,312.4 L56.4,291.2 L44.4,273.3 L63,225.3 L105.2,178.2 L51.5,113.2 L41.5,58.2 L68.8,24 Z'

const cityLabels = [
  { name: 'Sofia', lat: 42.7, lon: 23.32 },
  { name: 'Plovdiv', lat: 42.14, lon: 24.75 },
  { name: 'Veliko Tarnovo', lat: 43.08, lon: 25.62 },
  { name: 'Varna', lat: 43.21, lon: 27.91 },
  { name: 'Burgas', lat: 42.5, lon: 27.47 },
  { name: 'Vidin', lat: 44.0, lon: 22.87 },
]

const project = (lon: number, lat: number) => ({
  x: ((38.2 + (lon - 22.380526) * 0.734504 * 150.6447) / 760) * 100,
  y: ((24 + (44.234923 - lat) * 150.6447) / 500) * 100,
})

const toggleValue = <T extends string>(values: T[], value: T) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value]

const normalize = (value: string) => value.toLocaleLowerCase('en').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function useDialogFocus<T extends HTMLElement>() {
  const dialogRef = useRef<T>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter((element) => element.offsetParent !== null)
    document.body.style.overflow = 'hidden'
    focusable()[0]?.focus()

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', trapFocus)
    return () => {
      dialog.removeEventListener('keydown', trapFocus)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  return dialogRef
}

function Icon({ name, size = 18 }: { name: 'search' | 'filters' | 'heart' | 'map' | 'list' | 'close' | 'arrow' | 'external' | 'grape' | 'pin' | 'download' | 'check' | 'info' | 'route' | 'leaf' | 'chevron'; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="9" cy="9" r="5.5" {...common} /><path d="m13.2 13.2 4.1 4.1" {...common} /></>,
    filters: <><path d="M3 5h14M6 10h8M8.5 15h3" {...common} /><circle cx="7" cy="5" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="10" r="1.4" fill="currentColor" stroke="none" /></>,
    heart: <path d="M10 17.1S3 13 3 7.7C3 4.3 7.2 3 10 6.1 12.8 3 17 4.3 17 7.7 17 13 10 17.1 10 17.1Z" {...common} />,
    map: <><path d="m2.5 4.5 5-2 5 2 5-2v13l-5 2-5-2-5 2Z" {...common} /><path d="M7.5 2.5v13M12.5 4.5v13" {...common} /></>,
    list: <><path d="M7 5h10M7 10h10M7 15h10" {...common} /><circle cx="3.5" cy="5" r=".8" fill="currentColor" /><circle cx="3.5" cy="10" r=".8" fill="currentColor" /><circle cx="3.5" cy="15" r=".8" fill="currentColor" /></>,
    close: <path d="m4 4 12 12M16 4 4 16" {...common} />,
    arrow: <><path d="M3 10h14M12 5l5 5-5 5" {...common} /></>,
    external: <><path d="M11 3h6v6M17 3l-8 8" {...common} /><path d="M15 11v5H4V5h5" {...common} /></>,
    grape: <><circle cx="8" cy="8" r="2.4" {...common} /><circle cx="12.2" cy="8" r="2.4" {...common} /><circle cx="10.1" cy="11.6" r="2.4" {...common} /><circle cx="7.9" cy="14.6" r="2.1" {...common} /><circle cx="12.3" cy="14.6" r="2.1" {...common} /><path d="M10 5.6c.2-2 1.5-3.2 3.6-3.5M11 4c2-.4 3.5.2 4.5 1.8" {...common} /></>,
    pin: <><path d="M10 18s5.5-5.1 5.5-10A5.5 5.5 0 0 0 4.5 8C4.5 12.9 10 18 10 18Z" {...common} /><circle cx="10" cy="8" r="1.8" {...common} /></>,
    download: <><path d="M10 3v10M6.5 9.5 10 13l3.5-3.5M3.5 16.5h13" {...common} /></>,
    check: <path d="m4 10 3.5 3.5L16 5" {...common} />,
    info: <><circle cx="10" cy="10" r="7.5" {...common} /><path d="M10 9v5M10 6.2h.01" {...common} /></>,
    route: <><circle cx="5" cy="5" r="2" {...common} /><circle cx="15" cy="15" r="2" {...common} /><path d="M6.5 6.5c5 1 1.5 5.5 6.9 7" {...common} /></>,
    leaf: <><path d="M17 3C9 3 4 7.1 4 13.2c4.8.8 9.7-1.6 13-10.2Z" {...common} /><path d="M3 17c2.8-4.1 6.1-6.7 10.2-8.3" {...common} /></>,
    chevron: <path d="m6 8 4 4 4-4" {...common} />,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20">{paths[name]}</svg>
}

function Logo() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 42 42">
          <path d="M21 5c1.2 5.8 5.1 8.9 10.7 9.7C27.4 16.2 24 15 21 11.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15.5" cy="18" r="5.2" /><circle cx="25.5" cy="18" r="5.2" />
          <circle cx="20.5" cy="26" r="5.2" /><circle cx="13" cy="27.5" r="4.4" />
          <circle cx="28" cy="27.5" r="4.4" /><circle cx="20.5" cy="34" r="4.2" />
        </svg>
      </span>
      <span><strong>Wine Atlas</strong><small>Bulgaria</small></span>
    </span>
  )
}

function VineyardArt({ winery, index, large = false }: { winery: Winery; index: number; large?: boolean }) {
  const region = regionById[winery.region]
  const sunX = 58 + ((index * 19) % 55)
  const hillShift = (index % 4) * 9
  return (
    <svg className={large ? 'vineyard-art large' : 'vineyard-art'} viewBox="0 0 360 210" role="img" aria-label={`Illustrated vineyard landscape for ${winery.name}`}>
      <defs>
        <linearGradient id={`sky-${winery.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={region.pale} /><stop offset="1" stopColor="#f7efe1" />
        </linearGradient>
        <linearGradient id={`land-${winery.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={region.color} stopOpacity=".82" /><stop offset="1" stopColor="#233f32" />
        </linearGradient>
      </defs>
      <rect width="360" height="210" fill={`url(#sky-${winery.id})`} />
      <circle cx={sunX} cy="49" r="22" fill="#e8bd70" opacity=".78" />
      <path d={`M0 106 Q${55 + hillShift} 53 ${132 + hillShift} 104 T360 91V210H0Z`} fill={region.color} opacity=".22" />
      <path d={`M0 124 Q${85 - hillShift} 76 ${171 + hillShift} 125 T360 108V210H0Z`} fill={region.color} opacity=".46" />
      <path d="M0 150Q92 104 180 149T360 132V210H0Z" fill={`url(#land-${winery.id})`} />
      <g stroke="#ebd9b7" strokeWidth="1.4" opacity=".7">
        <path d="M35 210 142 137M88 210l74-70M146 210l38-68M211 210l-8-67M278 210l-51-63M340 210l-87-70" />
      </g>
      <g transform={`translate(${245 - hillShift} 91)`} fill="#f4ead9" stroke="#4b2a2f" strokeWidth="1.5">
        <path d="M0 28 24 8l28 20v33H0Z" /><path d="M19 61V39h15v22" fill="#6b2838" />
        <path d="M-8 28 24 0l36 28" fill="none" strokeWidth="3" />
      </g>
      <path d="M0 190Q95 164 180 190t180-4" fill="none" stroke="#ead9b7" strokeWidth="2" opacity=".65" />
    </svg>
  )
}

function RegionPill({ id }: { id: RegionId }) {
  const region = regionById[id]
  return <span className="region-pill" style={{ '--region-color': region.color, '--region-pale': region.pale } as CSSProperties}><i />{region.name}</span>
}

interface WineryCardProps {
  winery: Winery
  index: number
  selected: boolean
  saved: boolean
  onSelect: () => void
  onDetails: () => void
  onSave: () => void
  onHover: (id: string | null) => void
}

function WineryCard({ winery, index, selected, saved, onSelect, onDetails, onSave, onHover }: WineryCardProps) {
  return (
    <article
      id={`winery-${winery.id}`}
      className={`winery-card${selected ? ' selected' : ''}`}
      onMouseEnter={() => onHover(winery.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(winery.id)}
      onBlur={() => onHover(null)}
    >
      <button className="card-select" type="button" onClick={onSelect} aria-label={`Select ${winery.name} on the map`} />
      <div className="card-art">
        <VineyardArt winery={winery} index={index} />
        {winery.featured && <span className="curator-badge">Atlas pick</span>}
        <button className={`save-button${saved ? ' saved' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); onSave() }} aria-label={`${saved ? 'Remove' : 'Save'} ${winery.name}`}>
          <Icon name="heart" size={20} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-heading">
          <div><span className="location-line">{winery.locality} · {winery.province}</span><h2>{winery.name}</h2></div>
          {winery.organic && <span className="organic-mark"><Icon name="leaf" size={14} /> Organic</span>}
        </div>
        <RegionPill id={winery.region} />
        <p className="card-summary">{winery.summary}</p>
        <div className="grape-list">
          {winery.grapes.slice(0, 2).map((grape) => <span key={grape}>{grape}</span>)}
          {winery.grapes.length > 2 && <span>+{winery.grapes.length - 2}</span>}
        </div>
        <div className="card-footer">
          <span><Icon name="grape" size={17} /> {winery.styles.slice(0, 2).join(' · ')}</span>
          <button type="button" onClick={(event) => { event.stopPropagation(); onDetails() }}>Details <Icon name="arrow" size={15} /></button>
        </div>
      </div>
    </article>
  )
}

function MapView({ items, selectedId, hoveredId, onSelect, onDetails }: {
  items: Winery[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  onDetails: (id: string) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [showRegions, setShowRegions] = useState(true)
  const selected = items.find((item) => item.id === selectedId) ?? null
  return (
    <section className="map-shell" aria-label="Interactive map of Bulgarian wineries">
      <div className="map-topbar">
        <span><strong>{items.length}</strong> mapped {items.length === 1 ? 'winery' : 'wineries'}</span>
        <button type="button" className={showRegions ? 'active' : ''} aria-pressed={showRegions} onClick={() => setShowRegions((value) => !value)}>
          <span className="region-layer-icon" /> Region wash
        </button>
      </div>
      <div className="map-canvas">
        <div className="map-world" style={{ transform: `scale(${zoom})` }}>
          <svg className="map-base" viewBox="0 0 760 500" aria-hidden="true">
            <defs>
              <clipPath id="country-clip"><path d={bulgariaPath} /></clipPath>
              <pattern id="map-dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#66776e" opacity=".18" /></pattern>
              <filter id="country-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="13" stdDeviation="14" floodColor="#385045" floodOpacity=".14" /></filter>
              <filter id="region-blur"><feGaussianBlur stdDeviation="18" /></filter>
            </defs>
            <rect width="760" height="500" fill="url(#map-dots)" />
            <path d={bulgariaPath} fill="#f7f5ed" stroke="#87958e" strokeWidth="2.2" filter="url(#country-shadow)" />
            <g clipPath="url(#country-clip)" className={showRegions ? 'region-washes visible' : 'region-washes'}>
              <ellipse cx="315" cy="104" rx="330" ry="108" fill={regionById['danube-plain'].pale} filter="url(#region-blur)" />
              <ellipse cx="625" cy="235" rx="100" ry="190" fill={regionById['black-sea'].pale} filter="url(#region-blur)" />
              <ellipse cx="360" cy="260" rx="200" ry="65" fill={regionById['rose-valley'].pale} filter="url(#region-blur)" />
              <ellipse cx="380" cy="405" rx="305" ry="125" fill={regionById['thracian-lowland'].pale} filter="url(#region-blur)" />
              <ellipse cx="120" cy="405" rx="72" ry="125" fill={regionById['struma-valley'].pale} filter="url(#region-blur)" />
            </g>
            <g clipPath="url(#country-clip)" className="terrain-lines">
              <path d="M10 165Q145 125 270 178T505 165t255-3" />
              <path d="M-10 212Q125 167 280 224t250-15 240 18" />
              <path d="M4 286q145-74 290-11t270 3 210-34" />
              <path d="M8 340q145-61 270-10t255 20 235-60" />
              <path d="M-10 401q120-58 250-4t265 4 255-59" />
              <path className="river" d="M22 47q90 22 180 7t175 12 180-1 190-2" />
            </g>
            <g className="map-region-labels">
              {regions.map((region) => {
                const p = project(region.mapLabel.lon, region.mapLabel.lat)
                return <text key={region.id} x={p.x * 7.6} y={p.y * 5} textAnchor="middle">{region.shortName}</text>
              })}
            </g>
            <g className="city-labels">
              {cityLabels.map((city) => {
                const p = project(city.lon, city.lat)
                return <g key={city.name} transform={`translate(${p.x * 7.6} ${p.y * 5})`}><circle r="3" /><text x="8" y="4">{city.name}</text></g>
              })}
            </g>
          </svg>
          <div className="pin-layer">
            {items.map((winery) => {
              const p = project(winery.lon, winery.lat)
              const isActive = winery.id === selectedId || winery.id === hoveredId
              return (
                <button
                  key={winery.id}
                  type="button"
                  className={`map-pin${isActive ? ' active' : ''}${winery.id === selectedId ? ' selected' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, '--pin-color': regionById[winery.region].color } as CSSProperties}
                  onClick={() => onSelect(winery.id)}
                  aria-label={`${winery.name}, ${winery.locality}`}
                >
                  <span><Icon name="grape" size={13} /></span>
                  {isActive && <strong>{winery.name}</strong>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="map-controls" aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.15, +(value + .15).toFixed(2)))}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(1, +(value - .15).toFixed(2)))}>−</button>
        </div>
        {zoom > 1 && <button type="button" className="reset-map" onClick={() => setZoom(1)}>Reset Bulgaria</button>}
        {!items.length && <div className="map-empty"><Icon name="map" size={28} /><strong>No places match</strong><span>Adjust the filters to repopulate the map.</span></div>}
        {selected && (
          <div className="map-preview">
            <div className="preview-art"><VineyardArt winery={selected} index={wineries.indexOf(selected)} /></div>
            <div><span>{selected.locality} · {regionById[selected.region].shortName}</span><strong>{selected.name}</strong><button type="button" onClick={() => onDetails(selected.id)}>View winery <Icon name="arrow" size={14} /></button></div>
            <button type="button" className="preview-close" onClick={() => onSelect(selected.id)} aria-label="Close map preview"><Icon name="close" size={15} /></button>
          </div>
        )}
      </div>
      <div className="map-footnote"><Icon name="info" size={14} /> Coordinates and traditional region boundaries are indicative. Confirm routes before visiting.</div>
    </section>
  )
}

function Distribution({ items, activeRegions, onToggle }: { items: Winery[]; activeRegions: RegionId[]; onToggle: (id: RegionId) => void }) {
  const counts = regions.map((region) => ({ ...region, count: items.filter((item) => item.region === region.id).length }))
  const max = Math.max(...counts.map((item) => item.count), 1)
  return (
    <div className="distribution-card">
      <div className="distribution-title"><div><span>Curated seed distribution</span><strong>Records by traditional region</strong></div><small>Click a bar to filter</small></div>
      <div className="distribution-bars">
        {counts.map((region) => (
          <button type="button" key={region.id} className={activeRegions.includes(region.id) ? 'active' : ''} aria-pressed={activeRegions.includes(region.id)} onClick={() => onToggle(region.id)}>
            <span className="bar-track"><i style={{ width: `${Math.max((region.count / max) * 100, 8)}%`, background: region.color }} /></span>
            <span className="bar-name">{region.shortName}</span><strong>{region.count}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return <div className="empty-state"><span className="empty-grapes"><Icon name="grape" size={34} /></span><h2>No wineries found</h2><p>Try a broader search or remove one of your filters.</p><button type="button" onClick={onClear}>Clear all filters</button></div>
}

function DatabaseView({ items, query, setQuery, onDetails, onFilters, onClear }: {
  items: Winery[]
  query: string
  setQuery: (value: string) => void
  onDetails: (id: string) => void
  onFilters: () => void
  onClear: () => void
}) {
  type Key = 'name' | 'region' | 'province'
  const [sort, setSort] = useState<{ key: Key; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' })
  const rows = useMemo(() => [...items].sort((a, b) => {
    const left = sort.key === 'region' ? regionById[a.region].name : a[sort.key]
    const right = sort.key === 'region' ? regionById[b.region].name : b[sort.key]
    const result = left.localeCompare(right)
    return sort.direction === 'asc' ? result : -result
  }), [items, sort])
  const setSortKey = (key: Key) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  const exportCsv = () => {
    const header = ['Winery', 'Locality', 'Province', 'Traditional region', 'Grapes', 'Wine styles', 'Experiences', 'Latitude', 'Longitude', 'Website']
    const lines = rows.map((item) => [item.name, item.locality, item.province, regionById[item.region].name, item.grapes.join('; '), item.styles.join('; '), item.experiences.join('; '), item.lat, item.lon, item.website ?? ''])
    const csv = [header, ...lines].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'wine-atlas-bulgaria.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  const SortHead = ({ field, children }: { field: Key; children: ReactNode }) => <button type="button" onClick={() => setSortKey(field)}>{children}<span>{sort.key === field ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>
  return (
    <main className="database-page" id="main-content">
      <section className="database-intro">
        <div><span className="eyebrow"><i /> Open directory</span><h1>Bulgarian wineries, <em>row by row.</em></h1><p>Search, sort and export the same records shown on the map. This first edition is a curated starting point, not a complete national register.</p></div>
        <div className="database-stats">
          <div><strong>{items.length}</strong><span>matching wineries</span></div>
          <div><strong>{new Set(items.map((item) => item.province)).size}</strong><span>provinces</span></div>
          <div><strong>{new Set(items.flatMap((item) => item.grapes)).size}</strong><span>grape varieties</span></div>
        </div>
      </section>
      <section className="database-panel">
        <div className="database-toolbar">
          <label><Icon name="search" /><span className="sr-only">Search the winery database</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search winery, town, region or grape…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={15} /></button>}</label>
          <span className="record-count">{rows.length} records</span>
          <button type="button" className="outline-button" onClick={onFilters}><Icon name="filters" /> Filters</button>
          <button type="button" className="dark-button" onClick={exportCsv} disabled={!rows.length}><Icon name="download" /> Export CSV</button>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Curated Bulgarian winery directory</caption>
            <thead><tr><th><SortHead field="name">Winery</SortHead></th><th><SortHead field="region">Region</SortHead></th><th><SortHead field="province">Location</SortHead></th><th>Signature grapes</th><th>Visit</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  tabIndex={0}
                  onClick={() => onDetails(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault(); onDetails(item.id)
                    }
                  }}
                >
                  <td><strong>{item.name}</strong><span>{item.styles.slice(0, 3).join(' · ')}</span></td>
                  <td><RegionPill id={item.region} /></td>
                  <td><strong>{item.locality}</strong><span>{item.province} Province</span></td>
                  <td><div className="table-grapes">{item.grapes.slice(0, 2).map((grape) => <span key={grape}>{grape}</span>)}</div></td>
                  <td>{item.experiences.includes('Tastings') ? <span className="status yes"><Icon name="check" size={14} /> Tastings listed</span> : <span className="status">Not documented</span>}</td>
                  <td>{item.website ? <a href={item.website} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Official site <Icon name="external" size={13} /></a> : <span className="status">To verify</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState onClear={onClear} />}
        </div>
        <p className="database-note"><Icon name="info" size={15} /> Visitor information changes seasonally. Contact each winery directly before making a dedicated trip.</p>
      </section>
    </main>
  )
}

function FilterPanel({ selectedStyles, selectedExperiences, organicOnly, onStyle, onExperience, onOrganic, onClear, onClose, resultCount }: {
  selectedStyles: WineStyle[]
  selectedExperiences: Experience[]
  organicOnly: boolean
  onStyle: (value: WineStyle) => void
  onExperience: (value: Experience) => void
  onOrganic: () => void
  onClear: () => void
  onClose: () => void
  resultCount: number
}) {
  return (
    <ModalShell title="Refine your route" onClose={onClose} className="filter-modal">
      <div className="filter-section"><span className="filter-number">01</span><div><h3>Wine style</h3><p>Show wineries producing at least one selected style.</p><div className="choice-grid">{wineStyles.map((style) => <button type="button" key={style} className={selectedStyles.includes(style) ? 'selected' : ''} aria-pressed={selectedStyles.includes(style)} onClick={() => onStyle(style)}><span>{style === 'Red' ? '●' : style === 'White' ? '○' : style === 'Rosé' ? '◐' : '◇'}</span>{style}{selectedStyles.includes(style) && <Icon name="check" size={15} />}</button>)}</div></div></div>
      <div className="filter-section"><span className="filter-number">02</span><div><h3>Visitor experience</h3><p>Combine options to find the right kind of stop.</p><div className="choice-grid">{experienceOptions.map((experience) => <button type="button" key={experience} className={selectedExperiences.includes(experience) ? 'selected' : ''} aria-pressed={selectedExperiences.includes(experience)} onClick={() => onExperience(experience)}>{experience}{selectedExperiences.includes(experience) && <Icon name="check" size={15} />}</button>)}</div></div></div>
      <div className="filter-section organic-filter"><span className="filter-number">03</span><div><h3>Farming approach</h3><p>Certification and farming practices should always be reconfirmed with the producer.</p><button type="button" className={organicOnly ? 'switch on' : 'switch'} onClick={onOrganic} aria-pressed={organicOnly}><i /><span><strong>Organic listed</strong><small>Only records marked as organic in the starter dataset</small></span></button></div></div>
      <div className="modal-actions"><button type="button" className="text-button" onClick={onClear}>Clear all</button><button type="button" className="dark-button" onClick={onClose}>Show {resultCount} {resultCount === 1 ? 'winery' : 'wineries'}</button></div>
    </ModalShell>
  )
}

function ModalShell({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const dialogRef = useDialogFocus<HTMLElement>()
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><Logo /><span>{title}</span><button type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        {children}
      </section>
    </div>
  )
}

function RegionsPanel({ onClose, onChoose }: { onClose: () => void; onChoose: (id: RegionId) => void }) {
  return (
    <ModalShell title="Traditional wine regions" onClose={onClose} className="regions-modal">
      <div className="regions-intro"><span className="eyebrow"><i /> A practical touring lens</span><h2>Five landscapes.<br /><em>Many expressions.</em></h2><p>The familiar five-region model is useful for travel and discovery. It should not be confused with Bulgaria’s current protected geographical indication scheme.</p></div>
      <div className="region-guide-grid">
        {regions.map((region, index) => (
          <button type="button" key={region.id} onClick={() => { onChoose(region.id); onClose() }} style={{ '--region-color': region.color, '--region-pale': region.pale } as CSSProperties}>
            <span className="region-index">0{index + 1}</span><i className="region-swatch" /><h3>{region.name}</h3><p>{region.description}</p><small>{region.climate}</small><div>{region.signatures.map((item) => <span key={item}>{item}</span>)}</div><strong>Explore {wineries.filter((item) => item.region === region.id).length} wineries <Icon name="arrow" size={15} /></strong>
          </button>
        ))}
      </div>
    </ModalShell>
  )
}

function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="About the atlas" onClose={onClose} className="about-modal">
      <div className="about-layout">
        <div className="about-title"><span className="eyebrow"><i /> Edition 01</span><h2>A clearer way into <em>Bulgarian wine.</em></h2><p>Wine Atlas turns a scattered travel landscape into an approachable, filterable starting point.</p></div>
        <div className="about-copy">
          <section><span>01</span><div><h3>What is included</h3><p>A hand-curated starter directory of wineries with indicative coordinates, regional grouping, signature grapes and commonly advertised visitor experiences. It is intentionally selective rather than exhaustive.</p></div></section>
          <section><span>02</span><div><h3>How to read the map</h3><p>The five colours represent traditional wine-tourism regions. Boundaries are interpretive and winery markers are suitable for national orientation—not turn-by-turn navigation.</p></div></section>
          <section><span>03</span><div><h3>Before you travel</h3><p>Opening hours, tastings and accommodation can change. Follow the official-site link where available and contact the producer before making a dedicated journey.</p></div></section>
          <div className="source-links"><a href="https://visitbulgaria.com/wine-tourism-landing-page/" target="_blank" rel="noreferrer">Visit Bulgaria · Wine tourism <Icon name="external" size={14} /></a><a href="https://vineregister.eavw.com/manufacturers" target="_blank" rel="noreferrer">State producer register <Icon name="external" size={14} /></a></div>
        </div>
      </div>
    </ModalShell>
  )
}

function DetailPanel({ winery, saved, onSave, onClose }: { winery: Winery; saved: boolean; onSave: () => void; onClose: () => void }) {
  const region = regionById[winery.region]
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${winery.lat},${winery.lon}`
  const dialogRef = useDialogFocus<HTMLElement>()
  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside ref={dialogRef} className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${winery.name} details`}>
        <div className="detail-art"><VineyardArt winery={winery} index={wineries.indexOf(winery)} large /><button type="button" className="detail-close" onClick={onClose} aria-label="Close details"><Icon name="close" /></button><button type="button" className={`detail-save${saved ? ' saved' : ''}`} onClick={onSave}><Icon name="heart" /> {saved ? 'Saved' : 'Save'}</button></div>
        <div className="detail-content">
          <RegionPill id={winery.region} />
          <span className="detail-location"><Icon name="pin" size={15} /> {winery.locality}, {winery.province} Province</span>
          <h2>{winery.name}</h2>
          <p className="detail-lede">{winery.summary}</p>
          <div className="detail-callout"><span style={{ background: region.color }}><Icon name="grape" size={22} /></span><div><strong>{region.name}</strong><p>{region.description}</p></div></div>
          <section className="detail-section"><span>In the glass</span><h3>Signature grapes</h3><div className="detail-tags">{winery.grapes.map((grape) => <span key={grape}>{grape}</span>)}</div><h3>Styles produced</h3><div className="detail-tags muted">{winery.styles.map((style) => <span key={style}>{style}</span>)}</div></section>
          <section className="detail-section"><span>At the estate</span><h3>Experiences listed</h3><div className="experience-list">{winery.experiences.map((experience) => <span key={experience}><Icon name="check" size={14} />{experience}</span>)}</div></section>
          <div className="detail-actions"><a className="dark-button" href={mapsUrl} target="_blank" rel="noreferrer"><Icon name="route" /> Get directions</a>{winery.website ? <a className="outline-button" href={winery.website} target="_blank" rel="noreferrer">Official site <Icon name="external" size={15} /></a> : <span className="unverified-link">Official site not yet linked</span>}</div>
          <p className="detail-disclaimer"><Icon name="info" size={15} /> Map location is approximate. Confirm all visitor details directly with the winery.</p>
        </div>
      </aside>
    </div>
  )
}

export default function App() {
  const initial = new URLSearchParams(window.location.search)
  const [view, setView] = useState<PrimaryView>(initial.get('view') === 'database' ? 'database' : 'explore')
  const [mobileView, setMobileView] = useState<MobileView>('list')
  const [query, setQuery] = useState(initial.get('q') ?? '')
  const [activeRegions, setActiveRegions] = useState<RegionId[]>(() => {
    const value = initial.get('region') as RegionId | null
    return value && regions.some((region) => region.id === value) ? [value] : []
  })
  const [selectedStyles, setSelectedStyles] = useState<WineStyle[]>([])
  const [selectedExperiences, setSelectedExperiences] = useState<Experience[]>([])
  const [organicOnly, setOrganicOnly] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('recommended')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('wine-atlas-saved') ?? '[]')
      return Array.isArray(stored) && stored.every((item) => typeof item === 'string') ? stored : []
    } catch {
      return []
    }
  })

  const clearFilters = () => { setActiveRegions([]); setSelectedStyles([]); setSelectedExperiences([]); setOrganicOnly(false); setFavoritesOnly(false); setQuery('') }
  const toggleSave = (id: string) => setSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const filterCount = activeRegions.length + selectedStyles.length + selectedExperiences.length + (organicOnly ? 1 : 0) + (favoritesOnly ? 1 : 0)

  useEffect(() => {
    try { localStorage.setItem('wine-atlas-saved', JSON.stringify(savedIds)) } catch { /* Storage may be disabled. */ }
  }, [savedIds])
  useEffect(() => {
    const params = new URLSearchParams()
    if (view !== 'explore') params.set('view', view)
    if (query.trim()) params.set('q', query.trim())
    if (activeRegions.length === 1) params.set('region', activeRegions[0])
    window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`)
  }, [view, query, activeRegions])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPanel(null) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  const baseFiltered = useMemo(() => {
    const needle = normalize(query.trim())
    return wineries.filter((winery) => {
      const region = regionById[winery.region]
      const haystack = normalize([winery.name, winery.locality, winery.province, region.name, region.shortName, winery.summary, ...winery.grapes, ...winery.styles].join(' '))
      return (!needle || haystack.includes(needle))
        && (!selectedStyles.length || selectedStyles.some((style) => winery.styles.includes(style)))
        && (!selectedExperiences.length || selectedExperiences.every((experience) => winery.experiences.includes(experience)))
        && (!organicOnly || winery.organic)
        && (!favoritesOnly || savedIds.includes(winery.id))
    })
  }, [query, selectedStyles, selectedExperiences, organicOnly, favoritesOnly, savedIds])

  const filtered = useMemo(() => baseFiltered
    .filter((winery) => !activeRegions.length || activeRegions.includes(winery.region))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'region') return regionById[a.region].name.localeCompare(regionById[b.region].name) || a.name.localeCompare(b.name)
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name)
    }), [baseFiltered, activeRegions, sort])

  const selected = selectedId ? wineries.find((item) => item.id === selectedId) ?? null : null
  const openDetails = (id: string) => { setSelectedId(id); setPanel('detail') }
  const chooseRegion = (id: RegionId) => { setActiveRegions([id]); setView('explore'); setMobileView('list'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const selectMapPin = (id: string) => {
    if (selectedId === id) { setSelectedId(null); return }
    setSelectedId(id)
    if (window.innerWidth >= 1024) window.setTimeout(() => document.getElementById(`winery-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to results</a>
      <header className="site-header">
        <div className="header-main">
          <button type="button" className="brand-button" onClick={() => { setView('explore'); clearFilters(); }} aria-label="Wine Atlas home"><Logo /></button>
          <nav aria-label="Primary navigation">
            <button type="button" className={view === 'explore' && panel !== 'regions' ? 'active' : ''} onClick={() => setView('explore')}>Explore</button>
            <button type="button" onClick={() => setPanel('regions')}>Regions</button>
            <button type="button" className={view === 'database' ? 'active' : ''} onClick={() => setView('database')}>Database</button>
          </nav>
          <div className="header-actions">
            <button type="button" onClick={() => setPanel('about')}>About the data</button>
            <button type="button" className="mobile-header-link" onClick={() => setPanel('regions')}><Icon name="grape" size={16} /><span>Regions</span></button>
            <button type="button" className="mobile-header-link" onClick={() => { setView(view === 'database' ? 'explore' : 'database'); setMobileView('list') }}><Icon name={view === 'database' ? 'map' : 'list'} size={16} /><span>{view === 'database' ? 'Explore' : 'Database'}</span></button>
            <button type="button" aria-pressed={favoritesOnly} className={favoritesOnly ? 'saved-filter active' : 'saved-filter'} onClick={() => { setFavoritesOnly((value) => !value); setView('explore') }}><Icon name="heart" size={17} /><span>Saved</span>{savedIds.length > 0 && <i>{savedIds.length}</i>}</button>
          </div>
        </div>
        <div className="search-row">
          <label className="global-search"><Icon name="search" size={20} /><span className="sr-only">Search wineries</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Winery, town, region or grape…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={15} /></button>}</label>
          <div className="region-chips" aria-label="Filter by wine region">
            <button type="button" className={!activeRegions.length ? 'active all' : 'all'} aria-pressed={!activeRegions.length} onClick={() => setActiveRegions([])}>All Bulgaria <span>{baseFiltered.length}</span></button>
            {regions.map((region) => <button type="button" key={region.id} className={activeRegions.includes(region.id) ? 'active' : ''} aria-pressed={activeRegions.includes(region.id)} onClick={() => setActiveRegions((current) => toggleValue(current, region.id))}><i style={{ background: region.color }} />{region.shortName}<span>{baseFiltered.filter((item) => item.region === region.id).length}</span></button>)}
          </div>
          <button type="button" className={filterCount ? 'filter-button active' : 'filter-button'} onClick={() => setPanel('filters')}><Icon name="filters" /> <span>Filters</span>{filterCount > 0 && <i>{filterCount}</i>}</button>
        </div>
      </header>

      {view === 'explore' ? (
        <main className={`explore-layout mobile-${mobileView}`} id="main-content">
          <section className="results-pane">
            <div className="results-heading">
              <div><span className="eyebrow"><i /> Curated winery map</span><h1>Find a winery <em>worth the detour.</em></h1><p aria-live="polite">{filtered.length} places across {new Set(filtered.map((item) => item.region)).size} traditional wine {new Set(filtered.map((item) => item.region)).size === 1 ? 'region' : 'regions'}</p></div>
              <label className="sort-select"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="recommended">Atlas picks</option><option value="name">Name A–Z</option><option value="region">Region</option></select><Icon name="chevron" size={15} /></label>
            </div>
            <Distribution items={baseFiltered} activeRegions={activeRegions} onToggle={(id) => setActiveRegions((current) => toggleValue(current, id))} />
            {filterCount > 0 && <div className="active-filter-line"><span>{filterCount} {filterCount === 1 ? 'filter' : 'filters'} active</span><button type="button" onClick={clearFilters}>Clear all <Icon name="close" size={13} /></button></div>}
            {filtered.length ? <div className="card-grid">{filtered.map((winery, index) => <WineryCard key={winery.id} winery={winery} index={wineries.indexOf(winery)} selected={selectedId === winery.id} saved={savedIds.includes(winery.id)} onSelect={() => setSelectedId(winery.id)} onDetails={() => openDetails(winery.id)} onSave={() => toggleSave(winery.id)} onHover={setHoveredId} />)}</div> : <EmptyState onClear={clearFilters} />}
            <footer className="results-footer"><Logo /><p>A curated starting point for exploring Bulgarian wine country.</p><button type="button" onClick={() => setPanel('about')}>Method & data notes</button></footer>
          </section>
          <aside className="map-pane"><MapView items={filtered} selectedId={selectedId} hoveredId={hoveredId} onSelect={selectMapPin} onDetails={openDetails} /></aside>
          <div className="mobile-view-switch" role="group" aria-label="Choose list or map view"><button type="button" className={mobileView === 'list' ? 'active' : ''} aria-pressed={mobileView === 'list'} onClick={() => setMobileView('list')}><Icon name="list" /> List</button><button type="button" className={mobileView === 'map' ? 'active' : ''} aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}><Icon name="map" /> Map <span>{filtered.length}</span></button></div>
        </main>
      ) : <DatabaseView items={filtered} query={query} setQuery={setQuery} onDetails={openDetails} onFilters={() => setPanel('filters')} onClear={clearFilters} />}

      {panel === 'filters' && <FilterPanel selectedStyles={selectedStyles} selectedExperiences={selectedExperiences} organicOnly={organicOnly} onStyle={(value) => setSelectedStyles((current) => toggleValue(current, value))} onExperience={(value) => setSelectedExperiences((current) => toggleValue(current, value))} onOrganic={() => setOrganicOnly((value) => !value)} onClear={clearFilters} onClose={() => setPanel(null)} resultCount={filtered.length} />}
      {panel === 'regions' && <RegionsPanel onClose={() => setPanel(null)} onChoose={chooseRegion} />}
      {panel === 'about' && <AboutPanel onClose={() => setPanel(null)} />}
      {panel === 'detail' && selected && <DetailPanel winery={selected} saved={savedIds.includes(selected.id)} onSave={() => toggleSave(selected.id)} onClose={() => setPanel(null)} />}
    </div>
  )
}
