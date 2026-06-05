'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getCurriculumConfig, getGradeColor, getGradeLabel } from '@/lib/curriculum'
import { marksToLevel, levelToLabel, levelToColor, type CBCLevel } from '@/lib/assessments/gradeCalculator'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student {
  id: string
  name: string
  grade: number
  current_pathway?: string | null
  curriculum_type?: string | null
  year_level?: string | null
  user_id: string
}

// ─── Subject definitions (CBC — unchanged) ────────────────────────────────────

// Junior School (Grades 7-9) — 8 core + 1 religious
const JUNIOR_CORE = [
  { key: 'mathematics',          label: 'Mathematics',             emoji: '🔢' },
  { key: 'english',              label: 'English',                 emoji: '📚' },
  { key: 'kiswahili',            label: 'Kiswahili',               emoji: '🗣️' },
  { key: 'integrated_science',   label: 'Integrated Science',      emoji: '🔬' },
  { key: 'social_studies',       label: 'Social Studies',          emoji: '🌍' },
  { key: 'pre_technical_studies',label: 'Pre-Technical Studies',   emoji: '⚙️' },
  { key: 'creative_arts_sports', label: 'Creative Arts & Sports',  emoji: '🎨' },
  { key: 'agriculture_nutrition',label: 'Agriculture & Nutrition', emoji: '🌾' },
]

const JUNIOR_RELIGIOUS = [
  { key: 'cre', label: 'Christian Religious Education', emoji: '⛪' },
  { key: 'ire', label: 'Islamic Religious Education',   emoji: '🕌' },
  { key: 'hre', label: 'Hindu Religious Education',     emoji: '🕉️' },
]

// Senior School — compulsory 3 (Math is separate)
const SENIOR_COMPULSORY = [
  { key: 'english',                   label: 'English',                   emoji: '📚' },
  { key: 'kiswahili_ksl',             label: 'Kiswahili / KSL',           emoji: '🗣️' },
  { key: 'community_service_learning',label: 'Community Service Learning',emoji: '❤️' },
]

// Senior pathway electives
const PATHWAY_ELECTIVES: Record<string, { key: string; label: string; emoji: string }[]> = {
  'STEM': [
    { key: 'biology',              label: 'Biology',                      emoji: '🧬' },
    { key: 'chemistry',            label: 'Chemistry',                    emoji: '⚗️' },
    { key: 'physics',              label: 'Physics',                      emoji: '⚡' },
    { key: 'general_science',      label: 'General Science',              emoji: '🔬' },
    { key: 'agriculture',          label: 'Agriculture',                  emoji: '🌱' },
    { key: 'computer_studies',     label: 'Computer Studies',             emoji: '💻' },
    { key: 'home_science',         label: 'Home Science',                 emoji: '🏠' },
    { key: 'drawing_design',       label: 'Drawing & Design',             emoji: '✏️' },
    { key: 'aviation_technology',  label: 'Aviation Technology',          emoji: '✈️' },
    { key: 'building_construction',label: 'Building & Construction',      emoji: '🏗️' },
    { key: 'electrical_technology',label: 'Electrical Technology',        emoji: '⚡' },
    { key: 'metal_technology',     label: 'Metal Technology',             emoji: '🔧' },
    { key: 'power_machines',       label: 'Power Machines',               emoji: '⚙️' },
    { key: 'wood_technology',      label: 'Wood Technology',              emoji: '🪚' },
    { key: 'media_technology',     label: 'Media Technology',             emoji: '📹' },
    { key: 'marine_fisheries',     label: 'Marine & Fisheries Technology',emoji: '🐟' },
  ],
  'Social Sciences': [
    { key: 'advanced_english',     label: 'Advanced English',             emoji: '📖' },
    { key: 'literature_english',   label: 'Literature in English',        emoji: '📝' },
    { key: 'indigenous_language',  label: 'Indigenous Language',          emoji: '🗣️' },
    { key: 'kiswahili_kipevu',     label: 'Kiswahili Kipevu',             emoji: '📚' },
    { key: 'fasihi_kiswahili',     label: 'Fasihi ya Kiswahili',          emoji: '✍️' },
    { key: 'sign_language',        label: 'Sign Language',                emoji: '🤟' },
    { key: 'arabic',               label: 'Arabic',                       emoji: '🕋' },
    { key: 'french',               label: 'French',                       emoji: '🥖' },
    { key: 'german',               label: 'German',                       emoji: '🍺' },
    { key: 'mandarin',             label: 'Mandarin Chinese',             emoji: '🥢' },
    { key: 'history_citizenship',  label: 'History & Citizenship',        emoji: '📜' },
    { key: 'geography',            label: 'Geography',                    emoji: '🗺️' },
    { key: 'cre',                  label: 'Christian Religious Education',emoji: '⛪' },
    { key: 'ire',                  label: 'Islamic Religious Education',  emoji: '🕌' },
    { key: 'hre',                  label: 'Hindu Religious Education',    emoji: '🕉️' },
    { key: 'business_studies',     label: 'Business Studies',             emoji: '💼' },
  ],
  'Arts & Sports Science': [
    { key: 'sports_recreation',    label: 'Sports and Recreation',        emoji: '⚽' },
    { key: 'physical_education',   label: 'Physical Education',           emoji: '🏃' },
    { key: 'music_dance',          label: 'Music and Dance',              emoji: '🎵' },
    { key: 'theatre_film',         label: 'Theatre and Film',             emoji: '🎭' },
    { key: 'fine_arts',            label: 'Fine Arts',                    emoji: '🎨' },
  ],
}

