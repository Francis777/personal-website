import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const defaultCommercialSeedPath = resolve(projectRoot, 'data/commercial-seed.json')
export const defaultCommercialRuntimePath = resolve(projectRoot, 'var/commercial-records.json')

const parseJsonFile = async (path) => JSON.parse(await readFile(path, 'utf8'))

const seedSnapshot = (seed) => {
  if (!Array.isArray(seed)) throw new Error('Commercial seed must be a JSON array.')
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: null,
    records: seed,
    lastRefresh: null,
  }
}

const runtimeSnapshot = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.records)) {
    throw new Error('Commercial runtime snapshot has an invalid shape.')
  }
  return {
    schemaVersion: Number.isInteger(value.schemaVersion) ? value.schemaVersion : 1,
    revision: Number.isInteger(value.revision) ? value.revision : 0,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    records: value.records,
    lastRefresh: value.lastRefresh && typeof value.lastRefresh === 'object' ? value.lastRefresh : null,
  }
}

export class CommercialStore {
  constructor({
    seedPath = defaultCommercialSeedPath,
    runtimePath = process.env.COMMERCIAL_DATA_PATH || defaultCommercialRuntimePath,
  } = {}) {
    this.seedPath = resolve(seedPath)
    this.runtimePath = resolve(runtimePath)
  }

  async read() {
    try {
      const snapshot = runtimeSnapshot(await parseJsonFile(this.runtimePath))
      return { ...snapshot, dataSource: 'runtime', warning: null }
    } catch (runtimeError) {
      const snapshot = seedSnapshot(await parseJsonFile(this.seedPath))
      const missing = runtimeError?.code === 'ENOENT'
      return {
        ...snapshot,
        dataSource: 'seed',
        warning: missing ? null : 'The runtime snapshot could not be read; the bundled seed is being shown.',
      }
    }
  }

  async write({ records, lastRefresh, previousRevision = 0, updatedAt = new Date().toISOString() }) {
    const snapshot = {
      schemaVersion: 1,
      revision: previousRevision + 1,
      updatedAt,
      records,
      lastRefresh,
    }
    const directory = dirname(this.runtimePath)
    await mkdir(directory, { recursive: true })
    const temporaryPath = `${this.runtimePath}.${process.pid}.${Date.now()}.tmp`
    let handle
    try {
      handle = await open(temporaryPath, 'wx', 0o600)
      await handle.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
      await handle.sync()
      await handle.close()
      handle = null
      await rename(temporaryPath, this.runtimePath)
      return { ...snapshot, dataSource: 'runtime', warning: null }
    } catch (error) {
      if (handle) await handle.close().catch(() => {})
      await unlink(temporaryPath).catch(() => {})
      throw error
    }
  }
}
