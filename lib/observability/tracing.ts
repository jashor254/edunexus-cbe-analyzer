// lib/observability/tracing.ts
// Lightweight distributed tracing — generates request IDs and trace spans.
// For full OpenTelemetry, integrate @opentelemetry/sdk-node when budget allows.

import { randomUUID } from 'crypto'

export type Span = {
  traceId:   string
  spanId:    string
  parentId?: string
  name:      string
  startTime: number
  endTime?:  number
  status:    'ok' | 'error'
  tags:      Record<string, string | number | boolean>
}

/**
 * Generate a new trace ID for an incoming request.
 * Set this in Next.js middleware and thread it through.
 */
export function generateTraceId(): string {
  return randomUUID().replace(/-/g, '')
}

/**
 * Generate a span ID for a child operation.
 */
export function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16)
}

/**
 * Create and time a trace span for an operation.
 * Logs the span on completion.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    traceId?: string
    parentId?: string
    tags?: Record<string, string | number | boolean>
  }
): Promise<T> {
  const span: Span = {
    traceId:   options?.traceId  ?? generateTraceId(),
    spanId:    generateSpanId(),
    parentId:  options?.parentId,
    name,
    startTime: Date.now(),
    status:    'ok',
    tags:      options?.tags ?? {},
  }

  try {
    const result = await fn(span)
    span.endTime = Date.now()
    span.status  = 'ok'
    emitSpan(span)
    return result
  } catch (err) {
    span.endTime      = Date.now()
    span.status       = 'error'
    span.tags.error   = err instanceof Error ? err.message : String(err)
    emitSpan(span)
    throw err
  }
}

function emitSpan(span: Span): void {
  const duration = (span.endTime ?? Date.now()) - span.startTime

  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify({
      type:     'span',
      trace_id: span.traceId,
      span_id:  span.spanId,
      parent_id:span.parentId,
      name:     span.name,
      duration_ms: duration,
      status:   span.status,
      tags:     span.tags,
      timestamp: new Date(span.startTime).toISOString(),
    }) + '\n')
  } else {
    const statusIcon = span.status === 'ok' ? '✓' : '✗'
    console.log(`[trace] ${statusIcon} ${span.name} (${duration}ms) traceId=${span.traceId.slice(0, 8)}`)
  }
}
