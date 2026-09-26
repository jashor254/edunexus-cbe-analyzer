// lib/payments/paywall.ts
//
// One answer for "you need to pay for this", shared by every gated route.
//
// Before this, running out of tokens produced a 403 "Insufficient tokens.
// Please top up" with nowhere to top up — and the Scheme of Work wizard,
// which treats 403 as "not a teacher", redirected the teacher to /teacher/setup.
// A teacher willing to pay KES 100 never saw a price or a pay button.
//
// 402 is deliberate: it is distinguishable from auth failures (401/403), so a
// client can show a pay prompt instead of a login or setup redirect.

import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/lib/api/response'
import {
  FEATURE_PAYWALL_PRODUCT,
  PURCHASABLE_PRODUCTS,
  SUBSCRIPTION_PLANS,
  type TokenFeature,
} from '@/lib/payments/config'

export type PaywallInfo = {
  code:      'payment_required'
  productId: string | null
  label:     string | null
  priceKes:  number | null
  payUrl:    string
}

const FAMILY_PRODUCT_IDS = new Set<string>([
  SUBSCRIPTION_PLANS.TERMLY_SINGLE.id,
  SUBSCRIPTION_PLANS.TERMLY_FAMILY.id,
])

/** What to buy for a feature, and where. Pure — no request context. */
export function resolvePaywall(feature: TokenFeature): PaywallInfo {
  const productId = FEATURE_PAYWALL_PRODUCT[feature]
  const product   = productId ? PURCHASABLE_PRODUCTS[productId] : undefined
  const tab       = productId && FAMILY_PRODUCT_IDS.has(productId) ? 'family' : 'teacher'

  return {
    code:      'payment_required',
    productId: product ? productId : null,
    label:     product?.label ?? null,
    priceKes:  product?.price ?? null,
    payUrl:    product ? `/pricing?tab=${tab}&product=${productId}` : `/pricing?tab=${tab}`,
  }
}

/** The message shown to the person, naming the price when there is one. */
export function paywallMessage(info: PaywallInfo): string {
  return info.label && info.priceKes !== null
    ? `This needs the ${info.label} — KES ${info.priceKes}, paid with M-Pesa.`
    : 'This needs a purchase — see the pricing page to continue.'
}

export function apiPaymentRequired(feature: TokenFeature): NextResponse<ApiResponse<PaywallInfo>> {
  const info = resolvePaywall(feature)
  return NextResponse.json<ApiResponse<PaywallInfo>>({
    success: false,
    data:    info,
    error:   paywallMessage(info),
    meta:    { timestamp: new Date().toISOString(), version: '1.0' },
  }, { status: 402 })
}
