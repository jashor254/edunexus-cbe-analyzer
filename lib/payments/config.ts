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
// RETIRED FROM PUBLIC SALE. Kept because it is still the internal unit of
// account: KES_PER_TOKEN is derived from it, and every historical payment row
// with product_id 'starter' still resolves its token grant through it (see
// TOKEN_GRANTS below). It is deliberately absent from PURCHASABLE_PRODUCTS,
// so no new customer purchase can be initialized against it.
export const TOKEN_PACK = {
  id:       'starter',
  priceKes: 500,
  tokens:   10,          // KES 50 per token
} as const

// ===== TOKEN COSTS PER FEATURE (for pay-as-you-go users) =====
// career_guidance is now embedded in clinic_report — no separate gate.
//
// Teacher tools are free ONLY for teachers whose school has an active
// EduNexus subscription (checked via real organization membership in
// checkFeatureAccess — role: 'teacher' alone is no longer sufficient).
// A self-teacher with no attached school pays per service, individually —
// EXCEPT the SOW → lesson plans → Record of Work chain, which is priced
// as one Planning Bundle (2 tokens = KES 100), charged once at SOW
// generation; a teacher's genuinely first SOW ever is free (checked in
// access.ts against real SOW history, not inferred from role). Other
// services (slides, remedial planner, holiday plan, Compass, etc.) are
// unrelated to this chain and stay individually priced below — no
// bundling beyond SOW/lesson-plan/ROW specifically.
export const TOKEN_COSTS = {
  sow_generate:         2,
  lesson_plan_generate: 0,
  row_generate:         0,
  slides_generate:      2,
  // Remedial Planner — differentiated class plan — 2 tokens = KES 100
  remedial_planner:     2,
  // Holiday Plan — per-student personalised plan — 1 token = KES 50
  holiday_plan:         1,

  // Parent / student features
  clinic_report:        5,
  learning_compass:     1,
  career_intelligence_report: 3,

  // Adaptive assignment variants — per canonical question, per generate call
  // (single or "Generate All", charged once per question actually generated)
  adaptive_variant_generate: 1,

  // Class reports — one AI report per learner for a whole class, charged once
  // per class run (2 tokens = KES 100), only when at least one report succeeds.
  class_reports_generate: 2,

  // Kiswahili insha feedback — sold as a marking pack, not per essay. The
  // first essay after a pack is exhausted opens a new one (2 tokens = KES 100)
  // and the next INSHA_MARKING_PACK.essays - 1 essays cost nothing more.
  // See lib/kiswahili/inshaBilling.ts.
  kiswahili_insha_pack: 2,

  // Quick-checks are generated against a scheme of work the teacher already
  // owns, so they are part of that scheme's Planning Bundle — like
  // lesson_plan_generate and row_generate — not a separate purchase.
  teaching_quick_check: 0,

  // Unknown-career research (lib/career/knowledgeRequests.ts) — free to the
  // learner (never token-charged; this is exploration, not a purchased
  // report), but still needs a TokenFeature key so the existing
  // checkDailyCallLimit()/ai_call_logs abuse-cap mechanism (lib/ai/rateLimit.ts)
  // can bound its real LLM cost. Zero-cost entries already exist above
  // (lesson_plan_generate, row_generate) — this follows that precedent.
  career_knowledge_request: 0,
} as const

export type TokenFeature = keyof typeof TOKEN_COSTS

// ===== SOLO TEACHER PRODUCT =====
// The one thing a teacher without a school actually buys: a term's planning
// for one subject. It is deliberately priced at exactly what the SOW →
// lesson plans → Record of Work chain consumes, because TOKEN_COSTS already
// encodes that chain as a single charge (sow_generate: 2, lesson_plan_generate:
// 0, row_generate: 0). Deriving `tokens` from TOKEN_COSTS.sow_generate rather
// than restating "2" is what keeps the customer-facing bundle and the internal
// entitlement from drifting apart.
//
// `tokens` is an internal accounting quantity — never render it to a customer.
export const TEACHER_PLANNING_BUNDLE = {
  id:       'planning_bundle',
  name:     'Term Planning Bundle',
  priceKes: 100,
  tokens:   TOKEN_COSTS.sow_generate,
} as const

