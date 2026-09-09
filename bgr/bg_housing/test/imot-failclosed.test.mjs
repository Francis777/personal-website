import assert from 'node:assert/strict'
import test from 'node:test'
import { discoverImotRecords } from '../server/sources/imot.mjs'

test('imot discovery fails closed when recognized cards yield zero qualifying records', async () => {
  const fullId = '1b178397022499860'
  const futureOnly = `
    <div class="item" id="ida${fullId}">
      <div class="price"><div>260 000 €</div></div>
      <a class="title" href="/obiava-${fullId}-example">Продава 2-СТАЕН<location>град София, Витоша</location></a>
      <div class="info">61 кв.м, Ще бъде въведен в експлоатация 2026 г.</div>
    </div>`
  await assert.rejects(
    discoverImotRecords({ fetchHtml: async () => futureOnly, now: new Date('2026-08-01T12:00:00.000Z') }),
    /zero qualifying records/i,
  )
})
