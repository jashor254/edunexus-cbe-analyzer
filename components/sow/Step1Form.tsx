'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, Loader2, GraduationCap, Clock, BookOpen, X, Plus } from 'lucide-react'
import type { SOWContext, CurriculumMode } from '@/lib/sow/types'
import { getSetBooksForSubject } from '@/lib/sow/setBooks'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR + i)

const DB_CURRICULUM_TYPE: Record<CurriculumMode, string> = {
  cbc_senior: 'cbc_senior',
  cbc_junior: 'cbc_junior',
  '844_form3': '844',
  '844_form4': '844',
}

interface SowGrade { id: string; level_id: string; name: string; numeric_grade: number; order_index: number }
interface SowLearningArea { id: string; grade_id: string; name: string; order_index: number }

const CURRICULUM_OPTIONS: Array<{
  mode: CurriculumMode; icon: typeof GraduationCap; title: string; subtitle: string; tag: string
}> = [
  { mode: 'cbc_senior', icon: GraduationCap, title: 'CBC Senior',     subtitle: 'Grade 10–12',       tag: 'KNEC CBA' },
  { mode: 'cbc_junior', icon: BookOpen,       title: 'CBC Junior',     subtitle: 'Grade 7–9',          tag: 'KNEC CBA' },
  { mode: '844_form3',  icon: Clock,          title: '8-4-4',          subtitle: 'Form 3 & Form 4',    tag: 'KCSE' },
]

// ─── Book suggestions ──────────────────────────────────────────────────────────

