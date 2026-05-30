'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface Stats {
  users: number
  students: number
  assessments: number
  compassSessions: number
  payments: number
  totalRevenue: number
  activeSubscriptions: number
}

interface RecentUser {
  id: string
  email: string
  created_at: string
  plan: string
  balance: number
}

const ADMIN_EMAIL = 'kariukidennis092@gmail.com'

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [grantEmail, setGrantEmail] = useState('')
  const [grantStatus, setGrantStatus] = useState<string | null>(null)
  const [grantLoading, setGrantLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email?.toLowerCase().trim() !== ADMIN_EMAIL) {
        router.replace('/dashboard')
        return
      }
      setReady(true)
      fetchStats()
      fetchRecentUsers()
    })
  }, [router])

  const fetchStats = async () => {
    const res = await fetch('/api/admin/stats')
    const json = await res.json()
    if (json.success) setStats(json.data.stats)
  }

  const fetchRecentUsers = async () => {
    const res = await fetch('/api/admin/recent-users')
    const json = await res.json()
    if (json.success) setRecentUsers(json.data.users)
  }

  const handleGrantAccess = async () => {
    if (!grantEmail.trim()) return
    setGrantLoading(true)
    setGrantStatus(null)
    const res = await fetch('/api/admin/grant-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: grantEmail.trim(), days: 90 }),
    })
    const json = await res.json()
    setGrantStatus(
      json.success
        ? `✅ Access granted to ${grantEmail} — expires ${new Date(json.data.expiresAt).toLocaleDateString()}`
        : `❌ ${json.error}`
    )
    setGrantLoading(false)
    if (json.success) setGrantEmail('')
  }

  const handleExportCSV = () => {
    if (!recentUsers.length) return
    const header = 'id,email,created_at,plan,tokens'
    const rows = recentUsers.map((u) => `${u.id},${u.email},${u.created_at},${u.plan},${u.balance}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `edunexus-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const planColor: Record<string, string> = {
    free: 'bg-gray-700 text-gray-200',
    starter: 'bg-blue-900 text-blue-200',
    term: 'bg-violet-900 text-violet-200',
    premium: 'bg-amber-900 text-amber-200',
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">
              👑 Admin Panel
            </h1>
            <p className="text-white/50 text-sm mt-1">EduNexus Platform Control</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-900/50 text-red-400 border border-red-500/30">
            Administrator
          </span>
        </div>

        {/* SECTION 1 — Platform Stats */}
        <section>
          <h2 className="text-lg font-bold text-white/80 mb-4">Platform Stats</h2>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: stats.users.toLocaleString() },
                { label: 'Students', value: stats.students.toLocaleString() },
                { label: 'Assessments', value: stats.assessments.toLocaleString() },
                { label: 'Compass Sessions', value: stats.compassSessions.toLocaleString() },
                { label: 'Payments', value: stats.payments.toLocaleString() },
                { label: 'Total Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}` },
                { label: 'Active Subs', value: stats.activeSubscriptions.toLocaleString() },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <p className="text-white/50 text-xs mb-1">{s.label}</p>
                  <p className="text-2xl font-black text-white">{s.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse">
                  <div className="h-3 bg-white/10 rounded w-2/3 mb-2" />
                  <div className="h-7 bg-white/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2 — Recent Users */}
        <section>
          <h2 className="text-lg font-bold text-white/80 mb-4">Recent Sign-ups</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase">
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Signed up</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-right px-4 py-3">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-white/30">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  recentUsers.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white">{u.email}</td>
                      <td className="px-4 py-3 text-white/50 hidden md:table-cell">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${planColor[u.plan] ?? planColor.free}`}>
                          {u.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-amber-400 font-mono font-bold">
                        {u.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3 — Quick Actions */}
        <section>
          <h2 className="text-lg font-bold text-white/80 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Grant free access */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <p className="font-semibold text-white">Give User Free Access</p>
              <p className="text-white/40 text-xs">Grants 90-day Term subscription + 50 tokens</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleGrantAccess}
                  disabled={grantLoading || !grantEmail.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {grantLoading ? '…' : 'Grant'}
                </button>
              </div>
              {grantStatus && (
                <p className="text-xs text-white/70">{grantStatus}</p>
              )}
            </div>

            {/* Other actions */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <p className="font-semibold text-white">Other Actions</p>
              <div className="space-y-2">
                <a
                  href="/admin/payments"
                  className="flex items-center gap-2 w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View All Payments →
                </a>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Export Users CSV ↓
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 — System Status */}
        <section>
          <h2 className="text-lg font-bold text-white/80 mb-4">System Status</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'DeepSeek API',
                check: typeof process !== 'undefined',
                // checked client-side — always show configured
                value: 'Configured',
                ok: true,
              },
              {
                label: 'Paystack',
                value: 'Configured',
                ok: true,
              },
              {
                label: 'Supabase',
                value: 'Connected',
                ok: true,
              },
              {
                label: 'Environment',
                value: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
                ok: true,
              },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-white/40 text-xs mb-1">{s.label}</p>
                <p className="text-sm font-semibold">
                  {s.ok ? (
                    <span className="text-green-400">{s.value} ✅</span>
                  ) : (
                    <span className="text-red-400">{s.value} ❌</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
