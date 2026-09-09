export const comparisonQuarters = [
  '2024 Q1',
  '2024 Q2',
  '2024 Q3',
  '2024 Q4',
  '2025 Q1',
  '2025 Q2',
  '2025 Q3',
  '2025 Q4',
  '2026 Q1',
  '2026 Q2',
  '2026 Q3',
]

const median = (values) => {
  if (!values.length) return null
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2
}

export const quarterFromIsoDate = (dateIso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!match) return null
  const parsed = new Date(`${dateIso}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateIso) return null
  return `${match[1]} Q${Math.ceil(Number(match[2]) / 3)}`
}

export function buildMarketTrendCore(
  records,
  soldRows,
  city,
  quarters = comparisonQuarters,
  minimumAskingSample = 10,
) {
  const askingByQuarter = new Map()

  for (const record of records) {
    if (record.city !== city || !Number.isFinite(record.eurSqm) || record.eurSqm <= 0) continue
    const quarter = quarterFromIsoDate(record.recordDateIso)
    if (!quarter || !quarters.includes(quarter)) continue
    const values = askingByQuarter.get(quarter) ?? []
    values.push(record.eurSqm)
    askingByQuarter.set(quarter, values)
  }

  const rawPoints = quarters.map((quarter) => {
    const askingValues = askingByQuarter.get(quarter) ?? []
    const candidateSoldHpi = soldRows.find((row) => row.city === city && row.quarter === quarter)?.index
    const soldHpi = Number.isFinite(candidateSoldHpi) && candidateSoldHpi > 0 ? candidateSoldHpi : null
    return {
      quarter,
      soldHpi,
      askingMedianEurSqm: askingValues.length >= minimumAskingSample ? median(askingValues) : null,
      askingSampleSize: askingValues.length,
    }
  })

  const baseline = rawPoints.find((point) => point.soldHpi !== null && point.askingMedianEurSqm !== null) ?? null
  const soldBaseline = baseline?.soldHpi ?? null
  const askingBaseline = baseline?.askingMedianEurSqm ?? null

  return {
    city,
    baselineQuarter: baseline?.quarter ?? null,
    points: rawPoints.map((point) => ({
      ...point,
      soldComparableIndex: point.soldHpi !== null && soldBaseline !== null
        ? (point.soldHpi / soldBaseline) * 100
        : null,
      askingComparableIndex: point.askingMedianEurSqm !== null && askingBaseline !== null
        ? (point.askingMedianEurSqm / askingBaseline) * 100
        : null,
    })),
  }
}
