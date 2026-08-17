// lib/config/env.ts
// Server-only — NEVER import this from client components or client.ts files.
//
// H4A / OPS-ENV-001 — validates required env vars, but as a pure function,
// not a top-level import-time side effect. Confirmed (H4A audit) this
// module is currently imported nowhere in the real app — no production
// startup path actually calls validateEnv() today. Deliberately not wired
// this phase: the "required" set below (in particular
// DEEPSEEK_AI_API_KEY) directly conflicts with the harness's own
// foundational guarantee that the STANDARD test tier runs with zero AI/
// Supabase/payment credentials (docs/architecture/assurance-tiers.md) —
// wiring this into any code path STANDARD tests could reach would break
// that guarantee. A future phase should first reconcile the "critical set"
// with the harness's own environment models (Supabase URL/key are
// plausibly always-critical; DeepSeek/Paystack are legitimately optional
// in some real environments) before wiring startup validation anywhere.

import { z } from 'zod'

const envSchema = z.object({
  // Required
  DEEPSEEK_AI_API_KEY:         z.string().min(1, 'DEEPSEEK_AI_API_KEY is required'),
  NEXT_PUBLIC_SUPABASE_URL:    z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY:   z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Optional — not required in all environments
  PAYSTACK_PUBLIC_KEY:  z.string().optional(),
  PAYSTACK_SECRET_KEY:  z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type ValidatedEnv = z.infer<typeof envSchema>

export type EnvValidationResult =
  | { ok: true; env: ValidatedEnv }
  | { ok: false; message: string }

/** Pure — takes an explicit vars object rather than reading process.env itself, so it's testable without process-spawning tricks. */
export function validateEnv(vars: Record<string, string | undefined>): EnvValidationResult {
  const parsed = envSchema.safeParse(vars)
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
    return { ok: false, message: `Missing or invalid environment variables:\n${missing}\n\nCheck your .env.local file and restart the server.` }
  }
  return { ok: true, env: parsed.data }
}

/** Fail-closed entry point for a real startup path, when one is deliberately wired to call it. Not called anywhere today — see the module header. */
export function validateEnvOrThrow(vars: Record<string, string | undefined> = process.env): ValidatedEnv {
  const result = validateEnv(vars)
  if (result.ok === true) return result.env
  const failure = result as { ok: false; message: string }
  throw new Error(failure.message)
}
