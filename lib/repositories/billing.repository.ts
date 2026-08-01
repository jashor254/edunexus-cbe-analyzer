// lib/repositories/billing.repository.ts
// All DB queries for billing, subscriptions, token balances, and usage events.
// Auth session logic (createClient / cookie reads) stays in lib/payments/access.ts.

import { BaseRepository } from './base'
import { timedQuery } from '@/lib/observability/queryTiming'
import type { SubscriptionPlan, OrganizationSubscription, Invoice, UsageSummary } from '@/lib/billing/types'

// ── Column constants ──────────────────────────────────────────────────────────

const PLAN_COLS =
  'id, name, display_name, description, price_monthly_kes, price_annual_kes, api_quota_daily, api_quota_monthly, ai_token_quota, max_members, max_schools, features, paystack_plan_code, is_active, sort_order, created_at, updated_at'

const SUBSCRIPTION_COLS =
  'id, organization_id, plan_id, status, current_period_start, current_period_end, trial_end, canceled_at, external_id, metadata, created_at, updated_at'

const INVOICE_COLS =
  'id, organization_id, subscription_id, status, amount_kes, tax_kes, total_kes, currency, period_start, period_end, due_date, paid_at, external_id, line_items, metadata, created_at, updated_at'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProfileRole = {
  role: string
  secondary_role: string | null
}

type OrgQuota = {
  api_quota_daily: number
  api_quota_monthly: number
}

type SubscriptionWithPlan = {
  subscription: {
    id: string
    status: string
    current_period_start: string
    current_period_end: string | null
    trial_end: string | null
    canceled_at: string | null
    external_id: string | null
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
  }
  plan: SubscriptionPlan
}

// ── Repository ────────────────────────────────────────────────────────────────

export class BillingRepository extends BaseRepository {
  /**
   * Fetch profile role columns for a user.
   * Used by access.ts to determine teacher/admin tier without a full profile load.
   */
  async findProfileRole(userId: string): Promise<ProfileRole | null> {
    return timedQuery('profiles', 'findProfileRole', async () => {
      const { data } = await this.db
        .from('profiles')
        .select('role, secondary_role')
        .eq('id', userId)
        .maybeSingle()

      return data ?? null
    })
  }

  /**
   * Resolve the teachers.id row (distinct from auth user id) for a user.
   * schemes_of_work.teacher_id references this, not the auth id directly —
   * used by access.ts to check first-SOW trial eligibility.
   */
  async findTeacherIdByUserId(userId: string): Promise<string | null> {
    return timedQuery('teachers', 'findTeacherIdByUserId', async () => {
      const { data } = await this.db
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      return data?.id ?? null
    })
  }

  /**
   * Find an active, non-expired subscription for a user.
   * Used by the legacy subscriptions table (cookie-auth path in access.ts).
   */
  async findActiveSubscription(userId: string): Promise<{ id: string } | null> {
    return timedQuery('subscriptions', 'findActiveSubscription', async () => {
      const { data } = await this.db
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      return data ?? null
    })
  }

  /**
   * Fetch a user's token balance.
   */
  async findTokenBalance(userId: string): Promise<{ balance: number } | null> {
    return timedQuery('token_balances', 'findTokenBalance', async () => {
      const { data } = await this.db
        .from('token_balances')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle()

      return data ?? null
    })
  }

  /**
   * Atomically deduct tokens via the deduct_tokens RPC.
   * Call ONLY after a successful AI response — never before.
   */
  async deductTokens(
    userId: string,
    action: string,
    tokens: number,
    metadata: Record<string, unknown>
  ): Promise<void> {
    return timedQuery('token_balances', 'deductTokens', async () => {
      const { error } = await this.db.rpc('deduct_tokens', {
        p_user_id:  userId,
        p_action:   action,
        p_tokens:   tokens,
        p_metadata: metadata,
      })
      if (error) throw new Error(`Token deduction failed: ${error.message}`)
    })
  }

  /**
   * Fetch usage events for an organization within a date range.
   */
  async findUsageEvents(
    orgId: string,
    start: Date,
    end: Date
  ): Promise<Array<{ event_type: string; quantity: number }>> {
    const { data, error } = await this.db
      .from('usage_events')
      .select('event_type, quantity')
      .eq('organization_id', orgId)
      .gte('recorded_at', start.toISOString())
      .lte('recorded_at', end.toISOString())

    if (error) throw new Error(`Failed to fetch usage events: ${error.message}`)
    return (data ?? []) as Array<{ event_type: string; quantity: number }>
  }

  /**
   * Fetch today's usage count for a specific event type.
   * Used to compute percent_daily_used in UsageSummary.
   */
  async findTodayUsage(
    orgId: string,
    eventType: string,
    since: Date
  ): Promise<Array<{ quantity: number }>> {
    const { data, error } = await this.db
      .from('usage_events')
      .select('quantity')
      .eq('organization_id', orgId)
      .eq('event_type', eventType)
      .gte('recorded_at', since.toISOString())

    if (error) throw new Error(`Failed to fetch today's usage: ${error.message}`)
    return (data ?? []) as Array<{ quantity: number }>
  }

