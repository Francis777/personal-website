const CITY_NAMES = { Sofia: new Set(["Sofia", "София"]), Plovdiv: new Set(["Plovdiv", "Пловдив"]) }
const cityMatches = (value, city) => CITY_NAMES[city]?.has(String(value).trim()) ?? false

const SEARCH_ROUTES = {
  Sofia: '/bg/sales/sofia-sofia/d23l4396?tags=27',
  Plovdiv: '/bg/sales/plovdiv-plovdiv/d16l3607?tags=27',
}

const flightText = (html) => {
  const chunks = []
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)<\/script>/g)) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`))
    } catch {
      // Ignore unrelated malformed chunks; required payload markers are checked below.
    }
  }
  return chunks.join('')
}

const balancedObject = (text, start) => {
  if (start < 0 || text[start] !== '{') return null
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{') depth += 1
    else if (character === '}' && --depth === 0) return text.slice(start, index + 1)
  }
  return null
}

const objectAfter = (text, marker) => {
  const markerIndex = text.indexOf(marker)
  if (markerIndex < 0) return null
  const start = text.indexOf('{', markerIndex + marker.length)
  const serialized = balancedObject(text, start)
  if (!serialized) return null
  try {
    return JSON.parse(serialized)
  } catch {
    return null
  }
}

const propertyLabel = (value) => {
  const text = String(value ?? '').toLocaleLowerCase('bg-BG')
  if (/едностаен|1-стаен/.test(text)) return '1-room apartment'
  if (/двустаен|2-стаен/.test(text)) return '2-room apartment'
  if (/тристаен|3-стаен/.test(text)) return '3-room apartment'
  if (/четиристаен|4-стаен/.test(text)) return '4-room apartment'
  if (/многостаен/.test(text)) return 'Multi-room apartment'
  return null
}

const recordDateLabel = (iso) => {
  const date = new Date(`${iso}T00:00:00.000Z`)
  return `Page dated ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)}`
}

const completionEvidence = (property) => {
  if (property.isUnderConstruction) return { error: 'under_construction' }
  const evidence = `${property.title ?? ''}\n${property.description ?? ''}`
  if (/(?:очаква|предстои|ще\s+бъде|пред\s+акт\s*16|преди\s+акт\s*16|акт\s*1[45]|expected|awaiting|before\s+act\s*16)/iu.test(evidence)) {
    return { error: 'future_completion' }
  }
  const signal = '(?:акт\\s*16|разрешение\\s+за\\s+ползване|въведен[^.!?\\n]{0,60}експлоатация|occupancy\\s+permit|use\\s+permit|commissioned)'
  const after = new RegExp(`${signal}[^.!?\\n]{0,120}\\b(20\\d{2})\\b`, 'iu').exec(evidence)
  const before = new RegExp(`\\b(20\\d{2})\\b[^.!?\\n]{0,120}${signal}`, 'iu').exec(evidence)
  const year = Number(after?.[1] ?? before?.[1] ?? NaN)
  if (!Number.isInteger(year)) return { error: 'dated_completion_missing' }
  return { year, claim: `Act 16 / occupancy permit stated for ${year}` }
}

const parseSearchPayload = (html) => {
  const payload = objectAfter(flightText(html), '"ssrResult":')
  return Array.isArray(payload?.data?.cards) ? payload.data.cards : null
}

const parseDetailPayload = (html) => objectAfter(flightText(html), '"propertyData":')

export const parseYavlenaDetail = (html, expectedCity) => {
  const property = parseDetailPayload(html)
  if (!property) return { record: null, reason: 'detail_payload_missing' }
  if (property.isRent || property.isSoldOrRented || property.isProject || property.inProject) {
    return { record: null, reason: 'inactive_or_project' }
  }
  if (!cityMatches(property.cityName, expectedCity)) return { record: null, reason: 'city_mismatch' }
  const propertyType = propertyLabel(property.title)
  if (!propertyType) return { record: null, reason: 'unsupported_property' }
  const completion = completionEvidence(property)
  if (completion.error) return { record: null, reason: completion.error }

  const id = String(property.innerNumber ?? '')
  const askingPriceEur = Number(property.priceDecimal)
  const areaSqm = Number(property.area)
  const recordDateIso = String(property.dateCreated ?? "").slice(0, 10)
  if (!/^\d{5,8}$/.test(id) || !Number.isFinite(askingPriceEur) || !Number.isFinite(areaSqm) || !/^\d{4}-\d{2}-\d{2}$/.test(recordDateIso)) {
    return { record: null, reason: 'required_field_missing' }
  }
  const district = String(property.quarterName ?? property.districtName ?? 'Not stated').trim() || 'Not stated'
  return {
    reason: null,
    record: {
      id,
      sourceRecordId: id,
      source: 'Yavlena',
      city: expectedCity,
      district,
      property: propertyType,
      askingPriceEur,
      areaSqm,
      eurSqm: Math.round((askingPriceEur / areaSqm) * 100) / 100,
      recordDate: recordDateLabel(recordDateIso),
      recordDateIso,
      recordDateKind: 'page-created',
      act16Claim: completion.claim,
      act16Year: completion.year,
      act16DatePrecision: 'year',
      finish: property.additionalVATDue
        ? 'Finish not normalized; listing states additional VAT is due'
        : 'Finish and VAT treatment not normalized from source',
      sourceUrl: `https://www.yavlena.com/bg/${id}`,
      caveat: 'Completion status and date remain advertiser-stated.',
    },
  }
}

