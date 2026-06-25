// lib/payments/config.ts
// Single source of truth for all pricing, token costs, and feature access.

// ===== USER ACCESS TIERS =====
export type UserTier = 'teacher' | 'subscriber' | 'token' | 'none'

// ===== TERMLY SUBSCRIPTION PLANS =====
// Subscribers pay KES 0 per use — committed families save vs pay-as-you-go.
export const SUBSCRIPTION_PLANS = {
  TERMLY_SINGLE: {
    id:               'term',
    name:             'Term Plan',
    priceKes:         2499,
    childLimit:       1,
    termDurationDays: 120,
    tagline:          'Everything your child needs this term.',
    badge:            'Most popular',
  },
  TERMLY_FAMILY: {
    id:               'family',
    name:             'Family Plan',
    priceKes:         4499,
    childLimit:       3,
    termDurationDays: 120,
    tagline:          'For families with more than one child.',
    badge:            'Best value',
  },
} as const

// ===== TOKEN PACK =====
// Pay-as-you-go — higher per-unit cost than subscribing, maximum flexibility.
export const TOKEN_PACK = {
  id:       'starter',
  priceKes: 500,
  tokens:   10,          // KES 50 per token
} as const

// ===== TOKEN COSTS PER FEATURE (for pay-as-you-go users) =====
// career_guidance is now embedded in clinic_report — no separate gate.
export const TOKEN_COSTS = {
  // Teacher tools (free for teachers, token for non-subscribers)
  sow_generate:         5,
  lesson_plan_generate: 3,
  row_generate:         2,
  // Slide generator — 2 tokens = KES 100 per deck
  slides_generate:      2,

  // Parent / student features
  // Academic Clinic includes career guidance — 5 tokens = KES 250 per report
  clinic_report:        5,
  // Learning Compass — 1 token = KES 50 per session
  learning_compass:     1,
} as const

export type TokenFeature = keyof typeof TOKEN_COSTS

// ===== FEATURE ACCESS MATRIX =====
// 'free'  = no cost ever
// 'full'  = unlimited (subscriber perk, KES 0 marginal cost)
// 'token' = deducted from token balance
export const FEATURE_ACCESS = {
  sow_generate:         { teacher: 'free',  subscriber: 'full',  token: 'token' },
  lesson_plan_generate: { teacher: 'free',  subscriber: 'full',  token: 'token' },
  row_generate:         { teacher: 'free',  subscriber: 'full',  token: 'token' },
  slides_generate:      { teacher: 'free',  subscriber: 'full',  token: 'token' },
  // clinic_report now covers career guidance — one gate, one cost
  clinic_report:        { teacher: 'token', subscriber: 'full',  token: 'token' },
  learning_compass:     { teacher: 'token', subscriber: 'full',  token: 'token' },
} as const

export type FeatureKey = keyof typeof FEATURE_ACCESS

// ===== PER-USE COST IN KES (for display and comparisons) =====
// Derived from TOKEN_PACK price and TOKEN_COSTS — single source of truth.
const KES_PER_TOKEN = TOKEN_PACK.priceKes / TOKEN_PACK.tokens  // 50

export const PER_USE_COST_KES = {
  clinic_report:    TOKEN_COSTS.clinic_report    * KES_PER_TOKEN,   // 250
  learning_compass: TOKEN_COSTS.learning_compass * KES_PER_TOKEN,   // 50
} as const

// ===== PLAN TYPES =====
export type PlanType = 'termly' | 'none'
export type PaymentMethod = 'mpesa_stk' | 'mpesa_b2c' | 'card' | 'bank'

// ===== LEGACY ALIASES (unused components — kept for build compatibility) =====
export type TokenBundleType = 'starter'
export const PAYMENT_PLANS  = SUBSCRIPTION_PLANS
export const TOKEN_BUNDLES  = { starter: TOKEN_PACK } as const
export function getPlanDetails(planType: PlanType) {
  if (planType === 'none') return { name: 'Free', price: 0, features: [], limits: {} }
  return SUBSCRIPTION_PLANS.TERMLY_SINGLE
}
export function getTokenBundleDetails(_: TokenBundleType) { return TOKEN_PACK }

// ===== HELPERS =====

export function formatCurrency(amount: number, currency: string = 'KES'): string {
  return new Intl.NumberFormat('en-KE', {
    style:                 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0'))  return '254' + cleaned.slice(1)
  if (cleaned.startsWith('7'))  return '254' + cleaned
  return cleaned
}

type SubscriptionRecord = { status: string; end_date: string }

export function isSubscriptionActive(sub: SubscriptionRecord | null | undefined): boolean {
  if (!sub) return false
  if (sub.status !== 'active') return false
  return new Date(sub.end_date) > new Date()
}
