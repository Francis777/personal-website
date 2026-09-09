import assert from 'node:assert/strict'
import test from 'node:test'
import { createFetchHtml } from '../server/fetch-html.mjs'
import { readLimitedBody } from '../server/read-limited-body.mjs'

test('fetchHtml decodes a declared Windows-1251 response', async () => {
  const bytes = Uint8Array.from([0xc0, 0xea, 0xf2, 0x20, 0x31, 0x36])
  const fetchHtml = createFetchHtml({
    fetchImpl: async () => new Response(bytes, { headers: { 'content-type': 'text/html; charset=windows-1251' } }),
  })
  assert.equal(await fetchHtml('https://www.imot.bg/example', { minDelayMs: 0 }), 'Акт 16')
})

test('fetchHtml rejects an already-aborted request before calling fetch', async () => {
  const controller = new AbortController()
  controller.abort(new Error('stopped'))
  let calls = 0
  const fetchHtml = createFetchHtml({ fetchImpl: async () => { calls += 1; return new Response('never') } })
  await assert.rejects(fetchHtml('https://www.imot.bg/example', { signal: controller.signal, minDelayMs: 0 }), /stopped/)
  assert.equal(calls, 0)
})

test('streaming body reader enforces its byte cap before buffering the full response', async () => {
  const response = new Response(Uint8Array.from([1, 2, 3, 4, 5]))
  await assert.rejects(readLimitedBody(response, { maxBytes: 4, timeoutMs: 1_000 }), /size limit/i)
})

test('streaming body reader times out a stalled body', async () => {
  const response = new Response(new ReadableStream({ start() {} }))
  await assert.rejects(readLimitedBody(response, { maxBytes: 100, timeoutMs: 10 }), /timed out/i)
})
