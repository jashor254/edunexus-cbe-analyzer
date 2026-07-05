// lib/ai-orchestration/registry.ts
// Provider health registry with circuit-breaker pattern.
import type { ModelProvider, ProviderConfig, ProviderHealth } from './types'

// In-memory provider state — resets on cold start, which is acceptable.
// For a persistent circuit breaker, store state in Redis/Supabase.
const providers = new Map<ModelProvider, ProviderConfig>([
  ['gemini', {
    name:          'gemini',
    model:         process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
    health:        'healthy',
    error_count:   0,
    success_count: 0,
    avg_latency_ms: 0,
  }],
  ['deepseek', {
    name:          'deepseek',
    model:         process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    health:        'healthy',
    error_count:   0,
    success_count: 0,
    avg_latency_ms: 0,
  }],
])

const ERROR_THRESHOLD = 5    // mark degraded after 5 consecutive errors
const RECOVERY_MS    = 60_000 // attempt recovery after 60s

export function getProvider(name: ModelProvider): ProviderConfig {
  const p = providers.get(name)
  if (!p) throw new Error(`Unknown provider: ${name}`)

  // Auto-recovery after RECOVERY_MS
  if (p.health === 'down' && p.last_error_at) {
    if (Date.now() - p.last_error_at.getTime() > RECOVERY_MS) {
      p.health = 'degraded'
    }
  }

  return p
}

export function recordSuccess(name: ModelProvider, latencyMs: number): void {
  const p = providers.get(name)
  if (!p) return

  p.success_count++
  p.error_count = 0  // reset consecutive error count
  p.avg_latency_ms = p.avg_latency_ms
    ? Math.round((p.avg_latency_ms * 0.9) + (latencyMs * 0.1))  // EWMA
    : latencyMs

  if (p.health !== 'healthy') {
    p.health = 'healthy'
  }
}

export function recordError(name: ModelProvider, error: string): void {
  const p = providers.get(name)
  if (!p) return

  p.error_count++
  p.last_error = error
  p.last_error_at = new Date()

  if (p.error_count >= ERROR_THRESHOLD) {
    p.health = 'down'
  } else if (p.error_count >= 2) {
    p.health = 'degraded'
  }
}

export function getAllProviders(): ProviderConfig[] {
  return Array.from(providers.values())
}

export function getHealthyProviders(): ModelProvider[] {
  return Array.from(providers.entries())
    .filter(([, p]) => p.health !== 'down')
    .map(([name]) => name)
}
