export async function readLimitedBody(response, { maxBytes, timeoutMs, signal } = {}) {
  if (signal?.aborted) throw signal.reason ?? new Error('Request aborted.')
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  let timeout
  let abort
  const interrupted = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Remote response body timed out.')), timeoutMs)
    abort = () => reject(signal.reason ?? new Error('Request aborted.'))
    signal?.addEventListener('abort', abort, { once: true })
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted])
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error('Remote HTML exceeded the configured size limit.')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}
