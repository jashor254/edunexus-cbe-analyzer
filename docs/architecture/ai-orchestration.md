# AI Orchestration

All AI interactions on the EduNexus platform flow through a single orchestration layer in `lib/ai-orchestration/`. No route handler or service function calls an AI provider directly.

---

## Why an Orchestration Layer?

Without a central orchestration layer, each feature that needs AI would:
- Duplicate error handling
- Independently manage provider failures
- Accumulate separate cost tracking
- Create silent failures when a provider is degraded

The orchestration layer centralises all of this. Features request AI completions from the orchestrator; the orchestrator handles everything else.

---

## Components

```
lib/ai-orchestration/
  ├── router.ts      — Selects provider, handles retry and fallback
  ├── registry.ts    — Provider health tracking, circuit breaker
  └── cost.ts        — Token estimation and cost recording

lib/ai/
  ├── deepseek.ts    — DeepSeek API implementation
  └── gemini.ts      — Google Gemini API implementation
```

---

## Provider Registry (`registry.ts`)

The registry maintains an in-memory health record for each AI provider.

```typescript
type ProviderHealth = {
  name: string
  isHealthy: boolean
  errorCount: number
  lastErrorAt: Date | null
  latencyEwma: number      // exponentially-weighted moving average, milliseconds
  requestCount: number
  successCount: number
}
```

**Circuit breaker logic:**

| Condition | Action |
|-----------|--------|
| `errorCount >= 5` within the last 60 seconds | Provider marked unhealthy |
| 60 seconds after last error | Provider automatically recovers |
| Provider unhealthy | Router skips it, tries next in chain |

The circuit breaker is in-memory, which means it resets on Vercel cold starts. This is an acceptable trade-off: the breaker rebuilds its health state quickly from live traffic, and Vercel's immutable deployment model means cold starts are bounded. A persistent circuit breaker would require Redis and adds operational overhead that is not justified at the current scale.

---

## Router (`router.ts`)

The router receives an `AIRequest` and selects the provider chain.

```typescript
type AIRequest = {
  model?: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  maxTokens: number
  temperature?: number
  stream?: boolean
  ctx: RequestContext
}

type AIResponse = {
  content: string
  provider: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  durationMs: number
}
```

**Provider selection sequence:**

```
1. Check environmentConfig.ai.primaryProvider → 'deepseek' (LIVE) or configured value (SANDBOX)
2. Check registry — is the primary provider healthy?
   ├── Yes: attempt request via lib/ai/deepseek.ts
   │     ├── Success: return response
   │     └── Error / timeout:
   │           ├── Increment error count in registry
   │           └── If enableFallback=true: try fallback provider
   └── No (circuit open): skip directly to fallback
3. Fallback: attempt request via lib/ai/gemini.ts
     ├── Success: return response
     └── Error: throw AIUnavailableError (caller sees graceful error)
```

**Retry policy:**

The router retries once on transient errors (network timeout, 5xx) before activating fallback. It does not retry on client errors (4xx, invalid prompt).

**Streaming:**

Streaming requests follow the same provider selection logic. The router returns an async generator that yields text chunks. Non-streaming requests return a complete string.

---

## Provider Implementations

### DeepSeek (`lib/ai/deepseek.ts`)

**Primary provider.** Used for all AI content generation — SOW, lesson plans, records of work, assessment feedback, Monday Panel analysis, career intelligence, and more.

- Model: `deepseek-chat` (default)
- `max_tokens` is always set explicitly — never rely on provider defaults
- Handles JSON mode responses for structured generation
- Extracts token usage from the response `usage` field

### Gemini (`lib/ai/gemini.ts`)

**Fallback provider.** Activated when DeepSeek is unhealthy or returns errors.

- Model: `gemini-pro` (default)
- Prompt format translated from OpenAI-compatible to Gemini format by the implementation
- Same interface as DeepSeek — callers do not need to know which provider is active

---

## Cost Tracking (`cost.ts`)

### Token Estimation

When the provider response does not include token counts (e.g., certain Gemini responses), the orchestration layer estimates:

```
estimated_tokens = character_count / 4
```

The 4-characters-per-token ratio is a widely-used approximation for English and Swahili text. It is intentionally conservative to avoid under-counting costs.

### Cost Recording

After every successful AI response, the orchestrator:

1. Extracts actual token counts from the response (preferred) or uses the estimate.
2. Computes the estimated cost:
   ```
   cost = (prompt_tokens * provider.input_cost_per_token)
        + (completion_tokens * provider.output_cost_per_token)
   ```
3. Writes a `usage_events` record:
   ```typescript
   await recordUsageEvent({
     orgId: ctx.orgId,
     eventType: 'ai.tokens_used',
     quantity: totalTokens,
     metadata: { provider, model, feature, estimatedCost },
   })
   ```
4. If `ctx.environmentConfig.billing.deductTokens === true`, deducts tokens from `token_balances`.

Tokens are **never deducted before the response is received**. If the AI call fails, no tokens are consumed.

### Cost Monitoring

Token usage is queryable from `usage_events`:

```sql
SELECT
  org_id,
  SUM((metadata->>'estimatedCost')::numeric) AS total_cost,
  SUM(quantity) AS total_tokens,
  date_trunc('day', recorded_at) AS day
FROM usage_events
WHERE event_type = 'ai.tokens_used'
  AND recorded_at >= now() - interval '30 days'
GROUP BY org_id, day
ORDER BY day DESC;
```

---

## Prompt Templates

Prompt templates are defined in their respective feature `lib/` modules, not in the orchestration layer. The orchestration layer is prompt-agnostic.

**Conventions:**
- System prompts define the AI persona and output format constraints.
- User prompts contain the dynamic context (subject, grade, term, etc.).
- Structured output (JSON) is requested in the system prompt and validated with Zod after parsing.
- Prompts are version-controlled as TypeScript functions, not stored in a database.

---

## Provider Health Monitoring

The `/api/health` endpoint exposes provider health status:

```json
{
  "ai": {
    "deepseek": {
      "healthy": true,
      "latencyP50Ms": 1240,
      "errorRate": 0.002
    },
    "gemini": {
      "healthy": true,
      "latencyP50Ms": 890,
      "errorRate": 0.0
    }
  }
}
```

This is derived from the in-memory registry and reflects current runtime state.

---

## Adding a New AI Provider

To add a new provider:

1. Create `lib/ai/{provider}.ts` implementing the standard interface.
2. Register it in `lib/ai-orchestration/registry.ts`.
3. Add it as a provider option in `EnvironmentConfig.ai.primaryProvider`.
4. Add cost-per-token constants to `lib/payments/config.ts`.

No changes to business logic or route handlers are needed.

---

## Guardrails

The orchestration layer enforces:

- **`max_tokens` always set.** The `AIRequest` type requires `maxTokens`. An AI call without an explicit token limit is a type error.
- **No direct provider imports in routes or services.** Lint rules enforce that `lib/ai/deepseek.ts` and `lib/ai/gemini.ts` are not imported outside of `lib/ai-orchestration/`.
- **Error surfacing.** All AI errors are logged with provider, model, prompt length, and error message. A user-facing fallback message is returned when AI is unavailable.
