'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText, ChevronRight, ChevronLeft, CheckCircle2,
  Loader2, Download, Save, Plus, Trash2, AlertTriangle,
  Sparkles, BookOpen, GraduationCap, Scroll, Calendar,
  BarChart3, Zap, ArrowRight, ClipboardList,
} from 'lucide-react'
import type {
  CurriculumMode, SOWContext, LessonStructure,
  SelectedSubstrand, BreakItem, GeneratedLesson, SOWGenerationResult,
} from '@/lib/sow/types'
import { generateSOWHtml, downloadSOWAsText } from '@/lib/sow/pdfGenerator'

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRICULUM_OPTIONS: Array<{
  mode: CurriculumMode
  emoji: string
  title: string
  subtitle: string
  desc: string
  gradient: string
  ring: string
  badge: string
}> = [
  {
    mode: 'cbc_junior',
    emoji: '🇰🇪',
    title: 'CBC Junior',
    subtitle: 'Grade 7, 8 or 9',
    desc: 'Competency-Based Curriculum',
    gradient: 'from-teal-500 to-emerald-500',
    ring: 'ring-teal-400',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  },
  {
    mode: 'cbc_senior',
    emoji: '🎓',
    title: 'CBC Senior',
    subtitle: 'Grade 10',
    desc: 'Senior Secondary Pathways',
    gradient: 'from-indigo-500 to-violet-500',
    ring: 'ring-indigo-400',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  },
  {
    mode: '844_form3',
    emoji: '📚',
    title: '8-4-4 Form 3',
    subtitle: 'KCSE Preparation',
    desc: 'Content Mastery',
    gradient: 'from-amber-500 to-orange-500',
    ring: 'ring-amber-400',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  {
    mode: '844_form4',
    emoji: '🏆',
    title: '8-4-4 Form 4',
    subtitle: 'Final KCSE Year',
    desc: 'Exam Excellence',
    gradient: 'from-rose-500 to-pink-500',
    ring: 'ring-rose-400',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
]

const GRADE_OPTIONS: Record<CurriculumMode, string[]> = {
  cbc_junior:  ['Grade 7', 'Grade 8', 'Grade 9'],
  cbc_senior:  ['Grade 10'],
  '844_form3': ['Form 3'],
  '844_form4': ['Form 4'],
}

const STEPS = ['Curriculum', 'Topics', 'Schedule', 'Breaks', 'Preview']

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS  = [CURRENT_YEAR, CURRENT_YEAR + 1]

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function curriculumFor(mode: CurriculumMode | null) {
  return CURRICULUM_OPTIONS.find(c => c.mode === mode) ?? null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SchemeOfWorkPage() {
  const [step, setStep]               = useState(1)
  const [teacherSchool, setTeacherSchool] = useState('')

  // Step 1
  const [curriculumMode, setCurriculumMode] = useState<CurriculumMode | null>(null)
  const [grade, setGrade]             = useState('')
  const [learningArea, setLearningArea]     = useState('')
  const [learningAreaName, setLearningAreaName] = useState('')
  const [term, setTerm]               = useState<1 | 2 | 3>(1)
  const [year, setYear]               = useState(CURRENT_YEAR)
  const [school, setSchool]           = useState('')
  const [textbook, setTextbook]       = useState('')
  const [learningAreas, setLearningAreas] = useState<Array<{ id: string; name: string }>>([])

  // Step 2
  const [strands, setStrands]           = useState<Strand[]>([])
  const [selections, setSelections]     = useState<SubstrandSelection[]>([])
  const [strandsLoading, setStrandsLoading] = useState(false)
  const [expandedStrands, setExpandedStrands] = useState<Set<string>>(new Set())

  // Step 3
  const [lessonStructure, setLessonStructure] = useState<LessonStructure>({
    lessonsPerWeek: 5, firstWeek: 1, firstLesson: 1,
    lastWeek: 13, lastLesson: 5, doubleLessonOption: 'single',
  })

  // Step 4
  const [breaks, setBreaks]           = useState<BreakItem[]>([])
  const [noBreaks, setNoBreaks]       = useState(false)
  const [newBreak, setNewBreak]       = useState<Partial<BreakItem>>({
    title: '', startWeek: 1, startLesson: 1, endWeek: 1, endLesson: 1,
  })

  // Step 5
  const [generating, setGenerating]   = useState(false)
  const [progress, setProgress]       = useState('')
  const [result, setResult]           = useState<SOWGenerationResult | null>(null)
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [saving, setSaving]           = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [savedSchemeId, setSavedSchemeId] = useState<string | null>(null)
  const [creatingROW, setCreatingROW]     = useState(false)

  const curOpt = curriculumFor(curriculumMode)

  // ── Fetch teacher profile ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/teacher/classes').then(r => r.json()).then(d => {
      if (d.success) setTeacherSchool(d.data?.school || '')
    }).catch(() => {})
  }, [])

  useEffect(() => { if (teacherSchool && !school) setSchool(teacherSchool) }, [teacherSchool, school])

  // ── Fetch learning areas ──────────────────────────────────────────────────
  useEffect(() => {
    if (!grade || !curriculumMode) return
    fetch(`/api/sow/learning-areas?grade=${encodeURIComponent(grade)}&mode=${curriculumMode}`)
      .then(r => r.json()).then(d => { if (d.success) setLearningAreas(d.data?.areas || []) })
      .catch(() => setLearningAreas([]))
  }, [grade, curriculumMode])

  // ── Fetch strands ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!learningArea || !grade) return
    setStrandsLoading(true)
    fetch(`/api/sow/strands?learningAreaId=${encodeURIComponent(learningArea)}&grade=${encodeURIComponent(grade)}`)
      .then(r => r.json()).then(d => {
        setStrands(d.data?.strands || [])
        setExpandedStrands(new Set())
        setStrandsLoading(false)
      })
      .catch(() => { setStrands([]); setStrandsLoading(false) })
  }, [learningArea, grade])

  // ─── Computed ─────────────────────────────────────────────────────────────

  const totalAvailableSlots =
    (lessonStructure.lastWeek - lessonStructure.firstWeek) * lessonStructure.lessonsPerWeek +
    (lessonStructure.lastLesson - lessonStructure.firstLesson + 1)

  const totalBreakSlots = breaks.reduce((sum, b) => {
    const s = (b.startWeek - 1) * lessonStructure.lessonsPerWeek + b.startLesson
    const e = (b.endWeek   - 1) * lessonStructure.lessonsPerWeek + b.endLesson
    return sum + (e - s + 1)
  }, 0)

  const totalTeachingSlots = totalAvailableSlots - totalBreakSlots
  const totalNeeded        = selections.reduce((s, sel) => s + sel.lessonsRequired, 0)

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function toggleSubstrand(strandId: string, strandTitle: string, substrandId: string, substrandTitle: string) {
    setSelections(prev => {
      const exists = prev.find(s => s.substrandId === substrandId)
      if (exists) return prev.filter(s => s.substrandId !== substrandId)
      const isCBC = curriculumMode?.startsWith('cbc')
      return [...prev, { strandId, strandTitle, substrandId, substrandTitle, lessonsRequired: isCBC ? 4 : 6, orderIndex: prev.length }]
    })
  }

  function updateLessonsRequired(substrandId: string, val: number) {
    setSelections(prev => prev.map(s => s.substrandId === substrandId ? { ...s, lessonsRequired: val } : s))
  }

  function selectAll() {
    const all: SubstrandSelection[] = []
    const isCBC = curriculumMode?.startsWith('cbc')
    strands.forEach(st => st.substrands.forEach(sub => {
      all.push({ strandId: st.id, strandTitle: st.title, substrandId: sub.id, substrandTitle: sub.title,
        lessonsRequired: isCBC ? 4 : 6, orderIndex: all.length })
    }))
    setSelections(all)
    setExpandedStrands(new Set(strands.map(s => s.id)))
  }

  function toggleStrand(strand: Strand) {
    const isCBC = curriculumMode?.startsWith('cbc')
    const allSelected = strand.substrands.every(sub => selections.find(s => s.substrandId === sub.id))
    if (allSelected) {
      // Deselect all + collapse
      setSelections(prev => prev.filter(s => s.strandId !== strand.id))
      setExpandedStrands(prev => { const n = new Set(prev); n.delete(strand.id); return n })
    } else {
      // Select all missing + expand
      setSelections(prev => {
        const existing = new Set(prev.map(s => s.substrandId))
        const toAdd = strand.substrands
          .filter(sub => !existing.has(sub.id))
          .map((sub, i) => ({
            strandId: strand.id, strandTitle: strand.title,
            substrandId: sub.id, substrandTitle: sub.title,
            lessonsRequired: isCBC ? 4 : 6, orderIndex: prev.length + i,
          }))
        return [...prev, ...toAdd]
      })
      setExpandedStrands(prev => new Set([...prev, strand.id]))
    }
  }

  function addBreak() {
    if (!newBreak.title?.trim()) return
    setBreaks(prev => [...prev, {
      id: `break_${Date.now()}`, title: newBreak.title!,
      startWeek: newBreak.startWeek || 1, startLesson: newBreak.startLesson || 1,
      endWeek: newBreak.endWeek || 1, endLesson: newBreak.endLesson || 1,
    }])
    setNewBreak({ title: '', startWeek: 1, startLesson: 1, endWeek: 1, endLesson: 1 })
  }

  const handleGenerate = useCallback(async () => {
    if (!curriculumMode || !grade || !learningArea) return
    setGenerating(true); setProgress('Preparing lesson pipeline...'); setResult(null)
    const context: SOWContext = { school, grade, gradeName: grade, learningArea, learningAreaName, term, year, curriculumMode, textbook }
    const selectedSubstrands: SelectedSubstrand[] = selections.map((s, i) => ({
      strandId: s.strandId, strandTitle: s.strandTitle, substrandId: s.substrandId,
      substrandTitle: s.substrandTitle, lessonsRequired: s.lessonsRequired, orderIndex: i,
    }))
    try {
      setProgress(`Generating ${totalTeachingSlots} lessons with DeepSeek AI...`)
      const res  = await fetch('/api/sow/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, lessonStructure, selectedSubstrands, breaks: noBreaks ? [] : breaks }) })
      const data = await res.json()
      if (data.success) { setResult(data.data.result); setProgress(''); setStep(5) }
      else setProgress('Generation failed: ' + (data.error || 'Unknown error'))
    } catch (err: any) {
      setProgress('Network error: ' + err.message)
    } finally { setGenerating(false) }
  }, [curriculumMode, grade, learningArea, learningAreaName, school, term, year, textbook, selections, lessonStructure, breaks, noBreaks, totalNeeded])

  async function handleSave() {
    if (!result || !curriculumMode || !grade) return
    setSaving(true)
    const avgConf = result.lessons.reduce((s, l) => s + l._confidence, 0) / (result.lessons.length || 1)
    const schemeData = {
      meta: { school, grade, learningArea: learningAreaName, term: String(term), year, textbook,
        totalLessons: result.summary.generated, totalWeeks: lessonStructure.lastWeek - lessonStructure.firstWeek + 1,
        generatedDate: new Date().toLocaleDateString('en-KE'), curriculumMode, averageConfidence: Math.round(avgConf * 100) / 100 },
      lessons: result.lessons.map(l => ({ ...l, reflection: reflections[`${l.week}_${l.lesson}`] || '' })),
      breaks: noBreaks ? [] : breaks,
    }
    try {
      const res = await fetch('/api/sow/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemeData }) })
      const d = await res.json()
      if (d.success) {
        setSaveSuccess(true)
        setSavedSchemeId(d.data?.schemeId || null)
        setTimeout(() => setSaveSuccess(false), 4000)
      }
    } finally { setSaving(false) }
  }

  async function handleCreateROW() {
    if (!savedSchemeId) return
    setCreatingROW(true)
    try {
      const res = await fetch('/api/teacher/records-of-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeId: savedSchemeId, school, grade, learningArea: learningAreaName, term, year, curriculumMode }),
      })
      const d = await res.json()
      if (d.success) window.location.href = `/teacher/record-of-work/${d.data.rowId}`
    } finally { setCreatingROW(false) }
  }

  function handleDownloadHtml() {
    if (!result || !curriculumMode) return
    const avgConf = result.lessons.reduce((s, l) => s + l._confidence, 0) / (result.lessons.length || 1)
    const html = generateSOWHtml({
      meta: { school, grade, learningArea: learningAreaName, term: String(term), year, textbook,
        totalLessons: result.summary.generated, totalWeeks: lessonStructure.lastWeek - lessonStructure.firstWeek + 1,
        generatedDate: new Date().toLocaleDateString('en-KE'), curriculumMode, averageConfidence: Math.round(avgConf * 100) / 100 },
      lessons: result.lessons.map(l => ({ ...l, reflection: reflections[`${l.week}_${l.lesson}`] || '' })),
      breaks: noBreaks ? [] : breaks,
    })
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  function handleDownloadText() {
    if (!result || !curriculumMode) return
    const avgConf = result.lessons.reduce((s, l) => s + l._confidence, 0) / (result.lessons.length || 1)
    const text = downloadSOWAsText({
      meta: { school, grade, learningArea: learningAreaName, term: String(term), year, textbook,
        totalLessons: result.summary.generated, totalWeeks: lessonStructure.lastWeek - lessonStructure.firstWeek + 1,
        generatedDate: new Date().toLocaleDateString('en-KE'), curriculumMode, averageConfidence: Math.round(avgConf * 100) / 100 },
      lessons: result.lessons.map(l => ({ ...l, reflection: reflections[`${l.week}_${l.lesson}`] || '' })),
      breaks: noBreaks ? [] : breaks,
    })
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `SOW_${grade}_${learningAreaName}_Term${term}_${year}.txt`
    a.click(); URL.revokeObjectURL(a.href)
  }

  function reset() {
    setStep(1); setCurriculumMode(null); setGrade(''); setLearningArea(''); setLearningAreaName('')
    setTerm(1); setYear(CURRENT_YEAR); setTextbook(''); setStrands([]); setSelections([])
    setBreaks([]); setNoBreaks(false); setResult(null); setProgress(''); setReflections({}); setSaveSuccess(false)
  }

  // ─── Shared input class ───────────────────────────────────────────────────
  const inputCls = `w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900 transition`

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero Header ────────────────────────────────────────────────────── */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-0 left-1/3 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Scroll className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white leading-tight tracking-tight">
                Scheme of Work <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-300">Generator</span>
              </h1>
              <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                AI-powered · KICD aligned · CBC &amp; 8-4-4
              </p>
            </div>
          </div>

          {/* Step progress bar */}
          <div className="mt-6">
            <div className="flex items-center gap-0">
              {STEPS.map((label, i) => {
                const done    = step > i + 1
                const current = step === i + 1
                return (
                  <div key={i} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                        done    ? 'bg-teal-500 text-white shadow-md shadow-teal-900/40' :
                        current ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-900/40 ring-4 ring-indigo-500/20' :
                                  'bg-white/5 text-slate-500 border border-white/10'
                      }`}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-[10px] font-bold hidden sm:block whitespace-nowrap transition-colors ${
                        current ? 'text-indigo-300' : done ? 'text-teal-400' : 'text-slate-600'
                      }`}>{label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 mb-4 sm:mb-5 rounded-full overflow-hidden bg-white/5">
                        <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-teal-500 w-full' : 'w-0'}`} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── STEP 1: Curriculum ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">

            {/* Curriculum type selector */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-base">Choose Curriculum Type</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Select the curriculum framework for this scheme</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {CURRICULUM_OPTIONS.map(opt => {
                  const selected = curriculumMode === opt.mode
                  return (
                    <button
                      key={opt.mode}
                      onClick={() => { setCurriculumMode(opt.mode); setGrade(GRADE_OPTIONS[opt.mode][0]); setLearningArea(''); setSelections([]) }}
                      className={`group relative rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                        selected ? `ring-2 ${opt.ring} shadow-lg` : 'border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {selected && (
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${opt.gradient} opacity-5`} />
                      )}
                      <div className={`w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-2xl bg-gradient-to-br ${opt.gradient} shadow-md`}>
                        {opt.emoji}
                      </div>
                      <div className="font-black text-gray-900 text-sm leading-tight">{opt.title}</div>
                      <div className={`text-xs font-bold mt-0.5 ${selected ? 'text-indigo-600' : 'text-gray-400'}`}>{opt.subtitle}</div>
                      <div className="text-xs text-gray-400 mt-2 leading-tight">{opt.desc}</div>
                      {selected && (
                        <div className={`absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-br ${opt.gradient} flex items-center justify-center`}>
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Details form */}
            {curriculumMode && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${curOpt?.gradient}`}>
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-black text-gray-900 text-base">Scheme Details</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Fill in the basic information for your scheme</p>
                  </div>
                </div>
                <div className="p-6 grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">School Name</label>
                    <input value={school} onChange={e => setSchool(e.target.value)} placeholder="e.g. Nairobi Academy" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Grade / Form</label>
                    <select value={grade} onChange={e => { setGrade(e.target.value); setLearningArea(''); setSelections([]) }} className={inputCls}>
                      {GRADE_OPTIONS[curriculumMode].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Learning Area / Subject</label>
                    {learningAreas.length > 0 ? (
                      <select value={learningArea} onChange={e => {
                        setLearningArea(e.target.value)
                        setLearningAreaName(learningAreas.find(a => a.id === e.target.value)?.name || e.target.value)
                        setSelections([])
                      }} className={inputCls}>
                        <option value="">Select subject...</option>
                        {learningAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    ) : (
                      <input value={learningAreaName} onChange={e => { setLearningAreaName(e.target.value); setLearningArea(e.target.value) }}
                        placeholder="e.g. Mathematics" className={inputCls} />
                    )}
                    {learningAreas.length === 0 && grade && (
                      <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Loading curriculum data... enter manually if needed.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Term</label>
                    <div className="flex gap-2">
                      {([1, 2, 3] as const).map(t => (
                        <button key={t} onClick={() => setTerm(t)}
                          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                            term === t
                              ? `bg-gradient-to-br ${curOpt?.gradient} text-white shadow-md`
                              : 'border border-slate-200 text-gray-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}>
                          Term {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Year</label>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
                      {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      Textbook <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input value={textbook} onChange={e => setTextbook(e.target.value)} placeholder="e.g. KLB Mathematics Grade 8" className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={!curriculumMode || !grade || !learningAreaName || !school}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-7 py-3 rounded-xl font-black hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/20">
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Strands & Substrands ──────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${curOpt?.gradient}`}>
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-black text-gray-900 text-base">Select Topics</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{learningAreaName} · {grade}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm font-bold">
                  <button onClick={selectAll} className="text-indigo-600 hover:text-indigo-700 transition">Select All</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelections([])} className="text-gray-400 hover:text-gray-600 transition">Clear</button>
                </div>
              </div>

              <div className="p-6">
                {strandsLoading && (
                  <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <p className="text-sm font-medium">Loading curriculum data...</p>
                  </div>
                )}

                {!strandsLoading && strands.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-amber-800 font-bold">Curriculum data loading...</p>
                    <p className="text-amber-600 text-sm mt-1">Contact support if this persists. You can still proceed.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {strands.map((strand, si) => {
                    const SC = [
                      { bg: 'bg-indigo-600', border: 'border-indigo-100', light: 'bg-indigo-50', subCheck: 'bg-indigo-600', dot: 'bg-indigo-400' },
                      { bg: 'bg-teal-600',   border: 'border-teal-100',   light: 'bg-teal-50',   subCheck: 'bg-teal-600',   dot: 'bg-teal-400'   },
                      { bg: 'bg-violet-600', border: 'border-violet-100', light: 'bg-violet-50', subCheck: 'bg-violet-600', dot: 'bg-violet-400' },
                      { bg: 'bg-amber-600',  border: 'border-amber-100',  light: 'bg-amber-50',  subCheck: 'bg-amber-600',  dot: 'bg-amber-400'  },
                    ][si % 4]

                    const selectedInStrand = strand.substrands.filter(s => selections.find(sel => sel.substrandId === s.id)).length
                    const allSelected  = selectedInStrand === strand.substrands.length && strand.substrands.length > 0
                    const someSelected = selectedInStrand > 0 && !allSelected
                    const isExpanded   = expandedStrands.has(strand.id)

                    return (
                      <div key={strand.id} className={`border ${SC.border} rounded-2xl overflow-hidden`}>
                        {/* ── Strand header — click anywhere to toggle ── */}
                        <div
                          className={`${SC.bg} px-5 py-3.5 flex items-center gap-3 cursor-pointer select-none hover:opacity-95 transition-opacity`}
                          onClick={() => toggleStrand(strand)}
                        >
                          {/* Strand checkbox */}
                          <StrandCheckbox checked={allSelected} indeterminate={someSelected} color={SC.bg} />

                          <span className="flex-1 font-black text-white text-sm">{strand.title}</span>

                          <div className="flex items-center gap-2.5">
                            {selectedInStrand > 0 && (
                              <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-bold">
                                {selectedInStrand}/{strand.substrands.length}
                              </span>
                            )}
                            {/* Collapse arrow */}
                            <div className={`w-5 h-5 rounded-md bg-white/15 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              onClick={e => { e.stopPropagation(); setExpandedStrands(prev => { const n = new Set(prev); isExpanded ? n.delete(strand.id) : n.add(strand.id); return n }) }}>
                              <ChevronRight className="w-3 h-3 text-white rotate-90" />
                            </div>
                          </div>
                        </div>

                        {/* ── Substrands — only shown when expanded ── */}
                        {isExpanded && (
                          <div className={`divide-y divide-white/40 ${SC.light}`}>
                            {strand.substrands.map(sub => {
                              const sel        = selections.find(s => s.substrandId === sub.id)
                              const isSelected = !!sel
                              return (
                                <div key={sub.id}
                                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-white/60' : 'hover:bg-white/40'}`}
                                  onClick={e => { e.stopPropagation(); toggleSubstrand(strand.id, strand.title, sub.id, sub.title) }}
                                >
                                  <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                    isSelected ? `${SC.subCheck} border-transparent` : 'border-slate-300 bg-white'
                                  }`}>
                                    {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <span className={`flex-1 text-sm leading-snug ${isSelected ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>{sub.title}</span>
                                  {isSelected && (
                                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                      <span className="text-xs text-gray-400 font-medium">Lsn:</span>
                                      <input type="number" min={1} max={20} value={sel.lessonsRequired}
                                        onChange={e => updateLessonsRequired(sub.id, Number(e.target.value))}
                                        className="w-12 text-center px-1.5 py-1 border border-slate-200 rounded-lg text-xs font-black text-gray-800 focus:outline-none focus:border-indigo-400 bg-white"
                                      />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {selections.length > 0 && (
                  <div className="mt-5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg shadow-indigo-900/20">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-white/80" />
                      <span className="text-white font-black text-sm">
                        {selections.length} topic{selections.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-bold">{totalNeeded} total lessons</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-slate-200 font-bold hover:bg-slate-50 transition">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(3)} disabled={selections.length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-7 py-3 rounded-xl font-black hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/20">
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Lesson Structure ───────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-base">Lesson Schedule</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Define the teaching timetable for this term</p>
                </div>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-5">
                {([
                  { key: 'lessonsPerWeek', label: 'Lessons per week',   icon: '📅', min: 1, max: 10 },
                  { key: 'firstWeek',      label: 'First teaching week', icon: '🟢', min: 1, max: 52 },
                  { key: 'firstLesson',    label: 'First lesson no.',    icon: '1️⃣', min: 1, max: 10 },
                  { key: 'lastWeek',       label: 'Last teaching week',  icon: '🔴', min: 1, max: 52 },
                  { key: 'lastLesson',     label: 'Last lesson no.',     icon: '🔚', min: 1, max: 10 },
                ] as const).map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      <span className="mr-1.5">{field.icon}</span>{field.label}
                    </label>
                    <input type="number" min={field.min} max={field.max} value={lessonStructure[field.key]}
                      onChange={e => setLessonStructure(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                      className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    <span className="mr-1.5">⏱</span>Double lessons
                  </label>
                  <select value={lessonStructure.doubleLessonOption}
                    onChange={e => setLessonStructure(prev => ({ ...prev, doubleLessonOption: e.target.value as 'single' | 'double' }))}
                    className={inputCls}>
                    <option value="single">Single lessons only</option>
                    <option value="double">Double lessons enabled</option>
                  </select>
                </div>
              </div>

              {/* Slot summary */}
              <div className="mx-6 mb-6 rounded-2xl overflow-hidden border border-slate-100">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" /> Slot Summary
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between items-center px-5 py-3 text-sm">
                    <span className="text-gray-500">Total slots</span>
                    <span className="font-black text-gray-900 bg-slate-100 px-3 py-0.5 rounded-full">{totalAvailableSlots}</span>
                  </div>
                  {totalBreakSlots > 0 && (
                    <div className="flex justify-between items-center px-5 py-3 text-sm">
                      <span className="text-gray-500">Break slots</span>
                      <span className="font-black text-amber-700 bg-amber-50 px-3 py-0.5 rounded-full">−{totalBreakSlots}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-5 py-3 text-sm">
                    <span className="font-bold text-gray-800">Lessons to generate</span>
                    <span className="font-black text-teal-700 bg-teal-50 px-3 py-0.5 rounded-full">{totalTeachingSlots}</span>
                  </div>
                  <div className="px-5 py-3 bg-slate-50 text-xs text-gray-400">
                    {selections.length} topics distributed proportionally across {totalTeachingSlots} teaching slots
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-slate-200 font-bold hover:bg-slate-50 transition">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(4)}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-7 py-3 rounded-xl font-black hover:opacity-90 transition shadow-lg shadow-indigo-900/20">
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Breaks ────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-base">Term Breaks</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Mark any school holidays or mid-term breaks</p>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    noBreaks ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white group-hover:border-indigo-400'
                  }`} onClick={() => setNoBreaks(p => !p)}>
                    {noBreaks && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm font-bold text-gray-700">No breaks — continuous teaching throughout term</span>
                </label>

                {!noBreaks && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Break Name</label>
                        <input value={newBreak.title || ''} onChange={e => setNewBreak(p => ({ ...p, title: e.target.value }))}
                          placeholder="e.g. Mid-term break" className={inputCls} />
                      </div>
                      {([
                        { key: 'startWeek', label: 'Start week', emoji: '🟢' },
                        { key: 'startLesson', label: 'Start lesson', emoji: '▶️' },
                        { key: 'endWeek', label: 'End week', emoji: '🔴' },
                        { key: 'endLesson', label: 'End lesson', emoji: '⏹️' },
                      ] as const).map(f => (
                        <div key={f.key}>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            <span className="mr-1">{f.emoji}</span>{f.label}
                          </label>
                          <input type="number" min={1} value={newBreak[f.key] || 1}
                            onChange={e => setNewBreak(p => ({ ...p, [f.key]: Number(e.target.value) }))} className={inputCls} />
                        </div>
                      ))}
                      <div className="sm:col-span-2">
                        <button onClick={addBreak} disabled={!newBreak.title?.trim()}
                          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition disabled:opacity-40 shadow-md shadow-amber-900/20">
                          <Plus className="w-4 h-4" /> Add Break
                        </button>
                      </div>
                    </div>

                    {breaks.length > 0 && (
                      <div className="space-y-2">
                        {breaks.map(b => (
                          <div key={b.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-sm">📅</div>
                              <div>
                                <div className="font-black text-gray-900 text-sm">{b.title}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Week {b.startWeek} Lesson {b.startLesson} → Week {b.endWeek} Lesson {b.endLesson}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => setBreaks(prev => prev.filter(x => x.id !== b.id))}
                              className="w-8 h-8 rounded-xl bg-white border border-red-100 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Generate CTA */}
            <div className="bg-gradient-to-br from-[#0c1929] to-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 text-xs font-black uppercase tracking-wider">AI Generation</span>
                </div>
                <h3 className="text-white font-black text-lg mb-1">Ready to generate your scheme?</h3>
                <p className="text-slate-400 text-sm mb-5">
                  DeepSeek AI will create {totalNeeded} KICD-aligned lessons for {learningAreaName} · {grade} · Term {term}
                </p>
                {progress && (
                  <div className="mb-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    <p className="text-slate-300 text-sm">{progress}</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(3)} className="flex items-center gap-2 text-slate-400 px-5 py-3 rounded-xl border border-white/10 font-bold hover:bg-white/5 transition text-sm">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={handleGenerate} disabled={generating}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-7 py-3 rounded-xl font-black hover:opacity-90 transition disabled:opacity-60 shadow-lg shadow-indigo-900/30">
                    {generating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Generate Scheme</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: Preview & Download ────────────────────────────────── */}
        {step === 5 && result && (
          <div className="space-y-6">

            {/* Result stats */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 p-5 shadow-lg shadow-teal-900/20">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
                <div className="text-4xl font-black text-white mb-1">{result.summary.generated}</div>
                <div className="text-sm text-white/80 font-bold">Lessons Generated</div>
              </div>
              <div className={`relative overflow-hidden rounded-2xl p-5 shadow-lg ${result.summary.failed > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-900/20' : 'bg-gradient-to-br from-indigo-500 to-violet-500 shadow-indigo-900/20'}`}>
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
                <div className="text-4xl font-black text-white mb-1">{result.summary.failed}</div>
                <div className="text-sm text-white/80 font-bold">{result.summary.failed > 0 ? 'Failed to Generate' : 'All Successful ✓'}</div>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 p-5 shadow-lg shadow-rose-900/20">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
                <div className="text-4xl font-black text-white mb-1">
                  {Math.round((result.lessons.reduce((s, l) => s + l._confidence, 0) / (result.lessons.length || 1)) * 100)}%
                </div>
                <div className="text-sm text-white/80 font-bold">Avg Quality Score</div>
              </div>
            </div>

            {/* Attribution badge */}
            <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-5 py-3.5 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="text-sm text-gray-700 font-medium">
                Generated by <strong>DeepSeek AI</strong> · Aligned to{' '}
                <strong>KICD {curriculumMode?.startsWith('cbc') ? 'CBC' : '8-4-4'}</strong> · {grade} · Term {term} {year}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button onClick={handleDownloadHtml}
                className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white px-5 py-3 rounded-xl font-black hover:opacity-90 transition shadow-md shadow-teal-900/20">
                <Download className="w-4 h-4" /> Download PDF
              </button>
              <button onClick={handleDownloadText}
                className="flex items-center gap-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white px-5 py-3 rounded-xl font-black hover:opacity-90 transition shadow-md">
                <Download className="w-4 h-4" /> Download Text
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-3 rounded-xl font-black hover:opacity-90 transition disabled:opacity-60 shadow-md shadow-indigo-900/20">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save to My Schemes'}
              </button>
              <button onClick={reset}
                className="flex items-center gap-2 border border-slate-200 text-gray-600 px-5 py-3 rounded-xl font-black hover:bg-slate-50 transition">
                <Plus className="w-4 h-4" /> New Scheme
              </button>
            </div>

            {saveSuccess && (
              <div className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 text-teal-700 font-bold text-sm">
                  <div className="w-7 h-7 rounded-xl bg-teal-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  </div>
                  Scheme saved! Now create a Record of Work from it.
                </div>
                <button
                  onClick={handleCreateROW}
                  disabled={creatingROW || !savedSchemeId}
                  className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition disabled:opacity-50 shadow-md shadow-teal-900/20"
                >
                  {creatingROW ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                  {creatingROW ? 'Creating...' : 'Create Record of Work →'}
                </button>
              </div>
            )}

            {/* Preview table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="font-black text-gray-900">Lesson Preview</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Click any row to expand · First 5 shown in full</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800 to-[#0c1929]">
                      {['WK', 'LSN', 'Strand', 'Substrand', 'Learning Outcomes', 'Experiences', 'Inquiry Questions', 'Resources', 'Assessment', 'Reflection'].map(h => (
                        <th key={h} className="text-left px-3 py-3.5 text-xs font-black text-slate-300 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.lessons.map((l, i) => (
                      <LessonRow key={`${l.week}_${l.lesson}`} lesson={l} defaultExpanded={i < 5}
                        reflection={reflections[`${l.week}_${l.lesson}`] || ''}
                        onReflectionChange={val => setReflections(prev => ({ ...prev, [`${l.week}_${l.lesson}`]: val }))}
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
                    <div key={i} className="text-sm text-red-700 bg-red-100/60 rounded-lg px-3 py-2">
                      Week {f.week} Lesson {f.lesson} · {f.substrand}: {f.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Lesson Row ───────────────────────────────────────────────────────────────

function LessonRow({ lesson, defaultExpanded, reflection, onReflectionChange }: {
  lesson: GeneratedLesson; defaultExpanded: boolean
  reflection: string; onReflectionChange: (val: string) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const weekColor = [
    'bg-teal-500', 'bg-indigo-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500',
    'bg-cyan-500',  'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-blue-500',
  ][(lesson.week - 1) % 10]

  return (
    <tr className={`border-b border-slate-100 cursor-pointer transition-colors ${expanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}
      onClick={() => setExpanded(e => !e)}>
      <td className="px-3 py-3 align-top">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${weekColor} text-white text-xs font-black`}>
          {lesson.week}
        </span>
      </td>
      <td className="px-3 py-3 font-black text-gray-600 align-top text-xs">{lesson.lesson}</td>
      <td className="px-3 py-3 text-gray-700 align-top text-xs max-w-[90px] font-medium">{lesson.strand}</td>
      <td className="px-3 py-3 text-gray-700 align-top text-xs max-w-[90px]">{lesson.substrand}</td>
      <td className="px-3 py-3 align-top">
        {expanded
          ? <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">{lesson.learningOutcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
          : <span className="text-xs text-gray-500 line-clamp-2">{lesson.learningOutcomes[0]}</span>}
      </td>
      <td className="px-3 py-3 align-top">
        {expanded
          ? <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">{lesson.learningExperiences.map((e, i) => <li key={i}>{e}</li>)}</ul>
          : <span className="text-xs text-gray-500 line-clamp-1">{lesson.learningExperiences[0]}</span>}
      </td>
      <td className="px-3 py-3 align-top">
        {expanded
          ? <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">{lesson.keyInquiryQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          : <span className="text-xs text-gray-500 line-clamp-1">{lesson.keyInquiryQuestions[0]}</span>}
      </td>
      <td className="px-3 py-3 align-top">
        {expanded
          ? <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">{lesson.learningResources.map((r, i) => <li key={i}>{r}</li>)}</ul>
          : <span className="text-xs text-gray-500 line-clamp-1">{lesson.learningResources.join(', ')}</span>}
      </td>
      <td className="px-3 py-3 align-top">
        <span className="text-xs text-gray-600">{lesson.assessmentMethods.join(', ')}</span>
      </td>
      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
        <textarea rows={expanded ? 3 : 1} value={reflection} onChange={e => onReflectionChange(e.target.value)}
          placeholder="Reflection..." className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:border-indigo-400 min-w-[80px] bg-white" />
      </td>
    </tr>
  )
}

// ─── Strand checkbox with indeterminate support ───────────────────────────────

function StrandCheckbox({ checked, indeterminate, color }: { checked: boolean; indeterminate: boolean; color: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <div className="relative w-5 h-5 shrink-0" onClick={e => e.stopPropagation()}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={() => {}}
        className="peer sr-only"
        readOnly
      />
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
        ${checked || indeterminate ? 'bg-white/25 border-white' : 'bg-white/10 border-white/40'}`}>
        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
        {indeterminate && !checked && <span className="w-2.5 h-0.5 bg-white rounded-full block" />}
      </div>
    </div>
  )
}