const searchUrl = (city, page) => {
  const url = new URL(SEARCH_ROUTES[city], 'https://www.yavlena.com')
  url.searchParams.set('page', String(page))
  return url.href
}

export async function discoverYavlenaRecords({
  fetchHtml,
  now = new Date(),
  signal,
  existingRecords = [],
  revision = 0,
  maxDetailsPerCity = 3,
} = {}) {
  if (typeof fetchHtml !== 'function') throw new TypeError('Yavlena adapter requires fetchHtml.')
  const existingIds = new Set(existingRecords
    .filter((record) => String(record.source).toLowerCase().includes('yavlena'))
    .map((record) => String(record.sourceRecordId ?? record.id)))
  const warnings = []
  const rejectionReasons = {}
  const records = []
  let successfulCities = 0
  let discovered = 0
  let detailFetched = 0
  let parsedDetails = 0

  for (const city of Object.keys(SEARCH_ROUTES)) {
    const cityCandidates = new Map()
    let citySucceeded = false
    for (let page = 0; page < 2; page += 1) {
      try {
        const html = await fetchHtml(searchUrl(city, page), { signal, minDelayMs: 5_000 })
        const cards = parseSearchPayload(html)
        if (!cards) throw new Error('SSR search payload was not found.')
        citySucceeded = true
        if (!cards.length) break
        for (const card of cards) {
          const id = String(card.propertyInnerNumber ?? card.innerNumber ?? '')
          if (!/^\d{5,8}$/.test(id) || !cityMatches(card.cityName, city) || card.isRent || card.isSoldOrRented || card.isProject || card.inProject || card.isUnderConstruction) continue
          const previous = cityCandidates.get(id)
          if (!previous || String(card.dateCreated ?? '') > String(previous.dateCreated ?? '')) cityCandidates.set(id, card)
        }
      } catch (error) {
        warnings.push(`${city} page ${page}: ${error instanceof Error ? error.message : String(error)}`)
        break
      }
    }
    if (citySucceeded) successfulCities += 1
    const unseenCandidates = [...cityCandidates.values()]
      .sort((left, right) => String(right.dateCreated ?? '').localeCompare(String(left.dateCreated ?? '')))
      .filter((card) => !existingIds.has(String(card.propertyInnerNumber ?? card.innerNumber)))
    const batchSize = Math.max(0, Math.min(4, maxDetailsPerCity))
    const batchRevision = Number.isInteger(revision) ? Math.max(0, revision) : 0
    const batchStart = unseenCandidates.length && batchSize ? (batchRevision * batchSize) % unseenCandidates.length : 0
    const candidates = unseenCandidates.length
      ? [...unseenCandidates.slice(batchStart), ...unseenCandidates.slice(0, batchStart)].slice(0, batchSize)
      : []
    discovered += cityCandidates.size

    for (const candidate of candidates) {
      const id = String(candidate.propertyInnerNumber ?? candidate.innerNumber)
      detailFetched += 1
      try {
        const html = await fetchHtml(`https://www.yavlena.com/bg/${id}`, { signal, minDelayMs: 5_000 })
        const parsed = parseYavlenaDetail(html, city)
        if (parsed.reason === 'detail_payload_missing') {
          rejectionReasons[parsed.reason] = (rejectionReasons[parsed.reason] ?? 0) + 1
          continue
        }
        parsedDetails += 1
        if (parsed.record) records.push({ ...parsed.record, observedAt: now.toISOString() })
        else rejectionReasons[parsed.reason] = (rejectionReasons[parsed.reason] ?? 0) + 1
      } catch (error) {
        warnings.push(`${city} detail ${id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  if (!successfulCities) throw new Error(`Yavlena discovery failed for both cities${warnings.length ? `: ${warnings.join('; ')}` : '.'}`)
  if (!discovered) throw new Error('Yavlena returned no recognizable search cards; the source markup may have changed.')
  if (detailFetched > 0 && parsedDetails === 0) {
    throw new Error('Yavlena detail requests produced no parseable responses; the source may be unavailable or its markup may have changed.')
  }
  const rejected = detailFetched - records.length
  return {
    records,
    diagnostics: { discovered, reviewed: detailFetched, detailFetched, batchRevision: Number.isInteger(revision) ? revision : 0, accepted: records.length, rejected, rejectionReasons, warnings },
  }
}

export { parseSearchPayload as parseYavlenaSearch }
