'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Download,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import type {
  CurriculumMode,
  SOWContext,
  LessonStructure,
  SelectedSubstrand,
  BreakItem,
  GeneratedLesson,
  SOWGenerationResult,
} from '@/lib/sow/types'
import { generateSOWHtml, downloadSOWAsText } from '@/lib/sow/pdfGenerator'

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRICULUM_OPTIONS: Array<{
  mode: CurriculumMode
  emoji: string
  title: string
  subtitle: string
  desc: string
}> = [
  {
    mode: 'cbc_junior',
    emoji: '🇰🇪',
    title: 'CBC Junior',
    subtitle: 'Grade 7, 8 or 9',
    desc: 'Competency-Based',
  },
  {
    mode: 'cbc_senior',
    emoji: '🎓',
    title: 'CBC Senior',
    subtitle: 'Grade 10',
    desc: 'Senior Pathways',
  },
  {
    mode: '844_form3',
    emoji: '📚',
    title: '8-4-4 Form 3',
    subtitle: 'KCSE Preparation',
    desc: 'Content mastery',
  },
  {
    mode: '844_form4',
    emoji: '📚',
    title: '8-4-4 Form 4',
    subtitle: 'Final KCSE Year',
    desc: 'Exam excellence',
  },
]

const GRADE_OPTIONS: Record<CurriculumMode, string[]> = {
  cbc_junior: ['Grade 7', 'Grade 8', 'Grade 9'],
  cbc_senior: ['Grade 10'],
  '844_form3': ['Form 3'],
  '844_form4': ['Form 4'],
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR + 1]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Strand {
  id: string
  title: string
  substrands: Array<{ id: string; title: string }>
}

