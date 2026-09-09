import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://www.bulgarianwine.net'
const OUTPUT = resolve(ROOT, 'data/bulgarianwine-directory.json')
const PAGE_COUNT = 9
const CONCURRENCY = 6

const decodeHtml = (value = '') => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&ndash;/gi, '–')
  .replace(/&mdash;/gi, '—')
  .replace(/&auml;/gi, 'ä')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, ' ')
  .trim()

const matchText = (html, pattern) => decodeHtml(html.match(pattern)?.[1] ?? '')

const sectionById = (html, id) => {
  const start = html.indexOf(`id="${id}"`)
  if (start < 0) return ''
  const tail = html.slice(start)
  const end = tail.indexOf('</section>')
  return end < 0 ? tail.slice(0, 5000) : tail.slice(0, end)
}

const linkedTerms = (html) => {
  const values = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => decodeHtml(match[1]))
  return [...new Set(values.filter(Boolean))]
}

const normalizeProvince = (value) => {
  const province = value.split(',').at(-1)?.trim() ?? ''
  const aliases = new Map([
    ['Bourgas', 'Burgas'],
    ['Rousse', 'Ruse'],
    ['Targoviste', 'Targovishte'],
    ['Veliko Turnovo', 'Veliko Tarnovo'],
    ['Haskovo district', 'Haskovo'],
    ['Plovdiv district', 'Plovdiv'],
    ['Sofia region', 'Sofia'],
  ])
  return aliases.get(province) ?? province.replace(/ Province$/i, '')
}

const northernProvinces = new Set([
  'Vidin', 'Montana', 'Vratsa', 'Pleven', 'Lovech', 'Gabrovo', 'Veliko Tarnovo',
  'Ruse', 'Razgrad', 'Silistra', 'Targovishte',
])

const inferRegion = ({ latitude, longitude, locality, province }) => {
  const place = locality.toLocaleLowerCase('en')
  if (province === 'Blagoevgrad' || province === 'Kyustendil') return 'struma-valley'
  if (province === 'Varna' || province === 'Dobrich' || province === 'Shumen') return 'black-sea'
  if (province === 'Burgas') {
    if (longitude >= 27.1 || /pomorie|kableshkovo|aheloy|staro oryahovo/.test(place)) return 'black-sea'
    return 'rose-valley'
  }
  if (northernProvinces.has(province)) return 'danube-plain'
  if (province === 'Sliven' && !/elenovo|korten|nova zagora|hadzhi dimitrovo/.test(place)) return 'rose-valley'
  if (province === 'Plovdiv' && latitude >= 42.35) return 'rose-valley'
  if (latitude >= 42.48 && longitude >= 24.1 && longitude <= 27.15) return 'rose-valley'
  return 'thracian-lowland'
}

const styleFromTerms = (terms) => {
  const all = terms.join(' ').toLocaleLowerCase('en')
  const styles = []
  if (/red wine/.test(all)) styles.push('Red')
  if (/white wine/.test(all)) styles.push('White')
  if (/rose wine|rosé/.test(all)) styles.push('Rosé')
  if (/sparkling/.test(all)) styles.push('Sparkling')
  if (/orange wine/.test(all)) styles.push('Orange / low-intervention')
  if (/dessert wine/.test(all)) styles.push('Dessert')
  return styles
}

