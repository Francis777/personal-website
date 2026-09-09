const SOURCE_ALIASES = new Map([
  ['imot.bg', 'imot.bg'],
  ['www.imot.bg', 'imot.bg'],
  ['yavlena', 'Yavlena'],
  ['yavlena.com', 'Yavlena'],
  ['www.yavlena.com', 'Yavlena'],
])

const SOURCE_HOSTS = {
  'imot.bg': new Set(['imot.bg', 'www.imot.bg']),
  Yavlena: new Set(['yavlena.com', 'www.yavlena.com']),
}

const COMPLETED_PATTERN = /(акт\s*16|act\s*16|въведен[^.\n]{0,100}експлоатация|разрешение\s+за\s+ползване|удостоверение[^.\n]{0,100}експлоатация|occupancy\s+permit|use\s+permit|commissioned)/iu
const FUTURE_PATTERN = /(пред\s+акт\s*16|преди\s+акт\s*16|очаква(?:н|ме|\s+се)?|предстои|ще\s+бъде|до\s+акт\s*16|expected|awaiting|before\s+act\s*16|act\s*16\s+pending)/iu
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const cleanText = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ') : fallback

const asFiniteNumber = (value) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

const utcDateOnly = (value) => {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed
}

export const canonicalSource = (value) => SOURCE_ALIASES.get(cleanText(value).toLowerCase()) ?? null

export const commercialRecordKey = (record) => `${record.source}\u0000${record.sourceRecordId ?? record.id}`

export const sortCommercialRecords = (records) => [...records].sort((left, right) =>
  right.recordDateIso.localeCompare(left.recordDateIso)
  || String(right.lastSeenAt ?? right.observedAt ?? '').localeCompare(String(left.lastSeenAt ?? left.observedAt ?? ''))
  || commercialRecordKey(left).localeCompare(commercialRecordKey(right)),
)

const canonicalId = (source, value) => {
  if (typeof value !== 'string') return null
  const compact = value.trim()
  if (!compact || compact.length > 80 || !/^[a-z0-9_-]+$/i.test(compact)) return null
  if (source === 'imot.bg') {
    const displayedId = compact.match(/(\d{6})$/)?.[1]
    return displayedId ?? compact
  }
  return compact
}

const normalizeIsoTimestamp = (value) => {
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const completionEvidence = (raw, now, cutoff) => {
  const claim = cleanText(raw.act16Claim)
  if (!claim || !COMPLETED_PATTERN.test(claim) || FUTURE_PATTERN.test(claim)) {
    return { error: 'A completed Act 16 or occupancy-permit claim is required.' }
  }

  const explicitDate = utcDateOnly(raw.act16DateIso)
  const yearValue = Number.isInteger(raw.act16Year)
    ? raw.act16Year
    : Number(claim.match(/\b(20\d{2})\b/)?.[1] ?? NaN)
  const evidenceDate = explicitDate ?? (Number.isInteger(yearValue) ? new Date(Date.UTC(yearValue, 0, 1)) : null)
  if (!evidenceDate) return { error: 'The completed-status claim has no usable date or year.' }
  if (evidenceDate < cutoff) return { error: 'The Act 16 claim is outside the rolling two-year window.' }
  if (evidenceDate > now) return { error: 'The Act 16 claim is future-dated.' }

  return {
    claim,
    act16DateIso: explicitDate?.toISOString().slice(0, 10),
    act16Year: yearValue,
    act16DatePrecision: explicitDate ? 'day' : cleanText(raw.act16DatePrecision, 'year'),
  }
}

export function normalizeCommercialRecord(raw, { now = new Date() } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Record must be an object.' }
  }

  const source = canonicalSource(raw.source)
  if (!source) return { ok: false, error: 'Unsupported commercial source.' }
  const id = canonicalId(source, raw.id)
  if (!id) return { ok: false, error: 'Record ID must be a non-empty string.' }
  if (raw.city !== 'Sofia' && raw.city !== 'Plovdiv') return { ok: false, error: 'Unsupported city.' }

  let sourceUrl
  try {
    sourceUrl = new URL(raw.sourceUrl)
  } catch {
    return { ok: false, error: 'Invalid source URL.' }
  }
  if (sourceUrl.protocol !== 'https:' || !SOURCE_HOSTS[source].has(sourceUrl.hostname.toLowerCase())) {
    return { ok: false, error: 'Source URL host does not match the source.' }
  }

  const sourceRecordId = source === "imot.bg"
    ? cleanText(raw.sourceRecordId) || sourceUrl.pathname.match(/\/obiava-(1[a-z]\d{15,16})-/i)?.[1] || (raw.id.length > 6 ? raw.id : id)
    : cleanText(raw.sourceRecordId) || id

  const recordDate = utcDateOnly(raw.recordDateIso)
  if (!recordDate) return { ok: false, error: 'Invalid record date.' }
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (recordDate > tomorrow) return { ok: false, error: 'Record date is future-dated.' }

  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()))
  const completion = completionEvidence(raw, now, cutoff)
  if (completion.error) return { ok: false, error: completion.error }

  const askingPriceEur = asFiniteNumber(raw.askingPriceEur)
  const areaSqm = asFiniteNumber(raw.areaSqm)
  let eurSqm = asFiniteNumber(raw.eurSqm)
  if (askingPriceEur === null || askingPriceEur < 10_000 || askingPriceEur > 20_000_000) {
    return { ok: false, error: 'Asking price is outside the accepted bounds.' }
  }
  if (areaSqm === null || areaSqm < 10 || areaSqm > 2_000) {
    return { ok: false, error: 'Area is outside the accepted bounds.' }
  }
  const derivedUnitPrice = askingPriceEur / areaSqm
  if (eurSqm === null) eurSqm = derivedUnitPrice
  if (eurSqm < 100 || eurSqm > 50_000 || Math.abs(eurSqm - derivedUnitPrice) / derivedUnitPrice > 0.12) {
    return { ok: false, error: 'The unit price is invalid or inconsistent with price and area.' }
  }

  const normalized = {
    id,
    sourceRecordId,
    source,
    city: raw.city,
    district: cleanText(raw.district, 'Not stated'),
    property: cleanText(raw.property, 'Apartment'),
    askingPriceEur: Math.round(askingPriceEur * 100) / 100,
    areaSqm: Math.round(areaSqm * 100) / 100,
    eurSqm: Math.round(eurSqm * 100) / 100,
    recordDate: cleanText(raw.recordDate, raw.recordDateIso),
    recordDateIso: raw.recordDateIso,
    recordDateKind: cleanText(raw.recordDateKind) || undefined,
    act16Claim: completion.claim,
    act16DateIso: completion.act16DateIso,
    act16Year: completion.act16Year,
    act16DatePrecision: completion.act16DatePrecision,
    act16Verification: 'advertiser-claim',
    finish: cleanText(raw.finish, 'Finish and VAT treatment not stated'),
    sourceUrl: sourceUrl.href,
    caveat: cleanText(raw.caveat) || undefined,
    firstSeenAt: normalizeIsoTimestamp(raw.firstSeenAt),
    lastSeenAt: normalizeIsoTimestamp(raw.lastSeenAt),
    observedAt: normalizeIsoTimestamp(raw.observedAt),
    active: raw.active !== false,
  }

  return {
    ok: true,
    record: Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)),
  }
}

