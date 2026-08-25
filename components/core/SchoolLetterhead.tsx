// components/core/SchoolLetterhead.tsx
//
// Phase 3 (Learner Report Architecture — document identity/school authority).
// The ONE canonical, reusable header for a SCHOOL-OFFICIAL document (the
// official Report Card first; SOW, lesson plan, and Record of Work are named
// as future integrations in the Phase 3 closeout, not wired here — see that
// document for why this phase scopes to Report Card only).
//
// Renders only fields that genuinely exist on the School type
// (types/core.ts) — school_name, logo_url, motto, address, contact_phone,
// contact_email, nemis_code — and gracefully omits every optional field that
// is null, rather than fabricating a postal address, motto, or school code
// the database does not have. No principal/headteacher name or website
// field exists on School today; this component does not render them.
//
// Presentation-only: takes school identity as a prop, does not fetch data
// itself, and has no coupling to Clinic/intelligence code.
import type { School } from '@/types/core'

export type SchoolLetterheadIdentity = Pick<
  School,
  'school_name' | 'logo_url' | 'motto' | 'address' | 'contact_phone' | 'contact_email' | 'nemis_code'
>

type Props = {
  school: SchoolLetterheadIdentity
  /** Optional term/year context line, e.g. "Term 2, 2026". Omitted if not supplied. */
  contextLine?: string | null
}

export function SchoolLetterhead({ school, contextLine }: Props) {
  const contactParts = [school.contact_phone, school.contact_email].filter(Boolean)

  return (
    <div className="flex items-start gap-4 pb-4 border-b border-white/10">
      {school.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- external, school-supplied logo URL; not a static/local asset next/image can optimize
        <img
          src={school.logo_url}
          alt={`${school.school_name} logo`}
          className="w-14 h-14 rounded-xl object-contain bg-white/5 border border-white/10 shrink-0"
        />
      )}
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white leading-tight">{school.school_name}</h1>
        {school.motto && (
          <p className="text-xs text-white/50 italic mt-0.5">{school.motto}</p>
        )}
        <p className="text-xs text-white/40 mt-1">
          {[school.nemis_code && `NEMIS ${school.nemis_code}`, school.address].filter(Boolean).join(' · ')}
        </p>
        {contactParts.length > 0 && (
          <p className="text-xs text-white/40">{contactParts.join(' · ')}</p>
        )}
        {contextLine && (
          <p className="text-xs text-white/50 mt-1 font-medium">{contextLine}</p>
        )}
      </div>
    </div>
  )
}
