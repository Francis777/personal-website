import assert from 'node:assert/strict'
import test from 'node:test'
import { parseYavlenaDetail, parseYavlenaSearch } from '../server/sources/yavlena.mjs'

const flightPage = (value) => `<script>self.__next_f.push([1,${JSON.stringify(`1:${JSON.stringify(value)}`)}])</script>`

test('Yavlena fixture parser extracts SSR search cards', () => {
  const cards = [{ propertyInnerNumber: 167877, cityName: 'София', dateCreated: '2026-03-17T23:50:31.837' }]
  assert.deepEqual(parseYavlenaSearch(flightPage({ ssrResult: { data: { cards } } })), cards)
})

test('Yavlena fixture parser keeps only minimal qualifying detail facts', () => {
  const html = flightPage({
    propertyData: {
      innerNumber: 167877,
      cityName: 'София',
      quarterName: 'Левски',
      title: 'Тристаен апартамент с акт 16, завършен до ключ',
      description: 'Акт 16 от октомври 2025.',
      dateCreated: '2026-03-17T23:50:31.837',
      priceDecimal: 287500,
      area: 92,
      isRent: false,
      isSoldOrRented: false,
      isUnderConstruction: false,
    },
  })
  const parsed = parseYavlenaDetail(html, 'Sofia')
  assert.equal(parsed.reason, null)
  assert.deepEqual({
    id: parsed.record.id,
    city: parsed.record.city,
    district: parsed.record.district,
    askingPriceEur: parsed.record.askingPriceEur,
    areaSqm: parsed.record.areaSqm,
    recordDateIso: parsed.record.recordDateIso,
    act16Year: parsed.record.act16Year,
  }, {
    id: '167877',
    city: 'Sofia',
    district: 'Левски',
    askingPriceEur: 287500,
    areaSqm: 92,
    recordDateIso: '2026-03-17',
    act16Year: 2025,
  })
  assert.equal('description' in parsed.record, false)
})

test('Yavlena fixture parser rejects expected or pre-Act-16 wording', () => {
  const html = flightPage({
    propertyData: {
      innerNumber: 170000,
      cityName: 'Пловдив',
      quarterName: 'Тракия',
      title: 'Тристаен апартамент пред Акт 16',
      description: 'Очакван Акт 16 през 2026.',
      dateCreated: '2026-06-01T00:00:00',
      priceDecimal: 180000,
      area: 90,
      isRent: false,
      isSoldOrRented: false,
      isUnderConstruction: false,
    },
  })
  assert.equal(parseYavlenaDetail(html, 'Plovdiv').reason, 'future_completion')
})