const comparableRecord = (record) => {
  const { firstSeenAt, lastSeenAt, observedAt, ...comparable } = record
  return comparable
}

const recordsEqual = (left, right) =>
  JSON.stringify(comparableRecord(left)) === JSON.stringify(comparableRecord(right))

export function mergeCommercialRecords(existing, discovered, { now = new Date() } = {}) {
  const nowIso = now.toISOString()
  const current = new Map()
  let expired = 0

  for (const raw of Array.isArray(existing) ? existing : []) {
    const normalized = normalizeCommercialRecord(raw, { now })
    if (!normalized.ok) {
      expired += 1
      continue
    }
    current.set(commercialRecordKey(normalized.record), normalized.record)
  }

  const accepted = new Map()
  const rejectionDetails = []
  let rejected = 0
  for (const raw of Array.isArray(discovered) ? discovered : []) {
    const normalized = normalizeCommercialRecord(raw, { now })
    if (!normalized.ok) {
      rejected += 1
      if (rejectionDetails.length < 20) {
        rejectionDetails.push({ source: raw?.source, id: raw?.id, reason: normalized.error })
      }
      continue
    }
    const key = commercialRecordKey(normalized.record)
    const prior = accepted.get(key)
    if (!prior || normalized.record.recordDateIso >= prior.recordDateIso) accepted.set(key, normalized.record)
  }

  let added = 0
  let updated = 0
  let unchanged = 0
  for (const [key, incoming] of accepted) {
    const previous = current.get(key)
    const observedAt = incoming.observedAt ?? nowIso
    if (!previous) {
      current.set(key, { ...incoming, firstSeenAt: incoming.firstSeenAt ?? observedAt, lastSeenAt: observedAt })
      added += 1
      continue
    }

    if (incoming.recordDateIso < previous.recordDateIso) {
      current.set(key, { ...previous, lastSeenAt: observedAt })
      unchanged += 1
      continue
    }

    const merged = {
      ...incoming,
      firstSeenAt: previous.firstSeenAt ?? incoming.firstSeenAt ?? observedAt,
      lastSeenAt: observedAt,
    }
    if (recordsEqual(previous, merged)) unchanged += 1
    else updated += 1
    current.set(key, merged)
  }

  return {
    records: sortCommercialRecords([...current.values()]),
    stats: { added, updated, unchanged, rejected, expired, accepted: accepted.size },
    rejectionDetails,
  }
}
