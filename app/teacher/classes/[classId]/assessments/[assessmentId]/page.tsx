'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import Link from 'next/link'
import {
  Save, Upload, Download, PlusCircle, BarChart2,
  ClipboardList, Loader2, AlertCircle, CheckCircle2, Printer, X,
} from 'lucide-react'
import type { ClassAssessment, LearnerMark, SubjectAnalysis } from '@/lib/assessments/types'
import { analyzeSubjects } from '@/lib/assessments/subjectAnalytics'
import { openMarksheetPDF } from '@/lib/assessments/pdfRenderer'
import { calculateMeanScore, calculateMeanGrade, GRADE_META } from '@/lib/assessments/gradeCalculator'
import type { MeanGrade } from '@/lib/assessments/gradeCalculator'
import { gradeLabel } from '@/lib/curriculum/gradeLabel'

// ── Types ──────────────────────────────────────────────────────────────
type MarkRow = {
  rowKey: string
  studentName: string
  admNo: string
  scores: Record<string, string>
  total: number
  meanScore: number
  meanGrade: string
  position: number | null
}

type PageTab = 'marksheet' | 'analysis'

// ── Helpers ────────────────────────────────────────────────────────────
function rowTotal(scores: Record<string, string>, subjects: string[]): number {
  return subjects.reduce((sum, s) => sum + (parseInt(scores[s] || '') || 0), 0)
}

function calcPositions(
  rows: MarkRow[],
  subjects: string[],
  maxScore: number,
  curriculum: string
): MarkRow[] {
  const withTotals = rows.map((r) => {
    const total = rowTotal(r.scores, subjects)
    const rawScores = Object.fromEntries(
      subjects.map((s) => [s, parseInt(r.scores[s] || '') || 0])
    )
    const ms = calculateMeanScore(rawScores)
    return {
      ...r,
      total,
      meanScore: ms,
      meanGrade: calculateMeanGrade(ms, maxScore, curriculum === '844' ? '844' : 'cbc'),
    }
  })
  const sorted = [...withTotals].sort((a, b) => b.total - a.total)
  const posMap = new Map<string, number>()
  let pos = 1
  sorted.forEach((r, i) => {
    if (i > 0 && r.total < sorted[i - 1].total) pos = i + 1
    posMap.set(r.rowKey, pos)
  })
  return withTotals.map((r) => ({
    ...r,
    position: r.total > 0 ? (posMap.get(r.rowKey) ?? null) : null,
  }))
}

function marksToRows(marks: LearnerMark[], subjects: string[]): MarkRow[] {
  if (marks.length === 0) return []
  return marks.map((m) => ({
    rowKey:      m.id,
    studentName: m.student_name,
    admNo:       m.admission_number || '',
    scores:      Object.fromEntries(subjects.map((s) => [s, m.subject_scores[s] !== undefined ? String(m.subject_scores[s]) : ''])),
    total:       m.total_marks || 0,
    meanScore:   m.mean_score ?? 0,
    meanGrade:   m.mean_grade ?? '',
    position:    m.position,
  }))
}

function newRow(): MarkRow {
  return {
    rowKey:      `new-${Date.now()}-${Math.random()}`,
    studentName: '',
    admNo:       '',
    scores:      {},
    total:       0,
    meanScore:   0,
    meanGrade:   '',
    position:    null,
  }
}

