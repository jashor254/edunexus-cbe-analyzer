// lib/observability/queryTiming.ts
// Wraps a Supabase query with timing + a slow-query warning.
// Built on the existing metrics/logger primitives — no new timing mechanism.

import { observe } from './metrics'
import { logger } from './logger'

const SLOW_QUERY_MS = 500

/**
 * Times a query, records it under `db.query` (labelled by table/operation),
 * and logs a warning if it exceeds SLOW_QUERY_MS.
 */
export async function timedQuery<T>(
  table: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const durationMs = Date.now() - start
    observe('db.query', durationMs, { table, operation, status: 'success' })

    if (durationMs > SLOW_QUERY_MS) {
      logger.warn(`Slow query: ${table}.${operation} took ${durationMs}ms`, {
        service: 'db',
        table,
        operation,
        duration_ms: durationMs,
      })
    }

    return result
  } catch (err) {
    observe('db.query', Date.now() - start, { table, operation, status: 'error' })
    throw err
  }
}
