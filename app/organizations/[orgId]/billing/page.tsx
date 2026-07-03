'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Receipt, TrendingUp, BarChart3, Zap, ArrowUp,
  Loader2, CheckCircle2, AlertCircle, Crown,
} from 'lucide-react'

type UsageData = {
  usage: {
    period: string
    total_api_requests: number
    total_ai_tokens: number
    quota_daily: number
    quota_monthly: number
    percent_daily_used: number
    percent_monthly_used: number
    by_event_type: Record<string, number>
  }
  subscription: {
    subscription: { status: string; current_period_end: string | null }
    plan: {
      display_name: string
      price_monthly_kes: number
      api_quota_daily: number
      api_quota_monthly: number
      features: string[]
      max_members: number
    }
  } | null
}

type Plan = {
  name: string
  display_name: string
  description: string | null
  price_monthly_kes: number
  api_quota_daily: number
  api_quota_monthly: number
  max_members: number
  features: string[]
}

function ProgressBar({ pct, warning = 80 }: { pct: number; warning?: number }) {
  const color = pct >= warning ? 'bg-amber-500' : 'bg-teal-500'
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

export default function BillingPage() {
  const params = useParams()
  const orgId  = params.orgId as string

  const [data,      setData]      = useState<UsageData | null>(null)
  const [plans,     setPlans]     = useState<Plan[]>([])
  const [loading,   setLoading]   = useState(true)
  const [upgrading, setUpgrading] = useState('')
  const [upgraded,  setUpgraded]  = useState('')
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, pRes] = await Promise.all([
        fetch(`/api/organizations/${orgId}/billing/usage`),
        fetch(`/api/organizations/${orgId}/billing/plans`),
      ])
      const uData = await uRes.json()
      const pData = await pRes.json()
      setData(uData)
      setPlans(pData.plans ?? [])
    } catch {
      setError('Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function upgradePlan(planName: string) {
    setUpgrading(planName)
    setError('')
    try {
      const res = await fetch(`/api/organizations/${orgId}/billing/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: planName }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setUpgraded(planName)
      setTimeout(() => { setUpgraded(''); load() }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed')
    } finally {
      setUpgrading('')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
    </div>
  )

  const usage  = data?.usage
  const sub    = data?.subscription
  const current = sub?.plan.display_name ?? 'Free'

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Billing & Usage</h1>
        <p className="text-white/50 text-sm mt-1">
          {usage ? `Current period: ${usage.period}` : '—'}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Current plan */}
      {sub && (
        <div className="mb-6 flex items-center gap-4 bg-teal-500/10 border border-teal-500/20 rounded-xl p-5">
          <Crown className="w-8 h-8 text-teal-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-white font-semibold">{sub.plan.display_name} Plan</p>
            <p className="text-white/40 text-sm">
              {sub.subscription.status}
              {sub.subscription.current_period_end &&
                ` · renews ${new Date(sub.subscription.current_period_end).toLocaleDateString('en-KE')}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg">
              {sub.plan.price_monthly_kes === 0
                ? 'Free'
                : `KES ${sub.plan.price_monthly_kes.toLocaleString()}/mo`}
            </p>
          </div>
        </div>
      )}

      {/* Usage stats */}
      {usage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/50 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Daily API Requests
              </span>
              <span className={`text-sm font-semibold ${usage.percent_daily_used >= 80 ? 'text-amber-400' : 'text-teal-400'}`}>
                {usage.percent_daily_used}%
              </span>
            </div>
            <ProgressBar pct={usage.percent_daily_used} />
            <p className="text-white/30 text-xs mt-2">
              Quota: {usage.quota_daily.toLocaleString()} req/day
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/50 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Monthly API Requests
              </span>
              <span className={`text-sm font-semibold ${usage.percent_monthly_used >= 85 ? 'text-amber-400' : 'text-teal-400'}`}>
                {usage.total_api_requests.toLocaleString()}
              </span>
            </div>
            <ProgressBar pct={usage.percent_monthly_used} warning={85} />
            <p className="text-white/30 text-xs mt-2">
              Quota: {usage.quota_monthly.toLocaleString()} req/month
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-white/50" />
              <span className="text-white/50 text-sm">AI Tokens Used</span>
            </div>
            <p className="text-2xl font-bold text-white">{usage.total_ai_tokens.toLocaleString()}</p>
            <p className="text-white/30 text-xs mt-1">This period</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/50 text-sm mb-3">Usage by type</p>
            <div className="space-y-1.5">
              {Object.entries(usage.by_event_type).slice(0, 4).map(([type, count]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-white/50">{type}</span>
                  <span className="text-white/70 font-medium">{(count as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Plan selection */}
      <h2 className="text-white font-semibold mb-4">Plans</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => {
          const isCurrent = plan.display_name === current
          const isUpgrade = !isCurrent

          return (
            <div key={plan.name}
                 className={`relative p-5 rounded-xl border flex flex-col ${
                   isCurrent
                     ? 'border-teal-500/50 bg-teal-500/10'
                     : 'border-white/10 bg-white/5 hover:border-white/20'
                 }`}>
              {isCurrent && (
                <span className="absolute -top-2.5 left-4 text-xs bg-teal-500 text-white px-2 py-0.5 rounded-full font-medium">
                  Current
                </span>
              )}
              <h3 className="text-white font-semibold">{plan.display_name}</h3>
              <p className="text-white/40 text-xs mt-1 mb-3">{plan.description}</p>
              <p className="text-2xl font-bold text-white mb-1">
                {plan.price_monthly_kes === 0 ? 'Free' : `KES ${plan.price_monthly_kes.toLocaleString()}`}
              </p>
              {plan.price_monthly_kes > 0 && <p className="text-white/30 text-xs">per month</p>}

              <ul className="mt-4 space-y-1.5 flex-1">
                <li className="text-xs text-white/60">{plan.api_quota_daily.toLocaleString()} req/day</li>
                <li className="text-xs text-white/60">{plan.max_members} members</li>
                {plan.features.slice(0, 3).map(f => (
                  <li key={f} className="text-xs text-white/60 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-teal-400 flex-shrink-0" />
                    {f.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>

              {isUpgrade && plan.name !== 'free' && (
                <button
                  onClick={() => upgradePlan(plan.name)}
                  disabled={upgrading === plan.name}
                  className="mt-4 w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {upgrading === plan.name
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : upgraded === plan.name
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <ArrowUp className="w-3.5 h-3.5" />}
                  {upgraded === plan.name ? 'Upgraded!' : 'Upgrade'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
