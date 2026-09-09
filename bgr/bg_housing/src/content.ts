import commercialSeed from '../data/commercial-seed.json'

export type City = 'Sofia' | 'Plovdiv'
export type Metric = 'index' | 'yoy' | 'qoq'

export interface PriceRow {
  quarter: string
  city: City
  index: number
  qoq: number | null
  yoy: number | null
}

export const allQuarters = [
  '2024 Q1', '2024 Q2', '2024 Q3', '2024 Q4',
  '2025 Q1', '2025 Q2', '2025 Q3', '2025 Q4', '2026 Q1',
]

export const visibleQuarters = allQuarters.slice(1)

const levels: Record<City, number[]> = {
  Sofia: [83.61, 85.64, 92.53, 92.88, 93.12, 100.01, 103.50, 103.36, 108.24],
  Plovdiv: [83.82, 88.98, 91.30, 100.38, 97.46, 104.59, 98.31, 99.63, 99.31],
}

const publishedRates: Record<City, { qoq: number[]; yoy: number[] }> = {
  Sofia: {
    qoq: [10.4, 2.4, 8.0, 0.4, 0.3, 7.4, 3.5, -0.1, 4.7],
    yoy: [25.3, 20.1, 22.1, 22.6, 11.4, 16.8, 11.9, 11.3, 16.2],
  },
  Plovdiv: {
    qoq: [-1.4, 6.2, 2.6, 9.9, -2.9, 7.3, -6.0, 1.3, -0.3],
    yoy: [4.2, 1.4, 2.1, 18.1, 16.3, 17.5, 7.7, -0.7, 1.9],
  },
}

export const priceRows: PriceRow[] = (Object.keys(levels) as City[]).flatMap((city) =>
  levels[city].map((index, position) => ({
    quarter: allQuarters[position],
    city,
    index,
    qoq: publishedRates[city].qoq[position],
    yoy: publishedRates[city].yoy[position],
  })),
)

export interface AskingMarketPulse {
  source: "imot.bg" | "Yavlena"
  city: City
  value: string
  date: string
  dateIso: string
  scope: string
  sourceUrl: string
}

export interface AskingPriceReference {
  id: string
  sourceRecordId?: string
  source: "imot.bg" | "Yavlena"
  city: City
  district: string
  property: string
  askingPriceEur: number
  areaSqm: number
  eurSqm: number
  recordDate: string
  recordDateIso: string
  act16Claim: string
  finish: string
  sourceUrl: string
  caveat?: string
}

export interface CommissioningRecord {
  certificate: string
  date: string
  dateIso: string
  city: City
  category: string
  project: string
  district: string
  location: string
  sourceUrl: string
}

const sofiaDetail = (code: string) =>
  `https://nag.sofia.bg/RegisterInfo/Info?url=${encodeURIComponent(code)}`
const plovdivDetail = (docid: number) =>
  `http://isut.plovdiv.bg:998/user/__single_register_view.php?regid=7&docid=${docid}&viewmode=0`

