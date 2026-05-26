// lib/config/env.ts
// Server-only — NEVER import this from client components or client.ts files.
// Validates all env vars at startup so missing keys fail fast with a clear message.

import { z } from 'zod'

const envSchema = z.object({
  // Required
  DEEPSEEK_API_KEY:            z.string().min(1, 'DEEPSEEK_API_KEY is required'),
  NEXT_PUBLIC_SUPABASE_URL:    z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY:   z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Optional — not required in all environments
  PAYSTACK_PUBLIC_KEY:  z.string().optional(),
  PAYSTACK_SECRET_KEY:  z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = envSchema.safeParse({
  DEEPSEEK_API_KEY:              process.env.DEEPSEEK_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY,
  PAYSTACK_PUBLIC_KEY:           process.env.PAYSTACK_PUBLIC_KEY,
  PAYSTACK_SECRET_KEY:           process.env.PAYSTACK_SECRET_KEY,
  NODE_ENV:                      process.env.NODE_ENV,
})

if (!parsed.success) {
  const missing = parsed.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Missing or invalid environment variables:\n${missing}\n\nCheck your .env.local file and restart the server.`)
}

export const env = parsed.data
