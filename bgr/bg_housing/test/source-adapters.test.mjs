import assert from 'node:assert/strict'
import test from 'node:test'
import { commercialRecordKey, mergeCommercialRecords, normalizeCommercialRecord } from '../server/commercial-records.mjs'
import { creationDateFromId, parseImotCard } from '../server/sources/imot.mjs'
import { discoverYavlenaRecords, parseYavlenaDetail, parseYavlenaSearch } from '../server/sources/yavlena.mjs'

const now = new Date('2026-08-01T12:00:00.000Z')

const baseRecord = (sourceRecordId, price) => ({
  id: '012345',
  sourceRecordId,
  source: 'imot.bg',
  city: 'Sofia',
  district: 'Vitosha',
  property: '1-room apartment',
  askingPriceEur: price,
  areaSqm: 40,
  eurSqm: price / 40,
  recordDate: 'Listed 1 Jun 2026',
  recordDateIso: '2026-06-01',
  act16Claim: 'Commissioned in 2025',
  act16Year: 2025,
  finish: 'Not stated',
  sourceUrl: `https://www.imot.bg/obiava-${sourceRecordId}-example`,
})

test('commercial identity uses the full source ID, not a collision-prone display suffix', () => {
  const first = baseRecord('1b1770000000012345', 120000)
  const second = baseRecord('1b1780000000012345', 130000)
  const normalizedFirst = normalizeCommercialRecord(first, { now })
  const normalizedSecond = normalizeCommercialRecord(second, { now })
  assert.equal(normalizedFirst.ok, true)
  assert.equal(normalizedSecond.ok, true)
  assert.notEqual(commercialRecordKey(normalizedFirst.record), commercialRecordKey(normalizedSecond.record))
  assert.equal(mergeCommercialRecords([], [first, second], { now }).records.length, 2)
})

test('imot fixture parser extracts the total asking price, full identity, area and recent completion claim', () => {
  const fullId = '1a178530397375522'
  const html = `
    <div class="item" id="ida${fullId}">
      <div class="zaglavie">
        <div class="price"><div>125 000 €</div><span>2 777 €/m²</span></div>
        <a class="title" href="/obiava-${fullId}-prodava-ednostaen-apartament-grad-sofiya-vitosha">1-СТАЕН АПАРТАМЕНТ</a>
      </div>
      <location>град София, Овча купел 2</location>
      <div class="info">84 кв.м, Въведен в експлоатация 2025 г.</div>
    </div>`
  const parsed = parseImotCard({ fullId, html }, 'Sofia')
  assert.ok(parsed)
  assert.equal(parsed.sourceRecordId, fullId)
  assert.equal(parsed.id, '375522')
  assert.equal(parsed.askingPriceEur, 125000)
  assert.equal(parsed.areaSqm, 84)
  assert.equal(parsed.district, "Овча купел 2")
  assert.equal(parsed.act16Year, 2025)
  assert.equal(parsed.recordDateIso, new Date(1_785_303_973_000).toISOString().slice(0, 10))
})

test('imot fixture parser rejects expected future commissioning', () => {
  const fullId = '1a178530397375522'
  const html = `<div class="item" id="ida${fullId}"><div class="price">125 000 €</div><a class="title" href="/obiava-${fullId}-example">1-СТАЕН</a><div>45 кв. м. Ще бъде въведен в експлоатация 2026 г.</div></div>`
  assert.equal(parseImotCard({ fullId, html }, 'Sofia'), null)
})


const flightHtml = (value) => "<script>self.__next_f.push([1," + JSON.stringify(value) + "])</script>"

test("Yavlena Flight search parser returns SSR cards", () => {
  const cards = [{ propertyInnerNumber: 172528, cityName: "София", dateCreated: "2026-07-02T16:53:09.513" }]
  const parsed = parseYavlenaSearch(flightHtml(JSON.stringify({ ssrResult: { data: { cards } } })))
  assert.deepEqual(parsed, cards)
})

test("Yavlena detail parser accepts dated completed Act 16 and rejects future wording", () => {
  const propertyData = {
    innerNumber: 167877,
    dateCreated: "2026-03-17T23:50:31.837",
    cityName: "София",
    quarterName: "Левски",
    priceDecimal: 287500,
    area: 92,
    title: "Тристаен апартамент с Акт 16",
    description: "Акт 16 от октомври 2025.",
    isUnderConstruction: false,
    isSoldOrRented: false,
    isRent: false,
    isProject: false,
    inProject: false,
  }
  const qualifying = parseYavlenaDetail(flightHtml(JSON.stringify({ property: { propertyData } })), "Sofia")
  assert.equal(qualifying.reason, null)
  assert.equal(qualifying.record.id, "167877")
  assert.equal(qualifying.record.recordDateIso, "2026-03-17")
  assert.equal(qualifying.record.askingPriceEur, 287500)
  assert.equal(qualifying.record.areaSqm, 92)
  assert.equal(qualifying.record.act16Year, 2025)

  const future = parseYavlenaDetail(
    flightHtml(JSON.stringify({ property: { propertyData: { ...propertyData, description: "Очаква Акт 16 през 2026." } } })),
    "Sofia",
  )
  assert.equal(future.reason, "future_completion")
})


test("Yavlena discovery accepts Bulgarian city labels and fails closed when every detail request fails", async () => {
  const card = {
    propertyInnerNumber: 167877,
    cityName: "София",
    dateCreated: "2026-03-17T23:50:31.837",
    isUnderConstruction: false,
    isSoldOrRented: false,
    isRent: false,
    isProject: false,
    inProject: false,
  }
  const searchPage = flightHtml(JSON.stringify({ ssrResult: { data: { cards: [card] } } }))
  const emptyPage = flightHtml(JSON.stringify({ ssrResult: { data: { cards: [] } } }))
  const detailPage = flightHtml(JSON.stringify({ property: { propertyData: {
    innerNumber: 167877,
    dateCreated: card.dateCreated,
    cityName: "София",
    quarterName: "Левски",
    priceDecimal: 287500,
    area: 92,
    title: "Тристаен апартамент с Акт 16",
    description: "Акт 16 от октомври 2025.",
    isUnderConstruction: false,
    isSoldOrRented: false,
    isRent: false,
    isProject: false,
    inProject: false,
  } } }))
  const searchOnly = async (url) => url.includes("sofia-sofia") ? searchPage : emptyPage
  const successfulFetch = async (url) => url.endsWith("/167877") ? detailPage : searchOnly(url)
  const result = await discoverYavlenaRecords({ fetchHtml: successfulFetch, now, maxDetailsPerCity: 1 })
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0].city, "Sofia")
  assert.equal(result.records[0].id, "167877")

  const failingFetch = async (url) => {
    if (url.includes("/sales/")) return searchOnly(url)
    throw new Error("detail network failure")
  }
  await assert.rejects(
    discoverYavlenaRecords({ fetchHtml: failingFetch, now, maxDetailsPerCity: 1 }),
    /no parseable responses/i,
  )
})
