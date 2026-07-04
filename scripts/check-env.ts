#!/usr/bin/env tsx
// scripts/check-env.ts
// Validates all required environment variables before deployment.
// Exits with code 1 if any required variable is missing or malformed.
// Used by CI (env-check job) and can be run locally: npx tsx scripts/check-env.ts

type EnvRule = {
  key:         string
  required:    boolean
  description: string
  validate?:   (value: string) => string | null  // return error string or null
}

const URL_REGEX = /^https?:\/\/.+/

const RULES: EnvRule[] = [
  // ── Supabase ────────────────────────────────────────────────────────────────
  {
    key:         'NEXT_PUBLIC_SUPABASE_URL',
    required:    true,
    description: 'Supabase project URL',
    validate:    v => URL_REGEX.test(v) ? null : 'Must be a valid HTTPS URL',
  },
  {
    key:         'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required:    true,
    description: 'Supabase anonymous (public) key',
    validate:    v => v.startsWith('eyJ') ? null : 'Expected a JWT starting with eyJ',
  },
  {
    key:         'SUPABASE_SERVICE_ROLE_KEY',
    required:    true,
    description: 'Supabase service role key — bypasses RLS (server-only)',
    validate:    v => v.startsWith('eyJ') ? null : 'Expected a JWT starting with eyJ',
  },

  // ── AI providers ────────────────────────────────────────────────────────────
  {
    key:         'DEEPSEEK_API_KEY',
    required:    true,
    description: 'DeepSeek API key for AI generation',
    validate:    v => v.length >= 20 ? null : 'Key seems too short',
  },
  {
    key:         'GOOGLE_GEMINI_API_KEY',
    required:    false,
    description: 'Google Gemini API key (Gemini fallback + streaming)',
  },

  // ── Payments ────────────────────────────────────────────────────────────────
  {
    key:         'PAYSTACK_SECRET_KEY',
    required:    false,
    description: 'Paystack secret key for payment processing',
    validate:    v => v.startsWith('sk_') ? null : 'Must start with sk_',
  },
  {
    key:         'PAYSTACK_PUBLIC_KEY',
    required:    false,
    description: 'Paystack public key (browser-facing)',
    validate:    v => v.startsWith('pk_') ? null : 'Must start with pk_',
  },

  // ── Communications ──────────────────────────────────────────────────────────
  {
    key:         'TWILIO_ACCOUNT_SID',
    required:    false,
    description: 'Twilio Account SID for WhatsApp messaging',
    validate:    v => v.startsWith('AC') ? null : 'Must start with AC',
  },
  {
    key:         'TWILIO_AUTH_TOKEN',
    required:    false,
    description: 'Twilio Auth Token',
  },
  {
    key:         'TWILIO_WHATSAPP_FROM',
    required:    false,
    description: 'Twilio WhatsApp sender number (e.g. +14155238886)',
    validate:    v => v.startsWith('+') ? null : 'Must be in E.164 format starting with +',
  },

  // ── Vercel / hosting ────────────────────────────────────────────────────────
  {
    key:         'CRON_SECRET',
    required:    false,
    description: 'Secret token for authenticating Vercel cron job requests',
    validate:    v => v.length >= 16 ? null : 'Should be at least 16 characters',
  },
  {
    key:         'NEXT_PUBLIC_APP_VERSION',
    required:    false,
    description: 'App version string (injected by CI)',
  },
]

// ── Runner ────────────────────────────────────────────────────────────────────

type Result = { key: string; status: 'ok' | 'missing' | 'invalid'; message?: string; required: boolean }

function checkEnv(): { results: Result[]; passed: boolean } {
  const results: Result[] = []

  for (const rule of RULES) {
    const value = process.env[rule.key]

    if (!value) {
      if (rule.required) {
        results.push({ key: rule.key, status: 'missing', message: `Required but not set. ${rule.description}`, required: true })
      } else {
        results.push({ key: rule.key, status: 'ok', message: '(optional — not set)', required: false })
      }
      continue
    }

    if (rule.validate) {
      const error = rule.validate(value)
      if (error) {
        results.push({ key: rule.key, status: 'invalid', message: error, required: rule.required })
        continue
      }
    }

    results.push({ key: rule.key, status: 'ok', required: rule.required })
  }

  const passed = results.every(r => r.status !== 'missing' && !(r.status === 'invalid' && r.required))
  return { results, passed }
}

function printResults(results: Result[], passed: boolean): void {
  const maxKeyLen = Math.max(...results.map(r => r.key.length))

  console.log('\nEduNexus Environment Check\n' + '─'.repeat(60))

  for (const r of results) {
    const padded = r.key.padEnd(maxKeyLen)
    if (r.status === 'ok' && !r.message) {
      console.log(`  ✅  ${padded}`)
    } else if (r.status === 'ok' && r.message) {
      console.log(`  ⚪  ${padded}  ${r.message}`)
    } else if (r.status === 'missing') {
      console.log(`  ❌  ${padded}  MISSING — ${r.message}`)
    } else {
      console.log(`  ⚠️   ${padded}  INVALID — ${r.message}`)
    }
  }

  console.log('─'.repeat(60))
  const requiredOk = results.filter(r => r.required && r.status === 'ok').length
  const requiredTotal = results.filter(r => r.required).length
  console.log(`Required: ${requiredOk}/${requiredTotal} OK`)

  if (passed) {
    console.log('✅ Environment check passed\n')
  } else {
    console.log('❌ Environment check FAILED — fix the above issues before deploying\n')
  }
}

const { results, passed } = checkEnv()
printResults(results, passed)
process.exit(passed ? 0 : 1)
