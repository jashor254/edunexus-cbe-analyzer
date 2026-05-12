'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import {
  Upload, Download, CheckCircle2, AlertTriangle, MessageSquare,
  Loader2, FileText, Users, ClipboardList,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string
  name: string
  reg_number?: string
  existing_score: number | null
  existing_status: string
}

interface Assignment {
  id: string
  title: string
  subject: string
  topic: string
  max_score: number
  teacher_classes: { name: string; grade: number } | null
}

type ScoreType = 'percentage' | 'cbc' | 'grade'

interface ManualRow {
  studentId: string
  name: string
  score: string
  notes: string
}

interface CSVRow {
  studentId: string
  name: string
  rawScore: string
  notes: string
  cbcLevel: number | null
  valid: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCbcLevel(raw: string, scoreType: ScoreType, maxScore: number): number | null {
  if (!raw.trim()) return null
  if (scoreType === 'cbc') {
    const n = parseInt(raw)
    if (n >= 1 && n <= 4) return n
    return null
  }
  if (scoreType === 'grade') {
    const g = raw.trim().toUpperCase()
    if (g === 'A' || g === 'A+') return 4
    if (g === 'B' || g === 'B+') return 3
    if (g === 'C' || g === 'C+') return 2
    if (g === 'D' || g === 'D+' || g === 'E') return 1
    return null
  }
  // percentage
  const n = parseFloat(raw)
  if (isNaN(n)) return null
  const pct = maxScore > 0 ? (n / maxScore) * 100 : n
  if (pct >= 75) return 4
  if (pct >= 55) return 3
  if (pct >= 40) return 2
  return 1
}

function toNumericScore(raw: string, scoreType: ScoreType, maxScore: number): number | null {
  if (!raw.trim()) return null
  if (scoreType === 'percentage') {
    const n = parseFloat(raw)
    return isNaN(n) ? null : Math.min(n, maxScore)
  }
  if (scoreType === 'cbc') {
    const n = parseInt(raw)
    if (n < 1 || n > 4) return null
    return Math.round((n / 4) * maxScore)
  }
  if (scoreType === 'grade') {
    const g = raw.trim().toUpperCase()
    const map: Record<string, number> = { 'A+': 100, A: 90, 'B+': 75, B: 65, 'C+': 55, C: 50, 'D+': 40, D: 35, E: 20 }
    const pct = map[g]
    if (pct === undefined) return null
    return Math.round((pct / 100) * maxScore)
  }
  return null
}

function cbcLabel(level: number) {
  return ['', 'Emerging', 'Approaching', 'Meeting', 'Exceeding'][level] || '—'
}

function buildWhatsApp(studentName: string, topic: string, subject: string, className: string) {
  return `https://wa.me/?text=${encodeURIComponent(
    `Hi, your child ${studentName} scored Level 1 in ${topic} (${subject}).\n\nRecommended: Ask them to review their Learning Compass session on this topic — 15 mins daily this week.\n\n— ${className}, EduNexus`
  )}`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResultsPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual')
  const [scoreType, setScoreType] = useState<ScoreType>('percentage')

  // Manual entry
  const [manualRows, setManualRows] = useState<ManualRow[]>([])
  const [savingManual, setSavingManual] = useState(false)
  const [manualDone, setManualDone] = useState(false)

  // CSV upload
  const [csvRows, setCsvRows] = useState<CSVRow[]>([])
  const [csvParsed, setCsvParsed] = useState(false)
  const [savingCsv, setSavingCsv] = useState(false)
  const [csvDone, setCsvDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Struggling alerts (shared between tabs)
  const [strugglingAlerts, setStrugglingAlerts] = useState<{ name: string; studentId: string }[]>([])

  useEffect(() => {
    fetch(`/api/teacher/assignments/${assignmentId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAssignment(d.data.assignment)
          const subs: Array<{ student_id: string; score: number | null; status: string }> = d.data.submissions || []
          const subMap = new Map(subs.map(s => [s.student_id, s]))

          // Build student list from submissions
          const rows: Student[] = subs.map((s: any) => ({
            id: s.student_id,
            name: s.students?.name || 'Unknown',
            existing_score: s.score,
            existing_status: s.status,
          }))
          setStudents(rows)
          setManualRows(rows.map(r => ({
            studentId: r.id,
            name: r.name,
            score: r.existing_score !== null ? String(r.existing_score) : '',
            notes: '',
          })))
        }
      })
      .finally(() => setLoading(false))
  }, [assignmentId])

  // ── CSV Template download ─────────────────────────────────────────────────
  function downloadTemplate() {
    const header = 'student_name,score,notes'
    const rows = students.map(s => `${s.name},,`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${assignment?.title?.replace(/\s+/g, '_') || 'assignment'}_results_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── CSV parse ─────────────────────────────────────────────────────────────
  function handleCSVFile(file: File) {
    if (!assignment) return
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) return
      const rows: CSVRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',')
        const rawName = (cols[0] || '').trim()
        const rawScore = (cols[1] || '').trim()
        const notes = (cols[2] || '').trim()
        // Match by name (case-insensitive)
        const student = students.find(s => s.name.toLowerCase() === rawName.toLowerCase())
        const cbcLvl = toCbcLevel(rawScore, scoreType, assignment.max_score)
        rows.push({
          studentId: student?.id || '',
          name: rawName,
          rawScore,
          notes,
          cbcLevel: cbcLvl,
          valid: !!student,
        })
      }
      setCsvRows(rows)
      setCsvParsed(true)
    }
    reader.readAsText(file)
  }

  // ── Save manual results ───────────────────────────────────────────────────
  async function saveManual() {
    if (!assignment) return
    setSavingManual(true)
    const struggling: { name: string; studentId: string }[] = []

    for (const row of manualRows) {
      if (!row.score.trim()) continue
      const numScore = toNumericScore(row.score, scoreType, assignment.max_score)
      if (numScore === null) continue

      await fetch(`/api/teacher/assignments/${assignmentId}/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: row.studentId,
          score: numScore,
          feedback: row.notes || null,
          status: 'marked',
        }),
      })

      const level = toCbcLevel(row.score, scoreType, assignment.max_score)
      if (level === 1) {
        struggling.push({ name: row.name, studentId: row.studentId })
      }
    }

