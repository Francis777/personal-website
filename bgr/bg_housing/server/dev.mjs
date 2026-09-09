import { createServer as createViteServer } from 'vite'
import { createCommercialApp } from './index.mjs'

const host = process.env.HOST ?? '127.0.0.1'
const apiPort = Number(process.env.API_PORT ?? 4173)
const vitePort = Number(process.env.VITE_PORT ?? 5173)

const api = createCommercialApp()
await new Promise((resolve, reject) => {
  api.once('error', reject)
  api.listen(apiPort, host, resolve)
})

const vite = await createViteServer({
  server: { host, port: vitePort, strictPort: true, allowedHosts: true },
})

try {
  await vite.listen()
  console.log(`Commercial API listening on http://${host}:${apiPort}`)
  vite.printUrls()
} catch (error) {
  await new Promise((resolve) => api.close(resolve))
  throw error
}

const close = async () => {
  await Promise.all([
    vite.close(),
    new Promise((resolve) => api.close(resolve)),
  ])
  process.exit(0)
}

process.once('SIGINT', close)
process.once('SIGTERM', close)
