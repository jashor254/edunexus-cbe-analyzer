'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { ChevronLeft } from 'lucide-react'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const SCHOOL_TYPES = [
  { value: 'public_primary',          label: 'Public Primary' },
  { value: 'private_primary',         label: 'Private Primary' },
  { value: 'public_comprehensive',    label: 'Public Comprehensive' },
  { value: 'private_comprehensive',   label: 'Private Comprehensive' },
] as const

// Minimal internal onboarding form — posts straight to the existing
// POST /api/core/school (its CreateSchoolSchema is the single source of
// truth for validation; this page adds no rules of its own).
export default function NewCoreSchoolPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState({
    school_name: '',
    school_type: '' as (typeof SCHOOL_TYPES)[number]['value'] | '',
    nemis_code: '',
    county: '',
    sub_county: '',
    contact_phone: '',
    contact_email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase().trim() ?? '')) {
        router.replace('/dashboard')
        return
      }
      setReady(true)
    })
  }, [router])

  async function submit() {
    if (!form.school_name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/core/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name:   form.school_name.trim(),
          school_type:   form.school_type || undefined,
          nemis_code:    form.nemis_code.trim() || undefined,
          county:        form.county.trim() || undefined,
          sub_county:    form.sub_county.trim() || undefined,
          contact_phone: form.contact_phone.trim() || undefined,
          contact_email: form.contact_email.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? 'Failed to create school')
      router.push('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (!ready) return null

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <Link href="/admin" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Admin
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-white">Onboard Core School</h1>
          <p className="text-white/50 text-sm mt-1">Creates a school in Core and makes you its first school_admin.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">School name *</label>
            <input
              type="text"
              value={form.school_name}
              onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))}
              placeholder="Mwatate Ridge Senior School"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">School type</label>
            <select
              value={form.school_type}
              onChange={e => setForm(f => ({ ...f, school_type: e.target.value as typeof f.school_type }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="" className="bg-[#060d18]">Select a type…</option>
              {SCHOOL_TYPES.map(t => (
                <option key={t.value} value={t.value} className="bg-[#060d18]">{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">NEMIS code</label>
              <input
                type="text"
                value={form.nemis_code}
                onChange={e => setForm(f => ({ ...f, nemis_code: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">County</label>
              <input
                type="text"
                value={form.county}
                onChange={e => setForm(f => ({ ...f, county: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">Sub-county</label>
            <input
              type="text"
              value={form.sub_county}
              onChange={e => setForm(f => ({ ...f, sub_county: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Contact phone</label>
              <input
                type="text"
                value={form.contact_phone}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Contact email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={submit}
            disabled={loading || !form.school_name.trim()}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Creating…' : 'Create School'}
          </button>
        </div>
      </div>
    </div>
  )
}