// ===== TEACHER TOOL PRODUCTS =====
// Every paid teacher tool outside the Planning Bundle, sold as the outcome it
// produces. Each grants exactly what one use of its feature costs — `tokens`
// is derived from TOKEN_COSTS and `priceKes` from the same KES-per-token rate
// the Planning Bundle uses — so a product can never grant more or less than
// the feature it is named after consumes.
//
// Without these, a solo teacher who hit "insufficient tokens" on slides,
// remedial plans or holiday plans had nothing to buy but a Planning Bundle.
const TEACHER_KES_PER_TOKEN = TEACHER_PLANNING_BUNDLE.priceKes / TEACHER_PLANNING_BUNDLE.tokens // 50

function teacherTool<const Id extends string>(id: Id, name: string, feature: TokenFeature) {
  return {
    id,
    name,
    feature,
    tokens:   TOKEN_COSTS[feature],
    priceKes: TOKEN_COSTS[feature] * TEACHER_KES_PER_TOKEN,
  } as const
}

export const CLASS_REPORTS_PRODUCT = teacherTool('class_reports', 'Class Reports', 'class_reports_generate')
export const SLIDES_PRODUCT        = teacherTool('slides', 'Lesson Slides', 'slides_generate')
export const REMEDIAL_PRODUCT      = teacherTool('remedial_plan', 'Remedial Plan', 'remedial_planner')
export const HOLIDAY_PRODUCT       = teacherTool('holiday_plan', 'Holiday Plan', 'holiday_plan')

// Insha feedback is bought as a class set of essays, not per essay.
export const INSHA_MARKING_PACK = {
  ...teacherTool('insha_pack', 'Insha Marking Pack', 'kiswahili_insha_pack'),
  essays: 40,
} as const

export const TEACHER_TOOL_PRODUCTS = [
  CLASS_REPORTS_PRODUCT,
  INSHA_MARKING_PACK,
  SLIDES_PRODUCT,
  REMEDIAL_PRODUCT,
  HOLIDAY_PRODUCT,
] as const

// ===== PURCHASABLE PRODUCTS =====
// The complete set of products a NEW payment may be initialized against.
// Both payment entry points (app/api/payments/initialize and
// app/api/payments/mobile-init) read this one map, so they cannot drift and
// the pricing page cannot emit an id the server does not honour.
//
// Note what is absent: TOKEN_PACK ('starter'). Public token sales are retired —
// customers buy term access or a planning outcome, never a currency. Historical
// 'starter' payments are unaffected; they fulfil through TOKEN_GRANTS.
export type PurchaseType = 'token' | 'subscription'

export type PurchasableProduct = {
  price:  number
  type:   PurchaseType
  label:  string
  tokens?: number
}

export const PURCHASABLE_PRODUCTS: Record<string, PurchasableProduct> = {
  [TEACHER_PLANNING_BUNDLE.id]: {
    price:  TEACHER_PLANNING_BUNDLE.priceKes,
    type:   'token',
    label:  TEACHER_PLANNING_BUNDLE.name,
    tokens: TEACHER_PLANNING_BUNDLE.tokens,
  },
  ...Object.fromEntries(
    TEACHER_TOOL_PRODUCTS.map(p => [p.id, {
      price:  p.priceKes,
      type:   'token' as const,
      label:  p.name,
      tokens: p.tokens,
    }]),
  ),
  [SUBSCRIPTION_PLANS.TERMLY_SINGLE.id]: {
    price: SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes,
    type:  'subscription',
    label: SUBSCRIPTION_PLANS.TERMLY_SINGLE.name,
  },
  [SUBSCRIPTION_PLANS.TERMLY_FAMILY.id]: {
    price: SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes,
    type:  'subscription',
    label: SUBSCRIPTION_PLANS.TERMLY_FAMILY.name,
  },
}

