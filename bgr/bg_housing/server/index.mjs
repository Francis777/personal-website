import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CommercialService, CommercialServiceError } from './commercial-service.mjs'
import { CommercialStore } from './commercial-store.mjs'
import { createFetchHtml } from './fetch-html.mjs'
import { defaultCommercialSources } from './sources/index.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultDistDir = resolve(projectRoot, 'dist')
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
])

const writeJson = (response, status, value, extraHeaders = {}) => {
  const body = `${JSON.stringify(value)}\n`
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  response.end(body)
}

const sameOrigin = (request) => {
  const origin = request.headers.origin
  if (!origin) return true
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim()
  const protocol = forwardedProtocol || (request.socket.encrypted ? 'https' : 'http')
  const host = request.headers.host
  if (!host) return false
  try {
    return new URL(origin).origin === `${protocol}://${host}`
  } catch {
    return false
  }
}

const serveStatic = async (request, response, distDir, pathname) => {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }
  const requested = decoded === '/' ? '/index.html' : decoded
  let filePath = resolve(distDir, `.${requested}`)
  if (filePath !== distDir && !filePath.startsWith(`${distDir}${sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const details = await stat(filePath)
    if (!details.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' })
  } catch (error) {
    if (error?.code !== 'ENOENT' || extname(requested)) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end(error?.code === 'ENOENT' ? 'Not found' : 'Server error')
      return
    }
    filePath = resolve(distDir, 'index.html')
  }
  try {
    const body = await readFile(filePath)
    response.writeHead(200, {
      'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'content-length': body.byteLength,
      'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    })
    if (request.method === 'HEAD') response.end()
    else response.end(body)
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end(error?.code === 'ENOENT' ? 'Not found' : 'Server error')
  }
}

export const createDefaultCommercialService = (options = {}) => new CommercialService({
  store: options.store ?? new CommercialStore(options.storeOptions),
  sources: options.sources ?? defaultCommercialSources,
  fetchHtml: options.fetchHtml ?? createFetchHtml(options.fetchOptions),
  clock: options.clock,
  cooldownMs: options.cooldownMs,
  refreshEnabled: options.refreshEnabled,
})

export function createCommercialApp({
  service = createDefaultCommercialService(),
  distDir = defaultDistDir,
} = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    try {
      if (url.pathname === '/api/commercial') {
        if (request.method !== 'GET') {
          writeJson(response, 405, { error: { code: 'method_not_allowed', message: 'Use GET for this endpoint.' } }, { allow: 'GET' })
          return
        }
        writeJson(response, 200, await service.get())
        return
      }

      if (url.pathname === '/api/commercial/refresh') {
        if (request.method !== 'POST') {
          writeJson(response, 405, { error: { code: 'method_not_allowed', message: 'Use POST for this endpoint.' } }, { allow: 'POST' })
          return
        }
        if (!sameOrigin(request)) {
          writeJson(response, 403, { error: { code: 'origin_forbidden', message: 'Refresh requires a same-origin request.' } })
          return
        }
        const contentLength = Number(request.headers['content-length'] ?? 0)
        if (Number.isFinite(contentLength) && contentLength > 1_024) {
          writeJson(response, 413, { error: { code: 'body_too_large', message: 'Refresh requests do not accept a request body.' } })
          return
        }
        writeJson(response, 200, await service.refresh())
        return
      }

      if (url.pathname.startsWith('/api/')) {
        writeJson(response, 404, { error: { code: 'not_found', message: 'API endpoint not found.' } })
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed')
        return
      }
      await serveStatic(request, response, resolve(distDir), url.pathname)
    } catch (error) {
      if (error instanceof CommercialServiceError) {
        const retryAfter = error.details?.retryAfterSeconds
        writeJson(response, error.status, {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
        }, retryAfter ? { 'retry-after': String(retryAfter) } : {})
        return
      }
      console.error(error)
      writeJson(response, 500, { error: { code: 'internal_error', message: 'The commercial data service failed.' } })
    }
  })
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 4173)
  const host = process.env.HOST ?? '127.0.0.1'
  const server = createCommercialApp()
  server.listen(port, host, () => {
    console.log(`Dwelling Lens server listening on http://${host}:${port}`)
  })
}
