// lib/payments/pricingSurface.test.ts
//
// Guards the seam that the pricing convergence audit found broken: the pricing
// page defined its own product literals with no compile-time or runtime link to
// what the payment endpoints would actually accept. Five of the eight ids the
// page emitted did not exist server-side, so every teacher CTA on /pricing
// ended in "Invalid product selected".
//
// These are pure assertions over the exported registries — no DB, no network.
// Run with: npx tsx --test lib/payments/pricingSurface.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PURCHASABLE_PRODUCTS,
  TOKEN_GRANTS,
  TOKEN_PACK,
  TOKEN_COSTS,
  TEACHER_PLANNING_BUNDLE,
  SUBSCRIPTION_PLANS,
} from './config'

// The exact set of product ids any public CTA can emit. Kept here rather than
// imported from the pricing page because that page is a client component whose
// module graph pulls in React, next/navigation and the Supabase browser client.
// If a CTA is added to the page, it must be added here too — and the first test
// then proves the server honours it.
const PUBLIC_CTA_PRODUCT_IDS = [
  'planning_bundle', // Teacher tab — Term Planning Bundle
  'term',            // Family tab — Term Plan
  'family',          // Family tab — Family Plan
]

// Ids the pricing page used to emit that no longer exist anywhere, plus the
// retired token pack. None may be purchasable.
const RETIRED_PRODUCT_IDS = [
  'starter',
  'teacher_pro',
  'term_pack',
  'wallet_topup',
  'wallet_100',
  'wallet_500',
  'wallet_1000',
  'school_starter',
  'school_growth',
  'school_institution',
]

// ── Product correctness ───────────────────────────────────────────────────────

test('every product id a public CTA can emit is accepted by the payment registry', () => {
  for (const id of PUBLIC_CTA_PRODUCT_IDS) {
    assert.ok(
      PURCHASABLE_PRODUCTS[id],
      `pricing page emits '${id}' but PURCHASABLE_PRODUCTS does not accept it — this CTA would 400`
    )
  }
})

test('the payment registry exposes nothing the pricing page does not offer', () => {
  assert.deepEqual(
    Object.keys(PURCHASABLE_PRODUCTS).sort(),
    [...PUBLIC_CTA_PRODUCT_IDS].sort(),
    'a purchasable product with no CTA is either dead or an unadvertised sale path'
  )
})

test('both payment entry points read the same registry, so they cannot drift', async () => {
  // initialize and mobile-init each used to hold their own copy of the product
  // map. Proving equivalence by reading the module source is deliberate: it
  // fails if either route reintroduces a local PRODUCTS literal.
  const { readFileSync } = await import('node:fs')
  for (const route of [
    'app/api/payments/initialize/route.ts',
    'app/api/payments/mobile-init/route.ts',
  ]) {
    const src = readFileSync(route, 'utf8')
    assert.ok(
      src.includes('PURCHASABLE_PRODUCTS'),
      `${route} must resolve products through PURCHASABLE_PRODUCTS`
    )
    assert.ok(
      !/const\s+PRODUCTS\s*[:=]/.test(src),
      `${route} has reintroduced a local PRODUCTS map — the two entry points can now drift`
    )
  }
})

test('retired products cannot initialize a new purchase', () => {
  for (const id of RETIRED_PRODUCT_IDS) {
    assert.equal(
      PURCHASABLE_PRODUCTS[id],
      undefined,
      `'${id}' is retired but is still purchasable`
    )
  }
})

test('a historical starter payment can still resolve its token grant', () => {
  // Retiring a product from sale must never strand a payment row that already
  // exists. 'starter' is absent from PURCHASABLE_PRODUCTS (no new sales) but
  // present in TOKEN_GRANTS (historical fulfilment still works).
  assert.equal(PURCHASABLE_PRODUCTS[TOKEN_PACK.id], undefined)
  assert.equal(TOKEN_GRANTS[TOKEN_PACK.id], TOKEN_PACK.tokens)
})

// ── Family ────────────────────────────────────────────────────────────────────

test('no purchasable family product sells tokens', () => {
  for (const id of ['term', 'family']) {
    assert.equal(
      PURCHASABLE_PRODUCTS[id].type,
      'subscription',
      `family product '${id}' must grant term access, not a token balance`
    )
    assert.equal(PURCHASABLE_PRODUCTS[id].tokens, undefined)
  }
})

test('term charges the canonical Term Plan price', () => {
  assert.equal(PURCHASABLE_PRODUCTS['term'].price, SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes)
  assert.equal(PURCHASABLE_PRODUCTS['term'].price, 2499)
})

test('family charges the canonical Family Plan price', () => {
  assert.equal(PURCHASABLE_PRODUCTS['family'].price, SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes)
  assert.equal(PURCHASABLE_PRODUCTS['family'].price, 4499)
})

// ── Solo Teacher ──────────────────────────────────────────────────────────────

test('the planning bundle charges exactly KES 100', () => {
  assert.equal(TEACHER_PLANNING_BUNDLE.priceKes, 100)
  assert.equal(PURCHASABLE_PRODUCTS[TEACHER_PLANNING_BUNDLE.id].price, 100)
})

test('the planning bundle grants exactly what one Scheme of Work consumes', () => {
  // The bundle IS the SOW → lesson plans → Record of Work chain. If these ever
  // diverge, a teacher pays KES 100 and still cannot generate their scheme.
  assert.equal(TEACHER_PLANNING_BUNDLE.tokens, TOKEN_COSTS.sow_generate)
  assert.equal(TOKEN_GRANTS[TEACHER_PLANNING_BUNDLE.id], TOKEN_COSTS.sow_generate)
  assert.notEqual(
    TOKEN_GRANTS[TEACHER_PLANNING_BUNDLE.id],
    TOKEN_PACK.tokens,
    'a KES 100 bundle must not credit a KES 500 pack — this was the fulfilment hazard'
  )
})

test('lesson plans and Record of Work cost nothing after the bundle is bought', () => {
  // The whole chain is charged once, at the scheme. A teacher who paid at SOW
  // time can never be blocked partway through the term with a zero balance.
  assert.equal(TOKEN_COSTS.lesson_plan_generate, 0)
  assert.equal(TOKEN_COSTS.row_generate, 0)
})

// ── Schools ───────────────────────────────────────────────────────────────────

test('no school product is purchasable', () => {
  for (const id of ['school_starter', 'school_growth', 'school_institution']) {
    assert.equal(
      PURCHASABLE_PRODUCTS[id],
      undefined,
      `school pricing is consultation-only — '${id}' must never reach a payment endpoint`
    )
  }
})

test('the organization billing page cannot self-grant a paid plan', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync('app/organizations/[orgId]/billing/page.tsx', 'utf8')
  // Reading the plan list is fine; writing is not. The upgrade button used to
  // POST to /billing/plans and grant a paid plan without collecting a shilling.
  assert.ok(
    !/method:\s*['"]POST['"]/.test(src),
    'the billing page must issue no writes — a POST here granted a paid plan with no payment'
  )
  assert.ok(
    !/\bupgradePlan\s*\(/.test(src),
    'the self-serve upgradePlan action must not exist on this page'
  )
})
