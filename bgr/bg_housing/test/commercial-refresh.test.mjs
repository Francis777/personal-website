import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { CommercialService, CommercialServiceError } from '../server/commercial-service.mjs'
import { mergeCommercialRecords, normalizeCommercialRecord } from '../server/commercial-records.mjs'
import { CommercialStore } from '../server/commercial-store.mjs'
import { createCommercialApp } from '../server/index.mjs'

const now = new Date('2026-08-01T12:00:00.000Z')

const record = (overrides = {}) => ({
  id: '123456',
  source: 'imot.bg',
  city: 'Sofia',
  district: 'Mladost 4',
  property: '2-room apartment',
  askingPriceEur: 200000,
  areaSqm: 80,
  eurSqm: 2500,
  recordDate: 'Published 1 Jul 2026',
  recordDateIso: '2026-07-01',
  act16Claim: 'Act 16 from 2025',
  finish: 'Not stated',
  sourceUrl: 'https://www.imot.bg/obiava-123456-example',
  ...overrides,
})

test('commercial validation accepts a recent completed claim and rejects future or ambiguous claims', () => {
  assert.equal(normalizeCommercialRecord(record(), { now }).ok, true)
  assert.match(normalizeCommercialRecord(record({ act16Claim: 'Expected Act 16 in 2026' }), { now }).error, /completed Act 16/i)
  assert.match(normalizeCommercialRecord(record({ act16Claim: 'Act 16 from 2024' }), { now }).error, /two-year window/i)
  assert.match(normalizeCommercialRecord(record({ sourceUrl: 'https://example.com/123456' }), { now }).error, /host/i)
})

test('merge deduplicates by source and ID and sorts deterministically newest first', () => {
  const merged = mergeCommercialRecords(
    [record({ id: "000111", recordDateIso: "2026-05-01", recordDate: "1 May 2026", sourceUrl: "https://www.imot.bg/obiava-1b177000000000111-example" })],
    [
      record({ id: "1b177000000000111", recordDateIso: "2026-06-01", recordDate: "1 Jun 2026", askingPriceEur: 208000, eurSqm: 2600, sourceUrl: "https://www.imot.bg/obiava-1b177000000000111-example" }),
      record({ id: '222222', recordDateIso: '2026-07-15', recordDate: '15 Jul 2026', sourceUrl: 'https://www.imot.bg/obiava-222222-example' }),
    ],
    { now },
  )
  assert.equal(merged.records.length, 2)
  assert.deepEqual(merged.records.map((item) => item.id), ['222222', '000111'])
  assert.equal(merged.records[1].askingPriceEur, 208000)
  assert.deepEqual({ added: merged.stats.added, updated: merged.stats.updated }, { added: 1, updated: 1 })
})

test('store falls back to seed and writes an atomic runtime snapshot', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'dwelling-lens-store-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const seedPath = join(directory, 'seed.json')
  const runtimePath = join(directory, 'runtime', 'commercial.json')
  await writeFile(seedPath, `${JSON.stringify([record()])}\n`)
  const store = new CommercialStore({ seedPath, runtimePath })
  const seeded = await store.read()
  assert.equal(seeded.dataSource, 'seed')
  assert.equal(seeded.records.length, 1)

  await store.write({ records: seeded.records, lastRefresh: { finishedAt: now.toISOString() }, updatedAt: now.toISOString() })
  const persisted = JSON.parse(await readFile(runtimePath, 'utf8'))
  assert.equal(persisted.schemaVersion, 1)
  assert.equal(persisted.records[0].id, '123456')
  assert.equal((await store.read()).dataSource, 'runtime')
})

test('refresh preserves data on a source failure, persists success, and enforces cooldown', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'dwelling-lens-service-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const seedPath = join(directory, 'seed.json')
  const runtimePath = join(directory, 'runtime.json')
  await writeFile(seedPath, `${JSON.stringify([record()])}\n`)
  const service = new CommercialService({
    store: new CommercialStore({ seedPath, runtimePath }),
    clock: () => now,
    cooldownMs: 60_000,
    fetchHtml: async () => '',
    sources: [
      { source: 'imot.bg', discover: async () => ({ records: [record({ id: '654321', recordDateIso: '2026-07-20', recordDate: '20 Jul 2026', sourceUrl: 'https://www.imot.bg/obiava-654321-example' })], diagnostics: { discovered: 1 } }) },
      { source: 'Yavlena', discover: async () => { throw new Error('source unavailable') } },
    ],
  })

  const refreshed = await service.refresh()
  assert.equal(refreshed.records.length, 2)
  assert.equal(refreshed.records[0].id, '654321')
  assert.equal(refreshed.refresh.sources[1].status, 'error')
  assert.equal(refreshed.meta.ordering, "recordDateIso-desc")
  assert.equal(refreshed.meta.refreshInProgress, false)
  await assert.rejects(service.refresh(), (error) => error instanceof CommercialServiceError && error.status === 429)
})

test('refresh is single-flight', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'dwelling-lens-lock-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const seedPath = join(directory, 'seed.json')
  await writeFile(seedPath, '[]\n')
  let release
  const pending = new Promise((resolve) => { release = resolve })
  const service = new CommercialService({
    store: new CommercialStore({ seedPath, runtimePath: join(directory, 'runtime.json') }),
    clock: () => now,
    cooldownMs: 0,
    sources: [{ source: 'imot.bg', discover: async () => pending }],
  })
  const first = service.refresh()
  await new Promise((resolve) => setImmediate(resolve))
  await assert.rejects(service.refresh(), (error) => error instanceof CommercialServiceError && error.status === 409)
  release({ records: [] })
  await first
})

test('HTTP API returns the documented envelope and maps service errors', async (context) => {
  const responseBody = { records: [record()], meta: { refreshedAt: null, recordCount: 1, sourceCounts: { 'imot.bg': 1 }, dataSource: 'seed', ordering: 'recordDateIso-desc' } }
  const service = {
    get: async () => responseBody,
    refresh: async () => { throw new CommercialServiceError(429, 'refresh_cooldown', 'Wait.', { retryAfterSeconds: 9 }) },
  }
  const server = createCommercialApp({ service, distDir: join(tmpdir(), 'missing-dist') })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`

  const getResponse = await fetch(`${base}/api/commercial`)
  assert.equal(getResponse.status, 200)
  assert.deepEqual(await getResponse.json(), responseBody)
  const postResponse = await fetch(`${base}/api/commercial/refresh`, { method: 'POST' })
  assert.equal(postResponse.status, 429)
  assert.equal(postResponse.headers.get('retry-after'), '9')
  assert.equal((await postResponse.json()).error.code, 'refresh_cooldown')
})