export const commissioningRecords: CommissioningRecord[] = [
  { certificate: '828', date: '30 Jul 2026', dateIso: '2026-07-30', city: 'Sofia', category: 'Municipal register', project: 'Multi-family residential building, stage 4, with parking', district: 'Pancharevo', location: 'Cad. 55419.6701.5593', sourceUrl: sofiaDetail('vgxWFjpVNA0=') },
  { certificate: '826', date: '30 Jul 2026', dateIso: '2026-07-30', city: 'Sofia', category: 'Municipal register', project: 'Multi-family residential building', district: 'Vitosha', location: 'Cad. 68134.1933.9100 · 32 Prof. Velizar Velkov St', sourceUrl: sofiaDetail('spWNXEcOmVU=') },
  { certificate: '823', date: '30 Jul 2026', dateIso: '2026-07-30', city: 'Sofia', category: 'Municipal register', project: 'Multi-family residential building with garages', district: 'Lyulin', location: 'Cad. 68134.4358.428', sourceUrl: sofiaDetail('4kmESTU5-aY=') },
  { certificate: '822', date: '30 Jul 2026', dateIso: '2026-07-30', city: 'Sofia', category: 'Municipal register', project: 'Residential building with underground garage', district: 'Vitosha', location: '3A Lamar St', sourceUrl: sofiaDetail('OL2O-aX3pvY=') },
  { certificate: '768', date: '17 Jul 2026', dateIso: '2026-07-17', city: 'Sofia', category: 'Municipal register', project: 'Residential building with underground garages', district: 'Triaditsa', location: 'Cad. 68134.1007.3026 · Krastova Vada', sourceUrl: sofiaDetail('OxgvdlJ86tY=') },
  { certificate: '762', date: '16 Jul 2026', dateIso: '2026-07-16', city: 'Sofia', category: 'Municipal register', project: 'Colina Verde, stage 1 — 12 residential buildings', district: 'Pancharevo', location: 'Cad. 44063.6216.3616', sourceUrl: sofiaDetail('T20H3NBmsQU=') },
  { certificate: '755', date: '15 Jul 2026', dateIso: '2026-07-15', city: 'Sofia', category: 'Municipal register', project: 'Low-rise multi-family building and underground garage', district: 'Vitosha', location: '30 Prof. Velizar Velkov St', sourceUrl: sofiaDetail('EjvJGFaCZ8Q=') },
  { certificate: '98', date: '28 Jan 2026', dateIso: '2026-01-28', city: 'Sofia', category: 'Municipal register', project: 'Residential buildings under 15m with underground garages', district: 'Studentski', location: 'Cad. 68134.1607.7224 · Malinova Dolina', sourceUrl: sofiaDetail('OR5ItYMZEiI=') },
  { certificate: '90', date: '27 Jan 2026', dateIso: '2026-01-27', city: 'Sofia', category: 'Municipal register', project: 'Buildings A and B — five entrances', district: 'Vitosha', location: '16 Neofit Hilendarski St', sourceUrl: sofiaDetail('8tobxJ4QLZQ=') },
  { certificate: 'PLO-22', date: '10 Mar 2026', dateIso: '2026-03-10', city: 'Plovdiv', category: 'V', project: 'Residential building', district: 'Zapaden · Hristo Smirnenski IV, q. 96', location: 'PI 533.1140', sourceUrl: plovdivDetail(3068) },
  { certificate: 'PLO-18', date: '2 Mar 2026', dateIso: '2026-03-02', city: 'Plovdiv', category: 'V', project: 'Multi-family residential building', district: 'Zapaden · Hristo Smirnenski III, q. 4', location: 'PI 513.392', sourceUrl: plovdivDetail(3064) },
  { certificate: 'PLO-17', date: '2 Mar 2026', dateIso: '2026-03-02', city: 'Plovdiv', category: 'V', project: 'Multi-family residential buildings', district: 'Zapaden · Hristo Smirnenski III, q. 4', location: 'PI 513.391', sourceUrl: plovdivDetail(3063) },
  { certificate: 'PLO-16', date: '2 Mar 2026', dateIso: '2026-03-02', city: 'Plovdiv', category: 'V', project: 'Multi-family residential building', district: 'Zapaden · Hristo Smirnenski III, q. 4', location: 'PI 513.390', sourceUrl: plovdivDetail(3062) },
  { certificate: 'PLO-7', date: '19 Feb 2026', dateIso: '2026-02-19', city: 'Plovdiv', category: 'IV', project: 'New three-storey residential complex, stage 2 — buildings V and G', district: 'Zapaden · Hristo Smirnenski IV, q. 91', location: 'PI 510.1084', sourceUrl: plovdivDetail(3053) },
  { certificate: 'PLO-2', date: '20 Jan 2026', dateIso: '2026-01-20', city: 'Plovdiv', category: 'IV', project: 'Residential building', district: 'Severen · Fifth city part', location: 'PI 506.1519', sourceUrl: plovdivDetail(3048) },
  { certificate: 'PLO-102', date: '19 Dec 2025', dateIso: '2025-12-19', city: 'Plovdiv', category: 'V', project: 'Magnolia Forest residential complex, Block 1', district: 'Severen · Maritsa North Residential Park', location: 'PI 501.558', sourceUrl: plovdivDetail(3045) },
  { certificate: 'PLO-100', date: '16 Dec 2025', dateIso: '2025-12-16', city: 'Plovdiv', category: 'V', project: 'Multi-family residential building', district: 'Zapaden · Hristo Smirnenski IV, q. 87', location: 'PI 510.1173', sourceUrl: plovdivDetail(3043) },
  { certificate: 'PLO-101', date: '16 Dec 2025', dateIso: '2025-12-16', city: 'Plovdiv', category: 'V', project: 'Multi-family residential building', district: 'Zapaden · Hristo Smirnenski IV, q. 87', location: 'PI 510.1175', sourceUrl: plovdivDetail(3044) },
]

