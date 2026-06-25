// ============================================================
// lib/config/api.ts
// ✅ Server-side secrets ONLY - never import this in client components
// ✅ Never prefix these with NEXT_PUBLIC_
// ============================================================

// ============================================================
// AI PROVIDER CONFIG
// ============================================================

export const AI_PROVIDER = 'deepseek' as const

export const DEEPSEEK_CONFIG = {
  // ✅ Getter ensures fresh value on every call
  get apiKey() {
    return process.env.DEEPSEEK_AI_API_KEY
  },

  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.startsWith('sk-'))
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
// TOKEN CONFIG
// ============================================================

export const TOKEN_CONFIG = {
  // Free tokens on signup
  FREE_TOKENS_ON_SIGNUP: 1,

  // Admin gets unlimited (effectively)
  ADMIN_TOKENS: 999999,

  // Tokens per referral
  TOKENS_PER_REFERRAL: 2,

  // Token cost per AI analysis
  TOKENS_PER_ANALYSIS: 1,
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