function getPathwayElectives(pathway: string) {
  return PATHWAY_ELECTIVES[pathway] || []
}

// ─── IGCSE constants ──────────────────────────────────────────────────────────
const IGCSE_ASSESSMENT_STYLES = [
  { value: 'end_of_term',         label: 'End of Term',         emoji: '📚' },
  { value: 'mock_exam',           label: 'Mock Exam',           emoji: '📝' },
  { value: 'cambridge_predicted', label: 'Cambridge Predicted', emoji: '🎯' },
  { value: 'summative',           label: 'Internal Exam',       emoji: '📋' },
]

// ─── CBC Score button component ───────────────────────────────────────────────
function ScoreButtons({
  subjectKey,
  label,
  emoji,
  scores,
  onScore,
}: {
  subjectKey: string
  label: string
  emoji?: string
  scores: Record<string, number>
  onScore: (key: string, value: number) => void
}) {
  const scored = scores[subjectKey]

  return (
    <div className={`p-4 rounded-2xl border-2 transition-all ${
      scored ? 'bg-white border-black' : 'bg-white border-slate-100'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        {emoji && <span className="text-xl">{emoji}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-slate-500 uppercase truncate">{label}</div>
          {scored && (
            <div className="text-xs text-green-600 font-bold">
              {scored === 1 ? 'Emerging' : scored === 2 ? 'Developing' : scored === 3 ? 'Proficient' : 'Exemplary'} ✓
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onScore(subjectKey, v)}
            className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${
              scores[subjectKey] === v
                ? 'bg-black text-white shadow-lg scale-105'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Marks input component (0-100 → auto level) ──────────────────────────────
function MarksScoreInput({
  subjectKey,
  label,
  emoji,
  rawMarks,
  scores,
  onMark,
}: {
  subjectKey: string
  label:      string
  emoji?:     string
  rawMarks:   Record<string, number | ''>
  scores:     Record<string, number>
  onMark:     (key: string, raw: number | '') => void
}) {
  const raw   = rawMarks[subjectKey] ?? ''
  const level = scores[subjectKey] as CBCLevel | undefined

  return (
    <div className={`p-4 rounded-2xl border-2 transition-all ${level ? 'bg-white border-black' : 'bg-white border-slate-100'}`}>
      <div className="flex items-center gap-2 mb-3">
        {emoji && <span className="text-xl">{emoji}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-slate-500 uppercase truncate">{label}</div>
          {level && (
            <div className="text-xs font-bold" style={{ color: levelToColor(level) }}>
              L{level} — {levelToLabel(level)} ✓
            </div>
          )}
        </div>
        {level && (
          <span
            className="text-xs font-black px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: levelToColor(level) }}
          >
            L{level}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          value={raw}
          onChange={e => {
            const v = e.target.value === '' ? '' : Number(e.target.value)
            onMark(subjectKey, v)
          }}
          placeholder="0–100"
          className="w-20 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-black text-center focus:border-black focus:outline-none"
        />
        <span className="text-xs text-slate-400 font-medium">
          75+ L4 · 50-74 L3 · 30-49 L2 · 0-29 L1
        </span>
      </div>
    </div>
  )
}

// ─── IGCSE Score button component ─────────────────────────────────────────────
function IGCSEScoreButtons({
  subjectId,
  label,
  scores,
  onScore,
}: {
  subjectId: string
  label: string
  scores: Record<string, string>
  onScore: (id: string, grade: string) => void
}) {
  const config  = getCurriculumConfig('igcse')
  const scored  = scores[subjectId]
  const color   = scored ? getGradeColor('igcse', scored) : null
  const glLabel = scored ? getGradeLabel('igcse', scored) : null

  return (
    <div className={`p-4 rounded-2xl border-2 transition-all ${
      scored ? 'bg-white border-black' : 'bg-white border-slate-100'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-slate-500 uppercase truncate">{label}</div>
          {scored && color && glLabel && (
            <div className="text-xs font-bold" style={{ color }}>
              {scored} — {glLabel} ✓
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {config.gradeLabels.map(gl => {
          const val = String(gl.value)
          const isSelected = scored === val
          return (
            <button
              key={val}
              type="button"
              onClick={() => onScore(subjectId, val)}
              className={`flex-1 min-w-[2.2rem] py-2 rounded-xl font-black text-xs transition-all ${
                isSelected
                  ? 'text-white shadow-lg scale-105'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
              }`}
              style={isSelected ? { backgroundColor: gl.color } : {}}
            >
              {val}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function AddAssessmentContent() {
  const supabase    = createClient()
  const router      = useRouter()
  const searchParams = useSearchParams()

  const [students,           setStudents]           = useState<Student[]>([])
  const [selectedStudent,    setSelectedStudent]    = useState<string>('')
  const [currentStudent,     setCurrentStudent]     = useState<Student | null>(null)
  const [term,               setTerm]               = useState<number>(1)
  const [year,               setYear]               = useState<number>(new Date().getFullYear())
  const [scores,             setScores]             = useState<Record<string, number>>({})
  const [mathType,           setMathType]           = useState<'core' | 'essential'>('essential')
  const [selectedElectives,  setSelectedElectives]  = useState<string[]>([])
  const [selectedReligion,   setSelectedReligion]   = useState<string>('')
  const [loading,            setLoading]            = useState(false)
  const [error,              setError]              = useState<string | null>(null)

  // Marks mode (CBC only)
  const [inputMode, setInputMode] = useState<'marks' | 'levels'>('marks')
  const [rawMarks,  setRawMarks]  = useState<Record<string, number | ''>>({})

  function setRawMark(key: string, raw: number | '') {
    setRawMarks(prev => ({ ...prev, [key]: raw }))
    if (raw !== '' && raw >= 0 && raw <= 100) {
      setScores(prev => ({ ...prev, [key]: marksToLevel(raw) }))
    } else {
      setScores(prev => { const next = { ...prev }; delete next[key]; return next })
    }
  }

  // IGCSE state
  const [igcseSelectedSubjects, setIgcseSelectedSubjects] = useState<string[]>([])
  const [igcseScores,           setIgcseScores]           = useState<Record<string, string>>({})
  const [assessmentStyle,       setAssessmentStyle]       = useState<string>('end_of_term')
  const [dreamCareer,           setDreamCareer]           = useState<string>('')

  // ── Load students ───────────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (data) setStudents(data)
  }, [router, supabase])

  useEffect(() => {
    loadStudents()
    const studentId = searchParams.get('student')
    if (studentId) setSelectedStudent(studentId)
  }, [searchParams, loadStudents])

  // ── When student changes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedStudent) return
    const student = students.find(s => s.id === selectedStudent)
    setCurrentStudent(student || null)
    setScores({})
    setSelectedElectives([])
    setSelectedReligion('')
    setMathType(student?.current_pathway === 'STEM' ? 'core' : 'essential')
    setIgcseScores({})

    // Pre-select compulsory IGCSE subjects
    if (student?.curriculum_type === 'igcse') {
      const phase = student.grade <= 9 ? 'junior' : 'senior'
      const config = getCurriculumConfig('igcse')
      const phaseSubjects = config.phases.find(p => p.phaseType === phase)?.subjects || []
      const compulsory = phaseSubjects.filter(s => s.isCompulsory).map(s => s.id)
      setIgcseSelectedSubjects(compulsory)
    } else {
      setIgcseSelectedSubjects([])
    }
  }, [selectedStudent, students])

  const isJunior = !!currentStudent && currentStudent.grade >= 7 && currentStudent.grade <= 9
  const isSenior = !!currentStudent && currentStudent.grade >= 10 && currentStudent.grade <= 12
  const isIGCSE  = currentStudent?.curriculum_type === 'igcse'

  // IGCSE phase subjects
  const igcsePhase = isIGCSE && currentStudent
    ? getCurriculumConfig('igcse').phases.find(p => p.phaseType === (isJunior ? 'junior' : 'senior'))
    : null
  const igcsePhaseSubjects = igcsePhase?.subjects || []

  // Group IGCSE subjects by group (for senior phase)
  const igcseGroups: Record<string, typeof igcsePhaseSubjects> = {}
  for (const s of igcsePhaseSubjects) {
    const g = s.group ?? 'Other'
    if (!igcseGroups[g]) igcseGroups[g] = []
    igcseGroups[g].push(s)
  }

  const setScore = (key: string, value: number) =>
    setScores(prev => ({ ...prev, [key]: value }))

  const setIgcseScore = (id: string, grade: string) =>
    setIgcseScores(prev => ({ ...prev, [id]: grade }))

  const toggleIgcseSubject = (id: string, isCompulsory: boolean) => {
    if (isCompulsory) return // Can't deselect compulsory
    setIgcseSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
    // Remove score if deselected
    setIgcseScores(prev => {
      if (igcseSelectedSubjects.includes(id)) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return prev
    })
  }

  const toggleElective = (key: string) => {
    if (selectedElectives.includes(key)) {
      setSelectedElectives(p => p.filter(e => e !== key))
    } else if (selectedElectives.length < 3) {
      setSelectedElectives(p => [...p, key])
    } else {
      setError('Maximum 3 electives only!')
      setTimeout(() => setError(null), 3000)
    }
  }

  // ── Progress counts ─────────────────────────────────────────────────────────
  const juniorScoredCount  = JUNIOR_CORE.filter(s => scores[s.key]).length +
                             (selectedReligion && scores[selectedReligion] ? 1 : 0)
  const juniorTotalNeeded  = JUNIOR_CORE.length + 1
  const seniorScoredCount  = SENIOR_COMPULSORY.filter(s => scores[s.key]).length +
                             (scores[mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'] ? 1 : 0) +
                             selectedElectives.filter(e => scores[e]).length
  const igcseScoredCount   = igcseSelectedSubjects.filter(id => igcseScores[id]).length

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    try {
      if (!selectedStudent || !currentStudent) throw new Error('Select a student first')

      // ── IGCSE submit ───────────────────────────────────────────────────────
      if (isIGCSE) {
        if (igcseSelectedSubjects.length === 0) {
          throw new Error('Select at least one subject')
        }
        const unscored = igcseSelectedSubjects.filter(id => !igcseScores[id])
        if (unscored.length > 0) {
          const names = unscored
            .map(id => igcsePhaseSubjects.find(s => s.id === id)?.displayName ?? id)
            .join(', ')
          throw new Error(`Please grade all selected subjects. Missing: ${names}`)
        }

        const assessmentData = {
          student_id:       selectedStudent,
          grade:            currentStudent.grade,
          term:             1, // placeholder for IGCSE
          year,
          grade_level:      isJunior ? 'junior' : 'senior',
          subject_scores:   igcseScores,
          curriculum_type:  'igcse',
          assessment_style: assessmentStyle,
          mathematics_type: null,
          pathway_electives: null,
        }

        const { error: insertError } = await supabase.from('assessments').insert(assessmentData)
        if (insertError) throw insertError

        router.push(`/dashboard/clinic/reports/${selectedStudent}`)
        return
      }

      // ── CBC Junior validation ──────────────────────────────────────────────
      if (isJunior) {
        const missedCore = JUNIOR_CORE.filter(s => !scores[s.key]).map(s => s.label)
        if (missedCore.length > 0) {
          throw new Error(`Please score all core subjects. Missing: ${missedCore.join(', ')}`)
        }
        if (!selectedReligion) {
          throw new Error('Please select a Religious Education subject (CRE / IRE / HRE)')
        }
        if (!scores[selectedReligion]) {
          throw new Error('Please score your selected Religious Education subject')
        }
      }

      // ── CBC Senior validation ──────────────────────────────────────────────
      if (isSenior) {
        if (!currentStudent.current_pathway) {
          throw new Error('This student needs a pathway set. Go to Dashboard → edit student.')
        }
        if (selectedElectives.length !== 3) {
          throw new Error(`Select exactly 3 electives (you have ${selectedElectives.length})`)
        }
        const mathKey      = mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'
        const requiredKeys = [...SENIOR_COMPULSORY.map(s => s.key), mathKey, ...selectedElectives]
        const missingLabels = requiredKeys.filter(k => !scores[k])
        if (missingLabels.length > 0) {
          throw new Error(`Score all 7 subjects. Missing ${missingLabels.length} subject(s).`)
        }
      }

      // ── CBC Build data ─────────────────────────────────────────────────────
      const finalScores = { ...scores }

      if (isJunior && selectedReligion) {
        finalScores[selectedReligion] = scores[selectedReligion]
        JUNIOR_RELIGIOUS.forEach(r => {
          if (r.key !== selectedReligion) delete finalScores[r.key]
        })
      }

      const assessmentData: Record<string, unknown> = {
        student_id:        selectedStudent,
        grade:             currentStudent.grade,
        term,
        year,
        grade_level:       isJunior ? 'junior' : 'senior',
        subject_scores:    finalScores,
        curriculum_type:   'cbc',
        assessment_style:  'formative',
        mathematics_type:  isSenior ? mathType : null,
        pathway_electives: isSenior ? selectedElectives : null,
        source:            'parent',
        raw_marks:         inputMode === 'marks' ? rawMarks : {},
      }

      const { error: insertError } = await supabase
        .from('assessments')
        .insert(assessmentData)

      if (insertError) throw insertError

      // Save dream career separately — stored in interests JSONB as { dream_career: "..." }
      if (dreamCareer.trim()) {
        const { error: interestsError } = await supabase
          .from('student_interests')
          .upsert(
            { student_id: selectedStudent, interests: { dream_career: dreamCareer.trim() } },
            { onConflict: 'student_id' }
          )
        if (interestsError) console.error('[assessments/add] dream career save failed:', interestsError.message)
      }

      router.push(`/dashboard/clinic/reports/${selectedStudent}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 flex-wrap">
          <Link href="/dashboard" className="text-sm font-black uppercase tracking-wider hover:underline">
            ← Dashboard
          </Link>
          {currentStudent && (
            <div className="text-sm font-black text-slate-500 uppercase flex items-center gap-2">
              {currentStudent.name}
              {currentStudent.curriculum_type === 'igcse'
                ? <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs normal-case font-bold">🌍 IGCSE · Year {currentStudent.grade}</span>
                : <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs normal-case font-bold">🇰🇪 CBC · Grade {currentStudent.grade}</span>
              }
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-black mb-2 uppercase">New Assessment</h1>
        <div className="h-2 w-32 bg-black mb-12" />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-100 border-4 border-red-600 text-red-900 p-5 rounded-3xl mb-8 font-black">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── STEP 1: Assessment info ─────────────────────────────────────────── */}
        <section className="mb-10 p-8 bg-slate-50 rounded-3xl border-2 border-slate-200">
          <h2 className="text-xs font-black mb-6 uppercase tracking-widest text-slate-400">
            Step 1 — Assessment Info
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Student */}
            <div>
              <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Student</label>
              <select
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
                className="w-full p-4 bg-white rounded-xl font-bold border-2 border-slate-200 focus:border-black focus:outline-none text-slate-900"
              >
                <option value="">— Choose student —</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.curriculum_type === 'igcse' ? `Year ${s.grade}` : `Grade ${s.grade}`})
                  </option>
                ))}
              </select>
              {students.length === 0 && (
                <p className="text-xs text-slate-400 mt-2 font-bold">
                  No students yet.{' '}
                  <Link href="/dashboard/clinic" className="underline">Add one →</Link>
                </p>
              )}
            </div>

            {/* Term / Assessment style */}
            <div>
              <label className="block text-xs font-black text-slate-400 mb-2 uppercase">
                {isIGCSE ? 'Assessment Type' : 'Term'}
              </label>
              {isIGCSE ? (
                <select
                  value={assessmentStyle}
                  onChange={e => setAssessmentStyle(e.target.value)}
                  className="w-full p-4 bg-white rounded-xl font-bold border-2 border-slate-200 focus:border-black focus:outline-none text-slate-900"
                >
                  {IGCSE_ASSESSMENT_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={term}
                  onChange={e => setTerm(Number(e.target.value))}
                  className="w-full p-4 bg-white rounded-xl font-bold border-2 border-slate-200 focus:border-black focus:outline-none text-slate-900"
                >
                  <option value={1}>Term 1</option>
                  <option value={2}>Term 2</option>
                  <option value={3}>Term 3</option>
                </select>
              )}
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Year</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                min={2020}
                max={2035}
                className="w-full p-4 bg-white rounded-xl font-bold border-2 border-slate-200 focus:border-black focus:outline-none text-slate-900"
              />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── IGCSE FLOW ──────────────────────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isIGCSE && currentStudent && (
          <div className="space-y-8">

            {/* IGCSE Banner */}
            <div className="flex items-center justify-between p-6 bg-indigo-50 rounded-3xl border-4 border-indigo-200">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🌍</span>
                <div>
                  <h2 className="text-2xl font-black uppercase text-indigo-900">Cambridge IGCSE</h2>
                  <p className="text-sm font-bold text-indigo-600">
                    Year {currentStudent.grade} · {isJunior ? 'Lower Secondary (Key Stage 3)' : 'IGCSE Upper Secondary'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-indigo-800">
                  {igcseScoredCount}/{igcseSelectedSubjects.length}
                </div>
                <div className="text-xs font-bold text-indigo-600">Subjects Graded</div>
              </div>
            </div>

            {/* Subject selection */}
            <section className="p-8 bg-blue-50 rounded-3xl border-2 border-blue-200">
              <h2 className="text-xs font-black mb-1 uppercase tracking-widest text-blue-400">
                Step 2 — Which Subjects Is Your Child Taking?
              </h2>
              <p className="text-xs text-blue-500 font-bold mb-6">
                Compulsory subjects are pre-selected. Add any optional subjects.
              </p>

              {/* Junior: flat list */}
              {isJunior && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {igcsePhaseSubjects.map(subject => {
                    const isSelected = igcseSelectedSubjects.includes(subject.id)
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => toggleIgcseSubject(subject.id, subject.isCompulsory)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                          isSelected
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'
                        } ${subject.isCompulsory ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-white border-white' : 'border-blue-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-700" />}
                        </div>
                        <span className="text-sm font-bold">{subject.displayName}</span>
                        {subject.isCompulsory && (
                          <span className="text-xs opacity-70 ml-auto">Required</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Senior: grouped */}
              {!isJunior && (
                <div className="space-y-6">
                  {Object.entries(igcseGroups).map(([group, subjects]) => (
                    <div key={group}>
                      <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-3">
                        {group}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {subjects.map(subject => {
                          const isSelected = igcseSelectedSubjects.includes(subject.id)
                          return (
                            <button
                              key={subject.id}
                              type="button"
                              onClick={() => toggleIgcseSubject(subject.id, subject.isCompulsory)}
                              className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                                isSelected
                                  ? 'bg-blue-700 text-white border-blue-700'
                                  : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'
                              } ${subject.isCompulsory ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-white border-white' : 'border-blue-300'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-700" />}
                              </div>
                              <span className="text-sm font-bold truncate">{subject.displayName}</span>
                              {subject.isCompulsory && (
                                <span className="text-xs opacity-70 ml-auto flex-shrink-0">Required</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* IGCSE Grade inputs */}
            {igcseSelectedSubjects.length > 0 && (
              <section className="p-8 bg-white rounded-3xl border-2 border-slate-200">
                <h2 className="text-xs font-black mb-1 uppercase tracking-widest text-slate-400">
                  Step 3 — Enter Grades
                </h2>
                <p className="text-xs text-slate-500 font-bold mb-6">
                  Cambridge grades: A* (highest) → U (ungraded)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {igcseSelectedSubjects.map(subjectId => {
                    const subject = igcsePhaseSubjects.find(s => s.id === subjectId)
                    if (!subject) return null
                    return (
                      <IGCSEScoreButtons
                        key={subjectId}
                        subjectId={subjectId}
                        label={subject.displayName}
                        scores={igcseScores}
                        onScore={setIgcseScore}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {/* IGCSE Grade guide */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <p className="text-xs font-black text-slate-400 uppercase mb-3">Cambridge Grade Guide</p>
              <div className="flex flex-wrap gap-2">
                {getCurriculumConfig('igcse').gradeLabels.map(gl => (
                  <div
                    key={String(gl.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                    style={{ backgroundColor: gl.color }}
                  >
                    <span className="font-black">{String(gl.value)}</span>
                    <span className="opacity-80">{gl.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Input mode toggle (CBC only) ────────────────────────────────── */}
        {!isIGCSE && currentStudent && (
          <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 rounded-2xl border-2 border-slate-200">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Enter scores as:</span>
            <div className="flex gap-1 bg-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setInputMode('marks')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${inputMode === 'marks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Marks (0–100)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('levels')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${inputMode === 'levels' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Levels (1–4)
              </button>
            </div>
            {inputMode === 'marks' && (
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">75+ → L4 · 50-74 → L3 · 30-49 → L2 · 0-29 → L1</span>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── CBC FLOW ────────────────────────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* ── CBC JUNIOR SCHOOL ───────────────────────────────────────────── */}
        {!isIGCSE && isJunior && currentStudent && (
          <div className="space-y-8">

            {/* Banner */}
            <div className="flex items-center justify-between p-6 bg-green-50 rounded-3xl border-4 border-green-200">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎯</span>
                <div>
                  <h2 className="text-2xl font-black uppercase text-green-900">Junior School</h2>
                  <p className="text-sm font-bold text-green-600">
                    Grade {currentStudent.grade} · Pathway guidance will be generated
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-green-800">
                  {juniorScoredCount}/{juniorTotalNeeded}
                </div>
                <div className="text-xs font-bold text-green-600">Subjects Scored</div>
              </div>
            </div>

            {/* Core subjects */}
            <section className="p-8 bg-blue-50 rounded-3xl border-2 border-blue-200">
              <h2 className="text-xs font-black mb-1 uppercase tracking-widest text-blue-400">
                Step 2 — Core Subjects (8)
              </h2>
              <p className="text-xs text-blue-500 font-bold mb-6">All 8 required</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {JUNIOR_CORE.map(subject => (
                  inputMode === 'marks' ? (
                    <MarksScoreInput key={subject.key} subjectKey={subject.key} label={subject.label} emoji={subject.emoji} rawMarks={rawMarks} scores={scores} onMark={setRawMark} />
                  ) : (
                    <ScoreButtons key={subject.key} subjectKey={subject.key} label={subject.label} emoji={subject.emoji} scores={scores} onScore={setScore} />
                  )
                ))}
              </div>
            </section>

            {/* Religious education */}
            <section className="p-8 bg-rose-50 rounded-3xl border-2 border-rose-200">
              <h2 className="text-xs font-black mb-1 uppercase tracking-widest text-rose-400">
                Step 3 — Religious Education (Choose 1)
              </h2>
              <p className="text-xs text-rose-500 font-bold mb-6">Select one then score it</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {JUNIOR_RELIGIOUS.map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      if (selectedReligion && selectedReligion !== r.key) {
                        setScores(prev => {
                          const next = { ...prev }
                          delete next[selectedReligion]
                          return next
                        })
                      }
                      setSelectedReligion(r.key)
                    }}
                    className={`p-4 rounded-2xl border-2 text-center transition-all ${
                      selectedReligion === r.key
                        ? 'bg-rose-700 text-white border-rose-700 scale-105 shadow-lg'
                        : 'bg-white text-rose-700 border-rose-200 hover:border-rose-400'
                    }`}
                  >
                    <div className="text-2xl mb-1">{r.emoji}</div>
                    <div className="text-xs font-black">{r.label}</div>
                  </button>
                ))}
              </div>

              {selectedReligion && (
                <div className="max-w-sm">
                  {inputMode === 'marks' ? (
                    <MarksScoreInput subjectKey={selectedReligion} label={JUNIOR_RELIGIOUS.find(r => r.key === selectedReligion)?.label || ''} emoji={JUNIOR_RELIGIOUS.find(r => r.key === selectedReligion)?.emoji} rawMarks={rawMarks} scores={scores} onMark={setRawMark} />
                  ) : (
                    <ScoreButtons subjectKey={selectedReligion} label={JUNIOR_RELIGIOUS.find(r => r.key === selectedReligion)?.label || ''} emoji={JUNIOR_RELIGIOUS.find(r => r.key === selectedReligion)?.emoji} scores={scores} onScore={setScore} />
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── CBC SENIOR SCHOOL ───────────────────────────────────────────── */}
        {!isIGCSE && isSenior && currentStudent && (
          <div className="space-y-8">

            {/* Banner */}
            <div className="flex items-center justify-between p-6 bg-purple-50 rounded-3xl border-4 border-purple-200">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎓</span>
                <div>
                  <h2 className="text-2xl font-black uppercase text-purple-900">Senior School</h2>
                  <p className="text-sm font-bold text-purple-600">
                    Grade {currentStudent.grade} · 7 subjects required
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {currentStudent.current_pathway ? (
                  <div className="px-5 py-2 bg-purple-900 text-white rounded-full font-black text-sm">
                    {currentStudent.current_pathway}
                  </div>
                ) : (
                  <div className="px-5 py-2 bg-red-600 text-white rounded-full font-black text-sm">
                    ⚠️ No Pathway Set
                  </div>
                )}
                <div className="text-right">
                  <div className="text-2xl font-black text-purple-800">
                    {seniorScoredCount}/7
                  </div>
                  <div className="text-xs font-bold text-purple-600">Scored</div>
                </div>
              </div>
            </div>

            {!currentStudent.current_pathway ? (
              <div className="p-8 bg-red-50 rounded-3xl border-4 border-red-300 text-center">
                <div className="text-6xl mb-4">🚫</div>
                <h3 className="text-2xl font-black text-red-900 mb-2">Pathway Required!</h3>
                <p className="text-red-700 font-bold mb-6">
                  Edit this student's profile to set their pathway (STEM / Social Sciences / Arts & Sports Science).
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block px-8 py-4 bg-red-600 text-white rounded-full font-black"
                >
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              <>
                {/* Part 1: Compulsory */}
                <section className="p-8 bg-green-50 rounded-3xl border-2 border-green-200">
                  <h2 className="text-xs font-black mb-1 uppercase tracking-widest text-green-400">
                    Step 2 — Compulsory Subjects (4)
                  </h2>
                  <p className="text-xs text-green-600 font-bold mb-6">
                    Required for ALL students regardless of pathway
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SENIOR_COMPULSORY.map(subject => (
                      inputMode === 'marks' ? (
                        <MarksScoreInput key={subject.key} subjectKey={subject.key} label={subject.label} emoji={subject.emoji} rawMarks={rawMarks} scores={scores} onMark={setRawMark} />
                      ) : (
                        <ScoreButtons key={subject.key} subjectKey={subject.key} label={subject.label} emoji={subject.emoji} scores={scores} onScore={setScore} />
                      )
                    ))}

                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between p-4 bg-yellow-100 rounded-2xl mb-3 border-2 border-yellow-300">
                        <div>
                          <div className="text-xs font-black text-yellow-800 uppercase">
                            Mathematics — auto-set by pathway
                          </div>
                          <div className="text-sm font-bold text-yellow-700 mt-1">
                            {currentStudent.current_pathway === 'STEM'
                              ? '📐 Core Mathematics (STEM)'
                              : '📊 Essential Mathematics (Non-STEM)'}
                          </div>
                        </div>
                        <span className="text-3xl">
                          {currentStudent.current_pathway === 'STEM' ? '🔬' : '🎨'}
                        </span>
                      </div>
                      <div className="max-w-sm">
                        {inputMode === 'marks' ? (
                          <MarksScoreInput subjectKey={mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'} label={mathType === 'core' ? 'Core Mathematics' : 'Essential Mathematics'} emoji={mathType === 'core' ? '📐' : '📊'} rawMarks={rawMarks} scores={scores} onMark={setRawMark} />
                        ) : (
                          <ScoreButtons subjectKey={mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'} label={mathType === 'core' ? 'Core Mathematics' : 'Essential Mathematics'} emoji={mathType === 'core' ? '📐' : '📊'} scores={scores} onScore={setScore} />
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Part 2: Pathway electives */}
                <section className="p-8 bg-purple-50 rounded-3xl border-2 border-purple-200">
                  <h2 className="text-xs font-black mb-1 uppercase tracking-widest text-purple-400">
                    Step 3 — {currentStudent.current_pathway} Electives
                  </h2>
                  <p className="text-xs font-black text-purple-400 mb-6 uppercase">
                    Choose exactly 3 • Selected: {selectedElectives.length}/3
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {getPathwayElectives(currentStudent.current_pathway).map(elective => (
                      <button
                        key={elective.key}
                        type="button"
                        onClick={() => toggleElective(elective.key)}
                        className={`p-3 rounded-2xl text-left text-xs font-black border-2 transition-all ${
                          selectedElectives.includes(elective.key)
                            ? 'bg-purple-900 text-white border-purple-900 scale-105 shadow-lg'
                            : selectedElectives.length >= 3
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                            : 'bg-white text-purple-600 border-purple-200 hover:border-purple-500 hover:bg-purple-50'
                        }`}
                        disabled={selectedElectives.length >= 3 && !selectedElectives.includes(elective.key)}
                      >
                        <span className="text-lg mr-1">{elective.emoji}</span>
                        {elective.label}
                        {selectedElectives.includes(elective.key) && (
                          <span className="ml-1 text-white">✓</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedElectives.length > 0 && (
                    <div className="pt-6 border-t-2 border-purple-200">
                      <p className="text-xs font-black text-purple-600 uppercase mb-4">
                        📝 Score your {selectedElectives.length} selected elective{selectedElectives.length > 1 ? 's' : ''}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedElectives.map(key => {
                          const elective = getPathwayElectives(currentStudent.current_pathway!).find(e => e.key === key)
                          if (!elective) return null
                          return inputMode === 'marks' ? (
                            <MarksScoreInput key={key} subjectKey={key} label={elective.label} emoji={elective.emoji} rawMarks={rawMarks} scores={scores} onMark={setRawMark} />
                          ) : (
                            <ScoreButtons key={key} subjectKey={key} label={elective.label} emoji={elective.emoji} scores={scores} onScore={setScore} />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {/* Summary */}
                <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-200">
                  <p className="text-xs font-black text-slate-400 uppercase mb-3">Assessment Summary</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[
                      { value: 4,                        label: 'Compulsory', color: 'text-blue-600'   },
                      { value: selectedElectives.length, label: 'Electives',  color: 'text-purple-600' },
                      { value: seniorScoredCount,        label: 'Scored',     color: 'text-green-600'  },
                      { value: 7,                        label: 'Required',   color: 'text-orange-600' },
                    ].map(({ value, label, color }) => (
                      <div key={label} className="p-3 bg-white rounded-2xl">
                        <div className={`text-3xl font-black ${color}`}>{value}</div>
                        <div className="text-xs font-bold text-slate-500 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CBC Score guide ─────────────────────────────────────────────── */}
        {!isIGCSE && currentStudent && (
          <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-xs font-black text-slate-400 uppercase mb-3">CBC Score Guide</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs font-bold">
              {[
                { v: 1, label: 'Emerging',   bg: 'bg-red-100',    text: 'text-red-700'    },
                { v: 2, label: 'Developing', bg: 'bg-amber-100',  text: 'text-amber-700'  },
                { v: 3, label: 'Proficient', bg: 'bg-green-100',  text: 'text-green-700'  },
                { v: 4, label: 'Exemplary',  bg: 'bg-purple-100', text: 'text-purple-700' },
              ].map(({ v, label, bg, text }) => (
                <div key={v} className={`${bg} ${text} p-2 rounded-xl`}>
                  <div className="text-lg font-black">{v}</div>
                  <div>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Dream Career (optional) ────────────────────────────────────────── */}
        {currentStudent && (
          <div className="mt-8 border-t-2 border-dashed border-slate-200 pt-8">
            <div className="mb-2">
              <label className="block text-sm font-black uppercase tracking-wider text-slate-700 mb-1">
                Dream Career <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                What career does your child dream of? We&apos;ll connect their learning to this goal.
              </p>
              <input
                type="text"
                value={dreamCareer}
                onChange={e => setDreamCareer(e.target.value)}
                placeholder="e.g. Doctor, Engineer, Teacher..."
                maxLength={100}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-medium text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>
        )}

        {/* ── Submit ─────────────────────────────────────────────────────────── */}
        {currentStudent && (
          (!isIGCSE && isSenior ? !!currentStudent.current_pathway : true)
        ) && (
          <div className="mt-10 flex gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-5 bg-slate-100 text-slate-600 rounded-full font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-5 bg-black text-white rounded-full font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Save Assessment
                  {isJunior && ' → Get Pathway Guidance'}
                  {isSenior && ' → Get Career Guidance'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page export with Suspense ────────────────────────────────────────────────
export default function AddAssessmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-black uppercase text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <AddAssessmentContent />
    </Suspense>
  )
}
