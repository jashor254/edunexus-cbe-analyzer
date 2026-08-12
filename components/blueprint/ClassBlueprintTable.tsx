// components/blueprint/ClassBlueprintTable.tsx
//
// The teacher's entry point into the Blueprint: a whole class on one screen,
// ordered so the learners who need them are already at the top.
//
// Presentation only — every value arrives from `getClassBlueprint()`. No
// sorting rules, no thresholds and no derived judgements live here.
//
// Deliberately contains no mean, total, position or rank. KNEC warned schools
// in December 2025 against circulating analyses built on aggregate or mean
// scores, so the class summary shows a DISTRIBUTION and a support-ordering
// instead — which is also the more useful thing for planning a week.

import Link from 'next/link'
import type { ClassBlueprint, ClassBlueprintRow, ClassAttentionReason } from '@/lib/learnerBlueprint/classBlueprint'
import { subjectLabel } from './blueprintNarrative'

const CBC_LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
  4: 'Exceeding',
  3: 'Meeting',
  2: 'Approaching',
  1: 'Below',
}

const CBC_LEVEL_ACCENT: Record<1 | 2 | 3 | 4, string> = {
  4: 'bg-emerald-600 text-white',
  3: 'bg-sky-700 text-white',
  2: 'bg-amber-500 text-white',
  1: 'bg-rose-600 text-white',
}

const REASON_COPY: Record<ClassAttentionReason, { label: string; tone: string } | null> = {
  no_evidence:             { label: 'No assessment yet',    tone: 'bg-slate-800 text-white' },
  at_risk:                 { label: 'At risk',              tone: 'bg-rose-600 text-white' },
  multiple_subjects_below: { label: 'Several subjects low', tone: 'bg-amber-600 text-white' },
  one_subject_below:       { label: 'One subject low',      tone: 'bg-amber-500 text-white' },
  declining:               { label: 'Slipping',             tone: 'bg-orange-500 text-white' },
  not_bridged:             { label: 'Record not linked',    tone: 'bg-violet-600 text-white' },
  none:                    null,
}

function asOfLabel(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-KE', { dateStyle: 'medium' })
}

function LearnerRow({ row }: { row: ClassBlueprintRow }) {
  const reason = REASON_COPY[row.attentionReason]

  return (
    <tr className="border-b border-slate-100 last:border-b-0 align-top">
      <td className="py-2.5 pr-3">
        <Link
          href={`/student/blueprint/${row.coreLearnerId}`}
          className="text-sm font-bold text-teal-800 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {row.learnerName}
        </Link>
        {row.admissionNumber && (
          <p className="text-[11px] text-slate-400">{row.admissionNumber}</p>
        )}
      </td>

      <td className="py-2.5 pr-3">
        {reason
          ? <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${reason.tone}`}>{reason.label}</span>
          : <span className="text-[11px] text-slate-400">—</span>}
      </td>

      <td className="py-2.5 pr-3">
        {row.subjects.length === 0 ? (
          <span className="text-[11px] text-slate-400">
            {row.bridged ? 'Nothing recorded yet' : 'Not linked to an assessment record'}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.subjects.map((s) => (
              <span
                key={s.subject}
                title={`${subjectLabel(s.subject)} — ${CBC_LEVEL_LABEL[s.latestLevel]} (${s.evidenceCount} assessment${s.evidenceCount === 1 ? '' : 's'})`}
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${CBC_LEVEL_ACCENT[s.latestLevel]}`}
              >
                {subjectLabel(s.subject)}
              </span>
            ))}
          </div>
        )}
      </td>

      <td className="py-2.5 pr-3 text-right text-xs tabular-nums text-slate-500">
        {row.evidenceCount || '—'}
      </td>
    </tr>
  )
}

export default function ClassBlueprintTable({ data }: { data: ClassBlueprint }) {
  const { distribution: d, rows } = data
  const asOf = asOfLabel(data.oldestProjectionAsOf)

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-black text-[#0b1530]">
          {data.className ?? 'Class'} — Blueprint overview
        </h1>
        <p className="text-xs text-slate-500">
          {rows.length} learner{rows.length === 1 ? '' : 's'}, ordered by who needs attention first.
          {' '}This list shows no mean score, total or position.
        </p>
        {asOf && (
          <p className="text-[11px] text-slate-400">
            Learning pictures last recalculated on or after {asOf}. New assessments appear once they are recorded.
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Need attention" value={d.learnersNeedingAttention} tone="text-amber-700" />
        <Stat label="Assessed" value={d.learnersWithEvidence} tone="text-emerald-700" />
        <Stat label="No assessment yet" value={d.learnersWithoutEvidence} tone="text-slate-700" />
        <Stat label="Record not linked" value={d.learnersNotBridged} tone="text-violet-700" />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          No learners are enrolled in this class for the current term.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <Th>Learner</Th>
                <Th>Needs</Th>
                <Th>Subjects (lowest first)</Th>
                <Th align="right">Evidence</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => <LearnerRow key={row.coreLearnerId} row={row} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-0 py-2 pr-3 text-[10px] font-black uppercase tracking-wide text-slate-400 ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      <p className={`text-xl font-black tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}
