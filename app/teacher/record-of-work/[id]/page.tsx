'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, Download, CheckCircle2,
  ClipboardList, Sparkles, AlertTriangle,
} from 'lucide-react'

interface ROWEntry {
  id: string
  week: number
  lesson: number
  date_taught: string | null
  strand: string
  substrand: string
  reflection: string
}

interface ROWRecord {
  id: string
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
  curriculum_mode: string | null
  teacher_name: string
  scheme_id: string | null
}

const WEEK_GRADIENTS = [
  'from-teal-500 to-emerald-500',
  'from-indigo-500 to-violet-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
  'from-purple-500 to-fuchsia-500',
  'from-lime-500 to-green-500',
  'from-red-500 to-rose-500',
  'from-sky-500 to-cyan-500',
  'from-orange-500 to-red-500',
]

export default function RecordOfWorkEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }              = use(params)
  const [row, setRow]       = useState<ROWRecord | null>(null)
  const [entries, setEntries] = useState<ROWEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/teacher/records-of-work/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setRow(d.data.row); setEntries(d.data.entries || []) }
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [id])

  const updateEntry = useCallback(async (entryId: string, field: string, value: string) => {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: value } : e))
    setSaving(entryId)
    await fetch(`/api/teacher/records-of-work/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId, [field]: value }),
    })
    setSaving(null)
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
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-0 right-1/3 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/teacher/record-of-work"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-white/10 transition">
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-900/40 shrink-0">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-tight">{row.learning_area}</h1>
                <p className="text-slate-400 text-xs mt-0.5">
                  {row.grade} · Term {row.term} · {row.year}
                  {row.school && <> · {row.school}</>}
                  {row.scheme_id && <span className="ml-2 text-teal-400 flex-inline items-center gap-0.5"><Sparkles className="w-2.5 h-2.5 inline" /> From SOW</span>}
                </p>
              </div>
            </div>

            <button onClick={handleDownload}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition shadow-lg shadow-indigo-900/30">
              <Download className="w-4 h-4" /> Print / Download
            </button>
          </div>

          {/* Progress */}
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">{done}/{total} lessons with reflections</span>
              <span className={`font-black ${pct === 100 ? 'text-teal-400' : 'text-indigo-300'}`}>{pct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="font-black text-gray-700 mb-1">No lesson entries</h3>
            <p className="text-gray-400 text-sm">This record has no lessons — link a Scheme of Work to auto-populate.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="bg-gradient-to-r from-slate-800 to-[#0c1929]">
              <div className="grid grid-cols-[60px_120px_1fr_1fr_1.6fr] gap-0">
                {['Week', 'Date', 'Strand', 'Sub-Strand', 'Reflection'].map((h, i) => (
                  <div key={i} className="px-4 py-3.5 text-xs font-black text-slate-300 uppercase tracking-wide border-r border-white/5 last:border-0">
                    {h}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50">
              {entries.map((entry, idx) => {
                const grad      = WEEK_GRADIENTS[(entry.week - 1) % WEEK_GRADIENTS.length]
                const isSaving  = saving === entry.id
                const hasDone   = entry.reflection?.trim().length > 0
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[60px_120px_1fr_1fr_1.6fr] gap-0 group transition-colors ${hasDone ? 'bg-teal-50/20' : 'hover:bg-slate-50/70'}`}
                  >
                    {/* Week */}
                    <div className="px-4 py-3 flex items-start pt-3.5 border-r border-slate-50">
                      <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-black text-xs shadow-sm shrink-0`}>
                        {entry.week}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="px-3 py-3 border-r border-slate-50 flex items-start">
                      <input
                        type="date"
                        defaultValue={entry.date_taught || ''}
                        onBlur={e => updateEntry(entry.id, 'date_taught', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white transition"
                      />
                    </div>

                    {/* Strand */}
                    <div className="px-3 py-3 border-r border-slate-50 flex items-start">
                      <textarea
                        rows={2}
                        defaultValue={entry.strand}
                        onBlur={e => updateEntry(entry.id, 'strand', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white transition leading-relaxed"
                      />
                    </div>

                    {/* Sub-Strand */}
                    <div className="px-3 py-3 border-r border-slate-50 flex items-start">
                      <textarea
                        rows={2}
                        defaultValue={entry.substrand}
                        onBlur={e => updateEntry(entry.id, 'substrand', e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white transition leading-relaxed"
                      />
                    </div>

                    {/* Reflection */}
                    <div className="px-3 py-3 flex items-start gap-2">
                      <textarea
                        rows={2}
                        defaultValue={entry.reflection}
                        onBlur={e => updateEntry(entry.id, 'reflection', e.target.value)}
                        placeholder="Teacher's reflection..."
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 bg-white transition leading-relaxed"
                      />
                      <div className="shrink-0 mt-0.5">
                        {isSaving
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          : hasDone
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                            : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200" />
                        }
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Auto-saved on blur · {total} lessons total
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-teal-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {done} done
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

// ─── Print HTML ───────────────────────────────────────────────────────────────

function buildPrintHtml(row: ROWRecord, entries: ROWEntry[]): string {
  const rows = entries.map(e => `
    <tr>
      <td class="center">${e.week}</td>
      <td>${e.date_taught ? new Date(e.date_taught).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</td>
      <td>${e.strand || ''}</td>
      <td>${e.substrand || ''}</td>
      <td>${e.reflection || ''}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Record of Work — ${row.learning_area}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 15mm; color: #111; }
  .header { text-align: center; margin-bottom: 14px; }
  .header h1 { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .header h2 { font-size: 12px; margin-top: 3px; color: #333; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; border: 1px solid #bbb; padding: 10px; border-radius: 4px; }
  .meta-label { font-size: 8px; text-transform: uppercase; color: #666; font-weight: 700; }
  .meta-value { font-weight: 900; font-size: 11px; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1e293b; }
  th { color: white; padding: 7px 8px; text-align: left; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
  td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; line-height: 1.5; font-size: 10px; }
  td.center { text-align: center; font-weight: 900; }
  tr:nth-child(even) td { background: #f8fafc; }
  .sig { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
  .sig-block { border-top: 1px solid #111; padding-top: 5px; }
  .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #444; }
  .sig-line { margin-top: 16px; border-bottom: 1px solid #999; }
  @media print { body { padding: 8mm; } @page { size: A4 portrait; margin: 8mm; } }
</style>
</head>
<body>
<div class="header">
  <h1>Record of Work Covered</h1>
  <h2>${row.school || ''}</h2>
</div>
<div class="meta">
  <div><div class="meta-label">Learning Area / Subject</div><div class="meta-value">${row.learning_area}</div></div>
  <div><div class="meta-label">Grade / Form</div><div class="meta-value">${row.grade}</div></div>
  <div><div class="meta-label">Term</div><div class="meta-value">${row.term}</div></div>
  <div><div class="meta-label">Year</div><div class="meta-value">${row.year}</div></div>
  <div><div class="meta-label">Teacher's Name</div><div class="meta-value">${row.teacher_name || ''}</div></div>
  <div><div class="meta-label">Curriculum</div><div class="meta-value">${row.curriculum_mode || 'CBC'}</div></div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:6%">Week</th>
      <th style="width:12%">Date</th>
      <th style="width:18%">Strand</th>
      <th style="width:22%">Sub-Strand</th>
      <th style="width:42%">Reflection</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="sig">
  <div class="sig-block">
    <div class="sig-label">Teacher's Signature</div>
    <div class="sig-line"></div>
  </div>
  <div class="sig-block">
    <div class="sig-label">HOD's Signature</div>
    <div class="sig-line"></div>
  </div>
  <div class="sig-block">
    <div class="sig-label">Principal's Signature</div>
    <div class="sig-line"></div>
  </div>
</div>
</body>
</html>`
}
