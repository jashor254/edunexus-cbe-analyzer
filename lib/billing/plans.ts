import { repos } from '@/lib/repositories'
import type { SubscriptionPlan } from './types'

export async function listPlans(): Promise<SubscriptionPlan[]> {
  return repos.billing.findSubscriptionPlans()
}

export async function getPlanByName(name: string): Promise<SubscriptionPlan | null> {
  return repos.billing.findPlanByName(name)
}

export async function getOrgSubscription(organizationId: string): Promise<{
  subscription: {
    id: string
    status: string
    current_period_start: string
    current_period_end: string | null
    trial_ends_at: string | null
    canceled_at: string | null
    paystack_subscription_code: string | null
    paystack_customer_code: string | null
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
  }
  plan: SubscriptionPlan
} | null> {
  return repos.billing.findOrgSubscription(organizationId)
}

export async function upgradePlan(
  organizationId: string,
  newPlanName: string
): Promise<{ subscription_id: string; plan: SubscriptionPlan }> {
  const plan = await getPlanByName(newPlanName)
  if (!plan) throw new Error(`Plan not found: ${newPlanName}`)

  const existing = await repos.billing.findOrgSubscriptionId(organizationId)
  if (!existing) throw new Error('No subscription found for this organization')

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const updated = await repos.billing.updateSubscription(organizationId, {
    plan_id:               plan.id,
    status:                'active',
    current_period_start:  now.toISOString(),
    current_period_end:    periodEnd.toISOString(),
    updated_at:            now.toISOString(),
  })

  // Update org quotas to match new plan
  await repos.billing.updateOrgQuota(organizationId, {
    api_quota_daily:   plan.api_quota_daily,
    api_quota_monthly: plan.api_quota_monthly,
    updated_at:        now.toISOString(),
  })

  return { subscription_id: updated.id, plan }
}
