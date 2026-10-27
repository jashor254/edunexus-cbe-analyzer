// ============================================================
// lib/config/api.ts
// ✅ Server-side secrets ONLY - never import this in client components
// ✅ Never prefix these with NEXT_PUBLIC_
// ============================================================

// ============================================================
// AI PROVIDER CONFIG
// ============================================================

export const AI_PROVIDER = 'deepseek' as const

// Provider is env-driven so DeepSeek can be served from an EU/US host that
// keeps learner data out of mainland China (privacy remediation Option 1 / the
// region the privacy policy was always written for). Leave the env vars unset
// and behaviour is identical to before (DeepSeek's own China API). To switch,
// set DEEPSEEK_BASE_URL to the provider's OpenAI-compatible base INCLUDING the
// /v1 segment (e.g. https://api.studio.nebius.com/v1) and DEEPSEEK_MODEL to
// that provider's model id (e.g. deepseek-ai/DeepSeek-V3) — no code change.
// Both DeepSeek-direct and these hosts speak the same /chat/completions API.
export const DEEPSEEK_CONFIG = {
  // ✅ Getter ensures fresh value on every call
  get apiKey() {
    return process.env.DEEPSEEK_AI_API_KEY
  },

  get baseURL() {
    return process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
  },

  get model() {
    return process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  },

  /** Full OpenAI-compatible chat-completions endpoint for the configured host. */
  get chatCompletionsUrl() {
    return `${this.baseURL.replace(/\/+$/, '')}/chat/completions`
  },

  isConfigured() {
    // Presence only — an EU/US host's key need not start with "sk-".
    return Boolean(this.apiKey)
  },

  getKeyOrThrow() {
    const key = this.apiKey
    if (!key) {
      throw new Error(
        'CRITICAL ERROR: DEEPSEEK_AI_API_KEY is missing. ' +
        'Check your .env.local file and restart with "npm run dev".'
      )
    }
    return key
  }
}

// ✅ Gemini properly dead-ended
export const GEMINI_CONFIG = {
  isConfigured: () => false,
  apiKey: null as null
}

// ============================================================
// SUPABASE CONFIG
// ============================================================

export const SUPABASE_SERVER_CONFIG = {
  // ✅ Server-only - NEVER expose to client
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  },

  // ✅ These are safe for server use
  get url() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
  },

  getServiceKeyOrThrow() {
    const key = this.serviceRoleKey
    if (!key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
    }
    return key
  }
}

// ============================================================
// COMPASS AUTO-CONFIRM SYSTEM ACCOUNT
// ============================================================
// A real auth.users row (created once via
// scripts/create-compass-auto-confirm-account.ts, per Compass v2 Wave 2
// Phase 11) representing the automated policy actor that confirms
// engagement-only Compass evidence. Required because learner_evidence.reviewed_by
// is a hard FK to auth.users(id) — there is no way to call confirmReview()
// legally without a real user row as the reviewer.

export const COMPASS_AUTO_CONFIRM_CONFIG = {
  get userId() {
    return process.env.COMPASS_AUTO_CONFIRM_USER_ID
  },

  isConfigured() {
    return Boolean(this.userId)
  },

  getUserIdOrThrow() {
    const id = this.userId
    if (!id) {
      throw new Error(
        'COMPASS_AUTO_CONFIRM_USER_ID is missing. Run scripts/create-compass-auto-confirm-account.ts ' +
        'once and set the resulting user id in your environment before engagement evidence can be auto-confirmed.'
      )
    }
    return id
  }
}

// ============================================================
// PAYMENT CONFIG (Paystack)
// ============================================================

export const PAYSTACK_CONFIG = {
  // ✅ Server-only secret key
  get secretKey() {
    return process.env.PAYSTACK_SECRET_KEY
  },

  // ✅ Public key (safe to use but keep here for organization)
  get publicKey() {
    return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
  },

  isConfigured() {
    return Boolean(this.secretKey && this.secretKey.startsWith('sk_'))
  },

  getSecretOrThrow() {
    const key = this.secretKey
    if (!key) {
      throw new Error('PAYSTACK_SECRET_KEY is missing')
    }
    return key
  }
}

// ============================================================
// EMAIL CONFIG (Resend)
// ============================================================

export const RESEND_CONFIG = {
  get apiKey() {
    return process.env.RESEND_API_KEY
  },

  get fromEmail() {
    return process.env.RESEND_FROM_EMAIL || 'noreply@edunexus.co.ke'
  },

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.startsWith('re_'))
  },

  getKeyOrThrow() {
    const key = this.apiKey
    if (!key) {
      throw new Error('RESEND_API_KEY is missing')
    }
    return key
  }
}

// ============================================================
// ADMIN CONFIG
// ============================================================

export const ADMIN_CONFIG = {
  adminEmail: 'kariukidennis092@gmail.com',

  get adminSecret() {
    return process.env.ADMIN_SECRET
  },

  adminEmails: [
    'kariukidennis092@gmail.com',
  ],

  isAdmin(email: string) {
    return this.adminEmails.includes(email.toLowerCase().trim())
  },
}