// ── Grade distribution bar ─────────────────────────────────────────────
function DistBar({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8 text-right">{value}</span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────
export default function MarksheetPage({
  params,
}: {
  params: Promise<{ classId: string; assessmentId: string }>
}) {
  const { classId, assessmentId } = use(params)

  const [tab, setTab]               = useState<PageTab>('marksheet')
  const [assessment, setAssessment] = useState<ClassAssessment | null>(null)
  const [classInfo, setClassInfo]   = useState<any>(null)
  const [teacherInfo, setTeacher]   = useState<{ full_name: string; school: string } | null>(null)
  const [rows, setRows]             = useState<MarkRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]             = useState(false)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvFile, setCsvFile]           = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    imported: number
    updated:  number
    errors:   Array<{ row: number; field: string; message: string }>
    skipped:  number
  } | null>(null)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [analysis, setAnalysis]     = useState<SubjectAnalysis[]>([])

  const cellRefs = useRef<(HTMLInputElement | null)[][]>([])
  const fileRef  = useRef<HTMLInputElement>(null)

  // ── Load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/teacher/assessments/${assessmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return
        const { assessment: a, marks, class: cls, teacher } = data.data
        setAssessment(a)
        setClassInfo(cls)
        setTeacher(teacher)

        const loaded = marksToRows(marks, a.subjects)
        const emptyRow = { ...newRow(), scores: Object.fromEntries(a.subjects.map((s: string) => [s, ''])) }
        const withPos = loaded.length > 0
          ? calcPositions(loaded, a.subjects, a.max_score, a.curriculum_type ?? 'cbc')
          : [emptyRow]
        setRows(withPos)
        setAnalysis(analyzeSubjects(marks, a.subjects, a.max_score))
      })
      .finally(() => setLoading(false))
  }, [assessmentId])

  // ── Toast helper ──────────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Cell change ───────────────────────────────────────────────────────
  const handleCellChange = useCallback(
    (rowKey: string, field: 'studentName' | 'admNo' | string, value: string) => {
      setRows((prev) => {
        const updated = prev.map((r) => {
          if (r.rowKey !== rowKey) return r
          if (field === 'studentName') return { ...r, studentName: value }
          if (field === 'admNo') return { ...r, admNo: value }
          return { ...r, scores: { ...r.scores, [field]: value } }
        })
        return calcPositions(
          updated,
          assessment?.subjects || [],
          assessment?.max_score ?? 100,
          assessment?.curriculum_type ?? 'cbc'
        )
      })
    },
    [assessment]
  )

  // ── Keyboard navigation ───────────────────────────────────────────────
  function handleKeyDown(
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number,
    totalCols: number
  ) {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey || (e.key === 'Tab' && e.shiftKey)) {
        const prev = colIdx - 1
        if (prev >= 0) cellRefs.current[rowIdx]?.[prev]?.focus()
        else cellRefs.current[rowIdx - 1]?.[totalCols - 1]?.focus()
      } else {
        const next = colIdx + 1
        if (next < totalCols) cellRefs.current[rowIdx]?.[next]?.focus()
        else cellRefs.current[rowIdx + 1]?.[0]?.focus()
      }
    }
  }

  // ── Add row ───────────────────────────────────────────────────────────
  function addRow() {
    if (!assessment) return
    const r = { ...newRow(), scores: Object.fromEntries(assessment.subjects.map((s) => [s, ''])) }
    setRows((prev) => [...prev, r])
    setTimeout(() => {
      const last = rows.length
      cellRefs.current[last]?.[0]?.focus()
    }, 50)
  }

  // ── Save all marks ────────────────────────────────────────────────────
  async function saveMarks() {
    if (!assessment) return
    const valid = rows.filter((r) => r.studentName.trim())
    if (valid.length === 0) { showToast('Add at least one learner name', false); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/teacher/assessments/${assessmentId}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marks: valid.map((r) => ({
            studentName:   r.studentName.trim(),
            admNo:         r.admNo.trim() || undefined,
            subjectScores: Object.fromEntries(
              assessment.subjects.map((s) => [s, parseInt(r.scores[s] || '') || 0])
            ),
          })),
        }),
      })
      const data = await res.json()
      if (!data.success) { showToast(data.error || 'Save failed', false); return }

      const saved: LearnerMark[] = data.data.marks
      setRows(marksToRows(saved, assessment.subjects))
      setAnalysis(analyzeSubjects(saved, assessment.subjects, assessment.max_score))
      showToast(`Saved ${data.data.saved} learners — positions calculated`)
    } catch {
      showToast('Network error — please try again', false)
    } finally {
      setSaving(false)
    }
  }

  // ── CSV upload ────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
      setUploadResult(null)
    }
    e.target.value = ''
  }

  async function handleUploadSubmit() {
    if (!csvFile || !assessment) return
    setCsvUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      const res = await fetch(`/api/teacher/assessments/${assessmentId}/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!data.success) { showToast(data.error || 'Upload failed', false); return }

      setUploadResult(data.data)
      setCsvFile(null)

      // Reload marks
      const mRes = await fetch(`/api/teacher/assessments/${assessmentId}/marks`)
      const mData = await mRes.json()
      if (mData.success) {
        const reloaded: LearnerMark[] = mData.data.marks
        setRows(marksToRows(reloaded, assessment.subjects))
        setAnalysis(analyzeSubjects(reloaded, assessment.subjects, assessment.max_score))
      }
    } catch {
      showToast('Upload failed', false)
    } finally {
      setCsvUploading(false)
    }
  }

  // ── PDF ───────────────────────────────────────────────────────────────
  function printPDF() {
    if (!assessment || !teacherInfo) return
    const marks: LearnerMark[] = rows
      .filter((r) => r.studentName.trim())
      .map((r, i) => ({
        id:               r.rowKey,
        assessment_id:    assessmentId,
        class_id:         classId,
        teacher_id:       assessment.teacher_id,
        student_name:     r.studentName,
        admission_number: r.admNo || null,
        subject_scores:   Object.fromEntries(
          assessment.subjects.map((s) => [s, parseInt(r.scores[s] || '') || 0])
        ),
        total_marks:  r.total,
        mean_score:   r.meanScore || null,
        mean_grade:   r.meanGrade || null,
        position:     r.position,
        created_at:   '',
        updated_at:   '',
      }))

    openMarksheetPDF(assessment, marks, {
      teacherName: teacherInfo.full_name,
      school:      teacherInfo.school,
    })
  }

  // ── Class stats ───────────────────────────────────────────────────────
  const filledRows      = rows.filter((r) => r.studentName.trim() && r.total > 0)
  const classAvg        = filledRows.length > 0
    ? Math.round((filledRows.reduce((s, r) => s + r.total, 0) / filledRows.length) * 10) / 10
    : null
  const classMeanScore  = filledRows.length > 0
    ? Math.round((filledRows.reduce((s, r) => s + r.meanScore, 0) / filledRows.length) * 10) / 10
    : null
  const classMeanGrade  = classMeanScore !== null && assessment
    ? calculateMeanGrade(classMeanScore, assessment.max_score, assessment.curriculum_type === '844' ? '844' : 'cbc')
    : null

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500">Assessment not found.</p>
        <Link href={`/teacher/classes/${classId}/assessments`} className="text-teal-600 font-bold mt-2 inline-block">
          ← Back to Assessments
        </Link>
      </div>
    )
  }

  const subjects    = assessment.subjects
  const totalCols   = subjects.length  // score columns only (name + adm are separate)
  const maxTotal    = subjects.length * assessment.max_score

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 py-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Back + header */}
      <div className="mb-5">
        <Link
          href={`/teacher/classes/${classId}/assessments`}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3 font-medium"
        >
          ← Back to Assessments
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{assessment.title}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {classInfo?.name} · {gradeLabel(classInfo?.grade ?? 7)} · Term {assessment.term} {assessment.year}
              {' · Max '}{assessment.max_score}/subject
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-bold text-xs hover:bg-gray-200 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Learner
            </button>
            <button
              onClick={printPDF}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-bold text-xs hover:bg-gray-200 transition"
            >
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={saveMarks}
              disabled={saving}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All Marks
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Bulk Upload Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
            <Upload className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <h2 className="font-black text-gray-900 text-sm">Bulk Upload Marks</h2>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">Enter marks for the whole class at once</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/teacher/assessments/${assessmentId}/template`}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-200 transition"
          >
            <Download className="w-4 h-4" /> Download CSV Template
          </a>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 border border-dashed border-teal-300 bg-teal-50 text-teal-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-100 transition"
          >
            <Upload className="w-4 h-4" />
            {csvFile ? csvFile.name : 'Select CSV to Upload'}
          </button>

          {csvFile && (
            <>
              <button
                onClick={handleUploadSubmit}
                disabled={csvUploading}
                className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
              >
                {csvUploading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />}
                Upload &amp; Calculate
              </button>
              <button
                onClick={() => { setCsvFile(null); setUploadResult(null) }}
                className="text-gray-400 hover:text-gray-600 transition"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {filledRows.length > 0 && (
            <a
              href={`/api/teacher/assessments/${assessmentId}/results-csv`}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-100 transition ml-auto"
            >
              <Download className="w-4 h-4" /> Download Results
            </a>
          )}
        </div>

        {/* Instructions — shown when no file selected and no result */}
        {!csvFile && !uploadResult && (
          <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">How it works</p>
            <div className="grid sm:grid-cols-2 gap-1">
              {[
                '1. Download the CSV template above',
                '2. Fill marks in Excel or Google Sheets',
                '3. Save as .csv and upload here',
                '4. System calculates totals, means &amp; rankings',
              ].map((step) => (
                <p key={step} className="text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: step }} />
              ))}
            </div>
          </div>
        )}

        {/* Upload result feedback */}
        {uploadResult && (
          <div className="mt-4">
            {uploadResult.errors.length === 0 ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-sm font-bold text-green-700">
                  {uploadResult.imported} imported · {uploadResult.updated} updated
                  {uploadResult.skipped > 0 && ` · ${uploadResult.skipped} skipped`}
                  {' '}· Rankings calculated
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-amber-700 mb-2">
                  ⚠ {uploadResult.imported + uploadResult.updated} imported · {uploadResult.errors.length} error{uploadResult.errors.length !== 1 ? 's' : ''}
                  {uploadResult.skipped > 0 && ` · ${uploadResult.skipped} skipped`}
                </p>
                <ul className="space-y-0.5">
                  {uploadResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i} className="text-xs text-amber-700">
                      Row {err.row}: <strong>{err.field}</strong> — {err.message}
                    </li>
                  ))}
                  {uploadResult.errors.length > 5 && (
                    <li className="text-xs text-amber-600 font-bold">
                      +{uploadResult.errors.length - 5} more errors
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-5 w-fit">
        {([
          { key: 'marksheet', label: 'Marksheet', icon: ClipboardList },
          { key: 'analysis',  label: 'Subject Analysis', icon: BarChart2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition ${
              tab === key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: MARKSHEET ─────────────────────────────────────────────── */}
      {tab === 'marksheet' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1e3a5f] text-white">
                  <th className="text-center px-2 py-3 text-xs font-bold w-10 border-r border-white/10">#</th>
                  <th className="text-left px-3 py-3 text-xs font-bold min-w-[160px] border-r border-white/10">Name</th>
                  <th className="text-center px-2 py-3 text-xs font-bold w-20 border-r border-white/10">Adm No</th>
                  {subjects.map((s) => (
                    <th key={s} className="text-center px-2 py-3 text-xs font-bold min-w-[70px] border-r border-white/10">
                      {s.length > 8 ? s.slice(0, 8) + '…' : s}
                      <span className="block text-[10px] font-normal opacity-70">/{assessment.max_score}</span>
                    </th>
                  ))}
                  <th className="text-center px-2 py-3 text-xs font-bold w-16 bg-teal-700 border-r border-white/10">
                    Total<span className="block text-[10px] font-normal opacity-70">/{maxTotal}</span>
                  </th>
                  <th className="text-center px-2 py-3 text-xs font-bold w-16 bg-teal-700 border-r border-white/10">
                    Mean<span className="block text-[10px] font-normal opacity-70">score</span>
                  </th>
                  <th className="text-center px-2 py-3 text-xs font-bold w-16 bg-teal-700 border-r border-white/10">
                    Grade
                  </th>
                  <th className="text-center px-2 py-3 text-xs font-bold w-12 bg-teal-800">Pos.</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={row.rowKey}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${rowIdx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                  >
                    {/* Row number */}
                    <td className="text-center text-xs text-gray-400 font-mono px-2 py-1 border-r border-gray-100">
                      {rowIdx + 1}
                    </td>

                    {/* Student name */}
                    <td className="px-1 py-1 border-r border-gray-100">
                      <input
                        ref={(el) => {
                          if (!cellRefs.current[rowIdx]) cellRefs.current[rowIdx] = []
                          cellRefs.current[rowIdx][-2] = el
                        }}
                        type="text"
                        value={row.studentName}
                        onChange={(e) => handleCellChange(row.rowKey, 'studentName', e.target.value)}
                        placeholder="Student name"
                        className="w-full px-2 py-1.5 text-sm font-medium text-gray-800 bg-transparent rounded focus:outline-none focus:ring-1 focus:ring-teal-400 focus:bg-white placeholder:text-gray-300"
                      />
                    </td>

                    {/* Adm No */}
                    <td className="px-1 py-1 border-r border-gray-100">
                      <input
                        type="text"
                        value={row.admNo}
                        onChange={(e) => handleCellChange(row.rowKey, 'admNo', e.target.value)}
                        placeholder="—"
                        className="w-full px-2 py-1.5 text-xs text-center text-gray-600 bg-transparent rounded focus:outline-none focus:ring-1 focus:ring-teal-400 focus:bg-white placeholder:text-gray-300"
                      />
                    </td>

                    {/* Subject score cells */}
                    {subjects.map((subj, colIdx) => {
                      const val     = row.scores[subj] || ''
                      const numVal  = parseInt(val)
                      const isOver  = !isNaN(numVal) && numVal > assessment.max_score
                      return (
                        <td key={subj} className="px-1 py-1 border-r border-gray-100">
                          <input
                            ref={(el) => {
                              if (!cellRefs.current[rowIdx]) cellRefs.current[rowIdx] = []
                              cellRefs.current[rowIdx][colIdx] = el
                            }}
                            type="number"
                            min={0}
                            max={assessment.max_score}
                            value={val}
                            onChange={(e) => handleCellChange(row.rowKey, subj, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx, totalCols)}
                            placeholder="—"
                            className={`w-full px-1 py-1.5 text-sm text-center bg-transparent rounded focus:outline-none focus:ring-1 focus:bg-white placeholder:text-gray-300 ${
                              isOver
                                ? 'text-red-600 font-bold ring-1 ring-red-400 bg-red-50'
                                : 'text-gray-800 focus:ring-teal-400'
                            }`}
                          />
                        </td>
                      )
                    })}

                    {/* Total */}
                    <td className="text-center px-2 py-1 font-black text-teal-700 bg-teal-50/60 border-r border-gray-100">
                      {row.total > 0 ? row.total : '—'}
                    </td>

                    {/* Mean score */}
                    <td className="text-center px-2 py-1 font-bold text-teal-700 bg-teal-50/40 border-r border-gray-100">
                      {row.meanScore > 0 ? row.meanScore.toFixed(1) : '—'}
                    </td>

                    {/* Mean grade */}
                    <td className="text-center px-2 py-1 bg-teal-50/40 border-r border-gray-100">
                      {row.meanGrade ? (
                        <span className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${GRADE_META[row.meanGrade as MeanGrade]?.cls ?? ''}`}>
                          {row.meanGrade}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Position */}
                    <td className="text-center px-2 py-1 font-black text-teal-800 bg-teal-100/60">
                      {row.position ?? '—'}
                    </td>
                  </tr>
                ))}

                {/* Class average row */}
                {filledRows.length > 0 && (
                  <tr className="bg-amber-50 border-t-2 border-amber-200 font-bold text-xs">
                    <td colSpan={3} className="px-3 py-2 text-amber-700 font-black">
                      Class Average ({filledRows.length} learners)
                    </td>
                    {subjects.map((s) => {
                      const vals = filledRows.map((r) => parseInt(r.scores[s] || '') || 0)
                      const avg  = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b) / vals.length) * 10) / 10 : 0
                      return (
                        <td key={s} className="text-center px-2 py-2 text-amber-700">
                          {avg}
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-2 text-amber-800 font-black">{classAvg}</td>
                    <td className="text-center px-2 py-2 text-amber-700 font-bold">
                      {classMeanScore !== null ? classMeanScore.toFixed(1) : '—'}
                    </td>
                    <td className="text-center px-2 py-2">
                      {classMeanGrade ? (
                        <span className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${GRADE_META[classMeanGrade as MeanGrade]?.cls ?? ''}`}>
                          {classMeanGrade}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-center px-2 py-2 text-amber-600">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: add row + stats */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-teal-600 font-bold text-sm hover:text-teal-700 transition"
            >
              <PlusCircle className="w-4 h-4" /> Add Learner
            </button>
            <div className="text-xs text-gray-400">
              Tab / Enter to navigate cells &nbsp;·&nbsp; Positions auto-calculate as you type
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SUBJECT ANALYSIS ──────────────────────────────────────── */}
      {tab === 'analysis' && (
        <div className="space-y-4">
          {analysis.length === 0 || filledRows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">Save marks first to see subject analysis.</p>
            </div>
          ) : (
            analysis.map((sa) => {
              const passColor   = sa.passRate >= 70 ? 'text-green-600' : sa.passRate >= 50 ? 'text-amber-600' : 'text-red-600'
              const avgPct      = Math.round((sa.average / assessment.max_score) * 100)
              const avgBarColor = avgPct >= 70 ? 'bg-green-500' : avgPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
              const totalLearners = filledRows.filter((r) => r.scores[sa.subject] !== '' && r.scores[sa.subject] !== undefined).length

              return (
                <div key={sa.subject} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-gray-900 text-base">{sa.subject}</h3>
                    <span className={`text-sm font-bold ${passColor}`}>
                      {sa.passRate}% pass rate
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <div className="font-black text-green-700 text-lg">{sa.highest?.score ?? '—'}</div>
                      <div className="text-xs text-green-600 font-semibold">Highest</div>
                      {sa.highest && <div className="text-xs text-gray-400 truncate mt-0.5">{sa.highest.name}</div>}
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <div className="font-black text-red-700 text-lg">{sa.lowest?.score ?? '—'}</div>
                      <div className="text-xs text-red-600 font-semibold">Lowest</div>
                      {sa.lowest && <div className="text-xs text-gray-400 truncate mt-0.5">{sa.lowest.name}</div>}
                    </div>
                    <div className="bg-teal-50 rounded-xl p-3 text-center">
                      <div className="font-black text-teal-700 text-lg">{sa.average}</div>
                      <div className="text-xs text-teal-600 font-semibold">Class Avg</div>
                      <div className="text-xs text-gray-400 mt-0.5">/{assessment.max_score}</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <div className={`font-black text-lg ${passColor}`}>{sa.passRate}%</div>
                      <div className="text-xs text-blue-600 font-semibold">Pass Rate</div>
                      <div className="text-xs text-gray-400 mt-0.5">&gt;{assessment.max_score / 2}</div>
                    </div>
                  </div>

                  {/* Average bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Class average</span>
                      <span className="font-bold text-gray-600">{avgPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${avgBarColor}`} style={{ width: `${avgPct}%` }} />
                    </div>
                  </div>

                  {/* Grade distribution */}
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Grade Distribution</div>
                    <div className="space-y-1.5">
                      <DistBar value={sa.distribution.a} total={totalLearners} color="bg-purple-500" label="A (80-100%)" />
                      <DistBar value={sa.distribution.b} total={totalLearners} color="bg-green-500"  label="B (60-79%)"  />
                      <DistBar value={sa.distribution.c} total={totalLearners} color="bg-amber-500"  label="C (40-59%)"  />
                      <DistBar value={sa.distribution.d} total={totalLearners} color="bg-red-500"    label="D (0-39%)"   />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