interface SubstrandSelection {
  strandId: string
  strandTitle: string
  substrandId: string
  substrandTitle: string
  lessonsRequired: number
  orderIndex: number
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SchemeOfWorkPage() {
  const [step, setStep] = useState(1)
  const [teacherSchool, setTeacherSchool] = useState('')

  // Step 1
  const [curriculumMode, setCurriculumMode] = useState<CurriculumMode | null>(null)
  const [grade, setGrade] = useState('')
  const [learningArea, setLearningArea] = useState('')
  const [learningAreaName, setLearningAreaName] = useState('')
  const [term, setTerm] = useState<1 | 2 | 3>(1)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [school, setSchool] = useState('')
  const [textbook, setTextbook] = useState('')
  const [learningAreas, setLearningAreas] = useState<Array<{ id: string; name: string }>>([])

  // Step 2
  const [strands, setStrands] = useState<Strand[]>([])
  const [selections, setSelections] = useState<SubstrandSelection[]>([])
  const [strandsLoading, setStrandsLoading] = useState(false)

  // Step 3
  const [lessonStructure, setLessonStructure] = useState<LessonStructure>({
    lessonsPerWeek: 5,
    firstWeek: 1,
    firstLesson: 1,
    lastWeek: 13,
    lastLesson: 5,
    doubleLessonOption: 'single',
  })

  // Step 4
  const [breaks, setBreaks] = useState<BreakItem[]>([])
  const [noBreaks, setNoBreaks] = useState(false)
  const [newBreak, setNewBreak] = useState<Partial<BreakItem>>({
    title: '',
    startWeek: 1,
    startLesson: 1,
    endWeek: 1,
    endLesson: 1,
  })

  // Step 5
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<SOWGenerationResult | null>(null)
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Fetch teacher profile ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/teacher/classes')
      .then(r => r.json())
      .then(d => {
        if (d.success) setTeacherSchool(d.data?.school || '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (teacherSchool && !school) setSchool(teacherSchool)
  }, [teacherSchool, school])

  // ── Fetch learning areas when grade changes ───────────────────────────────
  useEffect(() => {
    if (!grade || !curriculumMode) return
    fetch(`/api/sow/learning-areas?grade=${encodeURIComponent(grade)}&mode=${curriculumMode}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setLearningAreas(d.data?.areas || [])
      })
      .catch(() => setLearningAreas([]))
  }, [grade, curriculumMode])

  // ── Fetch strands when learning area changes ──────────────────────────────
  useEffect(() => {
    if (!learningArea || !grade) return
    setStrandsLoading(true)
    fetch(
      `/api/sow/strands?learningAreaId=${encodeURIComponent(learningArea)}&grade=${encodeURIComponent(grade)}`
    )
      .then(r => r.json())
      .then(d => {
        setStrands(d.data?.strands || [])
        setStrandsLoading(false)
      })
      .catch(() => {
        setStrands([])
        setStrandsLoading(false)
      })
  }, [learningArea, grade])

  // ─── Computed values ──────────────────────────────────────────────────────

  const totalAvailableSlots =
    (lessonStructure.lastWeek - lessonStructure.firstWeek) *
      lessonStructure.lessonsPerWeek +
    (lessonStructure.lastLesson - lessonStructure.firstLesson + 1)

  const totalBreakSlots = breaks.reduce((sum, b) => {
    const bStart = (b.startWeek - 1) * lessonStructure.lessonsPerWeek + b.startLesson
    const bEnd = (b.endWeek - 1) * lessonStructure.lessonsPerWeek + b.endLesson
    return sum + (bEnd - bStart + 1)
  }, 0)

  const totalTeachingSlots = totalAvailableSlots - totalBreakSlots
  const totalNeeded = selections.reduce((s, sel) => s + sel.lessonsRequired, 0)
  const isInsufficient = totalNeeded > totalTeachingSlots

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function toggleSubstrand(
    strandId: string,
    strandTitle: string,
    substrandId: string,
    substrandTitle: string
  ) {
    setSelections(prev => {
      const exists = prev.find(s => s.substrandId === substrandId)
      if (exists) return prev.filter(s => s.substrandId !== substrandId)
      const isCBC = curriculumMode?.startsWith('cbc')
      return [
        ...prev,
        {
          strandId,
          strandTitle,
          substrandId,
          substrandTitle,
          lessonsRequired: isCBC ? 4 : 6,
          orderIndex: prev.length,
        },
      ]
    })
  }

  function updateLessonsRequired(substrandId: string, val: number) {
    setSelections(prev =>
      prev.map(s =>
        s.substrandId === substrandId ? { ...s, lessonsRequired: val } : s
      )
    )
  }

  function selectAll() {
    const all: SubstrandSelection[] = []
    const isCBC = curriculumMode?.startsWith('cbc')
    strands.forEach(st =>
      st.substrands.forEach(sub => {
        all.push({
          strandId: st.id,
          strandTitle: st.title,
          substrandId: sub.id,
          substrandTitle: sub.title,
          lessonsRequired: isCBC ? 4 : 6,
          orderIndex: all.length,
        })
      })
    )
    setSelections(all)
  }

  function addBreak() {
    if (!newBreak.title?.trim()) return
    const id = `break_${Date.now()}`
    setBreaks(prev => [
      ...prev,
      {
        id,
        title: newBreak.title!,
        startWeek: newBreak.startWeek || 1,
        startLesson: newBreak.startLesson || 1,
        endWeek: newBreak.endWeek || 1,
        endLesson: newBreak.endLesson || 1,
      },
    ])
    setNewBreak({ title: '', startWeek: 1, startLesson: 1, endWeek: 1, endLesson: 1 })
  }

  const handleGenerate = useCallback(async () => {
    if (!curriculumMode || !grade || !learningArea) return
    setGenerating(true)
    setProgress('Preparing lesson pipeline...')
    setResult(null)

    const context: SOWContext = {
      school,
      grade,
      gradeName: grade,
      learningArea,
      learningAreaName,
      term,
      year,
      curriculumMode,
      textbook,
    }

    const selectedSubstrands: SelectedSubstrand[] = selections.map((s, i) => ({
      strandId: s.strandId,
      strandTitle: s.strandTitle,
      substrandId: s.substrandId,
      substrandTitle: s.substrandTitle,
      lessonsRequired: s.lessonsRequired,
      orderIndex: i,
    }))

    try {
      setProgress(`Generating ${totalNeeded} lessons with DeepSeek AI...`)
      const res = await fetch('/api/sow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          lessonStructure,
          selectedSubstrands,
          breaks: noBreaks ? [] : breaks,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.data.result)
        setProgress('')
        setStep(5)
      } else {
        setProgress('Generation failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err: any) {
      setProgress('Network error: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }, [
    curriculumMode,
    grade,
    learningArea,
    learningAreaName,
    school,
    term,
    year,
    textbook,
    selections,
    lessonStructure,
    breaks,
    noBreaks,
    totalNeeded,
  ])

  async function handleSave() {
    if (!result || !curriculumMode || !grade) return
    setSaving(true)
    const lessons = result.lessons.map(l => ({
      ...l,
      reflection: reflections[`${l.week}_${l.lesson}`] || '',
    }))
    const avgConf =
      result.lessons.reduce((s, l) => s + l._confidence, 0) /
      (result.lessons.length || 1)

    const schemeData = {
      meta: {
        school,
        grade,
        learningArea: learningAreaName,
        term: String(term),
        year,
        textbook,
        totalLessons: result.summary.generated,
        totalWeeks: lessonStructure.lastWeek - lessonStructure.firstWeek + 1,
        generatedDate: new Date().toLocaleDateString('en-KE'),
        curriculumMode,
        averageConfidence: Math.round(avgConf * 100) / 100,
      },
      lessons,
      breaks: noBreaks ? [] : breaks,
    }

    try {
      const res = await fetch('/api/sow/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeData }),
      })
      const d = await res.json()
      if (d.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 4000)
      }
    } finally {
      setSaving(false)
    }
  }

  function handleDownloadHtml() {
    if (!result || !curriculumMode) return
    const avgConf =
      result.lessons.reduce((s, l) => s + l._confidence, 0) /
      (result.lessons.length || 1)

    const html = generateSOWHtml({
      meta: {
        school,
        grade,
        learningArea: learningAreaName,
        term: String(term),
        year,
        textbook,
        totalLessons: result.summary.generated,
        totalWeeks: lessonStructure.lastWeek - lessonStructure.firstWeek + 1,
        generatedDate: new Date().toLocaleDateString('en-KE'),
        curriculumMode,
        averageConfidence: Math.round(avgConf * 100) / 100,
      },
      lessons: result.lessons.map(l => ({
        ...l,
        reflection: reflections[`${l.week}_${l.lesson}`] || '',
      })),
      breaks: noBreaks ? [] : breaks,
    })

    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  function handleDownloadText() {
    if (!result || !curriculumMode) return
    const avgConf =
      result.lessons.reduce((s, l) => s + l._confidence, 0) /
      (result.lessons.length || 1)

    const text = downloadSOWAsText({
      meta: {
        school,
        grade,
        learningArea: learningAreaName,
        term: String(term),
        year,
        textbook,
        totalLessons: result.summary.generated,
        totalWeeks: lessonStructure.lastWeek - lessonStructure.firstWeek + 1,
        generatedDate: new Date().toLocaleDateString('en-KE'),
        curriculumMode,
        averageConfidence: Math.round(avgConf * 100) / 100,
      },
      lessons: result.lessons.map(l => ({
        ...l,
        reflection: reflections[`${l.week}_${l.lesson}`] || '',
      })),
      breaks: noBreaks ? [] : breaks,
    })

    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `SOW_${grade}_${learningAreaName}_Term${term}_${year}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function reset() {
    setStep(1)
    setCurriculumMode(null)
    setGrade('')
    setLearningArea('')
    setLearningAreaName('')
    setTerm(1)
    setYear(CURRENT_YEAR)
    setTextbook('')
    setStrands([])
    setSelections([])
    setBreaks([])
    setNoBreaks(false)
    setResult(null)
    setProgress('')
    setReflections({})
    setSaveSuccess(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Scheme of Work Generator</h1>
            <p className="text-sm text-gray-500">AI-powered · KICD aligned · CBC & 8-4-4</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {['Basic Info', 'Strands', 'Schedule', 'Breaks', 'Preview'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  step > i + 1
                    ? 'bg-teal-600 text-white'
                    : step === i + 1
                    ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {step > i + 1 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:inline ${
                  step === i + 1 ? 'text-teal-700' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
              {i < 4 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 1: Basic Info ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-4">Curriculum Type</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CURRICULUM_OPTIONS.map(opt => (
                <button
                  key={opt.mode}
                  onClick={() => {
                    setCurriculumMode(opt.mode)
                    setGrade(GRADE_OPTIONS[opt.mode][0])
                    setLearningArea('')
                    setSelections([])
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    curriculumMode === opt.mode
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{opt.emoji}</div>
                  <div className="font-black text-gray-900 text-sm">{opt.title}</div>
                  <div className="text-xs text-teal-600 font-bold">{opt.subtitle}</div>
                  <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {curriculumMode && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-black text-gray-900">Details</h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">School Name</label>
                  <input
                    value={school}
                    onChange={e => setSchool(e.target.value)}
                    placeholder="e.g. Nairobi Academy"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Grade / Form</label>
                  <select
                    value={grade}
                    onChange={e => { setGrade(e.target.value); setLearningArea(''); setSelections([]) }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {GRADE_OPTIONS[curriculumMode].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Learning Area / Subject</label>
                  {learningAreas.length > 0 ? (
                    <select
                      value={learningArea}
                      onChange={e => {
                        setLearningArea(e.target.value)
                        setLearningAreaName(
                          learningAreas.find(a => a.id === e.target.value)?.name || e.target.value
                        )
                        setSelections([])
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                    >
                      <option value="">Select subject...</option>
                      {learningAreas.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={learningAreaName}
                      onChange={e => {
                        setLearningAreaName(e.target.value)
                        setLearningArea(e.target.value)
                      }}
                      placeholder="e.g. Mathematics"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                    />
                  )}
                  {learningAreas.length === 0 && grade && (
                    <p className="text-xs text-amber-600 mt-1">
                      Curriculum data loading... Enter subject manually.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Term</label>
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
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Year</label>
                  <select
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Textbook <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    value={textbook}
                    onChange={e => setTextbook(e.target.value)}
                    placeholder="e.g. KLB Mathematics Grade 8"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!curriculumMode || !grade || !learningAreaName || !school}
              className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Strands & Substrands ──────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-gray-900">
                Select Strands & Substrands
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-teal-600 font-bold hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setSelections([])}
                  className="text-sm text-gray-400 font-bold hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            {strandsLoading && (
              <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading curriculum data...
              </div>
            )}

            {!strandsLoading && strands.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <p className="text-amber-800 font-bold mb-1">Curriculum data loading...</p>
                <p className="text-amber-600 text-sm">
                  Contact support if this persists. You can still proceed by entering strands manually.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {strands.map(strand => (
                <div key={strand.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 font-bold text-gray-800 text-sm">
                    {strand.title}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {strand.substrands.map(sub => {
                      const sel = selections.find(s => s.substrandId === sub.id)
                      const isSelected = !!sel
                      return (
                        <div
                          key={sub.id}
                          className={`flex items-center gap-3 px-4 py-3 transition ${
                            isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleSubstrand(strand.id, strand.title, sub.id, sub.title)
                            }
                            className="w-4 h-4 rounded border-gray-300 text-teal-600 accent-teal-600"
                          />
                          <span className="flex-1 text-sm text-gray-800">{sub.title}</span>
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500">Lessons:</label>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={sel.lessonsRequired}
                                onChange={e =>
                                  updateLessonsRequired(sub.id, Number(e.target.value))
                                }
                                className="w-14 text-center px-2 py-1 border border-teal-300 rounded-lg text-sm font-bold text-teal-700"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selections.length > 0 && (
              <div className="mt-4 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-teal-700 font-bold">
                  {selections.length} substrand{selections.length !== 1 ? 's' : ''} selected
                </span>
                <span className="text-sm text-teal-600 font-bold">
                  {totalNeeded} lessons total
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selections.length === 0}
              className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Lesson Structure ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-5">Lesson Schedule</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {(
                [
                  { key: 'lessonsPerWeek', label: 'Lessons per week', min: 1, max: 10 },
                  { key: 'firstWeek',      label: 'First week',       min: 1, max: 52 },
                  { key: 'firstLesson',    label: 'First lesson',     min: 1, max: 10 },
                  { key: 'lastWeek',       label: 'Last week',        min: 1, max: 52 },
                  { key: 'lastLesson',     label: 'Last lesson',      min: 1, max: 10 },
                ] as const
              ).map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={lessonStructure[field.key]}
                    onChange={e =>
                      setLessonStructure(prev => ({
                        ...prev,
                        [field.key]: Number(e.target.value),
                      }))
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Double lessons</label>
                <select
                  value={lessonStructure.doubleLessonOption}
                  onChange={e =>
                    setLessonStructure(prev => ({
                      ...prev,
                      doubleLessonOption: e.target.value as 'single' | 'double',
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                >
                  <option value="single">Single lessons only</option>
                  <option value="double">Double lessons enabled</option>
                </select>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total available slots:</span>
                <span className="font-bold text-gray-900">{totalAvailableSlots}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total lessons needed:</span>
                <span className={`font-bold ${isInsufficient ? 'text-red-600' : 'text-teal-700'}`}>
                  {totalNeeded}
                </span>
              </div>
              {isInsufficient && (
                <div className="flex items-center gap-2 text-red-600 text-sm font-bold mt-2">
                  <AlertTriangle className="w-4 h-4" />
                  Not enough slots — reduce lessons or extend term dates
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Breaks ────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-5">Term Breaks</h2>

            <label className="flex items-center gap-3 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={noBreaks}
                onChange={e => setNoBreaks(e.target.checked)}
                className="w-4 h-4 accent-teal-600"
              />
              <span className="text-sm font-bold text-gray-700">No breaks this term (continuous teaching)</span>
            </label>

            {!noBreaks && (
              <>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Break Name</label>
                    <input
                      value={newBreak.title || ''}
                      onChange={e => setNewBreak(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Mid-term break"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                    />
                  </div>
                  {(
                    [
                      { key: 'startWeek', label: 'Start week' },
                      { key: 'startLesson', label: 'Start lesson' },
                      { key: 'endWeek', label: 'End week' },
                      { key: 'endLesson', label: 'End lesson' },
                    ] as const
                  ).map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">{f.label}</label>
                      <input
                        type="number"
                        min={1}
                        value={newBreak[f.key] || 1}
                        onChange={e => setNewBreak(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={addBreak}
                  disabled={!newBreak.title?.trim()}
                  className="flex items-center gap-2 bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-900 transition disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" /> Add Break
                </button>

                {breaks.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {breaks.map(b => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
                      >
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{b.title}</div>
                          <div className="text-xs text-gray-500">
                            Week {b.startWeek} Lesson {b.startLesson} → Week {b.endWeek} Lesson {b.endLesson}
                          </div>
                        </div>
                        <button
                          onClick={() => setBreaks(prev => prev.filter(x => x.id !== b.id))}
                          className="text-red-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <>Generate Scheme <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 shrink-0" />
              <p className="text-blue-800 text-sm font-medium">{progress}</p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 5: Preview & Download ────────────────────────────────────── */}
      {step === 5 && result && (
        <div className="space-y-6">

          {/* Quality summary */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 text-center">
              <div className="text-3xl font-black text-teal-700 mb-1">{result.summary.generated}</div>
              <div className="text-sm text-teal-600 font-bold">Lessons Generated</div>
            </div>
            <div className={`rounded-2xl p-5 text-center border ${result.summary.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`text-3xl font-black mb-1 ${result.summary.failed > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {result.summary.failed}
              </div>
              <div className={`text-sm font-bold ${result.summary.failed > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {result.summary.failed > 0 ? 'Failed' : 'All Successful'}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
              <div className="text-3xl font-black text-blue-700 mb-1">
                {Math.round(
                  (result.lessons.reduce((s, l) => s + l._confidence, 0) /
                    (result.lessons.length || 1)) *
                    100
                )}%
              </div>
              <div className="text-sm text-blue-600 font-bold">Avg Quality</div>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-3 text-sm text-teal-700 font-medium">
            ✅ Source: DeepSeek AI · Aligned to KICD {curriculumMode?.startsWith('cbc') ? 'CBC' : '8-4-4'} · {grade}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={handleDownloadText}
              className="flex items-center gap-2 bg-gray-700 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-800 transition"
            >
              <Download className="w-4 h-4" /> Download Text
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save to My Schemes'}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 border border-gray-300 text-gray-600 px-5 py-3 rounded-xl font-bold hover:bg-gray-50 transition"
            >
              <Plus className="w-4 h-4" /> Create Another
            </button>
          </div>

          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-2 text-green-700 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" /> Scheme saved successfully!
            </div>
          )}

          {/* Preview table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-black text-gray-900">Lesson Preview</h2>
              <p className="text-sm text-gray-500">First 5 rows shown fully. Click any row to expand.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['WK', 'LSN', 'Strand', 'Substrand', 'Learning Outcomes', 'Experiences', 'Inquiry Questions', 'Resources', 'Assessment', 'Reflection'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-bold text-gray-500 whitespace-nowrap border-b border-gray-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.lessons.map((l, i) => (
                    <LessonRow
                      key={`${l.week}_${l.lesson}`}
                      lesson={l}
                      defaultExpanded={i < 5}
                      reflection={reflections[`${l.week}_${l.lesson}`] || ''}
                      onReflectionChange={val =>
                        setReflections(prev => ({ ...prev, [`${l.week}_${l.lesson}`]: val }))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.failures.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <h3 className="font-black text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {result.failures.length} lessons failed to generate
              </h3>
              <div className="space-y-2">
                {result.failures.map((f, i) => (
                  <div key={i} className="text-sm text-red-700">
                    Week {f.week} Lesson {f.lesson} · {f.substrand}: {f.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Lesson Row sub-component ─────────────────────────────────────────────────

function LessonRow({
  lesson,
  defaultExpanded,
  reflection,
  onReflectionChange,
}: {
  lesson: GeneratedLesson
  defaultExpanded: boolean
  reflection: string
  onReflectionChange: (val: string) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <tr
      className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${expanded ? 'bg-teal-50/30' : ''}`}
      onClick={() => setExpanded(e => !e)}
    >
      <td className="px-3 py-3 font-bold text-gray-700 align-top">{lesson.week}</td>
      <td className="px-3 py-3 font-bold text-gray-700 align-top">{lesson.lesson}</td>
      <td className="px-3 py-3 text-gray-700 align-top text-xs max-w-[90px]">{lesson.strand}</td>
      <td className="px-3 py-3 text-gray-700 align-top text-xs max-w-[90px]">{lesson.substrand}</td>
      <td className="px-3 py-3 align-top">
        {expanded ? (
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
            {lesson.learningOutcomes.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        ) : (
          <span className="text-xs text-gray-500 line-clamp-2">{lesson.learningOutcomes[0]}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {expanded ? (
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
            {lesson.learningExperiences.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        ) : (
          <span className="text-xs text-gray-500 line-clamp-1">{lesson.learningExperiences[0]}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {expanded ? (
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
            {lesson.keyInquiryQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        ) : (
          <span className="text-xs text-gray-500 line-clamp-1">{lesson.keyInquiryQuestions[0]}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {expanded ? (
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
            {lesson.learningResources.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : (
          <span className="text-xs text-gray-500 line-clamp-1">{lesson.learningResources.join(', ')}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <span className="text-xs text-gray-600">{lesson.assessmentMethods.join(', ')}</span>
      </td>
      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
        <textarea
          rows={expanded ? 3 : 1}
          value={reflection}
          onChange={e => onReflectionChange(e.target.value)}
          placeholder="Add reflection..."
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 resize-none focus:outline-none focus:border-teal-400 min-w-[80px]"
        />
      </td>
    </tr>
  )
}
