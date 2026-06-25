'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, Download, CheckCircle2,
  ClipboardList, Sparkles, AlertTriangle, Check,
} from 'lucide-react'

interface ROWEntry {
  id:                  string
  week:                number
  lesson:              number
  date_taught:         string | null
  strand:              string
  substrand:           string
  activities_summary?: string[] | null
  reflection:          string
}

interface ROWRecord {
  id:              string
  school:          string
  grade:           string
  learning_area:   string
  term:            string
  year:            number
  curriculum_mode: string | null
  teacher_name:    string
  scheme_id:       string | null
}

export default function RecordOfWorkEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }               = use(params)
  const [row, setRow]        = useState<ROWRecord | null>(null)
  const [entries, setEntries] = useState<ROWEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'editing' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/teacher/records-of-work/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setRow(d.data.row); setEntries(d.data.entries || []) }
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [id])

  const updateReflection = useCallback((
    entryId: string,
    reflection: string,
    extra: Record<string, string> = {}
  ) => {
    setSaveState('editing')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      await fetch(`/api/teacher/records-of-work/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, reflection, ...extra }),
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    }, 800)
  }, [id])

  function handleDownload() {
    if (!row) return
    const w = window.open('', '_blank')
    if (w) { w.document.write(buildPrintHtml(row, entries)); w.document.close() }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Loading record of work...</p>
        </div>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="font-bold text-gray-700">Record not found</p>
          <Link href="/teacher/record-of-work" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">← Back to Records</Link>
        </div>
      </div>
    )
  }

  const done  = entries.filter(e => e.reflection?.trim()).length
  const total = entries.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-size-[40px_40px]" />
        <div className="absolute top-0 right-1/3 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/teacher/record-of-work"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-white/10 transition">
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-900/40 shrink-0">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-tight">{row.learning_area}</h1>
                <p className="text-slate-400 text-xs mt-0.5">
                  {row.grade} · Term {row.term} · {row.year}
                  {row.school && <> · {row.school}</>}
                  {row.scheme_id && (
                    <span className="ml-2 text-teal-400 inline-flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> From SOW
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {saveState === 'editing' && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                </span>
              )}
              {saveState === 'saved' && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
              <button onClick={handleDownload}
                className="flex items-center gap-2 bg-linear-to-r from-indigo-500 to-violet-500 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition shadow-lg shadow-indigo-900/30">
                <Download className="w-4 h-4" /> Print / Download
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">{done}/{total} lessons with reflections</span>
              <span className={`font-black ${pct === 100 ? 'text-teal-400' : 'text-indigo-300'}`}>{pct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-linear-to-r from-teal-500 to-emerald-500' : 'bg-linear-to-r from-indigo-500 to-violet-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7">
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="font-black text-gray-700 mb-1">No lesson entries</h3>
            <p className="text-gray-400 text-sm">This record has no lessons — link a Scheme of Work to auto-populate.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Meta header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
                <div><span className="font-semibold text-slate-500">School:</span> <span className="text-slate-800">{row.school}</span></div>
                <div><span className="font-semibold text-slate-500">Subject:</span> <span className="text-slate-800">{row.learning_area}</span></div>
                <div><span className="font-semibold text-slate-500">Grade:</span> <span className="text-slate-800">{row.grade}</span></div>
                <div><span className="font-semibold text-slate-500">Teacher:</span> <span className="text-slate-800">{row.teacher_name || '—'}</span></div>
                <div><span className="font-semibold text-slate-500">Term:</span> <span className="text-slate-800">{row.term}</span></div>
                <div><span className="font-semibold text-slate-500">Year:</span> <span className="text-slate-800">{row.year}</span></div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#1e293b] text-white">
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-slate-600 w-27.5">Date</th>
                    <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide border-r border-slate-600 w-20">Wk / Lesson</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-slate-600">Work Done</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide border-r border-slate-600 w-50">Reflection</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide w-22.5">Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry, idx) => {
                    const hasDone = entry.reflection?.trim().length > 0
                    return (
                      <tr key={entry.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        {/* Date — editable */}
                        <td className="px-3 py-3 border-r border-slate-100 align-top">
                          <input
                            type="date"
                            defaultValue={entry.date_taught ?? ''}
                            onBlur={e => {
                              const v = e.target.value
                              if (v !== (entry.date_taught ?? '')) {
                                setEntries(prev => prev.map(en => en.id === entry.id ? { ...en, date_taught: v } : en))
                                updateReflection(entry.id, entry.reflection, { date_taught: v })
                              }
                            }}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 bg-white w-full transition"
                          />
                        </td>

                        {/* Wk / Lesson */}
                        <td className="px-3 py-3 border-r border-slate-100 align-top text-center">
                          <span className="font-black text-slate-700 text-sm">Wk {entry.week}</span>
                          <div className="text-xs text-slate-400 mt-0.5">L{entry.lesson}</div>
                        </td>

                        {/* Work Done — strand + substrand editable */}
                        <td className="px-3 py-3 border-r border-slate-100 align-top">
                          <div className="text-xs space-y-1.5">
                            <div>
                              <div className="font-semibold text-slate-400 text-[10px] uppercase mb-0.5">Strand</div>
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => {
                                  const v = e.currentTarget.textContent ?? ''
                                  if (v !== entry.strand) {
                                    setEntries(prev => prev.map(en => en.id === entry.id ? { ...en, strand: v } : en))
                                    updateReflection(entry.id, entry.reflection, { strand: v })
                                  }
                                }}
                                className="outline-none text-slate-800 cursor-text rounded px-1 -mx-1 focus:bg-amber-50 focus:ring-1 focus:ring-amber-300 min-w-[80px] leading-snug"
                              >{entry.strand || ''}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-400 text-[10px] uppercase mb-0.5">Sub-Strand</div>
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => {
                                  const v = e.currentTarget.textContent ?? ''
                                  if (v !== entry.substrand) {
                                    setEntries(prev => prev.map(en => en.id === entry.id ? { ...en, substrand: v } : en))
                                    updateReflection(entry.id, entry.reflection, { substrand: v })
                                  }
                                }}
                                className="outline-none text-slate-800 cursor-text rounded px-1 -mx-1 focus:bg-amber-50 focus:ring-1 focus:ring-amber-300 min-w-[80px] leading-snug"
                              >{entry.substrand || ''}</div>
                            </div>
                          </div>
                        </td>

                        {/* Reflection — editable */}
                        <td className="px-3 py-3 border-r border-slate-100 align-top">
                          <div className="relative">
                            <textarea
                              rows={3}
                              defaultValue={entry.reflection}
                              onBlur={e => updateReflection(entry.id, e.target.value)}
                              placeholder="Add reflection…"
                              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 bg-white transition leading-relaxed"
                            />
                            <div className="absolute top-2 right-2">
                              {hasDone
                                ? <CheckCircle2 className="w-3 h-3 text-teal-500" />
                                : <div className="w-3 h-3 rounded-full border-2 border-slate-200" />}
                            </div>
                          </div>
                        </td>

                        {/* Signature */}
                        <td className="px-3 py-3 align-top">
                          <div className="h-8 border-b border-slate-200 mt-4" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Auto-saved · {total} lessons total · Only Reflection is editable
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-teal-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {done} with reflection
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <div className="w-3 h-3 rounded-full border-2 border-slate-300" /> {total - done} pending
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTitleCase(s: string): string {
  if (!s) return s
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function fmtTerm(term: string): string {
  return term.toLowerCase().startsWith('term') ? term : `Term ${term}`
}

// ─── Print HTML ───────────────────────────────────────────────────────────────

function buildPrintHtml(row: ROWRecord, entries: ROWEntry[]): string {
  const school      = toTitleCase(row.school || '')
  const teacherName = toTitleCase(row.teacher_name || '')
  const term        = fmtTerm(row.term)
  const done        = entries.filter(e => e.reflection?.trim()).length
  const total       = entries.length

  const tableRows = entries.map((e, i) => {
    const date = e.date_taught
      ? new Date(e.date_taught).toLocaleDateString('en-KE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '<span class="placeholder">dd/mm/yyyy</span>'
    const workDone = e.activities_summary?.[0]?.split(/[.!?\n]/)[0]?.trim() || e.substrand || '—'
    return `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="col-date">${date}</td>
      <td class="col-wk center">Wk ${e.week}<br/><span class="sub">L${e.lesson}</span></td>
      <td class="col-work">${workDone}</td>
      <td class="col-ref">${e.reflection || ''}</td>
      <td class="col-sig"></td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Record of Work — ${row.learning_area}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; }

  .no-print { text-align: right; padding: 10px 16px 0; }

  .doc-title {
    font-size: 13pt; font-weight: 900; text-align: center;
    text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;
  }
  .meta-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 14px; }
  .meta-table td { padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 10pt; }
  .ml { font-weight: 700; width: 18%; background: #f8fafc; }
  .mv { width: 32%; }

  .row-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .col-date  { width: 22mm; }
  .col-wk    { width: 18mm; }
  .col-work  { width: 72mm; }
  .col-ref   { width: 42mm; }
  .col-sig   { width: 26mm; }

  thead tr {
    background: #1e293b !important; color: #fff !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  th {
    padding: 7px 6px; text-align: left; font-size: 9pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #334155;
  }
  td {
    padding: 6px 6px; border: 1px solid #cbd5e1; vertical-align: top;
    font-size: 10pt; line-height: 1.45; min-height: 50px;
  }
  tr.alt td { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .center { text-align: center; }
  .sub { font-size: 8pt; color: #64748b; }
  .placeholder { color: #9CA3AF; font-style: italic; }

  .row-status {
    margin-top: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB;
    font-size: 8pt; color: #9CA3AF; font-style: italic; text-align: center;
  }
  .footer { margin-top: 6px; font-size: 8pt; color: #94a3b8; text-align: right; }

  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
    @page { size: A4 portrait; margin: 15mm; }
    thead tr { background: #1e293b !important; color: #fff !important;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()"
      style="background:#1e293b;color:#fff;border:none;padding:9px 20px;border-radius:6px;
             font-size:10pt;cursor:pointer;font-weight:700;">
      Print / Save as PDF
    </button>
  </div>
  <div style="padding:15mm;">
    <div class="doc-title">Record of Work Covered</div>
    <table class="meta-table">
      <tr>
        <td class="ml">School:</td>   <td class="mv">${school || '—'}</td>
        <td class="ml">Subject:</td>  <td class="mv">${row.learning_area}</td>
      </tr>
      <tr>
        <td class="ml">Grade:</td>    <td class="mv">${row.grade}</td>
        <td class="ml">Teacher:</td>  <td class="mv">${teacherName || '—'}</td>
      </tr>
      <tr>
        <td class="ml">Term:</td>     <td class="mv">${term}</td>
        <td class="ml">Year:</td>     <td class="mv">${row.year}</td>
      </tr>
    </table>

    <table class="row-table">
      <thead>
        <tr>
          <th class="col-date">Date</th>
          <th class="col-wk">Wk / Lesson</th>
          <th class="col-work">Work Done</th>
          <th class="col-ref">Reflection</th>
          <th class="col-sig">Signature</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div class="row-status">
      Record continues as lessons are completed — ${done} of ${total} lessons recorded
    </div>
    <div class="footer">EduNexus · edunexus.co.ke</div>
  </div>
</body>
</html>`
}
