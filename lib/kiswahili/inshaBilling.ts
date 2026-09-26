// lib/kiswahili/inshaBilling.ts
//
// Insha feedback is sold as a marking pack: KES 100 (INSHA_MARKING_PACK.tokens)
// covers INSHA_MARKING_PACK.essays essays. Tokens are whole numbers, so a pack
// cannot be charged per essay. Instead:
//
//   * The deduct_tokens RPC records each pack bought-and-opened as a
//     token_usage row with action PACK_ACTION.
//   * Each essay marked by a solo teacher is a token_usage row with action
//     ESSAY_ACTION and tokens_used 0.
//   * Essays left = packs opened × essays per pack − essays marked. When none
//     are left, the next essay opens a new pack (charged after the feedback
//     succeeds, like every other feature).
//
// School-covered teachers and subscribers are never metered.

import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { INSHA_MARKING_PACK } from '@/lib/payments/config'
import { repos } from '@/lib/repositories'

const FEATURE = 'kiswahili_insha_pack' as const
// deduct_tokens records the charge under the feature name.
const PACK_ACTION  = FEATURE
const ESSAY_ACTION = 'kiswahili_insha_essay'

/** Essays still available in packs already opened. Pure. */
export function essaysRemaining(packsOpened: number, essaysMarked: number, essaysPerPack: number): number {
  return Math.max(0, packsOpened * essaysPerPack - essaysMarked)
}

export type InshaCharge =
  | { allowed: false; reason: 'unauthenticated' | 'no_access' | 'payment_required' }
  // metered: false → covered/subscriber, nothing to record.
  // opensPack: true → this essay starts a new pack and must be charged.
  | { allowed: true; userId: string; metered: false }
  | { allowed: true; userId: string; metered: true; opensPack: boolean; cost: number }

/** Decide whether this essay may be marked and whether it opens a new pack. */
export async function resolveInshaCharge(userId: string): Promise<InshaCharge> {
  const access = await checkFeatureAccess(FEATURE)
  if (access.allowed && !access.deductTokens) {
    return { allowed: true, userId: access.userId, metered: false }
  }
  if (access.allowed === false && access.reason !== 'insufficient_tokens') {
    return { allowed: false, reason: access.reason }
  }

  const [packsOpened, essaysMarked] = await Promise.all([
    repos.billing.countTokenUsage(userId, PACK_ACTION),
    repos.billing.countTokenUsage(userId, ESSAY_ACTION),
  ])
  if (essaysRemaining(packsOpened, essaysMarked, INSHA_MARKING_PACK.essays) > 0) {
    return { allowed: true, userId, metered: true, opensPack: false, cost: 0 }
  }
  // No essays left: allowed only if the balance can open a new pack.
  if (access.allowed && access.deductTokens) {
    return { allowed: true, userId: access.userId, metered: true, opensPack: true, cost: access.cost }
  }
  return { allowed: false, reason: 'payment_required' }
}

/** Record one marked essay — call only after the feedback succeeded. */
export async function recordInshaEssay(charge: Extract<InshaCharge, { allowed: true }>): Promise<void> {
  if (!charge.metered) return
  if (charge.opensPack) {
    await deductFeatureTokens(charge.userId, FEATURE, charge.cost)
  }
  await repos.billing.recordFreeUsage(charge.userId, ESSAY_ACTION, { feature: FEATURE })
}
