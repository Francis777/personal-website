import { mergeCommercialRecords, normalizeCommercialRecord, sortCommercialRecords } from './commercial-records.mjs'

const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('The refresh clock returned an invalid date.')
  return date
}

const safeCount = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback

const sourceCounts = (records) => records.reduce((counts, record) => {
  counts[record.source] = (counts[record.source] ?? 0) + 1
  return counts
}, {})

const normalizeAdapterResult = (result) => {
  if (Array.isArray(result)) return { records: result, diagnostics: {} }
  if (!result || typeof result !== 'object' || !Array.isArray(result.records)) {
    throw new Error('Source adapter returned an invalid result.')
  }
  return { records: result.records, diagnostics: result.diagnostics ?? result }
}

export class CommercialServiceError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'CommercialServiceError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export class CommercialService {
  constructor({
    store,
    sources,
    fetchHtml,
    clock = () => new Date(),
    cooldownMs = Number(process.env.COMMERCIAL_REFRESH_COOLDOWN_MS ?? 15 * 60 * 1_000),
    refreshEnabled = process.env.COMMERCIAL_REFRESH_DISABLED !== '1',
  }) {
    if (!store) throw new TypeError('CommercialService requires a store.')
    if (!Array.isArray(sources)) throw new TypeError('CommercialService requires source adapters.')
    this.store = store
    this.sources = sources
    this.fetchHtml = fetchHtml
    this.clock = clock
    this.cooldownMs = Number.isFinite(cooldownMs) ? Math.max(0, cooldownMs) : 15 * 60 * 1_000
    this.refreshEnabled = refreshEnabled
    this.running = null
    this.lastStartedAt = null
  }

  async get() {
    const snapshot = await this.store.read()
    const now = asDate(this.clock())
    const normalized = mergeCommercialRecords(snapshot.records, [], { now }).records
    return this.#response(normalized, snapshot, now)
  }

  async refresh() {
    if (!this.refreshEnabled) {
      throw new CommercialServiceError(503, "refresh_disabled", "Commercial refresh is disabled on this deployment.")
    }
    if (this.running) {
      throw new CommercialServiceError(409, "refresh_in_progress", "A commercial refresh is already running.")
    }

    const task = this.#prepareRefresh()
    this.running = task
    try {
      return await task
    } finally {
      if (this.running === task) this.running = null
    }
  }

  async #prepareRefresh() {
    const now = asDate(this.clock())
    const snapshot = await this.store.read()
    const persistedStartedAt = snapshot.lastRefresh?.startedAt ? new Date(snapshot.lastRefresh.startedAt) : null
    const previousStartedAt = [this.lastStartedAt, persistedStartedAt]
      .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
      .sort((left, right) => right - left)[0]
    if (previousStartedAt) {
      const retryAt = new Date(previousStartedAt.getTime() + this.cooldownMs)
      if (retryAt > now) {
        throw new CommercialServiceError(429, "refresh_cooldown", "Commercial refresh is temporarily rate-limited.", {
          retryAt: retryAt.toISOString(),
          retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1_000)),
        })
      }
    }

    this.lastStartedAt = now
    return this.#runRefresh(snapshot, now)
  }

  async #runRefresh(snapshot, startedAt) {
    const discovered = []
    const sourceResults = []

    for (const adapter of this.sources) {
      const source = adapter?.source ?? 'unknown'
      try {
        if (typeof adapter?.discover !== 'function') throw new Error('Source adapter has no discover function.')
        const unpacked = normalizeAdapterResult(await adapter.discover({
          fetchHtml: this.fetchHtml,
          now: startedAt,
          existingRecords: snapshot.records,
          revision: snapshot.revision,
        }))
        const accepted = []
        const validationErrors = []
        for (const raw of unpacked.records) {
          const normalized = normalizeCommercialRecord(raw, { now: startedAt })
          if (normalized.ok) accepted.push(normalized.record)
          else if (validationErrors.length < 10) validationErrors.push({ id: raw?.id, reason: normalized.error })
        }
        discovered.push(...accepted)
        const adapterRejected = safeCount(unpacked.diagnostics.rejected, 0)
        const reportedDiscovered = safeCount(unpacked.diagnostics.discovered, unpacked.records.length + adapterRejected)
        const reportedReviewed = safeCount(unpacked.diagnostics.reviewed, unpacked.records.length + adapterRejected)
        sourceResults.push({
          source,
          status: 'ok',
          discovered: Math.max(reportedDiscovered, unpacked.records.length),
          reviewed: Math.max(reportedReviewed, accepted.length + validationErrors.length),
          accepted: accepted.length,
          rejected: adapterRejected + validationErrors.length,
          ...(validationErrors.length ? { validationErrors } : {}),
          ...(unpacked.diagnostics.rejectionReasons && typeof unpacked.diagnostics.rejectionReasons === 'object'
            ? { rejectionReasons: unpacked.diagnostics.rejectionReasons }
            : {}),
          ...(Array.isArray(unpacked.diagnostics.warnings) && unpacked.diagnostics.warnings.length
            ? { warnings: unpacked.diagnostics.warnings.map(String).slice(0, 10) }
            : {}),
        })
      } catch (error) {
        sourceResults.push({
          source,
          status: 'error',
          discovered: 0,
          accepted: 0,
          rejected: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const successfulSources = sourceResults.filter((result) => result.status === 'ok')
    if (!successfulSources.length) {
      throw new CommercialServiceError(502, 'all_sources_failed', 'Neither commercial source could be refreshed.', {
        sources: sourceResults,
      })
    }

    const finishedAt = asDate(this.clock())
    const merged = mergeCommercialRecords(snapshot.records, discovered, { now: finishedAt })
    const adapterRejected = sourceResults.reduce((total, result) => total + result.rejected, 0)
    const refresh = {
      added: merged.stats.added,
      updated: merged.stats.updated,
      unchanged: merged.stats.unchanged,
      rejected: adapterRejected + merged.stats.rejected,
      expired: merged.stats.expired,
      sources: sourceResults,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    }
    const written = await this.store.write({
      records: merged.records,
      lastRefresh: refresh,
      previousRevision: snapshot.revision,
      updatedAt: finishedAt.toISOString(),
    })
    const response = this.#response(merged.records, written, finishedAt)
    response.meta.refreshInProgress = false
    return { ...response, refresh }
  }

  #response(records, snapshot, now) {
    const persistedStartedAt = snapshot.lastRefresh?.startedAt ? new Date(snapshot.lastRefresh.startedAt) : null
    const candidate = [this.lastStartedAt, persistedStartedAt]
      .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
      .sort((left, right) => right - left)[0]
    const nextRefreshAllowedAt = candidate ? new Date(candidate.getTime() + this.cooldownMs) : null
    return {
      records: sortCommercialRecords(records),
      meta: {
        refreshedAt: snapshot.lastRefresh?.finishedAt ?? snapshot.updatedAt ?? null,
        recordCount: records.length,
        sourceCounts: sourceCounts(records),
        dataSource: snapshot.dataSource ?? 'runtime',
        ordering: 'recordDateIso-desc',
        refreshEnabled: this.refreshEnabled,
        refreshInProgress: Boolean(this.running),
        nextRefreshAllowedAt: nextRefreshAllowedAt && nextRefreshAllowedAt > now ? nextRefreshAllowedAt.toISOString() : null,
        warning: snapshot.warning ?? null,
      },
    }
  }
}
