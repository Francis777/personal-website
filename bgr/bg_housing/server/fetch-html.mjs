import { readLimitedBody } from './read-limited-body.mjs'

const ALLOWED_HOSTS = new Set(['imot.bg', 'www.imot.bg', 'yavlena.com', 'www.yavlena.com'])
const DEFAULT_DELAYS = new Map([
  ['imot.bg', 1_250],
  ['www.imot.bg', 1_250],
  ['yavlena.com', 5_000],
  ['www.yavlena.com', 5_000],
])

const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason ?? new Error("Request aborted."))
    return
  }
  if (milliseconds <= 0) return resolve()
  const timer = setTimeout(resolve, milliseconds)
  signal?.addEventListener('abort', () => {
    clearTimeout(timer)
    reject(signal.reason ?? new Error('Request aborted.'))
  }, { once: true })
})

const retryDelay = (response, attempt) => {
  const seconds = Number(response.headers.get('retry-after'))
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 10_000)
  return 500 * (attempt + 1)
}

export function createFetchHtml({
  fetchImpl = globalThis.fetch,
  timeoutMs = 12_000,
  maxBytes = 2_500_000,
  userAgent = 'DwellingLensBulgaria/1.0 (+manual, bounded public-listing refresh)',
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.')
  const hostQueues = new Map()
  const lastRequestAt = new Map()

  return async function fetchHtml(input, options = {}) {
    const initialUrl = new URL(input)
    if (initialUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(initialUrl.hostname.toLowerCase())) {
      throw new Error('Commercial refresh refused a non-allowlisted URL.')
    }

    const hostname = initialUrl.hostname.toLowerCase()
    const prior = hostQueues.get(hostname) ?? Promise.resolve()
    const task = prior.catch(() => {}).then(async () => {
      const minDelayMs = Number.isFinite(options.minDelayMs)
        ? Math.max(0, options.minDelayMs)
        : DEFAULT_DELAYS.get(hostname) ?? 1_500
      const elapsed = Date.now() - (lastRequestAt.get(hostname) ?? 0)
      await wait(Math.max(0, minDelayMs - elapsed), options.signal)

      let currentUrl = initialUrl
      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        let response
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(new Error('Remote request timed out.')), timeoutMs)
          const abort = () => controller.abort(options.signal?.reason ?? new Error('Request aborted.'))
          options.signal?.addEventListener('abort', abort, { once: true })
          try {
            lastRequestAt.set(hostname, Date.now())
            response = await fetchImpl(currentUrl, {
              redirect: 'manual',
              signal: controller.signal,
              headers: {
                accept: 'text/html,application/xhtml+xml;q=0.9',
                'accept-language': 'bg,en;q=0.7',
                'user-agent': userAgent,
                ...options.headers,
              },
            })
          } finally {
            clearTimeout(timeout)
            options.signal?.removeEventListener('abort', abort)
          }
          if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) break
          await wait(retryDelay(response, attempt), options.signal)
        }

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location || redirectCount === 3) throw new Error('Remote source returned an invalid redirect.')
          currentUrl = new URL(location, currentUrl)
          if (currentUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(currentUrl.hostname.toLowerCase())) {
            throw new Error('Commercial refresh refused a cross-host redirect.')
          }
          continue
        }

        if (!response.ok) {
          const error = new Error(`Remote source returned HTTP ${response.status}.`)
          error.status = response.status
          throw error
        }
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType && !/(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
          throw new Error(`Remote source returned unsupported content type: ${contentType}.`)
        }
        const declaredLength = Number(response.headers.get('content-length'))
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          throw new Error('Remote HTML exceeded the configured size limit.')
        }
        const body = await readLimitedBody(response, { maxBytes, timeoutMs, signal: options.signal })
        const headerCharset = contentType.match(/charset\s*=\s*["\x27]?([^;"\x27\s]+)/i)?.[1]
        const prefix = new TextDecoder("latin1").decode(body.slice(0, 4_096))
        const metaCharset = prefix.match(/<meta[^>]+charset\s*=\s*["\x27]?([^"\x27\s/>]+)/i)?.[1]
          ?? prefix.match(/<meta[^>]+content=["\x27][^"\x27]*charset=([^;"\x27\s]+)/i)?.[1]
        const charset = options.encoding ?? headerCharset ?? metaCharset ?? "utf-8"
        try {
          return new TextDecoder(charset).decode(body)
        } catch {
          return new TextDecoder("utf-8").decode(body)
        }
      }
      throw new Error('Too many source redirects.')
    })

    hostQueues.set(hostname, task)
    try {
      return await task
    } finally {
      if (hostQueues.get(hostname) === task) hostQueues.delete(hostname)
    }
  }
}
