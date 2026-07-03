// lib/observability/logger.ts
// Structured logger — replaces all console.log/warn/error in production.
// In development: pretty-prints to console.
// In production: emits structured JSON for log aggregation (Vercel, Datadog, etc.)

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = {
  service?: string
  organization_id?: string
  user_id?: string
  request_id?: string
  job_id?: string
  event_type?: string
  [key: string]: unknown
}

type LogEntry = {
  level: LogLevel
  message: string
  timestamp: string
  context: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const IS_PROD = process.env.NODE_ENV === 'production'

function emit(entry: LogEntry): void {
  if (IS_PROD) {
    // Structured JSON for log aggregation
    process.stdout.write(JSON.stringify(entry) + '\n')
  } else {
    const prefix = `[${entry.level.toUpperCase()}] [${entry.timestamp}]`
    const ctx = Object.keys(entry.context).length
      ? ' ' + JSON.stringify(entry.context)
      : ''
    const errDetail = entry.error ? `\n  Error: ${entry.error.message}` : ''

    const fn = entry.level === 'error'
      ? console.error
      : entry.level === 'warn'
        ? console.warn
        : console.log

    fn(`${prefix} ${entry.message}${ctx}${errDetail}`)
  }
}

function createEntry(
  level: LogLevel,
  message: string,
  context: LogContext = {},
  err?: unknown
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  }

  if (err instanceof Error) {
    entry.error = {
      name:    err.name,
      message: err.message,
      stack:   IS_PROD ? undefined : err.stack,
    }
  }

  return entry
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    emit(createEntry('debug', message, context)),

  info: (message: string, context?: LogContext) =>
    emit(createEntry('info', message, context)),

  warn: (message: string, context?: LogContext, err?: unknown) =>
    emit(createEntry('warn', message, context, err)),

  error: (message: string, context?: LogContext, err?: unknown) =>
    emit(createEntry('error', message, context, err)),

  /** Log the start and end of an operation with timing */
  timed: async <T>(
    name: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> => {
    const start = Date.now()
    logger.info(`${name}: started`, context)
    try {
      const result = await fn()
      logger.info(`${name}: completed in ${Date.now() - start}ms`, context)
      return result
    } catch (err) {
      logger.error(`${name}: failed after ${Date.now() - start}ms`, context, err)
      throw err
    }
  },
}

/** Create a child logger with pre-bound context */
export function createLogger(defaultContext: LogContext): typeof logger {
  return {
    debug: (msg, ctx) => logger.debug(msg, { ...defaultContext, ...ctx }),
    info:  (msg, ctx) => logger.info(msg, { ...defaultContext, ...ctx }),
    warn:  (msg, ctx, err) => logger.warn(msg, { ...defaultContext, ...ctx }, err),
    error: (msg, ctx, err) => logger.error(msg, { ...defaultContext, ...ctx }, err),
    timed: (name, fn, ctx) => logger.timed(name, fn, { ...defaultContext, ...ctx }),
  }
}
