// lib/infrastructure/billing.ts
// Token deduction and billing guards.
// Reads ctx.environmentConfig.billing — non-billed environments are no-ops.

import { repos } from '@/lib/repositories'
import type { RequestContext } from '@/lib/environment/types'

export type DeductResult =
  | { success: true }
  | { success: false; reason: string }

/**
 * Deduct tokens from an org's AI token balance.
 * Returns immediately without deducting in non-billed environments.
 */
export async function deductTokens(
  ctx: RequestContext,
  amount: number,
  feature: string
): Promise<DeductResult> {
  if (!ctx.environmentConfig.billing.deductTokens) {
    return { success: true }
  }

  const balance = await repos.billing.findOrgTokenBalance(ctx.orgId)

  if (!balance || balance.balance < amount) {
    return { success: false, reason: `Insufficient token balance for ${feature}` }
  }

  await repos.billing.updateOrgTokenBalance(ctx.orgId, balance.balance - amount)

  return { success: true }
}

/**
 * Check whether billing is active for this request context.
 * Use this before any payment-related side effects.
 */
export function isBillingEnabled(ctx: RequestContext): boolean {
  return ctx.environmentConfig.billing.enabled
}
