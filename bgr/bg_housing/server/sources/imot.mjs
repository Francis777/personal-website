const CITY_PATHS = {
  Sofia: 'grad-sofiya',
  Plovdiv: 'grad-plovdiv',
}

const decodeEntities = (value) => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&euro;|&#8364;/gi, '€')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const textContent = (html) => decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2] ? decodeEntities(match[2]) : null
}

const numberFromText = (value) => {
  if (!value) return null
  const normalized = value.replace(/\s|\u00a0/g, '').replace(/,(?=\d{1,2}\b)/, '.').replace(/[^\d.]/g, '')
  const result = Number(normalized)
  return Number.isFinite(result) ? result : null
}

const creationDateFromId = (id) => {
  const match = /^1[a-z](\d{10})\d{5,6}$/i.exec(id)
  if (!match) return null
  const date = new Date(Number(match[1]) * 1_000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const displayedId = (id) => id.match(/(\d{6})$/)?.[1] ?? id

const recordDateLabel = (iso) => {
  const date = new Date(`${iso}T00:00:00.000Z`)
  return `Listed ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)}`
}

const propertyLabel = (value) => {
  const text = value.toLocaleLowerCase('bg-BG')
  if (/едностаен|1-стаен/.test(text)) return '1-room apartment'
  if (/двустаен|2-стаен/.test(text)) return '2-room apartment'
  if (/тристаен|3-стаен/.test(text)) return '3-room apartment'
  if (/четиристаен|4-стаен/.test(text)) return '4-room apartment'
  if (/многостаен/.test(text)) return 'Multi-room apartment'
  return null
}

const cardChunks = (html) => {
  const starts = [...html.matchAll(/<div\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bitem\b[^"']*["'])(?=[^>]*\bid\s*=\s*["']ida([^"']+)["'])[^>]*>/gi)]
  return starts.map((match, index) => ({
    fullId: match[1],
    html: html.slice(match.index, starts[index + 1]?.index ?? html.length),
  }))
}

const parseCard = ({ fullId, html }, city) => {
  const plain = textContent(html)
  const infoHtml = html.match(/<div\b[^>]*class=["\x27][^"\x27]*\binfo\b[^"\x27]*["\x27][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""
  const infoText = textContent(infoHtml)
  if (/Ще\s+бъде\s+въведен|Пред\s+Акт\s*16|Преди\s+Акт\s*16/iu.test(infoText)) return null
  const commissioned = /Въведен\s+в\s+експлоатация\s+(20\d{2})\s*г\.?/iu.exec(infoText)
  if (!commissioned) return null

  const anchorTags = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0])
  const titleTag = anchorTags.find((tag) => /(?:^|\s)title(?:\s|$)/i.test(attribute(tag, 'class') ?? '') && attribute(tag, 'href'))
  const href = titleTag && attribute(titleTag, 'href')
  if (!href) return null
  const sourceUrl = new URL(href, 'https://www.imot.bg').href
  if (!/^https:\/\/(?:www\.)?imot\.bg\//i.test(sourceUrl)) return null

  const priceTag = [...html.matchAll(/<[a-z][^>]*>/gi)].find((match) =>
    (attribute(match[0], "class") ?? "").split(/\s+/).includes("price"),
  )
  const priceScope = priceTag ? textContent(html.slice(priceTag.index, priceTag.index + 1_200)) : plain
  const priceCandidates = [...priceScope.matchAll(/(\d[\d\s\u00a0.,]{2,})\s*(?:€|EUR|евро)/giu)]
    .map((match) => numberFromText(match[1]))
    .filter((value) => value !== null && value >= 10_000)
  const askingPriceEur = priceCandidates[0]
  const areaMatch = /(?:^|\s)(\d{2,4}(?:[.,]\d{1,2})?)\s*(?:кв\.?\s*м\.?|m²|m2)(?=\s|[,.;]|$)/iu.exec(infoText)
  const areaSqm = numberFromText(areaMatch?.[1])
  const recordDateIso = creationDateFromId(fullId)
  if (!askingPriceEur || !areaSqm || !recordDateIso) return null

  const locationMatch = html.match(/<location\b[^>]*>([\s\S]*?)<\/location>/i)
  const location = textContent(locationMatch?.[1] ?? '')
  const district = location
    .replace(/^(?:гр\.?|град)\s*(София|Пловдив)\s*,?/iu, '')
    .replace(/^(София|Пловдив)\s*,?/iu, '')
    .trim() || 'Not stated'
  const titleText = titleTag
    ? textContent(html.slice((html.indexOf(titleTag) + titleTag.length), html.indexOf('</a>', html.indexOf(titleTag))))
    : plain

  const property = propertyLabel(titleText || plain)
  if (!property) return null

  return {
    id: displayedId(fullId),
    sourceRecordId: fullId,
    source: 'imot.bg',
    city,
    district,
    property,
    askingPriceEur,
    areaSqm,
    eurSqm: Math.round((askingPriceEur / areaSqm) * 100) / 100,
    recordDate: recordDateLabel(recordDateIso),
    recordDateIso,
    recordDateKind: 'listing-created',
    act16Claim: `Commissioned in ${commissioned[1]}`,
    act16Year: Number(commissioned[1]),
    act16DatePrecision: 'year',
    finish: 'Finish and VAT treatment not stated in result card',
    sourceUrl,
    caveat: 'Listing date is decoded from the source record ID; completion status is advertiser-stated.',
  }
}

const rejectionReason = ({ fullId, html }) => {
  const infoHtml = html.match(/<div\b[^>]*class=["\x27][^"\x27]*\binfo\b[^"\x27]*["\x27][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""
  const infoText = textContent(infoHtml)
  if (/Ще\s+бъде|Пред\s+Акт\s*16|Преди\s+Акт\s*16/iu.test(infoText)) return "future_completion"
  if (!/Въведен\s+в\s+експлоатация\s+20\d{2}/iu.test(infoText)) return "completion_missing"
  if (!/(?:едностаен|двустаен|тристаен|четиристаен|многостаен|[1-4]-стаен)/iu.test(textContent(html))) return "unsupported_property"
  if (!/(?:€|EUR|евро)/iu.test(textContent(html))) return "price_missing"
  if (!/\d{2,4}(?:[.,]\d{1,2})?\s*(?:кв\.?\s*м\.?|m²|m2)(?=\s|[,.;]|$)/iu.test(infoText)) return "area_missing"
  if (!creationDateFromId(fullId)) return "record_date_missing"
  return "unparsed"
}

const pageUrl = (city, page, now) => {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()))
  const earliestFullYear = cutoff.getUTCMonth() === 0 && cutoff.getUTCDate() === 1 ? cutoff.getUTCFullYear() : cutoff.getUTCFullYear() + 1
  const base = `https://www.imot.bg/obiavi/prodazhbi/${CITY_PATHS[city]}/ot-${earliestFullYear}/do-${now.getUTCFullYear()}`
  return `${base}${page > 1 ? `/p-${page}` : ''}?sort=2&ybuild_type=1~`
}

export async function discoverImotRecords({ fetchHtml, now = new Date(), signal } = {}) {
  if (typeof fetchHtml !== 'function') throw new TypeError('imot.bg adapter requires fetchHtml.')
  const records = []
  const seen = new Set()
  const warnings = []
  let discovered = 0
  let rejected = 0
  const rejectionReasons = {}
  let successfulCities = 0

  for (const city of Object.keys(CITY_PATHS)) {
    let citySucceeded = false
    for (let page = 1; page <= 2; page += 1) {
      try {
        const html = await fetchHtml(pageUrl(city, page, now), { signal, minDelayMs: 1_250, encoding: 'windows-1251' })
        citySucceeded = true
        const cards = cardChunks(html)
        if (!cards.length) break
        let newOnPage = 0
        for (const card of cards) {
          const key = card.fullId
          if (seen.has(key)) continue
          seen.add(key)
          newOnPage += 1
          discovered += 1
          const parsed = parseCard(card, city)
          if (parsed) records.push(parsed)
          else {
            rejected += 1
            const reason = rejectionReason(card)
            rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1
          }
        }
        if (!newOnPage) break
      } catch (error) {
        warnings.push(`${city} page ${page}: ${error instanceof Error ? error.message : String(error)}`)
        break
      }
    }
    if (citySucceeded) successfulCities += 1
  }

  if (!successfulCities) throw new Error(`imot.bg discovery failed for both cities${warnings.length ? `: ${warnings.join('; ')}` : '.'}`)
  if (!discovered) throw new Error('imot.bg returned no recognizable listing cards; the source markup may have changed.')
  if (!records.length) throw new Error("imot.bg produced zero qualifying records from recognized cards; the source markup may have changed.")
  return {
    records,
    diagnostics: { discovered, accepted: records.length, rejected, rejectionReasons, warnings },
  }
}

export { creationDateFromId, parseCard as parseImotCard }
