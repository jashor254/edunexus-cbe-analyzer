'use client'

import { useState, useEffect, useRef, useCallback, use, Fragment } from 'react'
import Link from 'next/link'
import {
  Users, BookOpen, BarChart3, Sun, Copy, Check,
  AlertTriangle, PlusCircle, Share2,
  TrendingUp, Compass, Brain,
  Loader2, X, UserPlus, Mail, Phone, FileText, CheckCircle2,
  FlaskConical, ChevronDown, ChevronRight,
  Upload, Sparkles, Target, Zap, ClipboardList, Layers,
  MessageSquare, CalendarDays, ThumbsUp, HelpCircle, AlertCircle, ClipboardCheck,
  RefreshCw,
} from 'lucide-react'
import {
  SENIOR_PATHWAYS,
  SENIOR_PATHWAY_ELECTIVES,
  getSeniorCompulsorySubjects,
  validateSeniorSubjects,
  type SeniorPathway,
} from '@/lib/curriculum/subjects'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'
import { buildAssessmentTitle } from '@/lib/assessments/assessmentTypeCatalog'

type Tab = 'students' | 'gaps' | 'assignments' | 'holiday' | 'remedial' | 'compass' | 'clinic' | 'upload' | 'analytics'

// ─── Add Student Modal ────────────────────────────────────────────────────────

type StudentRow = {
  name:            string
  grade:           number
  curriculum_type: string
  parent_name:     string
  parent_phone:    string
  parent_email:    string
  pathway:         SeniorPathway | ''
  electives:       string[]
}