// ===== TOKEN GRANTS PER PRODUCT =====
// How many tokens a fulfilled non-subscription payment credits, keyed by the
// product_id stored on the payment row. This is deliberately a SUPERSET of
// PURCHASABLE_PRODUCTS: 'starter' can no longer be bought, but rows that were
// legitimately created while it could must still fulfil for exactly what the
// customer paid for. Retiring a product from sale must never strand a payment.
export const TOKEN_GRANTS: Record<string, number> = {
  [TOKEN_PACK.id]:              TOKEN_PACK.tokens,               // historical only
  [TEACHER_PLANNING_BUNDLE.id]: TEACHER_PLANNING_BUNDLE.tokens,
  ...Object.fromEntries(TEACHER_TOOL_PRODUCTS.map(p => [p.id, p.tokens])),
}

// ===== WHAT TO BUY WHEN A FEATURE IS OUT OF TOKENS =====
// The product a paywall points at for each feature. Teacher features resolve
// to the product named after them; parent/learner features resolve to the
// Term Plan, which makes all of them free per use. `null` means there is no
// single honest product for it (a variant costs 1 token, and no product
// grants exactly 1) — the paywall then opens the teacher tab without a
// preselection.
export const FEATURE_PAYWALL_PRODUCT: Record<TokenFeature, string | null> = {
  sow_generate:               TEACHER_PLANNING_BUNDLE.id,
  lesson_plan_generate:       TEACHER_PLANNING_BUNDLE.id,
  row_generate:               TEACHER_PLANNING_BUNDLE.id,
  teaching_quick_check:       TEACHER_PLANNING_BUNDLE.id,
  slides_generate:            SLIDES_PRODUCT.id,
  remedial_planner:           REMEDIAL_PRODUCT.id,
  holiday_plan:               HOLIDAY_PRODUCT.id,
  class_reports_generate:     CLASS_REPORTS_PRODUCT.id,
  kiswahili_insha_pack:       INSHA_MARKING_PACK.id,
  adaptive_variant_generate:  null,
  clinic_report:              SUBSCRIPTION_PLANS.TERMLY_SINGLE.id,
  learning_compass:           SUBSCRIPTION_PLANS.TERMLY_SINGLE.id,
  career_intelligence_report: SUBSCRIPTION_PLANS.TERMLY_SINGLE.id,
  career_knowledge_request:   null,
}

// ===== FEATURE ACCESS MATRIX =====
// 'free'  = no cost ever
// 'full'  = unlimited (subscriber perk, KES 0 marginal cost)
// 'token' = deducted from token balance
export const FEATURE_ACCESS = {
  sow_generate:         { teacher: 'free',  subscriber: 'full',  token: 'token' },
  lesson_plan_generate: { teacher: 'free',  subscriber: 'full',  token: 'token' },
  row_generate:         { teacher: 'free',  subscriber: 'full',  token: 'token' },
  slides_generate:      { teacher: 'free',  subscriber: 'full',  token: 'token' },
  remedial_planner:     { teacher: 'free',  subscriber: 'full',  token: 'token' },
  holiday_plan:         { teacher: 'free',  subscriber: 'full',  token: 'token' },
  clinic_report:              { teacher: 'token', subscriber: 'full',  token: 'token' },
  learning_compass:           { teacher: 'token', subscriber: 'full',  token: 'token' },
  career_intelligence_report: { teacher: 'token', subscriber: 'full',  token: 'token' },
  adaptive_variant_generate:  { teacher: 'free',  subscriber: 'full',  token: 'token' },
  class_reports_generate:     { teacher: 'free',  subscriber: 'full',  token: 'token' },
  kiswahili_insha_pack:       { teacher: 'free',  subscriber: 'full',  token: 'token' },
  teaching_quick_check:       { teacher: 'free',  subscriber: 'full',  token: 'token' },
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