const genericWineTerms = /^(red wine|white wine|rose wine|rosé|sparkling wine|dessert wine|orange wine|organic wine|bio wine)$/i
const grapesFromTerms = (terms) => terms
  .filter((term) => !genericWineTerms.test(term) && !/ and |\//i.test(term))
  .slice(0, 8)

const experiencesFromTerms = (services, facilities) => {
  const all = [...services, ...facilities].join(' ').toLocaleLowerCase('en')
  const values = []
  if (/tasting/.test(all)) values.push('Tastings')
  if (/wine tour|cellar tour|museum/.test(all)) values.push('Cellar tour')
  if (/hotel|guest house|accommodation/.test(all)) values.push('Stay')
  if (/restaurant|traditional dishes|bbq/.test(all)) values.push('Restaurant')
  if (/event|festival|corporate/.test(all)) values.push('Events')
  if (/children|playground|garden/.test(all)) values.push('Family-friendly')
  return values
}

const fetchText = async (url) => {
  const response = await fetch(url, { headers: { 'user-agent': 'WineAtlasBulgaria/1.0 (directory research snapshot)' } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.text()
}

const indexEntries = new Map()
for (let page = 0; page < PAGE_COUNT; page += 1) {
  const html = await fetchText(`${BASE}/location-type/wineries?page=${page}`)
  for (const match of html.matchAll(/href="(\/wineries\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = decodeHtml(match[2])
    if (!name || /^read more$/i.test(name)) continue
    indexEntries.set(match[1], name)
  }
}

const paths = [...indexEntries.keys()]
const records = []
const failures = []

const parseRecord = async (path) => {
  const sourceUrl = new URL(path, BASE).href
  const html = await fetchText(sourceUrl)
  const name = matchText(html, /<h1\b[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || indexEntries.get(path)
  const coordinateMatch = html.match(/"latlons":\[\["(-?\d+(?:\.\d+)?)","(-?\d+(?:\.\d+)?)/)
  const latitude = Number(coordinateMatch?.[1])
  const longitude = Number(coordinateMatch?.[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 41 || latitude > 45 || longitude < 22 || longitude > 29) {
    throw new Error('No usable Bulgaria coordinate in directory record')
  }

  const locality = matchText(html, /<span class="locality">([\s\S]*?)<\/span>/i)
    || matchText(html, /<div class="location vcard"><h4>([\s\S]*?)<\/h4>/i)
    || 'Location not documented'
  const regionText = matchText(html, /<span class="region">([\s\S]*?)<\/span>/i)
  const province = normalizeProvince(regionText) || 'Province not documented'
  const street = matchText(html, /<div class="street-address">([\s\S]*?)<\/div>/i)
  const postalCode = matchText(html, /<span class="postal-code">([\s\S]*?)<\/span>/i)
  const address = [street, locality, regionText, postalCode].filter(Boolean).join(', ')

  const websiteSection = sectionById(html, 'block-fieldblock-node-location-default-field-website')
  const websiteMatch = websiteSection.match(/href="(https?:\/\/[^"]+)"/i)
  const website = websiteMatch ? decodeHtml(websiteMatch[1]) : undefined
  const wineTerms = linkedTerms(sectionById(html, 'block-fieldblock-node-location-default-field-wine-types'))
  const services = linkedTerms(sectionById(html, 'block-fieldblock-node-location-default-field-services'))
  const facilities = linkedTerms(sectionById(html, 'block-fieldblock-node-location-default-field-facilities'))
  const styles = styleFromTerms(wineTerms)
  const grapes = grapesFromTerms(wineTerms)
  const experiences = experiencesFromTerms(services, facilities)
  const region = inferRegion({ latitude, longitude, locality, province })
  const regionName = {
    'danube-plain': 'the Danube Plain',
    'black-sea': 'the Black Sea Coast',
    'rose-valley': 'the Rose Valley',
    'thracian-lowland': 'the Thracian Lowland',
    'struma-valley': 'the Struma Valley',
  }[region]
  const grapeNote = grapes.length ? `, with directory tags including ${grapes.slice(0, 2).join(' and ')}` : ''

  return {
    id: `directory-${path.split('/').at(-1)}`,
    sourceSlug: path.split('/').at(-1),
    name,
    locality,
    province,
    region,
    lat: latitude,
    lon: longitude,
    address,
    summary: `A winery in ${locality}, mapped within ${regionName}${grapeNote}. Verify current visitor access before travelling.`,
    styles,
    grapes,
    experiences,
    organic: wineTerms.some((term) => /organic|bio wine/i.test(term)) || undefined,
    website,
    sourceUrl,
    sourceLabel: 'BulgarianWine.net',
    sourceCheckedAt: new Date().toISOString().slice(0, 10),
    coordinatePrecision: 'directory',
    dataStatus: 'directory',
  }
}

for (let index = 0; index < paths.length; index += CONCURRENCY) {
  const batch = paths.slice(index, index + CONCURRENCY)
  const results = await Promise.allSettled(batch.map(parseRecord))
  results.forEach((result, batchIndex) => {
    if (result.status === 'fulfilled') records.push(result.value)
    else failures.push({ path: batch[batchIndex], reason: result.reason instanceof Error ? result.reason.message : String(result.reason) })
  })
  process.stdout.write(`\rFetched ${Math.min(index + CONCURRENCY, paths.length)}/${paths.length}`)
}

records.sort((a, b) => a.name.localeCompare(b.name))
await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, `${JSON.stringify({
  source: `${BASE}/location-type/wineries`,
  fetchedAt: new Date().toISOString(),
  records,
  failures,
}, null, 2)}\n`)

const existing = await readFile(resolve(ROOT, 'src/data.ts'), 'utf8')
const curatedCount = [...existing.matchAll(/^    id: '/gm)].length
console.log(`\nSaved ${records.length} mapped directory records to ${OUTPUT}`)
console.log(`${failures.length} records lacked usable map coordinates or failed to fetch`)
console.log(`Current curated source contains ${curatedCount} records before deduplication`)
