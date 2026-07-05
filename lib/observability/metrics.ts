// lib/observability/metrics.ts
// Lightweight in-process metrics aggregation.
// Flushes to usage_events table every N minutes via cron.
// For production-grade metrics, replace with Prometheus/Datadog SDK.

type MetricType = 'counter' | 'gauge' | 'histogram'

type MetricValue = {
  type: MetricType
  value: number
  count: number
  sum: number
  min: number
  max: number
  labels: Record<string, string>
  updated_at: Date
}

const metrics = new Map<string, MetricValue>()

function metricKey(name: string, labels: Record<string, string>): string {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
  return `${name}{${labelStr}}`
}

/**
 * Increment a counter metric.
 */
export function increment(
  name: string,
  value = 1,
  labels: Record<string, string> = {}
): void {
  const key = metricKey(name, labels)
  const existing = metrics.get(key)

  if (existing) {
    existing.value += value
    existing.count++
    existing.sum += value
    existing.updated_at = new Date()
  } else {
    metrics.set(key, {
      type: 'counter', value, count: 1, sum: value, min: value, max: value,
      labels, updated_at: new Date(),
    })
  }
}

/**
 * Record a gauge (point-in-time) value.
 */
export function gauge(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const key = metricKey(name, labels)
  metrics.set(key, {
    type: 'gauge', value, count: 1, sum: value, min: value, max: value,
    labels, updated_at: new Date(),
  })
}

/**
 * Record a histogram observation (e.g., request latency).
 */
export function observe(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const key = metricKey(name, labels)
  const existing = metrics.get(key)

  if (existing) {
    existing.count++
    existing.sum += value
    existing.min = Math.min(existing.min, value)
    existing.max = Math.max(existing.max, value)
    existing.value = existing.sum / existing.count  // running average
    existing.updated_at = new Date()
  } else {
    metrics.set(key, {
      type: 'histogram', value, count: 1, sum: value, min: value, max: value,
      labels, updated_at: new Date(),
    })
  }
}

/**
 * Time an async function and record its duration.
 */
export async function time<T>(
  name: string,
  fn: () => Promise<T>,
  labels: Record<string, string> = {}
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    observe(name, Date.now() - start, { ...labels, status: 'success' })
    return result
  } catch (err) {
    observe(name, Date.now() - start, { ...labels, status: 'error' })
    throw err
  }
}

/**
 * Get a snapshot of all metrics — used by /api/admin/metrics endpoint.
 */
export function getMetricsSnapshot(): Record<string, MetricValue> {
  return Object.fromEntries(metrics)
}

/**
 * Reset all metrics (called after flushing to persistent storage).
 */
export function resetMetrics(): void {
  metrics.clear()
}