function getBookSuggestions(subjectName: string, gradeName: string): string[] {
  const sub = subjectName.toLowerCase()
  const g = gradeName
  const build = (pubs: string[]) => pubs.map(p => `${p} ${subjectName} ${g}`)

  if (sub.includes('math')) return build(['KLB', 'Mentor', 'Longhorn'])
  if (sub.includes('biology') || sub.includes('chemistry') || sub.includes('physics'))
    return build(['KLB', 'Mentor', 'Longhorn'])
  if (sub.includes('integrated science') || sub.includes('science'))
    return build(['KLB', 'Mentor', 'Longhorn'])
  if (sub.includes('english'))
    return [`KLB English ${g}`, `Mentor English ${g}`, `Oxford English ${g}`]
  if (sub.includes('kiswahili'))
    return [`KLB Kiswahili ${g}`, `Mentor Kiswahili ${g}`, `Oxford Kiswahili ${g}`]
  if (sub.includes('history') || sub.includes('geography') || sub.includes('social'))
    return build(['KLB', 'Mentor', 'Longhorn'])
  if (sub.includes('cre') || sub.includes('ire') || sub.includes('religious'))
    return build(['KLB', 'Mentor', 'Longhorn'])
  if (sub.includes('agriculture')) return build(['KLB', 'Mentor'])
  if (sub.includes('business')) return build(['KLB', 'Mentor', 'Longhorn'])
  return build(['KLB', 'Mentor'])
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-base font-black text-gray-900 mb-5 pb-3 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Step1Form({ onComplete }: { onComplete: (ctx: SOWContext) => void }) {
  // ── A: Curriculum mode
  const [curriculumMode, setCurriculumMode] = useState<CurriculumMode>('cbc_senior')

  // ── B: Basic info (pre-filled)
  const [teacherName, setTeacherName] = useState('')
  const [tscNumber, setTscNumber] = useState('')
  const [school, setSchool] = useState('')

  // ── C: Academic info cascade
  const [grades, setGrades] = useState<SowGrade[]>([])
  const [learningAreas, setLearningAreas] = useState<SowLearningArea[]>([])
  const [selectedGradeId, setSelectedGradeId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [loadingAreas, setLoadingAreas] = useState(false)
  const [levelError, setLevelError] = useState('')

  // ── D: Reference books
  const [selectedBooks, setSelectedBooks] = useState<string[]>([])
  const [customBook, setCustomBook] = useState('')

  // ── D2: Set books (8-4-4 English/Kiswahili only)
  const [selectedSetBooks, setSelectedSetBooks] = useState<string[]>([])

  // ── E: Term & year
  const [term, setTerm] = useState<1 | 2 | 3>(1)
  const [year, setYear] = useState(CURRENT_YEAR)

  // ── Pre-fill teacher info on mount via API (no direct DB calls in components)
  useEffect(() => {
    async function prefill() {
      try {
        const res = await fetch('/api/teacher/profile')
        if (!res.ok) return
        const json = await res.json() as { data?: { teacher?: { full_name?: string; school?: string } } }
        const teacher = json.data?.teacher
        if (teacher) {
          setTeacherName(t => t || teacher.full_name || '')
          setSchool(s => s || teacher.school || '')
        }
      } catch { /* silently skip prefill on network error */ }

      // TSC saved locally during setup
      const savedTsc = typeof window !== 'undefined' ? localStorage.getItem('teacher_tsc') ?? '' : ''
      setTscNumber(t => t || savedTsc)
    }
    prefill()
  }, [])

  // ── Load grades when curriculum mode changes
  useEffect(() => {
    setLoadingGrades(true)
    setLevelError('')
    setSelectedGradeId('')
    setSelectedAreaId('')
    setGrades([])
    setLearningAreas([])
    setSelectedBooks([])

    const dbType = DB_CURRICULUM_TYPE[curriculumMode]

    async function loadGrades() {
      try {
        const res = await fetch(`/api/sow/grades?mode=${encodeURIComponent(curriculumMode)}`)
        if (!res.ok) {
          setLevelError('Failed to load grades.')
          return
        }
        const json = await res.json() as { data?: { grades?: SowGrade[] } }
        const gradesData = json.data?.grades ?? []
        if (!gradesData.length) {
          setLevelError(`No "${dbType}" grades found. Run the seed script first.`)
          return
        }
        setGrades(gradesData)
      } catch {
        setLevelError('Failed to load grades.')
      } finally {
        setLoadingGrades(false)
      }
    }

    loadGrades()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculumMode])

  // ── Load subjects when grade changes
  useEffect(() => {
    if (!selectedGradeId) return
    setLoadingAreas(true)
    setSelectedAreaId('')
    setLearningAreas([])
    setSelectedBooks([])

    async function loadAreas() {
      try {
        const grade = grades.find(g => g.id === selectedGradeId)
        if (!grade) { setLoadingAreas(false); return }
        const res = await fetch(
          `/api/sow/learning-areas?grade=${encodeURIComponent(grade.name)}&mode=${encodeURIComponent(curriculumMode)}`
        )
        if (!res.ok) { setLoadingAreas(false); return }
        const json = await res.json() as { data?: { areas?: SowLearningArea[] } }
        setLearningAreas(json.data?.areas ?? [])
      } finally {
        setLoadingAreas(false)
      }
    }
    loadAreas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGradeId])

  const selectedGrade = grades.find(g => g.id === selectedGradeId)
  const selectedArea = learningAreas.find(a => a.id === selectedAreaId)

  const is844 = curriculumMode === '844_form3' || curriculumMode === '844_form4'
  const gradeLabel = is844 ? 'Form' : 'Grade'
  const subjectLabel = is844 ? 'Subject' : 'Learning Area'

  // Book suggestions depend on selected subject + grade
  const bookSuggestions = useMemo(() => {
    if (!selectedArea || !selectedGrade) return []
    return getBookSuggestions(selectedArea.name, selectedGrade.name)
  }, [selectedArea, selectedGrade])

  // Set books — only for 8-4-4 English/Kiswahili
  const availableSetBooks = useMemo(() => {
    if (!selectedArea || !selectedGrade) return []
    return getSetBooksForSubject(selectedArea.name, curriculumMode, selectedGrade.name)
  }, [selectedArea, selectedGrade, curriculumMode])

  // Reset book selections when subject changes
  useEffect(() => { setSelectedBooks([]); setSelectedSetBooks([]) }, [selectedAreaId])

  function toggleBook(book: string) {
    setSelectedBooks(prev =>
      prev.includes(book) ? prev.filter(b => b !== book) : [...prev, book]
    )
  }

  function toggleSetBook(title: string) {
    setSelectedSetBooks(prev =>
      prev.includes(title) ? prev.filter(b => b !== title) : [...prev, title]
    )
  }

  function addCustomBook() {
    const trimmed = customBook.trim()
    if (!trimmed || selectedBooks.includes(trimmed)) { setCustomBook(''); return }
    setSelectedBooks(prev => [...prev, trimmed])
    setCustomBook('')
  }

  const canProceed = !!(
    teacherName.trim() &&
    tscNumber.trim() &&
    school.trim() &&
    selectedGradeId &&
    selectedAreaId
  )

  function handleNext() {
    if (!canProceed || !selectedGrade || !selectedArea) return

    // Auto-detect Form 3 vs Form 4 for 8-4-4 mode
    let resolvedMode: CurriculumMode = curriculumMode
    if (curriculumMode === '844_form3') {
      const name = selectedGrade.name.toLowerCase()
      resolvedMode = name.includes('form 4') || name.includes('4') ? '844_form4' : '844_form3'
    }

    onComplete({
      school: school.trim(),
      teacherName: teacherName.trim(),
      tscNumber: tscNumber.trim(),
      grade: selectedGradeId,
      gradeName: selectedGrade.name.replace(/\s*\(JSS\)/i, ''),
      learningArea: selectedAreaId,
      learningAreaName: selectedArea.name,
      term,
      year,
      curriculumMode: resolvedMode,
      // Set books first, then reference books; pdfRenderer splits on ' | '
      textbook: [...selectedSetBooks, ...selectedBooks].filter(Boolean).join(' | '),
    })
  }

  return (
    <div className="space-y-5">

      {/* ── A: Curriculum Mode ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-black text-gray-900 mb-4 pb-3 border-b border-gray-100">
          Select Curriculum
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {CURRICULUM_OPTIONS.map(opt => {
            const Icon = opt.icon
            const isActive = curriculumMode === opt.mode
            return (
              <button
                key={opt.mode}
                onClick={() => setCurriculumMode(opt.mode)}
                className={`relative p-5 rounded-xl border-2 text-left transition-all cursor-pointer group ${
                  isActive
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-teal-200 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition ${
                  isActive ? 'bg-teal-600' : 'bg-gray-100 group-hover:bg-teal-100'
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-teal-600'}`} />
                </div>
                <div className="font-black text-gray-900 text-sm leading-tight">{opt.title}</div>
                <div className={`text-xs font-semibold mt-0.5 ${isActive ? 'text-teal-600' : 'text-gray-400'}`}>
                  {opt.subtitle}
                </div>
                <span className={`absolute top-3 right-3 text-[10px] px-1.5 py-0.5 rounded font-black ${
                  isActive ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {opt.tag}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── B: Basic Info ──────────────────────────────────────────────────── */}
      <Section title="Cover Page Info">
        {levelError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium">
            {levelError}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Teacher Name <span className="text-red-500">*</span>
            </label>
            <input
              value={teacherName}
              onChange={e => setTeacherName(e.target.value)}
              placeholder="e.g. Jane Wanjiku"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              TSC Number <span className="text-red-500">*</span>
            </label>
            <input
              value={tscNumber}
              onChange={e => {
                setTscNumber(e.target.value)
                if (e.target.value.trim()) localStorage.setItem('teacher_tsc', e.target.value.trim())
              }}
              placeholder="e.g. 0123456"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 transition"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              School Name <span className="text-red-500">*</span>
            </label>
            <input
              value={school}
              onChange={e => setSchool(e.target.value)}
              placeholder="e.g. Nairobi Academy"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 transition"
            />
          </div>
        </div>
      </Section>

      {/* ── C: Academic Info ───────────────────────────────────────────────── */}
      <Section title="Academic Info">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              {gradeLabel} <span className="text-red-500">*</span>
            </label>
            {loadingGrades ? (
              <div className="flex items-center gap-2 text-gray-400 py-3 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <select
                value={selectedGradeId}
                onChange={e => { setSelectedGradeId(e.target.value); setSelectedAreaId('') }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white transition"
              >
                <option value="">Select {gradeLabel.toLowerCase()}…</option>
                {grades.map(g => (
                  <option key={g.id} value={g.id}>{g.name.replace(/\s*\(JSS\)/i, '')}</option>
                ))}
              </select>
            )}
            {!loadingGrades && !levelError && grades.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No grades found — run seed script.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              {subjectLabel} <span className="text-red-500">*</span>
            </label>
            {loadingAreas ? (
              <div className="flex items-center gap-2 text-gray-400 py-3 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading subjects…
              </div>
            ) : (
              <select
                value={selectedAreaId}
                onChange={e => setSelectedAreaId(e.target.value)}
                disabled={!selectedGradeId}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white disabled:opacity-50 transition"
              >
                <option value="">
                  {selectedGradeId ? 'Select subject…' : `Select ${gradeLabel.toLowerCase()} first`}
                </option>
                {learningAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            {selectedGradeId && !loadingAreas && learningAreas.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No subjects found for this {gradeLabel.toLowerCase()}.</p>
            )}
          </div>
        </div>
      </Section>

      {/* ── D: Set Books (8-4-4 English / Kiswahili only) ─────────────────── */}
      {availableSetBooks.length > 0 && (
        <Section title="Prescribed Set Books">
          <p className="text-xs text-gray-500 mb-4 -mt-2">
            Select the set texts prescribed for this class this term.
          </p>
          <div className="space-y-2">
            {availableSetBooks.map(book => {
              const checked = selectedSetBooks.includes(book.title)
              return (
                <label
                  key={book.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                    checked
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSetBook(book.title)}
                    className="w-4 h-4 rounded accent-teal-600"
                  />
                  <span className="text-sm text-gray-800 font-medium">{book.title}</span>
                </label>
              )
            })}
          </div>
          {selectedSetBooks.length === 0 && (
            <p className="mt-3 text-xs text-gray-400 italic">
              No set book selected — section will be omitted from cover page.
            </p>
          )}
        </Section>
      )}

      {/* ── D2: Reference Books ────────────────────────────────────────────── */}
      {selectedArea && selectedGrade && (
        <Section title="Reference Books">
          <p className="text-xs text-gray-500 mb-4 -mt-2">
            Check the books you use. These appear on the SOW cover page.
          </p>

          {/* Suggestions */}
          <div className="space-y-2 mb-4">
            {bookSuggestions.map(book => {
              const checked = selectedBooks.includes(book)
              return (
                <label
                  key={book}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                    checked
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBook(book)}
                    className="w-4 h-4 rounded accent-teal-600"
                  />
                  <span className="text-sm text-gray-800 font-medium">{book}</span>
                </label>
              )
            })}
          </div>

          {/* Add custom */}
          <div className="flex gap-2">
            <input
              value={customBook}
              onChange={e => setCustomBook(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomBook())}
              placeholder="Add your own book title…"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-sm text-gray-900 transition"
            />
            <button
              type="button"
              onClick={addCustomBook}
              disabled={!customBook.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-teal-50 hover:text-teal-700 rounded-xl text-sm font-bold text-gray-600 transition disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {/* Selected chips */}
          {selectedBooks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedBooks.map(book => (
                <span
                  key={book}
                  className="flex items-center gap-1.5 bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  {book}
                  <button
                    type="button"
                    onClick={() => toggleBook(book)}
                    className="hover:text-red-600 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {selectedBooks.length === 0 && (
            <p className="mt-3 text-xs text-gray-400 italic">
              No books selected — section will be omitted from cover page.
            </p>
          )}
        </Section>
      )}

      {/* ── E: Term & Year ─────────────────────────────────────────────────── */}
      <Section title="Term & Year">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Term</label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTerm(t)}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition ${
                    term === t
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Term {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white transition"
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* ── Next button ────────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-2">
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="flex items-center gap-2 bg-teal-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed text-base shadow-sm"
        >
          Next — Select Topics <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
