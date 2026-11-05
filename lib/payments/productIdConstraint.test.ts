// lib/payments/productIdConstraint.test.ts
// The database CHECK on payments.product_id must allow exactly the products the
// application can open a payment for (plus the historical ones). A product added
// to PURCHASABLE_PRODUCTS without extending the CHECK would fail at the INSERT of
// the pending payment — fail-closed, but unbuyable.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PURCHASABLE_PRODUCTS, TOKEN_GRANTS } from './config'

const MIGRATION = join(process.cwd(), 'supabase/migrations/20261105120100_payments_product_id_check_teacher_tools.sql')

// Subscription ids that can exist on payment rows but are not purchasable tokens.
const HISTORICAL_OR_SUBSCRIPTION = ['premium']

function allowedInMigration(): Set<string> {
  const sql = readFileSync(MIGRATION, 'utf8').replace(/--.*$/gm, '')
  const list = /check\s*\(\s*product_id\s+in\s*\(([^)]*)\)/i.exec(sql)
  assert.ok(list, 'could not find the product_id IN (...) list in the migration')
  return new Set([...list[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]))
}

test('every purchasable product id is allowed by the payments CHECK', () => {
  const allowed = allowedInMigration()
  for (const id of Object.keys(PURCHASABLE_PRODUCTS)) assert.ok(allowed.has(id), `product '${id}' is sold but not allowed by payments_product_id_check`)
})

test('every token-grant product id (incl. historical starter) is allowed by the CHECK', () => {
  const allowed = allowedInMigration()
  for (const id of Object.keys(TOKEN_GRANTS)) assert.ok(allowed.has(id), `token product '${id}' not allowed`)
})

test('the CHECK allows nothing the application does not know about (no silent drift)', () => {
  const known = new Set([...Object.keys(PURCHASABLE_PRODUCTS), ...Object.keys(TOKEN_GRANTS), ...HISTORICAL_OR_SUBSCRIPTION])
  for (const id of allowedInMigration()) assert.ok(known.has(id), `CHECK allows '${id}' which the application does not define`)
})