function AddStudentModal({
  classId,
  defaultGrade,
  onClose,
  onSuccess,
}: {
  classId:      string
  defaultGrade: number
  onClose:      () => void
  onSuccess:    (count: number) => void
}) {
  const emptyRow = (): StudentRow => ({
    name: '', grade: defaultGrade, curriculum_type: 'cbc',
    parent_name: '', parent_phone: '', parent_email: '',
    pathway: '' as SeniorPathway | '', electives: [],
  })
  const [rows, setRows] = useState<StudentRow[]>([emptyRow()])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const fileRef               = useRef<HTMLInputElement>(null)

  function updateRow(i: number, field: keyof StudentRow, value: string | number | string[]) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, [field]: value }
      // reset pathway/electives when grade drops below 10
      if (field === 'grade' && Number(value) < 10) {
        updated.pathway  = ''
        updated.electives = []
      }
      // reset electives when pathway changes
      if (field === 'pathway') updated.electives = []
      return updated
    }))
  }

  function toggleRowElective(i: number, subject: string) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const has = r.electives.includes(subject)
      if (!has && r.electives.length >= 3) return r
      return { ...r, electives: has ? r.electives.filter(e => e !== subject) : [...r.electives, subject] }
    }))
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n').slice(1) // skip header
      const parsed: StudentRow[] = lines.map(line => {
        const [name, grade, curriculum_type, parent_name, parent_phone, parent_email] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
        return {
          name:            name || '',
          grade:           Number(grade) || defaultGrade,
          curriculum_type: curriculum_type || 'cbc',
          parent_name:     parent_name || '',
          parent_phone:    parent_phone || '',
          parent_email:    parent_email || '',
          pathway:   '' as SeniorPathway | '',
          electives: [] as string[],
        }
      }).filter(r => r.name)
      if (parsed.length > 0) setRows(parsed)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = rows.filter(r => r.name.trim())
    if (!valid.length) { setError('Add at least one student name'); return }

    // Validate senior rows
    for (const r of valid) {
      if (r.grade >= 10 && r.curriculum_type === 'cbc') {
        if (!r.pathway) {
          setError(`${r.name.trim()}: Please select a pathway (Grade 10–12)`)
          return
        }
        const v = validateSeniorSubjects(r.pathway as SeniorPathway, r.electives)
        if (!v.valid) { setError(`${r.name.trim()}: ${v.error}`); return }
      }
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          students: valid.map(r => {
            const isSenior = r.grade >= 10 && r.curriculum_type === 'cbc'
            return {
              name:            r.name.trim(),
              grade:           Number(r.grade),
              curriculum_type: r.curriculum_type,
              parent_name:     r.parent_name.trim() || undefined,
              parent_phone:    r.parent_phone.trim() || undefined,
              parent_email:    r.parent_email.trim() || undefined,
              ...(isSenior && r.pathway ? {
                current_pathway:   r.pathway,
                selected_subjects: [
                  ...getSeniorCompulsorySubjects(r.pathway as SeniorPathway),
                  ...r.electives,
                ],
              } : {}),
            }
          }),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add students')
      onSuccess(json.data.created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding students')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-8 relative">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Add Students</h2>
              <p className="text-xs text-gray-400">Add parent contacts to auto-send reports via WhatsApp & email</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            {/* CSV Import */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                CSV format: <code className="bg-gray-100 px-1 rounded text-xs">Name, Grade, Curriculum, Parent Name, Parent Phone, Parent Email</code>
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs text-teal-600 font-bold hover:underline flex items-center gap-1"
              >
                <FileText className="w-3 h-3" /> Import CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-xs font-black text-gray-400 uppercase tracking-wide pb-1">
              <div className="col-span-3">Student Name *</div>
              <div className="col-span-1">Grade</div>
              <div className="col-span-2">Curriculum</div>
              <div className="col-span-2">Parent Name</div>
              <div className="col-span-2">Parent Phone</div>
              <div className="col-span-2">Parent Email</div>
            </div>

            {/* Student rows */}
            {rows.map((row, i) => {
              const isSeniorRow = row.grade >= 10 && row.curriculum_type === 'cbc'
              return (
                <div key={i} className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-3 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:border-teal-400 focus:outline-none"
                      placeholder="e.g. Grace Wanjiku"
                      value={row.name}
                      onChange={e => updateRow(i, 'name', e.target.value)}
                    />
                    <select
                      className="col-span-1 px-2 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none bg-white"
                      value={row.grade}
                      onChange={e => updateRow(i, 'grade', Number(e.target.value))}
                    >
                      {[7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select
                      className="col-span-2 px-2 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none bg-white"
                      value={row.curriculum_type}
                      onChange={e => updateRow(i, 'curriculum_type', e.target.value)}
                    >
                      <option value="cbc">CBC</option>
                      <option value="igcse">IGCSE</option>
                      <option value="844">8-4-4</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      className="col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none"
                      placeholder="Parent name"
                      value={row.parent_name}
                      onChange={e => updateRow(i, 'parent_name', e.target.value)}
                    />
                    <div className="col-span-2 relative">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                      <input
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none"
                        placeholder="+254..."
                        value={row.parent_phone}
                        onChange={e => updateRow(i, 'parent_phone', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 relative flex items-center gap-1">
                      <div className="flex-1 relative">
                        <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                        <input
                          className="w-full pl-7 pr-2 py-2 rounded-xl border border-gray-200 text-xs focus:border-teal-400 focus:outline-none"
                          placeholder="email"
                          type="email"
                          value={row.parent_email}
                          onChange={e => updateRow(i, 'parent_email', e.target.value)}
                        />
                      </div>
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-400 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Senior pathway section — appears below row when Grade 10+ CBC */}
                  {isSeniorRow && (
                    <div className="ml-2 pl-3 border-l-2 border-teal-200 space-y-2 pb-1">
                      <p className="text-xs font-black text-teal-600 uppercase tracking-wide">Senior Pathway Required</p>
                      {/* Pathway dropdown */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-teal-400 focus:outline-none bg-white"
                          value={row.pathway}
                          onChange={e => updateRow(i, 'pathway', e.target.value)}
                        >
                          <option value="">Select pathway…</option>
                          {SENIOR_PATHWAYS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        {row.pathway && (
                          <span className="text-xs text-gray-500">
                            Compulsory: {getSeniorCompulsorySubjects(row.pathway as SeniorPathway).join(', ')}
                          </span>
                        )}
                      </div>
                      {/* Elective chips */}
                      {row.pathway && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            Electives <span className={row.electives.length === 3 ? 'text-teal-600 font-bold' : ''}>
                              ({row.electives.length}/3)
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {SENIOR_PATHWAY_ELECTIVES[row.pathway as SeniorPathway].map(subject => {
                              const selected = row.electives.includes(subject)
                              const maxed    = !selected && row.electives.length >= 3
                              return (
                                <button
                                  key={subject}
                                  type="button"
                                  onClick={() => toggleRowElective(i, subject)}
                                  disabled={maxed}
                                  className={[
                                    'text-xs px-2 py-0.5 rounded-full border transition-all',
                                    selected
                                      ? 'bg-teal-600 border-teal-600 text-white'
                                      : maxed
                                      ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-teal-400',
                                  ].join(' ')}
                                >
                                  {subject}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-2 text-sm text-teal-600 font-bold hover:text-teal-700 py-1"
            >
              <PlusCircle className="w-4 h-4" /> Add another student
            </button>
          </div>

          {error && (
            <div className="mx-6 mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {friendlyMessage(error).message}
            </div>
          )}

          <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Adding…' : `Add ${rows.filter(r => r.name.trim()).length || ''} Student${rows.filter(r => r.name.trim()).length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Clinic: types ────────────────────────────────────────────────────────────

type ClinicStudent = {
  id: string
  name: string
  grade: number
  latestAssessmentId: string | null
  parent_email: string | null
  parent_phone: string | null
  assessment: { id: string; term: number; year: number } | null
}

type ClinicProgress = {
  studentId:   string
  studentName: string
  status:      'waiting' | 'processing' | 'ok' | 'error'
  emailSent?:  boolean
  whatsappSent?: boolean
  error?:      string
}

// ─── Upload Assessment Tab ────────────────────────────────────────────────────

const CBC_SUBJECTS = [
  'mathematics', 'english', 'kiswahili', 'science',
  'social_studies', 'cre', 'creative_arts', 'physical_education',
]

function UploadAssessmentTab({
  classId,
  students,
  className,
}: {
  classId:   string
  students:  Array<{ id: string; name: string }>
  className: string
}) {
  const [term,   setTerm]   = useState(1)
  const [year,   setYear]   = useState(new Date().getFullYear())
  const [atype,  setAtype]  = useState('midterm')
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({})
  const [phase,  setPhase]  = useState<'entry' | 'saving' | 'generating' | 'done' | 'error'>('entry')
  const [progress, setProgress] = useState({ done: 0, total: 0, currentStudentName: null as string | null })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [reportJobId, setReportJobId] = useState<string | null>(null)

  // Live progress while report generation runs server-side — same pattern as
  // the Holiday Planner (HOTFIX 2/4, pilot-readiness sprint). Previously
  // this phase showed a hardcoded 60% bar for however long the whole class
  // took to generate, regardless of actual progress.
  useEffect(() => {
    if (phase !== 'generating' || !reportJobId) return
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/teacher/classes/${classId}/generate-reports/status?jobId=${reportJobId}`)
        const json = await res.json()
        if (!res.ok || !json.success || !json.data) return
        const job = json.data as { status: string; result: { total: number; completed: number; currentStudentName: string | null; success?: number; errorMessage?: string } }
        setProgress({ done: job.result.completed, total: job.result.total, currentStudentName: job.result.currentStudentName })
        if (job.status === 'completed') setPhase('done')
        else if (job.status === 'failed') {
          setErrorMsg(job.result.errorMessage ?? 'Report generation failed')
          setPhase('error')
        }
      } catch {
        // transient — next tick retries
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [phase, reportJobId, classId])

  function setScore(studentId: string, subject: string, val: string) {
    setScores(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [subject]: val },
    }))
  }

  async function handleSaveAndGenerate() {
    if (students.length === 0) return
    setPhase('saving')
    setErrorMsg(null)

    try {
      // 1. Create assessment
      const createRes = await fetch('/api/teacher/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId, title: buildAssessmentTitle(atype, String(term), year),
          assessmentType: atype, term: String(term), year,
          maxScore: 4, subjects: CBC_SUBJECTS, curriculumType: 'cbc',
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok || !createData.success) {
        throw new Error(createData.error ?? 'Failed to create assessment')
      }
      const assessmentId: string = createData.data.assessment.id

      // 2. Save marks
      const marks = students.map(s => ({
        studentName: s.name,
        subjectScores: Object.fromEntries(
          CBC_SUBJECTS.map(subj => [subj, parseFloat(scores[s.id]?.[subj] ?? '2') || 2])
        ),
      }))

      const marksRes = await fetch(`/api/teacher/assessments/${assessmentId}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks }),
      })
      const marksData = await marksRes.json()
      if (!marksRes.ok || !marksData.success) {
        throw new Error(marksData.error ?? 'Failed to save marks')
      }

      // 3. Generate reports with compass_bridge — starts a background job and
      // returns immediately; the polling effect above tracks it to 'done'.
      setPhase('generating')
      setProgress({ done: 0, total: students.length, currentStudentName: null })

      const genRes = await fetch(`/api/teacher/classes/${classId}/generate-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentIds: [assessmentId] }),
      })
      const genData = await genRes.json()
      if (!genRes.ok || !genData.success) {
        throw new Error(genData.error ?? 'Failed to generate reports')
      }

      setReportJobId(genData.data.jobId as string)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred')
      setPhase('error')
    }
  }

  if (phase === 'done') return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-3">
      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
      <h3 className="font-black text-green-800 text-xl">Reports Generated!</h3>
      <p className="text-green-700 text-sm">
        {progress.done}/{progress.total} student reports created with personalized Compass briefings.
        Parents will be notified automatically.
      </p>
      <button onClick={() => { setPhase('entry'); setScores({}) }}
        className="mt-2 px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700">
        Upload Another Assessment
      </button>
    </div>
  )

  if (phase === 'generating') return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-4">
      <Loader2 className="w-10 h-10 text-violet-500 mx-auto animate-spin" />
      <h3 className="font-black text-gray-800">
        {progress.total === 0 ? 'Preparing reports…' : `Student ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`}
      </h3>
      <p className="text-gray-500 text-sm">
        {progress.currentStudentName
          ? <>Building {progress.currentStudentName}&apos;s learning plan…</>
          : 'Building personalised learning plans for each student.'}
      </p>
      <div className="bg-gray-100 rounded-full h-3 overflow-hidden max-w-sm mx-auto">
        <div
          className="h-full bg-violet-500 rounded-full transition-all"
          style={{ width: `${progress.total === 0 ? 8 : Math.max(6, (progress.done / progress.total) * 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">It&apos;s safe to leave this tab — generation keeps running.</p>
    </div>
  )

  if (phase === 'saving') return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3">
      <Loader2 className="w-8 h-8 text-blue-500 mx-auto animate-spin" />
      <p className="text-gray-600">Saving scores…</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
        <h3 className="font-black text-blue-800 mb-1 flex items-center gap-2">
          <Upload className="w-5 h-5" /> Upload Assessment — {className}
        </h3>
        <p className="text-sm text-blue-700">
          Enter student scores below. Reports and personalized Compass briefings will generate automatically.
        </p>
      </div>

      {phase === 'error' && errorMsg && (
        <div className="flex items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <span className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {friendlyMessage(errorMsg).message}
          </span>
          {friendlyMessage(errorMsg).retryable && (
            <button
              onClick={() => setPhase('entry')}
              className="flex items-center gap-1.5 text-xs bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </button>
          )}
        </div>
      )}

      {/* Assessment metadata */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Term</label>
          <select value={term} onChange={e => setTerm(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium bg-white">
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium bg-white">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
          <select value={atype} onChange={e => setAtype(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium bg-white">
            <option value="opener">Opener</option>
            <option value="midterm">Mid-Term</option>
            <option value="endterm">End-Term</option>
            <option value="cat">CAT</option>
            <option value="exam">Exam</option>
          </select>
        </div>
      </div>

      {/* Score entry table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-black text-gray-700 sticky left-0 bg-gray-50">Student</th>
                {CBC_SUBJECTS.map(subj => (
                  <th key={subj} className="px-2 py-3 font-bold text-gray-600 text-center min-w-[70px] capitalize">
                    {subj.replace('_', ' ')}
                    <div className="text-xs font-normal text-gray-400">1–4</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-900 sticky left-0 bg-white">{s.name}</td>
                  {CBC_SUBJECTS.map(subj => (
                    <td key={subj} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={1} max={4} step={0.5}
                        value={scores[s.id]?.[subj] ?? ''}
                        onChange={e => setScore(s.id, subj, e.target.value)}
                        placeholder="–"
                        className="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:border-teal-400"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">CBC scale 1–4. Leave blank to default to 2 (Approaching).</p>
        <button
          onClick={handleSaveAndGenerate}
          disabled={students.length === 0}
          className="flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-violet-700 transition disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Save Scores & Generate Reports
        </button>
      </div>
    </div>
  )
}

// ─── Class Analytics Tab ──────────────────────────────────────────────────────

const LEVEL_LABELS_T: Record<string, { label: string; color: string; bg: string }> = {
  exceeds:     { label: 'Exceeds Expectations',     color: 'text-purple-700', bg: 'bg-purple-100' },
  meets:       { label: 'Meets Expectations',        color: 'text-green-700',  bg: 'bg-green-100'  },
  approaching: { label: 'Approaching Expectations',  color: 'text-amber-700',  bg: 'bg-amber-100'  },
  below:       { label: 'Below Expectations',        color: 'text-red-700',    bg: 'bg-red-100'    },
}

type TopicPickerState = {
  open:     boolean
  loading:  boolean
  topics:   Array<{ strandId: string; strandTitle: string; displayTitle: string; substrands: Array<{ id: string; title: string; displayName: string; slug: string }> }>
  selected: { subject: string; concept: string; strandName: string; displayName: string } | null
  saving:   boolean
  saved:    boolean
}

function CompassTopicPicker({
  studentId,
  weakSubjects,
  grade,
  curriculumType,
}: {
  studentId:      string
  weakSubjects:   string[]
  grade:          number
  curriculumType: string
}) {
  const [state, setState] = useState<TopicPickerState>({
    open: false, loading: false, topics: [], selected: null, saving: false, saved: false,
  })

  const openForSubject = async (subject: string) => {
    setState(s => ({ ...s, open: true, loading: true, topics: [], selected: null, saved: false }))
    try {
      const params = new URLSearchParams({ subject, grade: String(grade), curriculumType })
      const res  = await fetch(`/api/compass/topics?${params}`)
      const data = await res.json()
      setState(s => ({ ...s, loading: false, topics: data?.data?.topics ?? [] }))
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }

  const save = async () => {
    if (!state.selected) return
    setState(s => ({ ...s, saving: true }))
    try {
      await fetch(`/api/teacher/students/${studentId}/compass-topic`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject:    state.selected.subject,
          concept:    state.selected.concept,
          strandName: state.selected.strandName,
        }),
      })
      setState(s => ({ ...s, saving: false, saved: true, open: false }))
    } catch {
      setState(s => ({ ...s, saving: false }))
    }
  }

  if (state.saved) {
    return (
      <div className="flex items-center gap-1 text-xs text-teal-600 font-semibold mt-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Compass topic set
      </div>
    )
  }

  return (
    <div className="mt-2">
      {!state.open ? (
        <div className="flex flex-wrap gap-1">
          {weakSubjects.slice(0, 3).map(subj => (
            <button
              key={subj}
              onClick={() => openForSubject(subj)}
              className="text-xs px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium capitalize"
            >
              📌 {subj.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 border border-amber-200 rounded-xl bg-white p-3 space-y-2">
          {state.loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading topics…
            </div>
          ) : state.topics.length === 0 ? (
            <p className="text-xs text-gray-400">No topics found for this subject.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {state.topics.map(group => (
                <div key={group.strandId}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{group.displayTitle}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.substrands.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setState(s => ({
                          ...s,
                          selected: {
                            subject:     weakSubjects.find(w => state.topics.some(g => g.substrands.some(ss => ss.id === sub.id))) ?? weakSubjects[0] ?? '',
                            concept:     sub.slug,
                            strandName:  group.strandTitle,
                            displayName: sub.displayName,
                          },
                        }))}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors font-medium ${
                          state.selected?.concept === sub.slug
                            ? 'bg-teal-100 border-teal-400 text-teal-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-teal-50 hover:border-teal-300'
                        }`}
                      >
                        {sub.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={!state.selected || state.saving}
              className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-500 disabled:opacity-40 transition-colors"
            >
              {state.saving ? 'Saving…' : 'Set Topic'}
            </button>
            <button
              onClick={() => setState(s => ({ ...s, open: false }))}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            {state.selected && (
              <span className="text-xs text-teal-700 font-medium">
                → {state.selected.displayName}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type AnalyticsStudent = {
  id:              string
  name:            string
  grade:           number
  curriculum_type: string
  current_pathway: string | null
  assessment: {
    subject_scores: Record<string, number>
  } | null
}

function ClassAnalyticsTab({
  students,
  className,
  grade,
}: {
  students:  AnalyticsStudent[]
  className: string
  grade:     number
}) {
  const isJunior = grade <= 9

  // Compute stats from students' latest assessment
  const withAssessment = students.filter(s => s.assessment)
  const withoutAssessment = students.filter(s => !s.assessment)

  type LevelKey = 'exceeds' | 'meets' | 'approaching' | 'below'
  const levelCounts: Record<LevelKey, number> = { exceeds: 0, meets: 0, approaching: 0, below: 0 }
  const pathwayCounts: Record<string, number> = {}
  const subjectTotals: Record<string, { sum: number; count: number }> = {}
  const needsAttention: Array<{
    id:             string
    name:           string
    grade:          number
    curriculumType: string
    weakSubjects:   string[]   // display labels
    rawWeakSubjects: string[]  // original keys for API
  }> = []

  for (const s of withAssessment) {
    const scores: Record<string, number> = s.assessment?.subject_scores ?? {}
    const vals = Object.values(scores).filter(v => typeof v === 'number')
    if (!vals.length) continue

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const lvl: LevelKey = avg >= 3.5 ? 'exceeds' : avg >= 2.5 ? 'meets' : avg >= 1.5 ? 'approaching' : 'below'
    levelCounts[lvl]++

    if (s.current_pathway) {
      pathwayCounts[s.current_pathway] = (pathwayCounts[s.current_pathway] ?? 0) + 1
    }

    for (const [subj, score] of Object.entries(scores)) {
      if (!subjectTotals[subj]) subjectTotals[subj] = { sum: 0, count: 0 }
      subjectTotals[subj].sum   += score
      subjectTotals[subj].count += 1
    }

    const rawWeak = Object.entries(scores)
      .filter(([, v]) => v < 1.5)
      .map(([k]) => k)
    if (rawWeak.length >= 2) {
      needsAttention.push({
        id:              s.id,
        name:            s.name,
        grade:           s.grade ?? grade,
        curriculumType:  s.curriculum_type ?? 'cbc',
        weakSubjects:    rawWeak.map(k => k.replace(/_/g, ' ')),
        rawWeakSubjects: rawWeak,
      })
    }
  }

  const subjectAverages = Object.entries(subjectTotals)
    .map(([subj, { sum, count }]) => ({ subj, avg: sum / count }))
    .sort((a, b) => a.avg - b.avg)

  const weakestSubject = subjectAverages[0]
  const total = students.length

  return (
    <div className="space-y-6">
      {/* CLASS OVERVIEW */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-600" /> {className} — Overview
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-3xl font-black text-gray-800">{total}</div>
            <div className="text-xs text-gray-500 mt-1">Total Students</div>
          </div>
          <div className="bg-teal-50 rounded-xl p-4">
            <div className="text-3xl font-black text-teal-700">{withAssessment.length}</div>
            <div className="text-xs text-gray-500 mt-1">Have Assessment</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="text-3xl font-black text-amber-700">{withoutAssessment.length}</div>
            <div className="text-xs text-gray-500 mt-1">Missing Assessment</div>
          </div>
        </div>
      </div>

      {/* PATHWAY DISTRIBUTION (junior) */}
      {isJunior && Object.keys(pathwayCounts).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-black text-gray-900 mb-4">Pathway Distribution</h3>
          <div className="space-y-3">
            {Object.entries(pathwayCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([pathway, count]) => (
                <div key={pathway} className="flex items-center gap-3">
                  <div className="w-28 text-sm font-semibold text-gray-700">{pathway}</div>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${Math.round((count / total) * 100)}%` }}
                    />
                  </div>
                  <div className="text-sm font-bold text-gray-600 w-16 text-right">
                    {count} ({Math.round((count / total) * 100)}%)
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* PERFORMANCE DISTRIBUTION */}
      {withAssessment.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-black text-gray-900 mb-4">Performance Distribution</h3>
          <div className="space-y-3">
            {(Object.entries(levelCounts) as [LevelKey, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([lvl, count]) => {
                const cfg = LEVEL_LABELS_T[lvl]
                return (
                  <div key={lvl} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${cfg.bg} ${cfg.color}`}>
                      {count}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-700">{cfg.label}</div>
                      <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${total ? Math.round((count / total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 w-12 text-right">
                      {total ? Math.round((count / total) * 100) : 0}%
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* SUBJECT AVERAGES */}
      {subjectAverages.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-black text-gray-900 mb-4">Subject Averages</h3>
          {weakestSubject && (
            <div className="mb-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Weakest: <strong className="capitalize">{weakestSubject.subj.replace(/_/g, ' ')}</strong> — class average {weakestSubject.avg.toFixed(1)}/4
            </div>
          )}
          <div className="space-y-2">
            {subjectAverages.map(({ subj, avg }) => (
              <div key={subj} className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-600 capitalize">{subj.replace(/_/g, ' ')}</div>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${avg >= 3 ? 'bg-green-500' : avg >= 2 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${(avg / 4) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-bold text-gray-600 w-8">{avg.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEEDS ATTENTION */}
      {needsAttention.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h3 className="font-black text-amber-800 mb-1 flex items-center gap-2">
            <Target className="w-5 h-5" /> Students Who May Need Extra Support
          </h3>
          <p className="text-xs text-amber-600 mb-4">
            These students have 2+ subjects below expectations. Click a subject to suggest a specific Compass topic for them.
          </p>
          <div className="space-y-3">
            {needsAttention.map(({ id, name, grade: sGrade, curriculumType, weakSubjects, rawWeakSubjects }) => (
              <div key={id} className="bg-white rounded-xl p-3 border border-amber-100">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="font-semibold text-gray-800">{name}</div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {weakSubjects.map(s => (
                      <span key={s} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-lg capitalize">{s}</span>
                    ))}
                  </div>
                </div>
                <CompassTopicPicker
                  studentId={id}
                  weakSubjects={rawWeakSubjects}
                  grade={sGrade}
                  curriculumType={curriculumType}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {withAssessment.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Upload an assessment to see class analytics.</p>
        </div>
      )}
    </div>
  )
}

// ─── Clinic: Generate Reports component ───────────────────────────────────────

function ClinicReportsTab({
  classId,
  students,
  className,
}: {
  classId:   string
  students:  ClinicStudent[]
  className: string
}) {
  const [reportData, setReportData]       = useState<any>(null)
  const [loadingData, setLoadingData]     = useState(true)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [generating, setGenerating]       = useState(false)
  const [progress, setProgress]           = useState<ClinicProgress[]>([])
  const [phase, setPhase]                 = useState<'idle' | 'confirm' | 'running' | 'done'>('idle')

  // Load existing report records for this class
  useEffect(() => {
    fetch(`/api/teacher/classes/${classId}/reports`)
      .then(r => r.json())
      .then(d => { if (d.success) setReportData(d.data) })
      .finally(() => setLoadingData(false))
  }, [classId])

  // Students with assessments — eligible for report generation
  const eligible = students.filter(s => s.latestAssessmentId)
  const missingAssessment = students.filter(s => !s.latestAssessmentId)

  async function runGeneration() {
    if (eligible.length === 0) return
    setPhase('running')
    setGenerating(true)

    // Initialise progress list
    const initial: ClinicProgress[] = eligible.map((s, i) => ({
      studentId:   s.id,
      studentName: s.name,
      status:      i === 0 ? 'processing' : 'waiting',
    }))
    setProgress(initial)

    const updated = [...initial]

    for (let i = 0; i < eligible.length; i++) {
      const student = eligible[i]

      // Mark current as processing
      updated[i] = { ...updated[i], status: 'processing' }
      if (i + 1 < eligible.length) updated[i + 1] = { ...updated[i + 1], status: 'processing' }
      setProgress([...updated])

      try {
        const res = await fetch('/api/teacher/assessments/process', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            student_id:    student.id,
            assessment_id: student.latestAssessmentId,
            class_id:      classId,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Processing failed')
        const result = json.data?.results?.[0] ?? json.data
        updated[i] = {
          ...updated[i],
          status:      'ok',
          emailSent:   result?.emailSent,
          whatsappSent: result?.whatsappSent,
        }
      } catch (err) {
        updated[i] = {
          ...updated[i],
          status: 'error',
          error:  err instanceof Error ? err.message : 'Failed',
        }
      }
      setProgress([...updated])
    }

    setPhase('done')
    setGenerating(false)

    // Reload report data
    fetch(`/api/teacher/classes/${classId}/reports`)
      .then(r => r.json())
      .then(d => { if (d.success) setReportData(d.data) })
  }

  const doneCount      = progress.filter(p => p.status === 'ok').length
  const waCount        = progress.filter(p => p.status === 'ok' && p.whatsappSent).length
  const emailCount     = progress.filter(p => p.status === 'ok' && p.emailSent).length
  const errorStudents  = progress.filter(p => p.status === 'error')

  const stats = reportData?.stats
  const lastGenerated = reportData?.reports?.find((r: any) => r.generatedAt)?.generatedAt

  return (
    <div className="space-y-5">

      {/* Header card */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-black text-violet-800 mb-1 flex items-center gap-2 text-base">
              <FlaskConical className="w-5 h-5" /> Academic Clinic Reports
            </h3>
            <p className="text-sm text-violet-700">
              Generate a 7-page diagnostic report per student. Parents receive WhatsApp + email automatically.
            </p>
          </div>
          {phase === 'idle' && eligible.length > 0 && (
            <button
              onClick={() => setPhase('confirm')}
              className="shrink-0 flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-violet-700 transition"
            >
              <FlaskConical className="w-4 h-4" />
              Generate Reports
            </button>
          )}
        </div>

        {/* Stats row if reports already exist */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Reports',   value: stats.total,        color: 'text-violet-700' },
              { label: 'WhatsApp',  value: stats.whatsappSent, color: 'text-green-700'  },
              { label: 'Email',     value: stats.emailSent,    color: 'text-blue-700'   },
              { label: 'Opened',    value: stats.parentOpened, color: 'text-teal-700'   },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-violet-100 p-3 text-center">
                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-4 text-sm text-violet-600">
          <span>{eligible.length} students with assessments</span>
          {missingAssessment.length > 0 && (
            <span className="text-amber-600">⚠️ {missingAssessment.length} missing assessment</span>
          )}
          {lastGenerated && (
            <span className="text-gray-500">
              Last generated: {new Date(lastGenerated).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* What this does */}
      {phase === 'idle' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h4 className="font-black text-gray-800 mb-3">What this does:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            {[
              'Generates a 7-page Academic Clinic Report per student',
              'Sends WhatsApp message to parent with report summary',
              'Sends email with PDF report attached to parent',
              'Sets up personalised Learning Compass session for every student',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          {eligible.length === 0 ? (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>No assessments found.</strong> Students need assessment scores before reports can be generated.
              Add assessments via the Assessments tab.
            </div>
          ) : null}
        </div>
      )}

      {/* Confirmation modal */}
      {phase === 'confirm' && (
        <div className="bg-white border-2 border-violet-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center">
              <FlaskConical className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-lg">Generate reports for {eligible.length} students?</h3>
              <p className="text-sm text-gray-500">Parents will receive WhatsApp messages. This cannot be undone.</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800">
            <strong>Note:</strong> Only students with WhatsApp/email opted in will receive notifications.
            Reports are generated for all {eligible.length} students with assessment data.
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setPhase('idle')}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={runGeneration}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700"
            >
              <FlaskConical className="w-4 h-4" />
              Yes, Generate Reports
            </button>
          </div>
        </div>
      )}

      {/* Live progress */}
      {(phase === 'running' || phase === 'done') && progress.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-black text-gray-900">
              {phase === 'running' ? 'Generating Academic Clinic Reports…' : '✅ Reports Complete'}
            </h3>
            {phase === 'running' && (
              <span className="text-sm text-gray-500">
                {doneCount}/{eligible.length} students
              </span>
            )}
          </div>

          {/* Summary stats when done */}
          {phase === 'done' && (
            <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
              {[
                { label: 'Reports generated', value: doneCount,    color: 'text-violet-700' },
                { label: 'WhatsApp sent',      value: waCount,      color: 'text-green-700'  },
                { label: 'Emails sent',        value: emailCount,   color: 'text-blue-700'   },
              ].map(s => (
                <div key={s.label} className="bg-white px-5 py-3 text-center">
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Student list */}
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {progress.map(p => (
              <div key={p.studentId} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg leading-none">
                    {p.status === 'ok'         ? '✅' :
                     p.status === 'error'      ? '❌' :
                     p.status === 'processing' ? <Loader2 className="w-4 h-4 text-violet-500 animate-spin inline" /> :
                     <span className="text-gray-300">⬜</span>}
                  </span>
                  <span className={`font-medium text-sm ${p.status === 'waiting' ? 'text-gray-400' : 'text-gray-900'}`}>
                    {p.studentName.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {p.status === 'ok' && (
                    <>
                      {p.whatsappSent !== undefined && (
                        <span className={p.whatsappSent ? 'text-green-600 font-bold' : 'text-gray-400'}>
                          {p.whatsappSent ? '📱 Sent' : '📱 —'}
                        </span>
                      )}
                      {p.emailSent !== undefined && (
                        <span className={p.emailSent ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                          {p.emailSent ? '✉️ Sent' : '✉️ —'}
                        </span>
                      )}
                    </>
                  )}
                  {p.status === 'processing' && (
                    <span className="text-violet-500 font-bold">Processing…</span>
                  )}
                  {p.status === 'error' && (
                    <span className="text-red-500 text-xs">{p.error}</span>
                  )}
                  {p.status === 'waiting' && (
                    <span className="text-gray-300">Waiting…</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Failed contacts */}
          {phase === 'done' && errorStudents.length > 0 && (
            <div className="px-5 py-4 bg-red-50 border-t border-red-100">
              <p className="text-xs font-black text-red-700 uppercase tracking-wider mb-2">
                ⚠️ Failed ({errorStudents.length})
              </p>
              {errorStudents.map(s => (
                <p key={s.studentId} className="text-sm text-red-600">
                  • {s.studentName} — {s.error}
                </p>
              ))}
            </div>
          )}

          {/* Done CTA */}
          {phase === 'done' && (
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 justify-between items-center">
              <Link
                href="/teacher/reports"
                className="text-sm text-violet-600 font-bold hover:underline flex items-center gap-1"
              >
                View All Reports →
              </Link>
              <button
                onClick={() => { setPhase('idle'); setProgress([]) }}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Existing reports table */}
      {!loadingData && reportData?.reports && reportData.reports.length > 0 && phase === 'idle' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-black text-gray-900">Generated Reports</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase">Generated</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase">WhatsApp</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase">Parent Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reportData.reports.map((r: any) => (
                  <tr key={r.studentId} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{r.studentName}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {r.generatedAt
                        ? new Date(r.generatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
                        : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-5 py-3">
                      {r.whatsappSent
                        ? <span className="text-green-600 font-bold">✅ Sent</span>
                        : r.hasPhone
                        ? <span className="text-gray-400">Not sent</span>
                        : <span className="text-amber-600 text-xs">No phone</span>}
                    </td>
                    <td className="px-5 py-3">
                      {r.emailSent
                        ? <span className="text-blue-600 font-bold">✅ Sent</span>
                        : r.hasEmail
                        ? <span className="text-gray-400">Not sent</span>
                        : <span className="text-amber-600 text-xs">No email</span>}
                    </td>
                    <td className="px-5 py-3">
                      {r.parentOpened
                        ? <span className="text-teal-600 font-bold">✅ Opened</span>
                        : <span className="text-gray-400">Not yet</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Monday Intelligence Panel ───────────────────────────────────────────────

// ── Monday Panel types (match ClassIntelligencePanel from lib/learnerModel/types.ts) ──

type MondayStudent = {
  student_id:         string
  student_name:       string
  risk_level:         string
  top_flags:          Array<{ type: string; detail: string }>
  action:             string
  compass_suggestion: string | null
  peer_pairing:       string | null
  weeks_at_risk?:     number
}

type TeachingPattern = {
  pattern:    string
  count:      number
  suggestion: string
  substrands: string[]
}

type PrerequisiteAlert = {
  lesson_substrand:  string
  missing_prereq:    string
  students_affected: number
  pct_affected:      number
  suggested_warmup:  string
  student_names:     string[]
}

type InterventionCheckin = {
  intervention_id:   string
  student_name:      string
  student_id:        string
  substrand:         string
  intervention_type: string
  days_since:        number
  due_date:          string
}

type CareerMoment = {
  student_id:   string
  student_name: string
  moment_type:  string
  message:      string
  parent_note:  string
}

type MondayPanel = {
  class_id:                   string
  class_name:                 string
  week_of:                    string
  students_needing_attention: MondayStudent[]
  class_trajectory:           string
  teaching_patterns:          TeachingPattern[]
  prerequisite_alerts:        PrerequisiteAlert[]
  pending_checkins:           InterventionCheckin[]
  career_moments:             CareerMoment[]
  total_students:             number
  normal_count:               number
  watch_count:                number
  at_risk_count:              number
  critical_count:             number
  generated_at:               string
}

function MondayIntelligencePanel({ classId }: { classId: string }) {
  const [panel, setPanel]         = useState<MondayPanel | null>(null)
  const [loading, setLoading]     = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const [activeTab, setActiveTab] = useState<'students' | 'patterns' | 'prereqs' | 'checkins' | 'moments'>('students')

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/teacher/monday-panel?classId=${classId}`)
      const data = await res.json()
      if (data.success) setPanel(data.data.panel)
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  if (dismissed) return null

  if (!loaded) {
    return (
      <div className="mb-5 border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <div className="font-black text-violet-900 text-sm">Intelligence Panel</div>
            <div className="text-xs text-violet-600">Who needs your attention? What patterns? What's due?</div>
          </div>
        </div>
        <button
          onClick={load}
          className="shrink-0 flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-violet-700 transition"
        >
          <Zap className="w-3.5 h-3.5" /> Load Panel
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mb-5 border border-violet-200 bg-violet-50 rounded-2xl p-5 flex items-center justify-center gap-3 text-violet-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-semibold">Reading learner profiles…</span>
      </div>
    )
  }

  if (!panel) return null

  const hasStudents  = panel.students_needing_attention.length > 0
  const hasPatterns  = panel.teaching_patterns.length > 0
  const hasPrereqs   = panel.prerequisite_alerts.length > 0
  const hasCheckins  = panel.pending_checkins.length > 0
  const hasMoments   = panel.career_moments.length > 0
  const hasAnything  = hasStudents || hasPatterns || hasPrereqs || hasCheckins || hasMoments

  if (!hasAnything) {
    return (
      <div className="mb-5 border border-gray-200 bg-gray-50 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-gray-500">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="text-sm font-semibold">All clear — no students need urgent attention right now.</span>
        </div>
        <button onClick={() => setDismissed(true)} className="text-gray-300 hover:text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const riskColors: Record<string, string> = {
    critical: 'border-l-red-500 bg-red-50',
    at_risk:  'border-l-orange-400 bg-orange-50',
    watch:    'border-l-amber-400 bg-amber-50',
  }

  type PanelTab = typeof activeTab
  const tabs: Array<{ key: PanelTab; label: string; count: number; show: boolean }> = [
    { key: 'students' as PanelTab, label: 'Students',  count: panel.students_needing_attention.length, show: true },
    { key: 'patterns' as PanelTab, label: 'Patterns',  count: panel.teaching_patterns.length,          show: hasPatterns },
    { key: 'prereqs'  as PanelTab, label: 'Pre-check', count: panel.prerequisite_alerts.length,        show: hasPrereqs },
    { key: 'checkins' as PanelTab, label: 'Check-ins', count: panel.pending_checkins.length,           show: hasCheckins },
    { key: 'moments'  as PanelTab, label: 'Moments',   count: panel.career_moments.length,             show: hasMoments },
  ].filter(t => t.show)

  return (
    <div className="mb-5 border border-violet-200 rounded-2xl overflow-hidden shadow-sm">

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-white" />
          <div>
            <div className="font-black text-white text-sm">{panel.class_trajectory}</div>
            <div className="text-xs text-violet-200">
              {panel.total_students} students · {panel.critical_count > 0 ? `${panel.critical_count} critical · ` : ''}{panel.at_risk_count} at risk · {panel.watch_count} watch · {panel.normal_count} on track
            </div>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-violet-200 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-100 bg-white overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                activeTab === tab.key
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  activeTab === tab.key ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Students needing attention */}
      {activeTab === 'students' && (
        <div className="divide-y divide-gray-100 bg-white">
          {!hasStudents ? (
            <div className="px-5 py-4 flex items-center gap-3 text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">No students flagged for attention this week.</span>
            </div>
          ) : (
            panel.students_needing_attention.map(s => (
              <div key={s.student_id} className={`border-l-4 px-5 py-4 ${riskColors[s.risk_level] ?? 'border-l-gray-300 bg-white'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 text-sm">{s.student_name}</span>
                      {s.weeks_at_risk && s.weeks_at_risk >= 4 && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                          {s.weeks_at_risk}wks at risk
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1 leading-snug">{s.action}</p>
                    {s.compass_suggestion && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-teal-700">
                        <Compass className="w-3 h-3 shrink-0" />
                        <span>{s.compass_suggestion}</span>
                      </div>
                    )}
                    {s.peer_pairing && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-700">
                        <Users className="w-3 h-3 shrink-0" />
                        <span>{s.peer_pairing}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Teaching patterns */}
      {activeTab === 'patterns' && (
        <div className="divide-y divide-gray-100 bg-white">
          {panel.teaching_patterns.map((p, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.pattern}</p>
                  <p className="text-xs text-amber-700 mt-1 leading-snug">{p.suggestion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prerequisite alerts */}
      {activeTab === 'prereqs' && (
        <div className="divide-y divide-gray-100 bg-white">
          {panel.prerequisite_alerts.map((a, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-900">Before teaching "{a.lesson_substrand}"</span>
                    <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                      {a.pct_affected}% not ready
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {a.students_affected} students missing prerequisite: <strong>{a.missing_prereq}</strong>
                    {a.student_names.length > 0 && ` (${a.student_names.join(', ')}${a.students_affected > 5 ? '…' : ''})`}
                  </p>
                  <p className="text-xs text-orange-700 mt-1 leading-snug">Warmup: {a.suggested_warmup}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Intervention check-ins */}
      {activeTab === 'checkins' && (
        <div className="divide-y divide-gray-100 bg-white">
          {panel.pending_checkins.map(c => (
            <div key={c.intervention_id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-900">{c.student_name}</span>
                    {c.days_since >= 14 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Overdue</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {c.intervention_type.replace(/_/g, ' ')} on <strong>{c.substrand}</strong> — {c.days_since} days ago
                  </p>
                  <p className="text-xs text-blue-700 mt-1">Has their performance improved? Check in today.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Career micro-moments */}
      {activeTab === 'moments' && (
        <div className="divide-y divide-gray-100 bg-white">
          {panel.career_moments.map((m, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-black text-gray-900">{m.student_name}</span>
                  <p className="text-xs text-gray-700 mt-0.5 leading-snug">{m.message}</p>
                  {m.parent_note && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-green-700">
                      <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Tell their parent: "{m.parent_note}"</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Formative Signal Modal ───────────────────────────────────────────────────

const CBC_SUBJECTS_SHORT = [
  'Mathematics', 'English', 'Kiswahili', 'Science & Technology',
  'Social Studies', 'Creative Arts', 'Physical Education', 'CRE',
]

function FormativeSignalModal({
  classId,
  students,
  onClose,
}: {
  classId:  string
  students: Array<{ id: string; name: string }>
  onClose:  () => void
}) {
  const [subject,  setSubject]  = useState(CBC_SUBJECTS_SHORT[0])
  const [topic,    setTopic]    = useState('')
  const [gotIt,    setGotIt]    = useState<Set<string>>(new Set())
  const [confused, setConfused] = useState<Set<string>>(new Set())
  const [lost,     setLost]     = useState<Set<string>>(new Set())
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  function toggle(studentId: string, bucket: 'got_it' | 'confused' | 'lost') {
    const sets = { got_it: gotIt, confused, lost }
    const setters: Record<string, React.Dispatch<React.SetStateAction<Set<string>>>> = {
      got_it:   setGotIt,
      confused: setConfused,
      lost:     setLost,
    }
    // Remove from all first
    setGotIt(prev    => { const n = new Set(prev); n.delete(studentId); return n })
    setConfused(prev => { const n = new Set(prev); n.delete(studentId); return n })
    setLost(prev     => { const n = new Set(prev); n.delete(studentId); return n })
    // Add to target if not already there
    if (!sets[bucket].has(studentId)) {
      setters[bucket](prev => new Set([...prev, studentId]))
    }
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      await fetch('/api/formative/signal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          subject:       subject.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_'),
          subStrand:     topic || undefined,
          gotItIds:      [...gotIt],
          confusedIds:   [...confused],
          lostIds:       [...lost],
          teacherNote:   note || undefined,
        }),
      })
      setSaved(true)
      setTimeout(onClose, 1200)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
          <div className="font-black text-gray-900 text-lg">Signal recorded</div>
          <div className="text-sm text-gray-500 mt-1">Learner profiles are updating in the background.</div>
        </div>
      </div>
    )
  }

  const bucketConfig = [
    { id: 'got_it'  as const, label: 'Got It',   icon: ThumbsUp,     color: 'bg-green-100 border-green-300 text-green-800',  active: 'bg-green-500 text-white border-green-500',  set: gotIt    },
    { id: 'confused'as const, label: 'Confused', icon: HelpCircle,   color: 'bg-amber-100 border-amber-300 text-amber-800',  active: 'bg-amber-500 text-white border-amber-500',  set: confused },
    { id: 'lost'    as const, label: 'Lost',      icon: AlertCircle, color: 'bg-red-100 border-red-300 text-red-800',        active: 'bg-red-500 text-white border-red-500',      set: lost     },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4.5 h-4.5 text-teal-600" />
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm">How did the lesson go?</div>
              <div className="text-xs text-gray-400">30 seconds. Tap each student.</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Subject + topic */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wide">Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:border-teal-400 focus:outline-none bg-white"
              >
                {CBC_SUBJECTS_SHORT.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wide">Topic (optional)</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Fractions"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Bucket headers */}
          <div className="grid grid-cols-3 gap-2">
            {bucketConfig.map(b => (
              <div key={b.id} className={`text-center text-xs font-black py-2 rounded-xl border ${b.color}`}>
                {b.label}
                <div className="font-normal text-[10px] opacity-70">{b.set.size} selected</div>
              </div>
            ))}
          </div>

          {/* Student chips */}
          {students.length === 0 ? (
            <p className="text-sm text-center text-gray-400 py-4">No students in this class yet.</p>
          ) : (
            <div className="space-y-1.5">
              {students.map(s => {
                const current = gotIt.has(s.id) ? 'got_it' : confused.has(s.id) ? 'confused' : lost.has(s.id) ? 'lost' : null
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                    <div className="flex gap-1">
                      {bucketConfig.map(b => (
                        <button
                          key={b.id}
                          onClick={() => toggle(s.id, b.id)}
                          className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all text-sm ${
                            current === b.id ? b.active : 'border-gray-200 text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          <b.icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Teacher note */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Quick note (optional)…"
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none resize-none"
          />
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (gotIt.size + confused.size + lost.size === 0)}
            className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Record Signal'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Topical Check Modal ──────────────────────────────────────────────────────
// One subject, one strand/topic, rate the whole class 1-4 — fast enough that
// teachers actually do it between term assessments, unlike the full form.

const RATING_CONFIG = [
  { level: 1 as const, label: 'BE', full: 'Below Expectations',      color: 'bg-red-100 border-red-300 text-red-800',       active: 'bg-red-500 text-white border-red-500' },
  { level: 2 as const, label: 'AE', full: 'Approaching Expectations', color: 'bg-amber-100 border-amber-300 text-amber-800', active: 'bg-amber-500 text-white border-amber-500' },
  { level: 3 as const, label: 'ME', full: 'Meeting Expectations',     color: 'bg-green-100 border-green-300 text-green-800', active: 'bg-green-500 text-white border-green-500' },
  { level: 4 as const, label: 'EE', full: 'Exceeding Expectations',   color: 'bg-teal-100 border-teal-300 text-teal-800',    active: 'bg-teal-500 text-white border-teal-500' },
]

function TopicalCheckModal({
  classId,
  students,
  onClose,
}: {
  classId:  string
  students: Array<{ id: string; name: string }>
  onClose:  () => void
}) {
  const [subject,  setSubject]  = useState(CBC_SUBJECTS_SHORT[0])
  const [strand,   setStrand]   = useState('')
  const [topic,    setTopic]    = useState('')
  const [ratings,  setRatings]  = useState<Map<string, 1 | 2 | 3 | 4>>(new Map())
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  function setRating(studentId: string, level: 1 | 2 | 3 | 4) {
    setRatings(prev => new Map(prev).set(studentId, level))
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/assessments/topical', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          subject: subject.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_'),
          strand:  strand || topic || 'general',
          topic:   topic || strand || 'general',
          ratings: [...ratings.entries()].map(([studentId, rating]) => ({ studentId, rating })),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to save')
      }
      setSaved(true)
      setTimeout(onClose, 1200)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
          <div className="font-black text-gray-900 text-lg">Topical check recorded</div>
          <div className="text-sm text-gray-500 mt-1">Learner profiles are updating in the background.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm">Topical Check</div>
              <div className="text-xs text-gray-400">One topic. Rate the class 1-4.</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wide">Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:border-indigo-400 focus:outline-none bg-white"
              >
                {CBC_SUBJECTS_SHORT.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wide">Strand</label>
              <input
                value={strand}
                onChange={e => setStrand(e.target.value)}
                placeholder="e.g. Numbers"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1 uppercase tracking-wide">Topic</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Fractions"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-center text-gray-400 py-4">No students in this class yet.</p>
          ) : (
            <div className="space-y-1.5">
              {students.map(s => {
                const current = ratings.get(s.id) ?? null
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                    <div className="flex gap-1">
                      {RATING_CONFIG.map(r => (
                        <button
                          key={r.level}
                          onClick={() => setRating(s.id, r.level)}
                          title={r.full}
                          className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all text-xs font-black ${
                            current === r.level ? r.active : 'border-gray-200 text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{friendlyMessage(error).message}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || ratings.size === 0 || !topic}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Record Check'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Holiday Planner Tab ──────────────────────────────────────────────────────

type HolidayStudentPlan = {
  studentId:   string
  studentName: string
  message:     string
  weeks:       Array<{ week: number; label: string; student_task: string; parent_action: string; is_rest_week: boolean }>
  parent_summary: string
}

type HolidayJobProgress = {
  total:              number
  completed:          number
  generated:          number
  failed:             number
  currentStudentName: string | null
  failedStudents:     Array<{ studentId: string; studentName: string; reason: string }>
  errorMessage?:      string
}


function HolidayPlannerTab({
  classId,
  students,
  className,
  existingHolidayRisk,
}: {
  classId:              string
  students:             Array<{ id: string; name: string }>
  className:            string
  existingHolidayRisk?: Array<{ id: string; name: string; grade: number; riskLevel: string; isActive: boolean }>
}) {
  const [period,        setPeriod]        = useState('August Holiday')
  const [days,          setDays]          = useState(21)
  const [plans,         setPlans]         = useState<HolidayStudentPlan[]>([])
  const [plansLoading,  setPlansLoading]  = useState(true)
  const [planTerm,      setPlanTerm]      = useState<{ term: number; year: number } | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [copiedId,      setCopiedId]      = useState<string | null>(null)
  const [publishedIds,  setPublishedIds]  = useState<Set<string>>(new Set())
  const [publishing,    setPublishing]    = useState<string | null>(null) // studentId or 'all'

  const [jobId,       setJobId]       = useState<string | null>(null)
  const [jobStatus,   setJobStatus]   = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle')
  const [progress,    setProgress]    = useState<HolidayJobProgress | null>(null)
  const [retrying,    setRetrying]    = useState(false)
  const jobStartedAtRef = useRef<number>(0)

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    try {
      const res  = await fetch(`/api/holiday/generate?classId=${classId}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Could not load holiday plans')
      setPlanTerm({ term: json.data.term as number, year: json.data.year as number })
      setPlans(json.data.plans as HolidayStudentPlan[])
      setPublishedIds(new Set((json.data.plans as Array<{ studentId: string; published: boolean }>).filter(p => p.published).map(p => p.studentId)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load holiday plans')
    } finally {
      setPlansLoading(false)
    }
  }, [classId])

  // Reconnect to an in-flight (or just-finished) batch on tab load — a
  // teacher who started generating, left, and came back must see real
  // progress, not an empty "Generate Plans" button as if nothing happened.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res  = await fetch(`/api/holiday/generate/status?classId=${classId}`)
        const json = await res.json()
        if (cancelled) return
        if (res.ok && json.success && json.data) {
          const job = json.data as { id: string; status: string; result: HolidayJobProgress }
          setJobId(job.id)
          setProgress(job.result)
          if (job.status === 'processing') { setJobStatus('processing'); jobStartedAtRef.current = Date.now() - 1000 }
          else if (job.status === 'completed') { setJobStatus('completed'); loadPlans() }
          else if (job.status === 'failed') setJobStatus('failed')
        } else {
          loadPlans()
        }
      } catch {
        loadPlans()
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  // Poll while a batch is running.
  useEffect(() => {
    if (jobStatus !== 'processing' || !jobId) return
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/holiday/generate/status?jobId=${jobId}`)
        const json = await res.json()
        if (!res.ok || !json.success || !json.data) return
        const job = json.data as { status: string; result: HolidayJobProgress }
        setProgress(job.result)
        if (job.status === 'completed') { setJobStatus('completed'); loadPlans() }
        else if (job.status === 'failed') setJobStatus('failed')
      } catch {
        // transient — next tick retries. Never leave the teacher on a
        // silently-stuck progress bar because of one dropped poll.
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [jobStatus, jobId, loadPlans])

  function estimatedSecondsRemaining(): number | null {
    if (!progress || progress.completed === 0) return null
    const elapsedMs = Date.now() - jobStartedAtRef.current
    const msPerStudent = elapsedMs / progress.completed
    const remaining = progress.total - progress.completed
    return Math.max(0, Math.round((msPerStudent * remaining) / 1000))
  }

  async function generate(retryStudentIds?: string[]) {
    setError(null)
    if (retryStudentIds) setRetrying(true)
    try {
      const res = await fetch('/api/holiday/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          classId,
          holidayPeriod: period,
          holidayDays: days,
          ...(retryStudentIds ? { studentIds: retryStudentIds } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Generation failed')

      jobStartedAtRef.current = Date.now()
      setJobId(json.data.jobId as string)
      setJobStatus('processing')
      setProgress({ total: json.data.total as number, completed: 0, generated: 0, failed: 0, currentStudentName: null, failedStudents: [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error starting plan generation')
    } finally {
      setRetrying(false)
    }
  }

  function copyWhatsApp(plan: HolidayStudentPlan) {
    navigator.clipboard.writeText(plan.message)
    setCopiedId(plan.studentId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function publishOne(studentId: string) {
    if (!planTerm) return
    setPublishing(studentId)
    try {
      const res = await fetch('/api/holiday/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ studentId, term: planTerm.term, year: planTerm.year }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Publish failed')
      setPublishedIds(prev => new Set(prev).add(studentId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error publishing plan')
    } finally {
      setPublishing(null)
    }
  }

  async function publishAll() {
    if (!planTerm) return
    setPublishing('all')
    try {
      const res = await fetch('/api/holiday/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ classId, term: planTerm.term, year: planTerm.year }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Publish failed')
      setPublishedIds(new Set(plans.map(p => p.studentId)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error publishing plans')
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-black text-amber-800 mb-1 flex items-center gap-2 text-base">
          <CalendarDays className="w-5 h-5" /> Holiday Assignment Planner — {className}
        </h3>
        <p className="text-sm text-amber-700">
          Generates a personalised holiday plan per student based on their actual learning gaps. Plans are WhatsApp-ready for parents.
        </p>
      </div>

      {/* Config + Generate */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1">Holiday Period</label>
          <input
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:border-amber-400 focus:outline-none"
            placeholder="e.g. August 2026"
          />
        </div>
        <div>
          <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1">Days</label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium bg-white focus:border-amber-400 focus:outline-none"
          >
            <option value={7}>1 week (7 days)</option>
            <option value={14}>2 weeks (14 days)</option>
            <option value={21}>3 weeks (21 days)</option>
            <option value={28}>4 weeks (28 days)</option>
          </select>
        </div>
        <button
          onClick={() => generate()}
          disabled={jobStatus === 'processing' || students.length === 0}
          className="flex items-center gap-2 bg-amber-500 text-white px-6 py-2.5 rounded-xl font-black hover:bg-amber-600 disabled:opacity-50 transition"
        >
          {jobStatus === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {jobStatus === 'processing' ? 'Generating…' : `Generate Plans for ${students.length} Students`}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {friendlyMessage(error).message}
        </div>
      )}

      {/* Live progress — HOTFIX 2: a teacher must never see a frozen page
          while 45 students' worth of AI calls run in the background. Safe
          to navigate away from; reconnects on reload via the effect above. */}
      {jobStatus === 'processing' && progress && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              {progress.completed === 0
                ? 'Preparing learner plans…'
                : `Student ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}`}
            </div>
            {estimatedSecondsRemaining() !== null && progress.completed < progress.total && (
              <span className="text-xs text-gray-400 font-medium">
                ~{estimatedSecondsRemaining()! < 60 ? `${estimatedSecondsRemaining()}s` : `${Math.ceil(estimatedSecondsRemaining()! / 60)} min`} remaining
              </span>
            )}
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (progress.completed / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>

          {progress.currentStudentName && (
            <p className="text-xs text-gray-500">Currently generating: <span className="font-bold text-gray-700">{progress.currentStudentName}</span></p>
          )}

          <div className="flex items-center gap-4 text-xs font-bold pt-1">
            <span className="text-green-600">✓ {progress.generated} completed</span>
            {progress.failed > 0 && <span className="text-red-500">✕ {progress.failed} failed</span>}
            <span className="text-gray-400 font-medium">It's safe to leave this tab — generation keeps running.</span>
          </div>
        </div>
      )}

      {jobStatus === 'failed' && (
        <div className="flex items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
          <span className="text-red-700">
            We couldn&apos;t generate holiday plans this time. Nothing has been lost — your class and settings are unchanged.
          </span>
          <button
            onClick={() => generate()}
            className="flex items-center gap-1.5 text-xs bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Some students didn't get a plan — HOTFIX 3: never silently swallow
          this. 37-of-45 must never look like "job done, 37 requested." */}
      {jobStatus === 'completed' && progress && progress.failed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-red-800">
              <AlertTriangle className="w-4 h-4" />
              We couldn&apos;t generate plans for {progress.failed} learner{progress.failed !== 1 ? 's' : ''}.
            </div>
            <button
              onClick={() => generate(progress.failedStudents.map(f => f.studentId))}
              disabled={retrying}
              className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50 shrink-0"
            >
              {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Retry Failed Only
            </button>
          </div>
          <ul className="space-y-1.5">
            {progress.failedStudents.map(f => (
              <li key={f.studentId} className="text-xs text-red-700 flex items-start gap-1.5">
                <span className="font-bold shrink-0">{f.studentName}:</span>
                <span>{friendlyMessage(f.reason, "Something went wrong generating this student's plan.").message}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-500">Click Retry — the {progress.generated} plans already generated won&apos;t be touched.</p>
        </div>
      )}

      {/* Plans */}
      {plansLoading && jobStatus !== 'processing' && (
        <div className="flex items-center gap-2 text-sm text-gray-400 p-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading holiday plans…
        </div>
      )}
      {!plansLoading && plans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{plans.length} personalised plans generated — drafts until you publish</span>
            </div>
            <button
              onClick={publishAll}
              disabled={publishing !== null || publishedIds.size === plans.length}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {publishing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {publishedIds.size === plans.length ? 'All Published' : `Publish All to Parents (${plans.length - publishedIds.size} pending)`}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Unpublished drafts are auto-published after 3 days so parents don&apos;t miss them if you forget — publishing now shares them immediately via the Learner Blueprint.
          </p>
          {plans.map(plan => {
            const isPublished = publishedIds.has(plan.studentId)
            return (
            <div key={plan.studentId} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === plan.studentId ? null : plan.studentId)}
              >
                <div className="flex items-center gap-3">
                  {expandedId === plan.studentId
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <div className="font-bold text-gray-900">{plan.studentName}</div>
                  {plan.weeks.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                      {plan.weeks.length}-week plan
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!isPublished && (
                    <button
                      onClick={e => { e.stopPropagation(); publishOne(plan.studentId) }}
                      disabled={publishing !== null}
                      className="flex items-center gap-1.5 text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-200 transition disabled:opacity-50"
                    >
                      {publishing === plan.studentId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Publish
                    </button>
                  )}
                  {plan.message && (
                    <button
                      onClick={e => { e.stopPropagation(); copyWhatsApp(plan) }}
                      className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-bold hover:bg-green-200 transition"
                    >
                      {copiedId === plan.studentId ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      {copiedId === plan.studentId ? 'Copied!' : 'Copy WhatsApp'}
                    </button>
                  )}
                </div>
              </div>

              {expandedId === plan.studentId && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  {/* Week-by-week */}
                  {plan.weeks.length > 0 && (
                    <div className="space-y-2">
                      {plan.weeks.map(w => (
                        <div key={w.week} className={`rounded-xl p-3 border ${w.is_rest_week ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="font-black text-sm text-gray-800">Week {w.week}: {w.label}</div>
                          {w.student_task && <p className="text-xs text-gray-600 mt-1">📚 {w.student_task}</p>}
                          {w.parent_action && <p className="text-xs text-gray-500 mt-0.5">👩 {w.parent_action}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Parent summary */}
                  {plan.parent_summary && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                      {plan.parent_summary}
                    </div>
                  )}

                  {/* WhatsApp message */}
                  {plan.message && (
                    <div>
                      <div className="text-xs font-black text-gray-400 uppercase tracking-wide mb-1.5">WhatsApp Message Preview</div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                        {plan.message}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* Existing at-risk list (holiday risk from insights) */}
      {!plansLoading && jobStatus !== 'processing' && plans.length === 0 && existingHolidayRisk && existingHolidayRisk.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-black text-gray-900">Holiday Risk Radar</h3>
            <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold">
              {existingHolidayRisk.length} students
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {existingHolidayRisk.map((s) => {
              const msg = encodeURIComponent(
`Habari! 👋

Mimi ni mwalimu wa ${s.name}.

Nataka kukuarifa kwamba ${s.name} anahitaji usaidizi wakati wa likizo.

Tafadhali wasiliana nami ili tujadili mpango wa masomo.

Asante! 🙏`
              )
              return (
                <div key={s.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span>{s.riskLevel === 'high' ? '🔴' : '🟡'}</span>
                    <div>
                      <div className="font-bold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">Grade {s.grade} · {s.isActive ? 'Active recently' : 'Inactive'}</div>
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/?text=${msg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-600 transition"
                  >
                    📱 Remind Parent
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!plansLoading && jobStatus !== 'processing' && plans.length === 0 && (!existingHolidayRisk || existingHolidayRisk.length === 0) && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <TrendingUp className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-green-700 font-bold">No high-risk students identified.</p>
          <p className="text-sm text-green-600 mt-1">Generate personalised holiday plans above to keep everyone on track.</p>
        </div>
      )}
    </div>
  )
}

// ─── Remedial Planner Tab ─────────────────────────────────────────────────────

type RemedialGroup = {
  type:              string
  label:             string
  students:          Array<{ student_id: string; student_name: string; gap_detail: string }>
  teaching_action:   string
  suggested_activity: string
  lessons_needed:    number
}

type RemedialPlanData = {
  groups:     RemedialGroup[]
  allocation: {
    total_remedial_weeks: number
    week_by_week:         Array<{ week: number; focus: string; activity: string }>
    check_in_week:        number
  }
  sub_strand: string
  subject:    string
}

function RemedialPlannerTab({
  classId,
  className,
}: {
  classId:   string
  className: string
}) {
  const [subject,    setSubject]    = useState('Mathematics')
  const [strand,     setStrand]     = useState('')
  const [subStrand,  setSubStrand]  = useState('')
  const [term,       setTerm]       = useState(2)
  const [year,       setYear]       = useState(new Date().getFullYear())
  const [generating, setGenerating] = useState(false)
  const [plan,       setPlan]       = useState<RemedialPlanData | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const groupColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    critical_gap:      { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-500'    },
    prerequisite_gap:  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-500' },
    concept_confusion: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-500'  },
    on_track:          { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  dot: 'bg-green-500'  },
  }

  async function generate() {
    if (!subStrand.trim()) { setError('Enter a sub-strand or topic to analyse'); return }
    setGenerating(true)
    setError(null)
    setPlan(null)
    try {
      const res = await fetch('/api/remedial/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ classId, subject, strand, subStrand, term, year }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Generation failed')
      setPlan(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generating plan')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-5">
        <h3 className="font-black text-teal-800 mb-1 flex items-center gap-2 text-base">
          <Layers className="w-5 h-5" /> Remedial Planner — {className}
        </h3>
        <p className="text-sm text-teal-700">
          Enter the topic you just taught. The AI groups your students by gap type and tells you exactly what to do with each group.
        </p>
      </div>

      {/* Config */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1">Subject</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium bg-white focus:border-teal-400 focus:outline-none"
            >
              {CBC_SUBJECTS_SHORT.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1">Strand</label>
            <input
              value={strand}
              onChange={e => setStrand(e.target.value)}
              placeholder="e.g. Numbers"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1">Sub-Strand / Topic *</label>
            <input
              value={subStrand}
              onChange={e => setSubStrand(e.target.value)}
              placeholder="e.g. Fractions"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-1">Term</label>
            <select
              value={term}
              onChange={e => setTerm(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium bg-white focus:border-teal-400 focus:outline-none"
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {friendlyMessage(error).message}
          </div>
        )}

        <button
          onClick={generate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 rounded-xl font-black hover:bg-teal-700 disabled:opacity-50 transition"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Analysing learner data…' : 'Generate Remedial Plan'}
        </button>
      </div>

      {/* Plan output */}
      {plan && (
        <div className="space-y-4">
          {/* Groups */}
          <div className="text-sm font-black text-gray-500 uppercase tracking-wide">
            Student Groups — {plan.sub_strand}
          </div>
          {plan.groups.map(group => {
            const cfg = groupColors[group.type] ?? { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', dot: 'bg-gray-400' }
            return (
              <div key={group.type} className={`rounded-2xl border p-5 ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                    <div className={`font-black text-sm ${cfg.text}`}>{group.label}</div>
                    <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full font-semibold text-gray-600">
                      {group.students.length} students · {group.lessons_needed} lesson{group.lessons_needed !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Students */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {group.students.map(s => (
                    <div key={s.student_id} className="text-xs bg-white/80 border border-white rounded-lg px-2.5 py-1 text-gray-700">
                      <span className="font-semibold">{s.student_name}</span>
                      {s.gap_detail && <span className="text-gray-400"> · {s.gap_detail}</span>}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-1.5">
                  {group.teaching_action && (
                    <p className={`text-sm ${cfg.text} leading-snug`}>
                      <span className="font-black">Teacher: </span>{group.teaching_action}
                    </p>
                  )}
                  {group.suggested_activity && (
                    <p className={`text-sm ${cfg.text} leading-snug opacity-80`}>
                      <span className="font-black">Activity: </span>{group.suggested_activity}
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {/* Week allocation */}
          {plan.allocation?.week_by_week?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-black text-gray-800 text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-teal-600" />
                {plan.allocation.total_remedial_weeks}-Week Allocation Plan
              </div>
              <div className="divide-y divide-gray-100">
                {plan.allocation.week_by_week.map(w => (
                  <div key={w.week} className="px-5 py-3 flex items-start gap-4">
                    <div className="w-16 shrink-0 text-xs font-black text-gray-400">Week {w.week}</div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{w.focus}</div>
                      {w.activity && <div className="text-xs text-gray-500 mt-0.5">{w.activity}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {plan.allocation.check_in_week && (
                <div className="px-5 py-3 bg-teal-50 border-t border-teal-100 text-xs text-teal-700 font-semibold">
                  Check-in assessment: Week {plan.allocation.check_in_week}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getParentStatus(student: {
  parent_phone?: string | null
  parent_user_id?: string | null
  parent_id?: string | null
  whatsapp_verified?: boolean | null
}): { label: string; color: string } {
  const hasPhone    = !!student.parent_phone
  const hasAccount  = !!(student.parent_user_id ?? student.parent_id)
  const hasWhatsapp = !!student.whatsapp_verified

  if (hasWhatsapp) return { label: 'WhatsApp Connected', color: 'text-green-600 bg-green-50 border-green-200' }
  if (hasAccount)  return { label: 'Account Linked',     color: 'text-blue-600 bg-blue-50 border-blue-200'   }
  if (hasPhone)    return { label: 'Phone Added',        color: 'text-amber-600 bg-amber-50 border-amber-200' }
  return                  { label: 'Not Connected',      color: 'text-gray-400 bg-gray-50 border-gray-200'   }
}

function compassTierBadge(tier: string | null) {
  switch (tier) {
    case 'exceeds_expectations':     return { label: 'Exceeds',     cls: 'bg-purple-100 text-purple-700 border border-purple-200' }
    case 'meets_expectations':       return { label: 'Meets',       cls: 'bg-green-100 text-green-700 border border-green-200'   }
    case 'approaching_expectations': return { label: 'Approaching', cls: 'bg-amber-100 text-amber-700 border border-amber-200'   }
    case 'below_expectations':       return { label: 'Below',       cls: 'bg-red-100 text-red-700 border border-red-200'         }
    default:                         return null
  }
}

function confidenceBadge(level: string | null) {
  switch (level) {
    case 'high':   return { label: '↑ High confidence',   cls: 'bg-green-50 text-green-600 border border-green-200'   }
    case 'medium': return { label: '→ Medium confidence', cls: 'bg-amber-50 text-amber-600 border border-amber-200'   }
    case 'low':    return { label: '↓ Low confidence',    cls: 'bg-red-50 text-red-600 border border-red-200'         }
    default:       return null
  }
}

function levelBadge(avg: number) {
  if (avg >= 3.5) return { label: 'Exceeds', cls: 'bg-purple-100 text-purple-700' }
  if (avg >= 2.5) return { label: 'Meets', cls: 'bg-green-100 text-green-700' }
  if (avg >= 1.5) return { label: 'Approaching', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Below', cls: 'bg-red-100 text-red-700' }
}

function rowColor(avg: number | null) {
  if (avg === null) return 'border-l-gray-200'
  if (avg >= 3.5) return 'border-l-purple-400'
  if (avg >= 2.5) return 'border-l-green-400'
  if (avg >= 1.5) return 'border-l-amber-400'
  return 'border-l-red-400'
}

export default function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const [tab, setTab] = useState<Tab>('students')
  const [data, setData] = useState<any>(null)
  const [insights, setInsights] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [compassData, setCompassData]   = useState<any[]>([])
  const [compassLoading, setCompassLoading] = useState(false)
  const [compassLoaded, setCompassLoaded]   = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [processingId, setProcessingId]     = useState<string | null>(null)
  const [processedIds, setProcessedIds]     = useState<Set<string>>(new Set())
  const [inviteUrl, setInviteUrl]             = useState<string | null>(null)
  const [inviteLoading, setInviteLoading]     = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedStudentName, setSelectedStudentName] = useState('')
  const [expandedStudentId, setExpandedStudentId]     = useState<string | null>(null)
  const [showFormative, setShowFormative]             = useState(false)
  const [showTopical, setShowTopical]                 = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/teacher/classes/${classId}`).then(r => r.json()),
      fetch(`/api/teacher/classes/${classId}/insights`).then(r => r.json()),
    ]).then(([classData, insightData]) => {
      if (classData.success) setData(classData.data)
      if (insightData.success) setInsights(insightData.data.insights)
    }).finally(() => setLoading(false))
  }, [classId])

  useEffect(() => {
    if (tab !== 'compass' || compassLoaded) return
    setCompassLoading(true)
    fetch(`/api/teacher/classes/${classId}/compass`)
      .then(r => r.json())
      .then(d => { if (d.success) setCompassData(d.data.students) })
      .finally(() => { setCompassLoading(false); setCompassLoaded(true) })
  }, [tab, classId, compassLoaded])

  async function generateInvite() {
    setInviteLoading(true)
    setInviteUrl(null)
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/invite`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error('Failed to generate invite')
      const code = json.data.invite.invite_code
      setInviteUrl(`${window.location.origin}/join/${code}`)
    } catch (err) {
      console.error('[invite]', err)
    } finally {
      setInviteLoading(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(data?.class?.class_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function processStudent(studentId: string, assessmentId?: string) {
    if (!assessmentId) return
    setProcessingId(studentId)
    try {
      const res = await fetch('/api/teacher/assessments/process', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ student_id: studentId, assessment_id: assessmentId }),
      })
      if (res.ok) setProcessedIds(prev => new Set([...prev, studentId]))
    } finally {
      setProcessingId(null)
    }
  }

  function whatsappMessage() {
    if (!data?.class) return ''
    const cls = data.class
    return encodeURIComponent(
`Habari Wazazi! 👋

Mimi ni Mwalimu ${data.teacherName || ''} kutoka ${data.teacherSchool || ''}.

Nimeweka darasa lenu kwenye EduNexus —
platform ya AI inayosaidia watoto
wetu kujifunza vizuri zaidi.

Hatua za kujiunga (bure kabisa):
1️⃣ Nenda: edunexus.co.ke/signup
2️⃣ Ongeza mtoto wako
3️⃣ Dashboard → Settings → Join Class
4️⃣ Weka code hii: ${cls.class_code}

Nitaweza kuona maendeleo ya kila mtoto
na kuwasaidia vizuri zaidi darasani.

— Mwalimu 🎓`
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500">Class not found.</p>
        <Link href="/teacher/classes" className="text-teal-600 font-bold mt-2 inline-block">← Back to Classes</Link>
      </div>
    )
  }

  const cls = data.class
  const rawStudents: Record<string, unknown>[] = data.students || []
  const students: AnalyticsStudent[] = rawStudents.map(s => ({
    id:              s.id as string,
    name:            s.name as string,
    grade:           s.grade as number,
    curriculum_type: (s.curriculum_type as string) ?? 'cbc',
    current_pathway: (s.current_pathway as string | null) ?? null,
    assessment:      s.assessment as AnalyticsStudent['assessment'],
  }))
  const clinicStudents: ClinicStudent[] = rawStudents.map(s => ({
    id:                 s.id as string,
    name:               s.name as string,
    grade:              s.grade as number,
    latestAssessmentId: (s.latestAssessmentId as string | null) ?? null,
    parent_email:       (s.parent_email as string | null) ?? null,
    parent_phone:       (s.parent_phone as string | null) ?? null,
    assessment:         s.assessment as ClinicStudent['assessment'],
  }))
  const subjectInsights: Record<string, unknown>[] = data.insights || []

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'students',    label: 'Students',        icon: Users         },
    { key: 'gaps',        label: 'Gap Radar',       icon: BarChart3     },
    { key: 'assignments', label: 'Assignments',     icon: BookOpen      },
    { key: 'holiday',     label: 'Holiday Planner', icon: Sun           },
    { key: 'remedial',    label: 'Remedial Plan',   icon: Layers        },
    { key: 'compass',     label: 'Compass',         icon: Compass       },
    { key: 'clinic',      label: 'Clinic Reports',  icon: FlaskConical  },
    { key: 'upload',      label: 'Upload Scores',   icon: Upload        },
    { key: 'analytics',   label: 'Analytics',       icon: BarChart3     },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <Link href="/teacher/classes" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3 font-medium">
          ← Back to Classes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">{cls.name}</h1>
            <p className="text-gray-500 mt-1">Grade {cls.grade} · {cls.subject} · {cls.academic_year}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Class code + copy */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <span className="text-xs text-gray-500">Code:</span>
              <span className="font-mono font-black text-gray-800">{cls.class_code}</span>
              <button onClick={copyCode} className="text-gray-400 hover:text-teal-600">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {/* WhatsApp share */}
            <a
              href={`https://wa.me/?text=${whatsappMessage()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-600 transition"
            >
              <Share2 className="w-4 h-4" /> Send to Parents
            </a>
            <button
              onClick={() => setShowFormative(true)}
              className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-900 transition"
            >
              <MessageSquare className="w-4 h-4" /> After Lesson
            </button>
            <button
              onClick={() => setShowTopical(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
            >
              <ClipboardCheck className="w-4 h-4" /> Topical Check
            </button>
            <Link
              href={`/teacher/assignments/new?classId=${cls.id}`}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-700 transition"
            >
              <PlusCircle className="w-4 h-4" /> New Assignment
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-gray-900">{students.length}</div>
          <div className="text-sm text-gray-500">Students</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-teal-600">
            {insights?.activeStudents ?? '—'}
          </div>
          <div className="text-sm text-gray-500">Active This Week</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <div className={`text-2xl font-black ${(insights?.riskLevels?.high || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {insights?.riskLevels?.high ?? 0}
          </div>
          <div className="text-sm text-gray-500">High Risk</div>
        </div>
      </div>

      {/* Monday Intelligence Panel */}
      <MondayIntelligencePanel classId={classId} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition flex-1 justify-center ${
              tab === t.key
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Students */}
      {tab === 'students' && (
        <div className="space-y-4">
          {/* Add Students header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {students.length} student{students.length !== 1 ? 's' : ''} · Add students directly and their parents get WhatsApp + email automatically.
            </p>
            <button
              onClick={() => setShowAddStudent(true)}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-700 transition"
            >
              <UserPlus className="w-4 h-4" /> Add Students
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Last Active</th>
                    <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Parent</th>
                    <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <UserPlus className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-gray-400">No students yet.</p>
                        <button
                          onClick={() => setShowAddStudent(true)}
                          className="mt-3 text-sm text-teal-600 font-bold hover:underline"
                        >
                          Add students directly →
                        </button>
                      </td>
                    </tr>
                  ) : rawStudents.map((s: any) => {
                    const badge      = s.avgScore !== null ? levelBadge(s.avgScore) : null
                    const isDone     = processedIds.has(s.id)
                    const isBusy     = processingId === s.id
                    const hasAssess  = !!s.assessment
                    const isExpanded = expandedStudentId === s.id
                    const hasScores  = Object.keys(s.subjectScores || {}).length > 0

                    return (
                      <Fragment key={s.id}>
                        <tr
                          className={`border-l-4 ${rowColor(s.avgScore)} hover:bg-gray-50 cursor-pointer`}
                          onClick={() => setExpandedStudentId(isExpanded ? null : s.id)}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              {hasScores
                                ? isExpanded
                                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                : <span className="w-3.5 shrink-0" />
                              }
                              <div>
                                <div className="font-bold text-gray-900">{s.name}</div>
                                <div className="text-xs text-gray-400 flex items-center gap-2">
                                  <span>Grade {s.grade}</span>
                                  <Link
                                    href={`/teacher/reports/blueprint/${s.id}`}
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:underline"
                                  >
                                    <Brain className="w-3 h-3" /> Blueprint
                                  </Link>
                                  <Link
                                    href={`/teacher/reports/career-intelligence/${s.id}`}
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:underline"
                                  >
                                    <Compass className="w-3 h-3" /> Career
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {badge ? (
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${badge.cls}`}>
                                {badge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">No data</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {s.daysInactive !== null ? (
                              <span className={`text-sm ${s.daysInactive > 7 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                {s.daysInactive === 0 ? 'Today' : `${s.daysInactive}d ago`}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Never</span>
                            )}
                          </td>
                          <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                            {(() => {
                              const status = getParentStatus(s)
                              const isConnected = status.label !== 'Not Connected'
                              if (isConnected) {
                                return (
                                  <span className={`flex items-center gap-1 text-xs border px-2 py-1 rounded-full font-bold ${status.color}`}>
                                    <Check className="w-3 h-3" /> {status.label}
                                  </span>
                                )
                              }
                              return (
                                <button
                                  onClick={() => {
                                    setSelectedStudentName(s.name)
                                    setShowInviteModal(true)
                                    generateInvite()
                                  }}
                                  className="text-xs text-gray-400 font-bold border border-gray-200 bg-gray-50 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600 px-2.5 py-1 rounded-full transition-colors"
                                >
                                  Not Connected
                                </button>
                              )
                            })()}
                          </td>
                          <td className="px-5 py-4">
                            {isDone ? (
                              <span className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                                <CheckCircle2 className="w-4 h-4" /> Sent
                              </span>
                            ) : hasAssess ? (
                              <button
                                onClick={e => { e.stopPropagation(); processStudent(s.id, s.assessment_id || s.latestAssessmentId) }}
                                disabled={isBusy || !!processingId}
                                className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-violet-700 disabled:opacity-50"
                              >
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                {isBusy ? 'Processing…' : 'Send Report'}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">No assessment</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && hasScores && (
                          <tr className="bg-gray-50 border-l-4 border-l-teal-200">
                            <td colSpan={5} className="px-6 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                  Parent-entered assessment
                                </span>
                                {s.assessment && (
                                  <span className="text-[10px] text-gray-300">
                                    Term {s.assessment.term} · {s.assessment.year}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(s.subjectScores as Record<string, number>).map(([subject, score]) => (
                                  <div key={subject} className="flex items-center gap-1.5 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-gray-200">
                                    <span className="text-gray-500 capitalize">{subject.replace(/_/g, ' ')}</span>
                                    <span className="text-gray-800 font-bold">{score}/4</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Gap Radar */}
      {tab === 'gaps' && (
        <div className="space-y-5">
          {subjectInsights.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No assessment data yet. Insights will appear once parents add assessments.</p>
            </div>
          ) : (
            <>
              {subjectInsights.map((si: any) => {
                const pct = (si.avg / 4) * 100
                const barColor = si.avg >= 3.5 ? 'bg-purple-500' : si.avg >= 2.5 ? 'bg-green-500' : si.avg >= 1.5 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div key={si.subject} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-black text-gray-900 capitalize">{si.subject.replace(/_/g, ' ')}</h3>
                        <p className="text-sm text-gray-400">Class avg: {si.avg}/4</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${levelBadge(si.avg).cls}`}>
                        {si.level}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                      <div className={`h-3 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { label: '🔴 Below',      val: si.distribution.below,      cls: 'text-red-600 bg-red-50' },
                        { label: '🟡 Approaching', val: si.distribution.approaching, cls: 'text-amber-600 bg-amber-50' },
                        { label: '🟢 Meets',       val: si.distribution.meets,       cls: 'text-green-600 bg-green-50' },
                        { label: '💜 Exceeds',     val: si.distribution.exceeds,     cls: 'text-purple-600 bg-purple-50' },
                      ].map(d => (
                        <div key={d.label} className={`rounded-xl p-2 ${d.cls}`}>
                          <div className="font-black text-lg">{d.val}</div>
                          <div className="font-semibold leading-tight">{d.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Recommendations */}
              {data.recommendations && data.recommendations.length > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                  <h3 className="font-black text-teal-800 mb-3 flex items-center gap-2">
                    🎯 EduNexus Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {data.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-teal-700">
                        <span className="font-black text-teal-500 mt-0.5">{i + 1}.</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB: Assignments */}
      {tab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/teacher/assignments/new?classId=${cls.id}`}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition"
            >
              <PlusCircle className="w-4 h-4" /> New Assignment
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">
              Assignments for this class will appear here.{' '}
              <Link href="/teacher/assignments" className="text-teal-600 font-bold hover:underline">
                View all assignments →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* TAB: Compass Suggestions */}
      {tab === 'compass' && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-5">
            <h3 className="font-black text-teal-800 mb-1 flex items-center gap-2">
              <Compass className="w-5 h-5" /> Learning Compass — Per-Learner Suggestions
            </h3>
            <p className="text-sm text-teal-700">
              Pulled from each learner&apos;s live AI sessions. Refreshes every time they use Compass.
            </p>
          </div>

          {compassLoading ? (
            <div className="flex justify-center py-20">
              <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : compassData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <Compass className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No students in this class yet.</p>
            </div>
          ) : (
            compassData.map((s: any) => {
              const tierBadge   = compassTierBadge(s.compassTier)
              const confBadge   = confidenceBadge(s.confidenceLevel)
              const daysInactive = s.lastActive
                ? Math.floor((Date.now() - new Date(s.lastActive).getTime()) / (1000 * 60 * 60 * 24))
                : null

              if (!s.hasCompassData) {
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-dashed border-gray-200 px-5 py-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">Grade {s.grade}</div>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-bold">
                      No Compass sessions yet
                    </span>
                  </div>
                )
              }

              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Coloured top bar keyed to tier */}
                  <div className={`h-1 ${
                    s.compassTier === 'exceeds_expectations'     ? 'bg-purple-400' :
                    s.compassTier === 'meets_expectations'       ? 'bg-green-400'  :
                    s.compassTier === 'approaching_expectations' ? 'bg-amber-400'  :
                    s.compassTier === 'below_expectations'       ? 'bg-red-400'    : 'bg-gray-200'
                  }`} />

                  <div className="p-5">
                    {/* Student header row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="font-black text-gray-900 text-base">{s.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Grade {s.grade}
                          {s.lastSubject && (
                            <> · Last studied: <span className="capitalize font-semibold text-gray-600">{s.lastSubject.replace(/_/g, ' ')}</span></>
                          )}
                          {daysInactive !== null && (
                            <> · Active: <span className={daysInactive > 7 ? 'text-red-500 font-bold' : 'text-gray-600 font-semibold'}>{daysInactive === 0 ? 'today' : `${daysInactive}d ago`}</span></>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tierBadge && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${tierBadge.cls}`}>
                            {tierBadge.label}
                          </span>
                        )}
                        {confBadge && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${confBadge.cls}`}>
                            {confBadge.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Left: strengths + challenges */}
                      <div className="space-y-3">
                        {s.strengths.length > 0 && (
                          <div>
                            <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                              💪 Strengths
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {s.strengths.map((subj: string) => (
                                <span key={subj} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold capitalize">
                                  {subj.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {s.challenges.length > 0 && (
                          <div>
                            <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                              🎯 Needs Work
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {s.challenges.map((subj: string) => (
                                <span key={subj} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold capitalize">
                                  {subj.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: mastered + struggling concepts */}
                      <div className="space-y-3">
                        {s.masteredConcepts.length > 0 && (
                          <div>
                            <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                              ✅ Concepts Mastered
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {s.masteredConcepts.map((c: string) => (
                                <span key={c} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-semibold capitalize">
                                  {c.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {s.strugglingConcepts.length > 0 && (
                          <div>
                            <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                              ⚠️ Struggling With
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {s.strugglingConcepts.map((c: string) => (
                                <span key={c} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold capitalize">
                                  {c.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Subject tier chips (if multiple subjects) */}
                    {Object.keys(s.subjectTiers).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                          📊 Per-Subject Level
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(s.subjectTiers as Record<string, string>).map(([subj, tier]) => {
                            const t = compassTierBadge(tier)
                            if (!t) return null
                            return (
                              <div key={subj} className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${t.cls}`}>
                                <span className="capitalize">{subj.replace(/_/g, ' ')}</span>
                                <span className="opacity-60">—</span>
                                <span>{t.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Latest Compass suggestion */}
                    {s.latestInsight && (
                      <div className="mt-4 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                        <Brain className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-black text-teal-700 uppercase tracking-wider mb-0.5">
                            Latest Compass Suggestion
                          </div>
                          <p className="text-sm text-teal-800 leading-relaxed">{s.latestInsight}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* TAB: Clinic Reports */}
      {tab === 'clinic' && (
        <ClinicReportsTab
          classId={classId}
          students={clinicStudents}
          className={cls.name}
        />
      )}

      {/* Add Student Modal */}
      {showAddStudent && (
        <AddStudentModal
          classId={classId}
          defaultGrade={cls.grade}
          onClose={() => setShowAddStudent(false)}
          onSuccess={(count) => {
            setShowAddStudent(false)
            // Reload class data to show new students
            Promise.all([
              fetch(`/api/teacher/classes/${classId}`).then(r => r.json()),
              fetch(`/api/teacher/classes/${classId}/insights`).then(r => r.json()),
            ]).then(([classData, insightData]) => {
              if (classData.success) setData(classData.data)
              if (insightData.success) setInsights(insightData.data.insights)
            })
          }}
        />
      )}

      {/* Invite parent modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Invite {selectedStudentName}&apos;s parent
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Send this link — one click and they&apos;re connected.
                </p>
              </div>
              <button
                onClick={() => { setShowInviteModal(false); setInviteUrl(null) }}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              {inviteLoading ? (
                <div className="flex items-center justify-center py-8 gap-3 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Generating link…</span>
                </div>
              ) : inviteUrl ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-gray-600 break-all">
                    {inviteUrl}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteUrl)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Habari! Mimi ni mwalimu wa ${selectedStudentName}.\n\nUngependa kupata updates za ${selectedStudentName} moja kwa moja?\n\nBonyeza hapa: ${inviteUrl}\n\n— EduNexus`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    <Share2 className="w-4 h-4" /> Share on WhatsApp
                  </a>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-red-500">Failed to generate link.</p>
                  <button
                    onClick={generateInvite}
                    className="mt-3 text-sm text-teal-600 font-bold hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Holiday Planner */}
      {tab === 'holiday' && (
        <HolidayPlannerTab
          classId={classId}
          students={students.map((s: any) => ({ id: s.id, name: s.name }))}
          className={cls.name}
          existingHolidayRisk={insights?.holidayRisk}
        />
      )}

      {/* TAB: Remedial Planner */}
      {tab === 'remedial' && (
        <RemedialPlannerTab classId={classId} className={cls.name} />
      )}

      {/* TAB: Upload Assessment */}
      {tab === 'upload' && (
        <UploadAssessmentTab
          classId={classId}
          students={students.map((s: any) => ({ id: s.id, name: s.name }))}
          className={cls.name}
        />
      )}

      {/* TAB: Analytics */}
      {tab === 'analytics' && (
        <ClassAnalyticsTab
          students={students}
          className={cls.name}
          grade={cls.grade}
        />
      )}

      {/* Formative Signal Modal */}
      {showFormative && (
        <FormativeSignalModal
          classId={classId}
          students={students.map((s: any) => ({ id: s.id, name: s.name }))}
          onClose={() => setShowFormative(false)}
        />
      )}

      {/* Topical Check Modal */}
      {showTopical && (
        <TopicalCheckModal
          classId={classId}
          students={students.map((s: any) => ({ id: s.id, name: s.name }))}
          onClose={() => setShowTopical(false)}
        />
      )}
    </div>
  )
}
