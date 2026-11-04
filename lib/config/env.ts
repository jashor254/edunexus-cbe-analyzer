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
  // Required — enforced in superRefine below (so a missing key can be explained
  // as "retired name set instead" rather than a bare "required"). An EMPTY value
  // still fails here.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not be empty').optional(),
  SUPABASE_SECRET_KEY:         z.string().min(1, 'SUPABASE_SECRET_KEY must not be empty').optional(),

  // RETIRED names, parsed only so a misconfigured environment gets an explicit
  // message. Supabase disabled these keys on 2026-05-25; they are never used.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().optional(),

  // Optional — not required in all environments
  PAYSTACK_PUBLIC_KEY:  z.string().optional(),
  PAYSTACK_SECRET_KEY:  z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).superRefine((vars, ctx) => {
  // Missing valid name -> say exactly what is wrong. When the retired name is
  // set instead, the usual cause is a stale .env or hosting-dashboard variable.
  if (vars.SUPABASE_SECRET_KEY === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['SUPABASE_SECRET_KEY'],
      message: vars.SUPABASE_SERVICE_ROLE_KEY
        ? 'SUPABASE_SERVICE_ROLE_KEY is RETIRED (disabled by Supabase on 2026-05-25) and is not read — set SUPABASE_SECRET_KEY (sb_secret_…)'
        : 'SUPABASE_SECRET_KEY is required',
    })
  }
  if (vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
      message: vars.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY is RETIRED (disabled by Supabase on 2026-05-25) and is not read — set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_…)'
        : 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required',
    })
  }
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
