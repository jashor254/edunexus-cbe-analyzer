'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, Copy, Printer, Check } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookletScheme {
  id:            string
  school:        string
  learning_area: string
  grade:         string
  term:          number
  year:          number
  teacher_name:  string
  tsc_number:    string
  textbook:      string
}

export interface BookletLesson {
  id:                 string
  week_number:        number
  lesson_number:      number
  strand:             string
  sub_strand:         string
  step_1:             string | null
  date_taught:        string | null
  activities_summary: string[] | null
  reflection:         string | null
  is_taught:          boolean
}

export interface BreakItem {
  title:     string
  startWeek: number
  endWeek:   number
}

interface Props {
  scheme:        BookletScheme
  lessons:       BookletLesson[]
  breaks:        BreakItem[]
  totalLessons:  number
  taughtLessons: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTitleCase(s: string): string {
  if (!s) return s
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getWorkDone(lesson: BookletLesson): string {
  const firstStep = lesson.activities_summary?.[0]
  if (firstStep) {
    const sentence = firstStep.split(/[.!?\n]/)[0]?.trim()
    if (sentence) return sentence.length > 120 ? sentence.slice(0, 120) + '…' : sentence
  }
  return lesson.sub_strand
}

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-1 min-h-[22px]">
        {value || '—'}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookletClient({
  scheme, lessons, breaks, totalLessons, taughtLessons,
}: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pct = totalLessons > 0 ? Math.round((taughtLessons / totalLessons) * 100) : 0

  // Interleave breaks into lesson rows
  type Row =
    | { type: 'break'; key: string; title: string }
    | { type: 'lesson'; lesson: BookletLesson }

  const breakWeeks = new Map<number, string>()
  for (const b of breaks) {
    for (let w = b.startWeek; w <= b.endWeek; w++) {
      breakWeeks.set(w, b.title)
    }
  }

  const rows: Row[] = []
  let lastBreakWeek = -1
  for (const lesson of lessons) {
    const breakTitle = breakWeeks.get(lesson.week_number)
    if (breakTitle && lesson.week_number !== lastBreakWeek) {
      rows.push({ type: 'break', key: `break-${lesson.week_number}`, title: breakTitle })
      lastBreakWeek = lesson.week_number
    }
    rows.push({ type: 'lesson', lesson })
  }

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
          body { font-size: 10pt; }
          .booklet-table thead tr {
            background: #111827 !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .booklet-table tr { page-break-inside: avoid; }
          .booklet-cover { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      {/* SECTION 1 — Top bar (no-print) */}
      <div className="no-print sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/teacher/record-of-work"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition shrink-0"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <span className="text-gray-900 font-semibold text-sm truncate">
            {scheme.learning_area} · Grade {scheme.grade} · Term {scheme.term}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition text-gray-600"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Share Link'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 hover:bg-teal-700 transition font-semibold"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12">

        {/* SECTION 2 — Cover (print-visible) */}
        <div className="booklet-cover border border-gray-200 rounded-xl p-8 my-6 bg-white shadow-sm">
          <h1 className="text-xl font-black tracking-widest text-center mb-8 text-gray-900 uppercase">
            Record of Work Covered
          </h1>
          <div className="grid grid-cols-2 gap-x-10 gap-y-5">
            <Field label="School"   value={toTitleCase(scheme.school)} />
            <Field label="Subject"  value={scheme.learning_area} />
            <Field label="Grade"    value={`Grade ${scheme.grade}`} />
            <Field label="Teacher"  value={toTitleCase(scheme.teacher_name)} />
            <Field label="TSC No."  value={scheme.tsc_number} />
            <Field label="Term"     value={`Term ${scheme.term}`} />
            <Field label="Year"     value={String(scheme.year)} />
            <Field label="Textbook" value={scheme.textbook} />
          </div>
        </div>

        {/* SECTION 3 — Progress bar (no-print) */}
        <div className="no-print mb-5">
          <div className="flex justify-between text-sm text-gray-600 mb-1.5">
            <span>Lessons recorded</span>
            <span className="font-semibold">{taughtLessons} of {totalLessons}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* SECTION 4 — Live table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="booklet-table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-gray-700" style={{ width: '8%' }}>Date</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-gray-700" style={{ width: '18%' }}>Strand</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-gray-700" style={{ width: '18%' }}>Sub-Strand</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-gray-700" style={{ width: '32%' }}>Work Done</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-gray-700" style={{ width: '12%' }}>Reflection</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide"                          style={{ width: '12%' }}>Signature</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.type === 'break') {
                  return (
                    <tr key={row.key} style={{ backgroundColor: '#FEF3C7', borderLeft: '3px solid #F59E0B' }}>
                      <td
                        colSpan={6}
                        className="px-3 py-2 text-xs font-bold"
                        style={{ color: '#92400E' }}
                      >
                        ── {row.title} ──
                      </td>
                    </tr>
                  )
                }

                const { lesson } = row
                const isTaught = lesson.is_taught

                return (
                  <tr
                    key={lesson.id}
                    className="border-b border-gray-100"
                    style={{
                      backgroundColor: isTaught ? 'white' : '#F9FAFB',
                      opacity: isTaught ? 1 : 0.6,
                    }}
                  >
                    <td className="px-3 py-3 text-xs align-top border-r border-gray-100">
                      {isTaught && lesson.date_taught
                        ? <span className="font-medium">{formatDate(lesson.date_taught)}</span>
                        : <span className="text-gray-300 italic">dd/mm/yyyy</span>
                      }
                    </td>
                    <td className="px-3 py-3 text-xs align-top border-r border-gray-100">
                      {lesson.strand}
                    </td>
                    <td className="px-3 py-3 text-xs align-top border-r border-gray-100">
                      {lesson.sub_strand}
                    </td>
                    <td className="px-3 py-3 text-xs align-top border-r border-gray-100">
                      {isTaught
                        ? getWorkDone(lesson)
                        : <span className="text-gray-300 italic">{lesson.sub_strand}</span>
                      }
                    </td>
                    <td className="px-3 py-3 text-xs align-top border-r border-gray-100 leading-relaxed">
                      {isTaught && lesson.reflection
                        ? lesson.reflection.length > 60
                          ? lesson.reflection.slice(0, 60) + '…'
                          : lesson.reflection
                        : null
                      }
                    </td>
                    <td className="px-3 py-3 text-xs align-top">
                      {isTaught && (
                        <span className="text-gray-300 italic text-[10px]">pending</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 italic text-center mt-4 pt-3 border-t border-gray-100 mb-2">
          Record continues as lessons are completed — {taughtLessons} of {totalLessons} lessons recorded this term
        </p>
      </div>
    </>
  )
}
