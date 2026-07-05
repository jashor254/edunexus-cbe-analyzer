'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, School, Globe, ChevronLeft, Loader2, CheckCircle2,
} from 'lucide-react'

const ORG_TYPES = [
  { value: 'school',     label: 'School',     desc: 'A primary or secondary school' },
  { value: 'district',   label: 'District',   desc: 'A cluster of schools' },
  { value: 'county',     label: 'County',     desc: 'County education office' },
  { value: 'publisher',  label: 'Publisher',  desc: 'Educational content publisher' },
  { value: 'developer',  label: 'Developer',  desc: 'Building on the EduNexus API' },
  { value: 'ngo',        label: 'NGO',        desc: 'Non-profit education organization' },
  { value: 'university', label: 'University', desc: 'Higher education institution' },
  { value: 'ministry',   label: 'Ministry',   desc: 'Government education body' },
] as const

type OrgType = typeof ORG_TYPES[number]['value']

export default function NewOrganizationPage() {
  const router  = useRouter()
  const [step, setStep]   = useState<1 | 2>(1)
  const [type, setType]   = useState<OrgType | ''>('')
  const [form, setForm]   = useState({ name: '', slug: '', website: '', country: 'KE' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  }

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, slug: f.slug || slugify(name) }))
  }

  async function submit() {
    if (!type || !form.name.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/organizations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name.trim(),
          slug:    form.slug.trim() || undefined,
          type,
          website: form.website.trim() || undefined,
          country: form.country,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create organization')
      router.push(`/organizations/${data.organization.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        <Link href="/organizations" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Organizations
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Create Organization</h1>
          <p className="text-white/50 text-sm mt-1">Step {step} of 2</p>
          <div className="flex gap-1 mt-3">
            <div className="flex-1 h-1 rounded-full bg-teal-500" />
            <div className={`flex-1 h-1 rounded-full transition-colors ${step === 2 ? 'bg-teal-500' : 'bg-white/10'}`} />
          </div>
        </div>

        {/* Step 1 — Pick type */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-white/70 text-sm mb-4">What type of organization are you creating?</p>
            {ORG_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                  type === t.value
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${type === t.value ? 'bg-teal-500/20' : 'bg-white/10'}`}>
                  <Building2 className={`w-5 h-5 ${type === t.value ? 'text-teal-400' : 'text-white/50'}`} />
                </div>
                <div>
                  <p className="font-medium text-white">{t.label}</p>
                  <p className="text-white/40 text-xs mt-0.5">{t.desc}</p>
                </div>
                {type === t.value && <CheckCircle2 className="w-5 h-5 text-teal-400 ml-auto flex-shrink-0" />}
              </button>
            ))}
            <button
              onClick={() => type && setStep(2)}
              disabled={!type}
              className="w-full mt-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Details */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-white/70 text-sm mb-1">Fill in your organization's details</p>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Organization name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Sunshine Primary School"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Slug (URL identifier)</label>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-teal-500 transition-colors">
                <span className="pl-4 text-white/30 text-sm whitespace-nowrap">edunexus.co.ke/org/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="sunshine-primary"
                  className="flex-1 bg-transparent px-2 py-3 text-white placeholder-white/30 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Website <span className="text-white/30">(optional)</span></label>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-teal-500 transition-colors">
                <Globe className="w-4 h-4 text-white/30 ml-4 flex-shrink-0" />
                <input
                  type="url"
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="https://yourschool.ac.ke"
                  className="flex-1 bg-transparent px-3 py-3 text-white placeholder-white/30 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 py-3 rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={submit}
                disabled={loading || !form.name.trim()}
                className="flex-1 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <School className="w-4 h-4" />}
                {loading ? 'Creating…' : 'Create Organization'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