    setSavingManual(false)
    setManualDone(true)
    setStrugglingAlerts(struggling)
  }

  // ── Save CSV results ──────────────────────────────────────────────────────
  async function saveCSV() {
    if (!assignment) return
    setSavingCsv(true)
    const struggling: { name: string; studentId: string }[] = []

    for (const row of csvRows.filter(r => r.valid && r.rawScore.trim())) {
      const numScore = toNumericScore(row.rawScore, scoreType, assignment.max_score)
      if (numScore === null || !row.studentId) continue

      await fetch(`/api/teacher/assignments/${assignmentId}/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: row.studentId,
          score: numScore,
          feedback: row.notes || null,
          status: 'marked',
        }),
      })

      if (row.cbcLevel === 1) {
        struggling.push({ name: row.name, studentId: row.studentId })
      }
    }

    setSavingCsv(false)
    setCsvDone(true)
    setStrugglingAlerts(struggling)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500">Assignment not found.</p>
        <Link href="/teacher/assignments" className="text-teal-600 font-bold mt-2 inline-block">← Back</Link>
      </div>
    )
  }

  const className = assignment.teacher_classes?.name || 'Class'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <Link href={`/teacher/assignments/${assignmentId}`} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Back to Assignment
        </Link>
        <h1 className="text-2xl font-black text-gray-900 mt-3">Upload Paper Results</h1>
        <p className="text-gray-500 text-sm mt-1">
          {assignment.title} &nbsp;·&nbsp; {className}
        </p>
      </div>

      {/* Score type selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 shadow-sm">
        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Score Format</div>
        <div className="flex gap-2">
          {([
            { key: 'percentage', label: 'Percentage %' },
            { key: 'cbc',        label: 'CBC Level (1–4)' },
            { key: 'grade',      label: 'Grade (A–E)' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setScoreType(key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${
                scoreType === key
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {scoreType === 'percentage' && `Enter marks out of ${assignment.max_score}. CBC level is auto-calculated.`}
          {scoreType === 'cbc' && 'Enter 1 (Emerging), 2 (Approaching), 3 (Meeting), or 4 (Exceeding).'}
          {scoreType === 'grade' && 'Enter A, B, C, D, or E. Converted to numeric score automatically.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition ${
            activeTab === 'manual'
              ? 'bg-teal-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Manual Entry
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition ${
            activeTab === 'csv'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-4 h-4" /> Upload CSV
        </button>
      </div>

      {/* ══ Manual Entry Tab ══════════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          {manualDone && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-bold text-green-800">Results saved!</div>
                <div className="text-xs text-green-600">Learning Compass updated for all marked students.</div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Student</span>
              <span>Score ({scoreType === 'percentage' ? `/ ${assignment.max_score}` : scoreType === 'cbc' ? '1–4' : 'A–E'})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {manualRows.map((row, i) => (
                <div key={row.studentId} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-black shrink-0">
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 font-semibold text-gray-900 text-sm">{row.name}</div>
                  <input
                    value={row.score}
                    onChange={e => {
                      const updated = [...manualRows]
                      updated[i] = { ...row, score: e.target.value }
                      setManualRows(updated)
                    }}
                    placeholder={scoreType === 'percentage' ? '0–' + assignment.max_score : scoreType === 'cbc' ? '1–4' : 'A–E'}
                    className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm text-center focus:border-teal-500 outline-none"
                  />
                  {row.score && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      toCbcLevel(row.score, scoreType, assignment.max_score) === 4 ? 'bg-green-100 text-green-700' :
                      toCbcLevel(row.score, scoreType, assignment.max_score) === 3 ? 'bg-blue-100 text-blue-700' :
                      toCbcLevel(row.score, scoreType, assignment.max_score) === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      L{toCbcLevel(row.score, scoreType, assignment.max_score) ?? '?'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={saveManual}
            disabled={savingManual || manualRows.every(r => !r.score.trim())}
            className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-black hover:bg-teal-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {savingManual
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><CheckCircle2 className="w-4 h-4" /> Confirm &amp; Save All Results</>
            }
          </button>
        </div>
      )}

      {/* ══ CSV Upload Tab ════════════════════════════════════════════════════ */}
      {activeTab === 'csv' && (
        <div className="space-y-4">
          {/* Step 1: Download template */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-black">1</div>
              <span className="font-bold text-gray-900">Download template with student names</span>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-bold transition"
            >
              <Download className="w-4 h-4" /> Download CSV Template
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Fill in the <code>score</code> column. Leave blank for absent students.
            </p>
          </div>

          {/* Step 2: Upload */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-black">2</div>
              <span className="font-bold text-gray-900">Upload filled CSV</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleCSVFile(file)
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 border-2 border-dashed border-teal-300 hover:border-teal-500 text-teal-700 px-6 py-4 rounded-xl w-full justify-center font-bold transition"
            >
              <Upload className="w-5 h-5" /> Click to upload CSV file
            </button>
          </div>

          {/* Step 3: Preview */}
          {csvParsed && csvRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-black">3</div>
                <span className="font-bold text-gray-900">Preview — confirm before saving</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                      <th className="px-5 py-2.5 text-left">Name</th>
                      <th className="px-4 py-2.5 text-center">Score</th>
                      <th className="px-4 py-2.5 text-center">CBC Level</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {csvRows.map((row, i) => (
                      <tr key={i} className={row.valid ? '' : 'bg-red-50'}>
                        <td className="px-5 py-3 font-semibold text-gray-900">{row.name}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{row.rawScore || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {row.cbcLevel !== null ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                              row.cbcLevel === 4 ? 'bg-green-100 text-green-700' :
                              row.cbcLevel === 3 ? 'bg-blue-100 text-blue-700' :
                              row.cbcLevel === 2 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {row.cbcLevel} — {cbcLabel(row.cbcLevel)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold">
                          {row.valid
                            ? <span className="text-green-600">✅ Ready</span>
                            : <span className="text-red-500">⚠ Name not matched</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {csvDone ? (
                <div className="m-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-bold text-green-800">Results saved!</div>
                    <div className="text-xs text-green-600">Learning Compass updated for all marked students.</div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <button
                    onClick={saveCSV}
                    disabled={savingCsv || csvRows.every(r => !r.rawScore.trim())}
                    className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {savingCsv
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                      : <><CheckCircle2 className="w-4 h-4" /> Confirm &amp; Save All Results</>
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Struggling students alert (FIX 6) ──────────────────────────────── */}
      {strugglingAlerts.length > 0 && (
        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-black text-orange-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {strugglingAlerts.length} student{strugglingAlerts.length > 1 ? 's' : ''} scored Level 1
              </div>
              <div className="text-sm text-orange-700 mt-1">
                These students need support. Send a WhatsApp message to their parents today.
              </div>
              <div className="text-xs text-orange-500 mt-0.5">
                Suggested: Ask them to review their Learning Compass session on {assignment.topic} — 15 mins daily this week.
              </div>
            </div>
            <button
              onClick={() => setStrugglingAlerts([])}
              className="text-xs text-orange-400 hover:text-orange-600 font-bold mt-1"
            >
              Dismiss
            </button>
          </div>

          <div className="space-y-2">
            {strugglingAlerts.map(a => (
              <div key={a.studentId} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-orange-100">
                <span className="font-bold text-gray-900 text-sm">{a.name}</span>
                <a
                  href={buildWhatsApp(a.name, assignment.topic, assignment.subject, className)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-black text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 transition whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Alert {a.name.split(' ')[0]}&apos;s Parent
                </a>
              </div>
            ))}

            {strugglingAlerts.length > 1 && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hi, ${strugglingAlerts.length} students scored Level 1 in ${assignment.topic} (${assignment.subject}).\n\n` +
                  strugglingAlerts.map(a => `• ${a.name}`).join('\n') +
                  `\n\nPlease encourage 15 min daily Learning Compass practice this week.\n\n— EduNexus`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-3 rounded-2xl font-black text-sm hover:bg-green-700 transition"
              >
                <MessageSquare className="w-4 h-4" /> Alert All {strugglingAlerts.length} Parents at Once
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