  /**
   * Fetch daily and monthly quota values for an organization.
   */
  async findOrgQuota(orgId: string): Promise<OrgQuota> {
    const { data, error } = await this.db
      .from('organizations')
      .select('api_quota_daily, api_quota_monthly')
      .eq('id', orgId)
      .single()

    if (error) throw new Error(`Failed to fetch org quota: ${error.message}`)
    return data as OrgQuota
  }

  /**
   * Fetch invoices for an organization, newest first.
   */
  async findInvoices(orgId: string, limit = 12): Promise<Invoice[]> {
    const { data, error } = await this.db
      .from('invoices')
      .select(INVOICE_COLS)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error('Failed to fetch invoices')
    return (data ?? []) as Invoice[]
  }

  /**
   * Fetch all active subscription plans ordered by sort_order.
   */
  async findSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await this.db
      .from('subscription_plans')
      .select(PLAN_COLS)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw new Error('Failed to fetch subscription plans')
    return data as SubscriptionPlan[]
  }

  /**
   * Fetch a single active plan by name.
   */
  async findPlanByName(name: string): Promise<SubscriptionPlan | null> {
    const { data } = await this.db
      .from('subscription_plans')
      .select(PLAN_COLS)
      .eq('name', name)
      .eq('is_active', true)
      .maybeSingle()

    return data as SubscriptionPlan | null
  }

  /**
   * Fetch an organization's current subscription joined with its plan.
   */
  async findOrgSubscription(organizationId: string): Promise<SubscriptionWithPlan | null> {
    const { data } = await this.db
      .from('organization_subscriptions')
      .select(`
        id, status, current_period_start, current_period_end,
        trial_end, canceled_at, external_id,
        metadata, created_at, updated_at,
        subscription_plans!inner (${PLAN_COLS})
      `)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!data) return null

    const raw = data.subscription_plans
    const plan = (Array.isArray(raw) ? raw[0] : raw) as SubscriptionPlan

    return {
      subscription: {
        id:                   data.id,
        status:               data.status,
        current_period_start: data.current_period_start,
        current_period_end:   data.current_period_end,
        trial_end:            data.trial_end,
        canceled_at:          data.canceled_at,
        external_id:          data.external_id,
        metadata:             (data.metadata as Record<string, unknown>) ?? {},
        created_at:           data.created_at,
        updated_at:           data.updated_at,
      },
      plan,
    }
  }

  /**
   * Update fields on an organization's subscription row.
   * Returns the updated row's id.
   */
  async updateSubscription(
    organizationId: string,
    fields: {
      plan_id?: string
      status?: string
      current_period_start?: string
      current_period_end?: string
      updated_at?: string
    }
  ): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('organization_subscriptions')
      .update(fields)
      .eq('organization_id', organizationId)
      .select('id')
      .single()

    if (error) throw new Error('Failed to update subscription')
    return data
  }

  /**
   * Update quota fields on the organizations row after a plan upgrade.
   */
  async updateOrgQuota(
    organizationId: string,
    quota: { api_quota_daily: number; api_quota_monthly: number; updated_at: string }
  ): Promise<void> {
    const { error } = await this.db
      .from('organizations')
      .update(quota)
      .eq('id', organizationId)

    if (error) throw new Error(`Failed to update org quota: ${error.message}`)
  }

  /**
   * Check whether an org_subscription row exists.
   * Used by upgradePlan to decide insert vs update.
   */
  async findOrgSubscriptionId(organizationId: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('organization_subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .maybeSingle()

    return data ?? null
  }

  // NOTE: token_balances has no organization_id column — it is a per-user
  // table (id, user_id, balance, total_ever). There is no org-scoped token
  // balance concept in the schema today. These two methods will fail at
  // query time until a real design decision is made (org-level balances
  // table? a view over per-member balances? something else?). Left
  // unmodified rather than guessing at a schema change; only caller today
  // is lib/infrastructure/billing.ts::deductTokens, which itself is not
  // yet wired into any live request path (see Phase 3 recommendations).
  async findOrgTokenBalance(orgId: string): Promise<{ balance: number } | null> {
    const { data } = await this.db
      .from('token_balances')
      .select('balance')
      .eq('organization_id', orgId)
      .maybeSingle()
    return data ?? null
  }

  async updateOrgTokenBalance(orgId: string, newBalance: number): Promise<void> {
    const { error } = await this.db
      .from('token_balances')
      .update({ balance: newBalance })
      .eq('organization_id', orgId)
    if (error) throw new Error(`Failed to update org token balance: ${error.message}`)
  }

  async findOrgQuotaWithStatus(orgId: string): Promise<{ api_quota_daily: number; status: string } | null> {
    const { data } = await this.db
      .from('organizations')
      .select('api_quota_daily, status')
      .eq('id', orgId)
      .single()
    return data ?? null
  }

  async findDailyUsageByEnvironment(
    orgId: string,
    environment: string,
    eventType: string,
    since: string
  ): Promise<Array<{ quantity: number }>> {
    const { data, error } = await this.db
      .from('usage_events')
      .select('quantity')
      .eq('organization_id', orgId)
      .eq('environment', environment)
      .eq('event_type', eventType)
      .gte('recorded_at', since)
    if (error) throw new Error(`Failed to fetch daily usage: ${error.message}`)
    return (data ?? []) as Array<{ quantity: number }>
  }
}
