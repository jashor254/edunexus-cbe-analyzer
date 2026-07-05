'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Settings, Loader2, CheckCircle2, AlertCircle, Globe, Palette } from 'lucide-react'

type OrgData = {
  id: string
  name: string
  slug: string
  website: string | null
  timezone: string
  locale: string
  currency: string
  primary_color: string
  status: string
}

export default function OrgSettingsPage() {
  const params = useParams()
  const orgId  = params.orgId as string

  const [org,     setOrg]     = useState<OrgData | null>(null)
  const [form,    setForm]    = useState({ name: '', website: '', timezone: '', locale: '', currency: '', primary_color: '' })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/organizations/${orgId}`)
      const data = await res.json()
      const o    = data.organization as OrgData
      setOrg(o)
      setForm({
        name:          o.name,
        website:       o.website ?? '',
        timezone:      o.timezone,
        locale:        o.locale,
        currency:      o.currency,
        primary_color: o.primary_color,
      })
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          form.name.trim()   || undefined,
          website:       form.website.trim() || null,
          timezone:      form.timezone,
          locale:        form.locale,
          currency:      form.currency,
          primary_color: form.primary_color,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
    </div>
  )

  return (
    <div className="px-6 py-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/50 text-sm mt-1">Organization profile and preferences</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-white/60 text-sm mb-1.5">Organization name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-white/60 text-sm mb-1.5">Slug (read-only)</label>
          <input
            type="text"
            value={org?.slug ?? ''}
            readOnly
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/30 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-white/60 text-sm mb-1.5">
            <Globe className="w-3.5 h-3.5 inline mr-1.5" />
            Website
          </label>
          <input
            type="url"
            value={form.website}
            onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            placeholder="https://yourschool.ac.ke"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 text-sm mb-1.5">Timezone</label>
            <select
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option value="Africa/Nairobi" className="bg-[#0c1929]">Africa/Nairobi (EAT)</option>
              <option value="Africa/Lagos"   className="bg-[#0c1929]">Africa/Lagos (WAT)</option>
              <option value="Africa/Cairo"   className="bg-[#0c1929]">Africa/Cairo (EET)</option>
              <option value="UTC"            className="bg-[#0c1929]">UTC</option>
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-sm mb-1.5">Currency</label>
            <select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option value="KES" className="bg-[#0c1929]">KES — Kenya Shilling</option>
              <option value="UGX" className="bg-[#0c1929]">UGX — Uganda Shilling</option>
              <option value="TZS" className="bg-[#0c1929]">TZS — Tanzania Shilling</option>
              <option value="USD" className="bg-[#0c1929]">USD — US Dollar</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-white/60 text-sm mb-1.5">
            <Palette className="w-3.5 h-3.5 inline mr-1.5" />
            Brand color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primary_color}
              onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="w-12 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={form.primary_color}
              onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
              placeholder="#1e3a5f"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-2"
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : saved
            ? <CheckCircle2 className="w-4 h-4" />
            : <Settings className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
