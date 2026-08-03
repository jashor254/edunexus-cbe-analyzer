export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getOrganization, getOrganizationMembers } from '@/lib/organizations/get'
import { getOrgSubscription } from '@/lib/billing/plans'
import { getUsageSummary, getCurrentMonthStart } from '@/lib/billing/usage'
import {
  Users, Key, BarChart3, Crown, AlertCircle,
  TrendingUp, Receipt, Globe, Building2, Sparkles,
} from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, accent = 'teal' }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent?: string
}) {
  const colors: Record<string, string> = {
    teal:   'bg-nexusteal-500/20 text-nexusteal-400',
    blue:   'bg-trustblue-500/20 text-trustblue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    amber:  'bg-amber-500/20 text-amber-400',
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/50 text-sm">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default async function OrgOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ welcome?: string; setup?: string }>
}) {
  const { orgId } = await params
  const { welcome, setup } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnTo=/organizations/${orgId}`)
  const [org, members, subscription] = await Promise.all([
    getOrganization(orgId, user.id),
    getOrganizationMembers(orgId, user.id),
    getOrgSubscription(orgId),
  ])

  const monthStart = await getCurrentMonthStart()
  const usage = await getUsageSummary(orgId, monthStart, new Date())

  const planName   = subscription?.plan.display_name ?? 'Free'
  const subStatus  = subscription?.subscription.status ?? 'active'
  const isActive   = subStatus === 'active' || subStatus === 'trialing'

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">

      {/* Welcome banner — shown once, right after a school signs up and creates its org */}
      {welcome === '1' && setup !== 'incomplete' && (
        <div className="mb-8 flex items-center gap-4 bg-nexusteal-500/10 border border-nexusteal-500/25 rounded-2xl px-6 py-5">
          <div className="w-11 h-11 rounded-xl bg-nexusteal-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-nexusteal-400" />
          </div>
          <div>
            <p className="text-white font-bold">Welcome to {org.name}&apos;s dashboard.</p>
            <p className="text-white/55 text-sm mt-0.5">
              This is home base — invite your team, track usage, and manage billing from here.
            </p>
          </div>
        </div>
      )}

      {/* Honest failure state — org billing was created, but the academic
          side (Core school: classes, terms, the actual teaching workspace)
          didn't finish setting up. Never claim "welcome, you're ready"
          when part of setup failed. */}
      {setup === 'incomplete' && (
        <div className="mb-8 flex items-center gap-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-6 py-5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-bold">Your organization is ready, but school setup didn&apos;t finish.</p>
            <p className="text-white/55 text-sm mt-0.5">
              Billing and members work from here, but your teaching workspace (classes, terms) needs
              another try. Message us on WhatsApp and we&apos;ll sort it out — don&apos;t retry account
              creation, it may create a duplicate.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-nexusteal-500/20 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-7 h-7 text-nexusteal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white">{org.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="text-white/40 text-sm">{org.slug}</span>
            {org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1 text-nexusteal-400 hover:text-nexusteal-300 text-sm transition-colors">
                <Globe className="w-3.5 h-3.5" />
                Website
              </a>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {subStatus}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-xs text-white/40">Plan</span>
          <p className="text-white font-semibold">{planName}</p>
        </div>
      </div>

      {/* Trial warning */}
      {subStatus === 'trialing' && org.trial_ends_at && (
        <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-amber-300 text-sm font-medium">Trial period active</p>
            <p className="text-white/50 text-xs mt-0.5">
              Trial ends {new Date(org.trial_ends_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Link href={`/organizations/${orgId}/billing`}
                className="ml-auto text-xs bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
            Upgrade
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Members"       value={members.length}                  icon={Users}     accent="teal"   />
        <StatCard label="API Requests"  value={usage.total_api_requests.toLocaleString()}
                                        sub={`${usage.percent_monthly_used}% of monthly quota`} icon={TrendingUp} accent="blue" />
        <StatCard label="Daily Quota"   value={`${usage.percent_daily_used}%`}  sub={`of ${usage.quota_daily.toLocaleString()} req/day`} icon={BarChart3} accent="purple" />
        <StatCard label="Plan"          value={planName}                        sub={subStatus}  icon={Receipt}   accent="amber"  />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: `/organizations/${orgId}/members`,   label: 'Manage Members',  sub: `${members.length} active`,     icon: Users },
          { href: `/organizations/${orgId}/api-keys`,  label: 'API Keys',        sub: 'Manage access',                icon: Key   },
          { href: `/organizations/${orgId}/billing`,   label: 'Billing & Usage', sub: planName,                       icon: Receipt },
        ].map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href}
                className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-nexusteal-500/30 rounded-xl transition-all group">
            <div className="w-10 h-10 rounded-lg bg-nexusteal-500/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-nexusteal-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">{label}</p>
              <p className="text-white/40 text-xs mt-0.5">{sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent members */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Recent Members</h2>
          <Link href={`/organizations/${orgId}/members`} className="text-nexusteal-400 hover:text-nexusteal-300 text-sm transition-colors">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {members.slice(0, 5).map(m => {
            const initials = (m.user.full_name ?? m.user.email)
              .split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-nexusteal-500/20 flex items-center justify-center text-nexusteal-400 text-xs font-semibold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.user.full_name ?? m.user.email}</p>
                  <p className="text-white/40 text-xs truncate">{m.user.email}</p>
                </div>
                <span className="text-xs text-white/40 capitalize flex-shrink-0">
                  {m.role === 'owner' && <Crown className="w-3.5 h-3.5 text-amber-400 inline mr-1" />}
                  {m.role}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
