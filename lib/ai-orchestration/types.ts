// lib/ai-orchestration/types.ts

export type ModelProvider = 'deepseek' | 'gemini' | 'openai'

export type ProviderHealth = 'healthy' | 'degraded' | 'down'

export type CompletionMode = 'standard' | 'fast' | 'quality'

export type AIRequest = {
  prompt: string
  system?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  // Routing hints
  mode?: CompletionMode      // 'fast' = cheap/quick, 'quality' = best available
  max_tokens?: number
  temperature?: number
  // Cost tracking
  organization_id?: string
  user_id?: string
  feature?: string            // logical feature, e.g. a TokenFeature key ('remedial_planner')
  call_site?: string          // step within the feature ('enrich', 'generate', 'verify')
  correlation_id?: string     // workflow id threaded into usage telemetry
}

export type AIResponse = {
  text: string
  provider: ModelProvider
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  /** 'provider' = reported by the provider; 'estimated' = chars/4 fallback. Absent on hand-built test fixtures. */
  usage_source?: 'provider' | 'estimated'
  latency_ms: number
  cost_units: number          // normalized cost units for billing
  fallback_used: boolean
  /** Provider requests this logical call actually made (retries + fallback included). */
  provider_requests?: number
}

export type ProviderConfig = {
  name: ModelProvider
  model: string
  health: ProviderHealth
  last_error?: string
  last_error_at?: Date
  error_count: number
  success_count: number
  avg_latency_ms: number
}

export type PromptTemplate = {
  id: string
  name: string
  version: string
  system: string
  user_template: string      // uses {{variable}} syntax
  defaults?: {
    temperature?: number
    max_tokens?: number
    mode?: CompletionMode
  }
}