export const askingMarketPulses: AskingMarketPulse[] = [
  { source: "imot.bg", city: "Sofia", value: "€2,764/m²", date: "Accessed 31 Jul 2026", dateIso: "2026-07-31", scope: "Median across current Sofia sale listings; all building ages, context only", sourceUrl: "https://www.imot.bg/obiavi/prodazhbi/grad-sofiya" },
  { source: "imot.bg", city: "Plovdiv", value: "€1,599/m²", date: "Accessed 31 Jul 2026", dateIso: "2026-07-31", scope: "Median across current Plovdiv sale listings; all building ages, context only", sourceUrl: "https://www.imot.bg/obiavi/prodazhbi/grad-plovdiv" },
  { source: "Yavlena", city: "Sofia", value: "€3,000–3,300/m²", date: "Published 5 Sep 2025", dateIso: "2025-09-05", scope: "Broker commentary for offered Act 16 units in Mladost; not citywide", sourceUrl: "https://www.yavlena.com/bg/blogs/2933" },
  { source: "Yavlena", city: "Plovdiv", value: "€1,700–1,900/m²", date: "Published 24 Jun 2025", dateIso: "2025-06-24", scope: "Broker commentary for offered new builds with Act 16 or expected shortly", sourceUrl: "https://www.yavlena.com/bg/blogs/2778" },
]

export const askingPriceReferences = commercialSeed as AskingPriceReference[]

export const sourceLinks = [
  { label: 'NSI new-dwelling HPI levels', href: 'https://www.nsi.bg/en/statistical-data/98/328', detail: '2025 = 100 index series' },
  { label: 'NSI quarter-on-quarter HPI rates', href: 'https://www.nsi.bg/en/statistical-data/98/327', detail: 'Published one-decimal change series' },
  { label: 'NSI year-on-year HPI rates', href: 'https://www.nsi.bg/en/statistical-data/98/326', detail: 'Published one-decimal change series' },
  { label: 'NSI Q1 2026 HPI announcement', href: 'https://www.nsi.bg/en/announcement/housing-price-statistics-9055', detail: 'Preliminary release and scope notes' },
  { label: 'NSI March 2026 inflation release', href: 'https://www.nsi.bg/en/press-release/inflation-and-consumer-price-indices-8989', detail: 'Quarter-end HICP comparator' },
  { label: 'NSI June 2026 inflation release', href: 'https://www.nsi.bg/en/press-release/inflation-and-consumer-price-indices-9081', detail: 'Latest HICP pulse' },
  { label: 'European Commission — Bulgaria and the euro', href: 'https://economy-finance.ec.europa.eu/euro/eu-countries-and-euro/bulgaria-and-euro_en', detail: 'Conversion and dual-display rules' },
  { label: 'Council final euro-adoption acts', href: 'https://www.consilium.europa.eu/en/press/press-releases/2025/07/08/bulgaria-ready-to-use-the-euro-from-1-january-2026-council-takes-final-steps/', detail: '8 July 2025 decision' },
  { label: 'BNB housing-loan requirements', href: 'https://www.bnb.bg/AboutUs/PressOffice/POPressReleases/POPRDate/PR_20240911_1_EN', detail: 'Limits and 5% deviation allowance' },
  { label: 'BNB June 2026 monetary survey', href: 'https://www.bnb.bg/AboutUs/PressOffice/POStatisticalPressReleases/POPRSMonetarySurvey/202606_S_MS_PRESS_BG', detail: 'Housing-credit stock' },
  { label: 'Sofia commissioning register', href: 'https://nag.sofia.bg/RegisterCertificateForExploitationBuildings', detail: 'Permit and certificate records' },
  { label: 'Plovdiv municipal register directory', href: 'https://www.plovdiv.bg/uslugi/registers/', detail: 'Official register access' },
  { label: 'DNSK use-permit register', href: 'https://dnsk.bg/registri/publichen-registar-na-razresheniyata-za-polzvane-izdadeni-ot-dnsk/', detail: 'Separate coverage for categories I–III' },
]
