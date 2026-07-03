export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'

export type SubscriptionPlan = {
  id: string
  name: string
  display_name: string
  description: string | null
  price_monthly_kes: number
  price_annual_kes: number
  api_quota_daily: number
  api_quota_monthly: number
  ai_token_quota: number
  max_members: number
  max_schools: number
  features: string[]
  paystack_plan_code: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type OrganizationSubscription = {
  id: string
  organization_id: string
  plan_id: string
  status: SubscriptionStatus
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

export type Invoice = {
  id: string
  organization_id: string
  subscription_id: string | null
  invoice_number: string
  status: InvoiceStatus
  amount_kes: number
  currency: string
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  paystack_reference: string | null
  line_items: InvoiceLineItem[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type InvoiceLineItem = {
  description: string
  quantity: number
  unit_price_kes: number
  total_kes: number
}

export type UsageSummary = {
  period: string
  total_api_requests: number
  total_ai_tokens: number
  by_event_type: Record<string, number>
  quota_daily: number
  quota_monthly: number
  percent_daily_used: number
  percent_monthly_used: number
}

export type BillingOverview = {
  subscription: OrganizationSubscription & { plan: SubscriptionPlan }
  current_usage: UsageSummary
  invoices: Invoice[]
}
