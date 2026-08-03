'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, School, ChevronLeft, Loader2, CheckCircle2, GraduationCap, Layers,
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

function isOrgType(value: string | null): value is OrgType {
  return ORG_TYPES.some(t => t.value === value)
}

// The real shape of a Kenyan school, in the school's own language — not the
// database's four-value school_type enum. Each option carries its own exact
// grade list so activation never has to guess from a coarse type; school_type
// is still set to the closest-fitting label for reporting, but the grades
// actually created always come from `gradeCodes` here, not from resolving
// school_type after the fact. See lib/core/schoolActivation.ts's
// SCHOOL_TYPE_GRADE_CATEGORIES comment for why 'primary' includes Junior
// School and 'secondary' means a standalone Senior School.
const SCHOOL_LEVELS = [
  {
    id:         'primary',
    label:      'Primary & Junior School',
    range:      'Pre-Primary to Grade 9',
    icon:       School,
    schoolType: 'primary' as const,
    gradeCodes: ['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'],
  },
  {
    id:         'senior',
    label:      'Senior School',
    range:      'Grade 10 to 12',
    icon:       GraduationCap,
    schoolType: 'secondary' as const,
    gradeCodes: ['G10', 'G11', 'G12'],
  },
  {
    id:         'junior_senior',
    label:      'Junior & Senior School',
    range:      'Grade 7 to 12',
    icon:       Layers,
    schoolType: 'mixed' as const,
    gradeCodes: ['G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
  },
  {
    id:         'full',
    label:      'Full School',
    range:      'Pre-Primary to Grade 12',
    icon:       Building2,
    schoolType: 'mixed' as const,
    gradeCodes: ['PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
  },
] as const

type SchoolLevelId = typeof SCHOOL_LEVELS[number]['id']

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function NewOrganizationForm() {
  const router  = useRouter()
  const searchParams = useSearchParams()
  // Arriving from the "For Schools" marketing CTA already knows the type —
  // preselect it and skip straight to the school-specific step instead of
  // making a principal pick "School" out of an 8-item list aimed at
  // districts/ministries/etc.
  const presetType = isOrgType(searchParams.get('type')) ? searchParams.get('type') as OrgType : ''
  const [step, setStep]   = useState<1 | 2>(presetType ? 2 : 1)
  const [type, setType]   = useState<OrgType | ''>(presetType)
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevelId | ''>('')
  const [form, setForm]   = useState({ name: '', slug: '', website: '', country: 'KE' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const isSchool = type === 'school'

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, slug: f.slug || slugify(name) }))
  }

  async function submitSchool() {
    const level = SCHOOL_LEVELS.find(l => l.id === schoolLevel)
    if (!level || !form.name.trim()) return
    setLoading(true)
    setError('')

    try {
      // Wave 1 deliberately does NOT create an `organizations` row here.
      // Verified live (2026-08-02): that table has never been migrated to
      // this database (its migration, 20260701_phase8_platform_foundation,
      // is absent from the applied migration history) — every previous
      // attempt to create one has been silently failing. Core (schools/
      // school_users/academic_years/classes) is what actually runs
      // day-to-day school operations and is fully verified working
      // end-to-end. Re-linking school creation to org/billing is a
      // deliberate Wave 2+ decision once that table exists, not something
      // to route around silently here.
      const coreRes = await fetch('/api/core/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name: form.name.trim(),
          school_type: level.schoolType,
          grade_codes: level.gradeCodes,
        }),
      })
      const coreData = await coreRes.json()
      if (!coreRes.ok) throw new Error(coreData.error ?? 'Something went wrong setting up your school')
      if (coreData.data?.activation?.status !== 'complete') {
        throw new Error(
          `Your school was created, but setup didn't finish (${coreData.data?.activation?.failedStep ?? 'unknown step'}). Please try again, or message us on WhatsApp.`
        )
      }
      router.push('/teacher/core-office?justCreated=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  async function submitGeneric() {
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
      router.push(`/organizations/${data.organization.id}?welcome=1`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  // ── Honest loading state — one true message, not a fabricated sequence.
  // A single POST /api/core/school call does the real work server-side and
  // returns only once it's finished; there is no real per-step signal to
  // show during the request, so this deliberately doesn't fake one.
  if (loading && isSchool) {
    return (
      <div className="min-h-screen bg-[#060d18] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-5" />
          <p className="text-white font-semibold">Setting up {form.name || 'your school'}…</p>
          <p className="text-white/40 text-sm mt-2">This usually takes a few seconds.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        <Link href="/organizations" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Step 1 — Pick type (only reached without the marketing preselect) */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">What are you setting up?</h1>
            </div>
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

        {/* Step 2, school path — the dedicated, calm, jargon-free flow */}
        {step === 2 && isSchool && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Let&apos;s set up your school</h1>
              <p className="text-white/50 text-sm mt-1.5">
                Just two things — we&apos;ll take care of the rest.
              </p>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">School name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Sunshine Primary School"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Which best describes your school?</label>
              <p className="text-white/35 text-xs mb-3">
                This decides which grades and classes we set up for you — you can adjust anything later.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SCHOOL_LEVELS.map(level => (
                  <button
                    key={level.id}
                    onClick={() => setSchoolLevel(level.id)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      schoolLevel === level.id
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${schoolLevel === level.id ? 'bg-teal-500/20' : 'bg-white/10'}`}>
                      <level.icon className={`w-4.5 h-4.5 ${schoolLevel === level.id ? 'text-teal-400' : 'text-white/50'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm">{level.label}</p>
                      <p className="text-white/40 text-xs mt-0.5">{level.range}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={submitSchool}
              disabled={loading || !form.name.trim() || !schoolLevel}
              className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <School className="w-4 h-4" />
              Set up my school
            </button>
            <p className="text-center text-white/25 text-xs">
              No card needed. Nothing else is required to get started.
            </p>
          </div>
        )}

        {/* Step 2, everything else (district/county/publisher/etc.) — unchanged generic org form */}
        {step === 2 && !isSchool && (
          <div className="space-y-5">
            <p className="text-white/70 text-sm mb-1">Fill in your organization&apos;s details</p>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Organization name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Nairobi Education Trust"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Website <span className="text-white/30">(optional)</span></label>
              <input
                type="url"
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://example.ac.ke"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors"
              />
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
                onClick={submitGeneric}
                disabled={loading || !form.name.trim()}
                className="flex-1 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                {loading ? 'Creating…' : 'Create Organization'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function NewOrganizationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060d18] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <NewOrganizationForm />
    </Suspense>
  )
}
