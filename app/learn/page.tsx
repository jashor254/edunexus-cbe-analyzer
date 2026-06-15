'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Compass, Send, Trophy, Star, Clock, ChevronRight, BookOpen, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageState = 'student_select' | 'subject_select' | 'active_session' | 'session_complete' | 'needs_assessment'
type Level = 1 | 2 | 3 | 4

interface SubjectCard {
  key:             string
  label:           string
  level:           Level
  recommended:     boolean
  teacherSuggested: boolean
  subtopic:        string | null
}

interface Assignment {
  id:               string
  title:            string
  description:      string | null
  due_date:         string
  daysLeft:         number
  isOverdue:        boolean
  submissionStatus: 'pending' | 'submitted' | 'marked'
  score:            number | null
}

interface StudentData {
  id:        string
  firstName: string
  grade:     number
  subjects:  SubjectCard[]
}

interface Message {
  id:      string
  role:    'student' | 'compass'
  content: string
}

interface StudentSummaryCard {
  id:        string
  firstName: string
  grade:     number
}

type StudentApiResponse = {
  id:              string
  firstName:       string
  grade:           number
  isJunior:        boolean
  pathway:         string | null
  subjects:        Array<{ key: string; level: Level; recommended: boolean; teacherSuggested: boolean; subtopic: string | null }>
  needsAssessment?: boolean
}

type StudentListApiResponse = {
  success:  boolean
  data: {
    picker:   true
    students: StudentSummaryCard[]
  }
}

type LearnApiResponse = {
  success: boolean
  data: {
    text:         string
    evalSummary?: string | null
    sessionId?:   string
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SUBJECT_LABELS: Record<string, string> = {
  // Junior CBC (actual DB keys from subject_tiers)
  mathematics:           'Mathematics',
  english:               'English',
  kiswahili:             'Kiswahili',
  integrated_science:    'Integrated Science',
  social_studies:        'Social Studies',
  agriculture_nutrition: 'Agriculture & Nutrition',
  pre_technical_studies: 'Pre-Technical Studies',
  creative_arts_sports:  'Creative Arts & Sports',
  cre:                   'Christian Religious Education',
  // Senior CBC / 8-4-4
  biology:               'Biology',
  chemistry:             'Chemistry',
  physics:               'Physics',
  history:               'History',
  geography:             'Geography',
  business_studies:      'Business Studies',
  agriculture:           'Agriculture',
  creative_arts:         'Creative Arts',
  pre_technical:         'Pre-Technical Studies',
}

const LEVEL_LABELS: Record<Level, string> = {
  1: 'Beginning',
  2: 'Developing',
  3: 'Proficient',
  4: 'Advanced',
}

const LEVEL_COLORS: Record<Level, string> = {
  1: 'text-red-400',
  2: 'text-amber-400',
  3: 'text-emerald-400',
  4: 'text-sky-400',
}

const SESSION_SECS = 30 * 60
const WARNING_SECS = 5 * 60

// ── Helpers ────────────────────────────────────────────────────────────────────

function toLabel(key: string): string {
  return SUBJECT_LABELS[key]
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Main component ─────────────────────────────────────────────────────────────

function LearnContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const paramStudent = searchParams.get('student')

  // Page state
  const [pageState,   setPageState]   = useState<PageState>('subject_select')
  const [student,     setStudent]     = useState<StudentData | null>(null)
  const [students,    setStudents]    = useState<StudentSummaryCard[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([])

  // Session state
  const [activeSubject,        setActiveSubject]        = useState<SubjectCard | null>(null)
  const [sessionId,            setSessionId]            = useState<string | null>(null)
  const [messages,             setMessages]             = useState<Message[]>([])
  const [conversationHistory,  setConversationHistory]  = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input,           setInput]           = useState('')
  const [isLoading,       setIsLoading]       = useState(false)
  const [exchangeCount,   setExchangeCount]   = useState(0)
  const [startedAt,       setStartedAt]       = useState<number>(0)
  const [timeLeft,        setTimeLeft]        = useState(SESSION_SECS)
  const [showWarning,     setShowWarning]     = useState(false)
  const [sessionSummary,  setSessionSummary]  = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const warningShown   = useRef(false)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load student + subjects via server route (bypasses RLS)
  useEffect(() => {
    const init = async () => {
      const url = paramStudent
        ? `/api/learn/student?studentId=${paramStudent}`
        : '/api/learn/student'
      try {
        const res  = await fetch(url, { credentials: 'include' })
        const json = await res.json() as { success: boolean; data: StudentApiResponse | { picker: true; students: StudentSummaryCard[] } }
        if (!res.ok || !json.success) return

        if ('picker' in json.data && json.data.picker) {
          // Multiple students — show picker screen
          setStudents((json as StudentListApiResponse).data.students)
          setPageState('student_select')
          return
        }

        const d = json.data as StudentApiResponse

        if (d.needsAssessment) {
          setPageState('needs_assessment')
          return
        }

        const studentId = d.id
        setStudent({
          id:        studentId,
          firstName: d.firstName,
          grade:     d.grade,
          subjects:  d.subjects.map(s => ({ ...s, label: toLabel(s.key) })),
        })

        // Fetch assignments in parallel
        fetch(`/api/student/assignments?studentId=${studentId}`, { credentials: 'include' })
          .then(r => r.json())
          .then((aj: { success: boolean; data: { assignments: Assignment[] } }) => {
            if (aj.success) setAssignments(aj.data.assignments ?? [])
          })
          .catch(() => {})
      } catch (err) {
        console.error('[learn] student load failed:', err)
      } finally {
        setDataLoading(false)
      }
    }
    init()
  }, [paramStudent])

  // Called when parent picks a child from the student selector
  const selectStudent = useCallback(async (id: string) => {
    setDataLoading(true)
    try {
      const res  = await fetch(`/api/learn/student?studentId=${id}`, { credentials: 'include' })
      const json = await res.json() as { success: boolean; data: StudentApiResponse }
      if (!res.ok || !json.success) return
      const d = json.data

      if (d.needsAssessment) {
        setPageState('needs_assessment')
        return
      }

      setStudent({
        id:        d.id,
        firstName: d.firstName,
        grade:     d.grade,
        subjects:  d.subjects.map(s => ({ ...s, label: toLabel(s.key) })),
      })
      fetch(`/api/student/assignments?studentId=${d.id}`, { credentials: 'include' })
        .then(r => r.json())
        .then((aj: { success: boolean; data: { assignments: Assignment[] } }) => {
          if (aj.success) setAssignments(aj.data.assignments ?? [])
        })
        .catch(() => {})
      setPageState('subject_select')
    } catch (err) {
      console.error('[learn] student select failed:', err)
    } finally {
      setDataLoading(false)
    }
  }, [])

  // Countdown timer (only while active)
  useEffect(() => {
    if (pageState !== 'active_session' || !startedAt) return

    const id = setInterval(() => {
      const remaining = Math.max(0, SESSION_SECS - Math.floor((Date.now() - startedAt) / 1000))
      setTimeLeft(remaining)

      if (remaining <= WARNING_SECS && !warningShown.current) {
        warningShown.current = true
        setShowWarning(true)
      }

      if (remaining === 0) {
        clearInterval(id)
        setPageState('session_complete')
      }
    }, 1000)

    return () => clearInterval(id)
  }, [pageState, startedAt])

  // Start session — sends the opening message automatically
  const startSession = useCallback(async (card: SubjectCard) => {
    setActiveSubject(card)
    setMessages([])
    setConversationHistory([])
    setExchangeCount(0)
    setSessionSummary(null)
    setSessionId(null)
    setShowWarning(false)
    setTimeLeft(SESSION_SECS)
    warningShown.current = false

    const now = Date.now()
    setStartedAt(now)
    setPageState('active_session')
    setIsLoading(true)

    const opening = card.subtopic
      ? `Let's work on ${card.subtopic} in ${card.label} today.`
      : `Let's begin our ${card.label} session.`

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login?returnTo=/learn'
        return
      }

      const res = await fetch('/api/learn', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:             opening,
          sessionId:           null,
          learnerId:           student?.id ?? null,
          lockedSubject:       card.key,
          lockedSubstrand:     card.subtopic ?? null,
          subjectLevel:        card.level,
          conversationHistory: [],
        }),
      })

      if (!res.ok) return

      const newSessionId = res.headers.get('X-Session-Id')
      if (newSessionId) setSessionId(newSessionId)

      if (!res.body) {
        const json = await res.json() as { success: boolean; data: { text: string; evalSummary?: string | null } }
        if (json.success) {
          setMessages([{ id: `c-${Date.now()}`, role: 'compass', content: json.data.text }])
          setConversationHistory([
            { role: 'user',      content: opening        },
            { role: 'assistant', content: json.data.text },
          ])
          if (json.data.evalSummary) setSessionSummary(json.data.evalSummary)
          setExchangeCount(1)
        }
        return
      }

      const decoder = new TextDecoder()
      const msgId = `c-${Date.now()}`
      let accumulated = ''
      let streamStarted = false

      try {
        const reader = res.body.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            accumulated += chunk
            if (!streamStarted) {
              streamStarted = true
              setIsLoading(false)
            }
            setMessages([{ id: msgId, role: 'compass', content: accumulated }])
          }
        } finally {
          reader.releaseLock()
        }
      } catch (err) {
        console.error('[learn] stream error:', err)
        setMessages([{
          id:      `e-${Date.now()}`,
          role:    'compass',
          content: 'Samahani — kulikuwa na tatizo. Jaribu tena baada ya sekunde chache.',
        }])
        setIsLoading(false)
        return
      }

      if (!streamStarted) return

      // Strip COMPASS_EVAL from display and extract eval summary
      const EVAL_START = 'COMPASS_EVAL_START'
      const EVAL_END   = 'COMPASS_EVAL_END'
      const si = accumulated.indexOf(EVAL_START)
      const ei = accumulated.indexOf(EVAL_END)
      let visibleText = accumulated
      let evalSummary: string | null = null

      if (si !== -1 && ei !== -1 && ei > si) {
        visibleText = (accumulated.slice(0, si) + accumulated.slice(ei + EVAL_END.length)).trim()
        try {
          const ev = JSON.parse(accumulated.slice(si + EVAL_START.length, ei).trim()) as { one_line_summary?: string }
          evalSummary = ev.one_line_summary ?? null
        } catch { /* malformed eval JSON */ }
      }

      setMessages([{ id: msgId, role: 'compass', content: visibleText }])
      setConversationHistory([
        { role: 'user',      content: opening    },
        { role: 'assistant', content: visibleText },
      ])
      if (evalSummary) setSessionSummary(evalSummary)
      setExchangeCount(1)
    } catch {
      // Non-fatal — user can type first message manually
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [student])

  // Send message
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading || !activeSubject) return

    setInput('')
    setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: 'student', content: text }])
    setIsLoading(true)

    // Build history snapshot synchronously — state setter is async so we can't read
    // the updated value from state yet.
    const historyForRequest = [...conversationHistory, { role: 'user' as const, content: text }]

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login?returnTo=/learn'
        return
      }

      const res = await fetch('/api/learn', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:             text,
          sessionId,
          learnerId:           student?.id ?? null,
          lockedSubject:       activeSubject.key,
          lockedSubstrand:     activeSubject.subtopic ?? null,
          subjectLevel:        activeSubject.level,
          conversationHistory: historyForRequest,
        }),
      })

      if (!res.ok) {
        setMessages(prev => [...prev, {
          id:      `err-${Date.now()}`,
          role:    'compass',
          content: 'Something went wrong. Please try again.',
        }])
        return
      }

      const newSessionId = res.headers.get('X-Session-Id')
      if (newSessionId) setSessionId(newSessionId)

      if (!res.body) {
        const json = await res.json() as { success: boolean; data: { text: string; evalSummary?: string | null } }
        if (json.success) {
          setConversationHistory([...historyForRequest, { role: 'assistant', content: json.data.text }])
          setMessages(prev => [...prev, { id: `c-${Date.now()}`, role: 'compass', content: json.data.text }])
          if (json.data.evalSummary) {
            setSessionSummary(json.data.evalSummary)
            setTimeout(() => setPageState('session_complete'), 1500)
          }
          setExchangeCount(prev => prev + 1)
        }
        return
      }

      const decoder = new TextDecoder()
      const msgId = `c-${Date.now()}`
      let accumulated = ''
      let streamStarted = false

      try {
        const reader = res.body.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            accumulated += chunk

            if (!streamStarted) {
              streamStarted = true
              setIsLoading(false)
              setMessages(prev => [...prev, { id: msgId, role: 'compass', content: accumulated }])
            } else {
              setMessages(prev => {
                const idx = prev.findIndex(m => m.id === msgId)
                if (idx === -1) return prev
                return [...prev.slice(0, idx), { ...prev[idx], content: accumulated }, ...prev.slice(idx + 1)]
              })
            }
          }
        } finally {
          reader.releaseLock()
        }
      } catch (err) {
        console.error('[learn] stream error:', err)
        setMessages(prev => [...prev, {
          id:      `e-${Date.now()}`,
          role:    'compass',
          content: 'Samahani — kulikuwa na tatizo. Jaribu tena baada ya sekunde chache.',
        }])
        setIsLoading(false)
        return
      }

      if (!streamStarted) return

      // Strip COMPASS_EVAL from display and extract eval summary
      const EVAL_START = 'COMPASS_EVAL_START'
      const EVAL_END   = 'COMPASS_EVAL_END'
      const si = accumulated.indexOf(EVAL_START)
      const ei = accumulated.indexOf(EVAL_END)
      let visibleText = accumulated
      let evalSummary: string | null = null

      if (si !== -1 && ei !== -1 && ei > si) {
        visibleText = (accumulated.slice(0, si) + accumulated.slice(ei + EVAL_END.length)).trim()
        try {
          const ev = JSON.parse(accumulated.slice(si + EVAL_START.length, ei).trim()) as { one_line_summary?: string }
          evalSummary = ev.one_line_summary ?? null
        } catch { /* malformed eval JSON */ }
      }

      // Update final message content (with eval stripped)
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === msgId)
        if (idx === -1) return prev
        return [...prev.slice(0, idx), { ...prev[idx], content: visibleText }, ...prev.slice(idx + 1)]
      })

      setConversationHistory([
        ...historyForRequest,
        { role: 'assistant', content: visibleText },
      ])

      if (evalSummary) {
        setSessionSummary(evalSummary)
        setTimeout(() => setPageState('session_complete'), 1500)
      }

      setExchangeCount(prev => prev + 1)
    } catch {
      setMessages(prev => [...prev, {
        id:      `err-${Date.now()}`,
        role:    'compass',
        content: 'Something went wrong. Please try again.',
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, activeSubject, sessionId, student, conversationHistory])

  // ── Loading splash ──────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── State 3: Session Complete ───────────────────────────────────────────────

  if (pageState === 'session_complete') {
    const elapsed  = startedAt ? Math.min(SESSION_SECS, Math.floor((Date.now() - startedAt) / 1000)) : SESSION_SECS
    const minutes  = Math.floor(elapsed / 60)

    return (
      <div className="h-screen bg-[#0a0a14] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-linear-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center mb-6">
          <Trophy className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-2xl font-black text-white mb-2">Session Complete</h2>

        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
          <span className="px-3 py-1 bg-violet-500/20 border border-violet-500/30 rounded-full text-sm font-bold text-violet-300">
            {activeSubject?.label}
          </span>
          <span className="text-white/30 text-sm">
            {minutes} min · {exchangeCount} exchanges
          </span>
        </div>

        {sessionSummary && (
          <p className="text-white/60 text-sm max-w-sm mb-8 leading-relaxed">
            {sessionSummary}
          </p>
        )}

        {/* Pending assignments for the just-completed subject */}
        {(() => {
          const subjectAssignments = assignments.filter(
            a => a.submissionStatus === 'pending'
          )
          if (subjectAssignments.length === 0) return null
          return (
            <div className="w-full max-w-xs mt-6 mb-2">
              <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3 text-left">
                Your Assignments
              </p>
              <div className="grid gap-2">
                {subjectAssignments.map(a => (
                  <div
                    key={a.id}
                    className="px-4 py-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-left"
                  >
                    <p className="text-sm font-bold text-white">{a.title}</p>
                    <p className={`text-xs mt-0.5 ${a.isOverdue ? 'text-red-400' : 'text-sky-300/70'}`}>
                      {a.isOverdue
                        ? `Overdue by ${Math.abs(a.daysLeft)} day${Math.abs(a.daysLeft) !== 1 ? 's' : ''}`
                        : a.daysLeft === 0
                        ? 'Due today'
                        : `Due in ${a.daysLeft} day${a.daysLeft !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/30 mt-3 text-center">
                Submit your assignments through your student portal
              </p>
            </div>
          )
        })()}

        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
          <button
            onClick={() => {
              setPageState('subject_select')
              setMessages([])
              setConversationHistory([])
              setActiveSubject(null)
            }}
            className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-bold text-sm transition-colors"
          >
            Start Another Subject
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 font-medium text-sm transition-colors"
          >
            I'm Done Today
          </button>
        </div>
      </div>
    )
  }

  // ── State: Assessment not yet done ─────────────────────────────────────────

  if (pageState === 'needs_assessment') {
    return (
      <div className="h-screen bg-[#0a0a14] flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-16 h-16 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
          <AlertCircle className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Assessment Needed</h2>
          <p className="text-white/50 max-w-xs">
            This student hasn&apos;t completed their initial assessment yet. Ask their teacher to run the assessment first so the Compass can personalise their learning.
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  // ── State 0: Student Picker (multi-child parent) ────────────────────────────

  if (pageState === 'student_select') {
    return (
      <div className="h-screen bg-[#0a0a14] flex flex-col">
        <div className="px-5 py-4 border-b border-white/5 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 bg-linear-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-black text-white text-sm">Learning Compass</p>
            <p className="text-[10px] text-white/30">Personalised to your level</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-white mb-1">Who is studying today?</h2>
            <p className="text-white/50 text-sm mb-8">Select a learner to continue.</p>

            <div className="grid gap-3">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectStudent(s.id)}
                  className="group w-full flex items-center justify-between px-4 py-4 bg-white/5 hover:bg-violet-500/10 border border-white/8 hover:border-violet-500/30 rounded-2xl text-left transition-all"
                >
                  <div>
                    <p className="font-bold text-white text-sm">{s.firstName}</p>
                    <p className="text-xs text-white/40 mt-0.5">Grade {s.grade}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-400 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── State 1: Subject Select ─────────────────────────────────────────────────

  if (pageState === 'subject_select') {
    return (
      <div className="h-screen bg-[#0a0a14] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 bg-linear-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-black text-white text-sm">Learning Compass</p>
            <p className="text-[10px] text-white/30">Personalised to your level</p>
          </div>
        </div>

        {/* Scrollable subject list */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-white mb-1">
              Hey {student?.firstName ?? 'there'}.
            </h2>
            <p className="text-white/50 text-sm mb-6">What would you like to work on today?</p>

            {/* Teacher recommendation banner */}
            {student?.subjects.some(s => s.teacherSuggested) && (
              <div className="mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3">
                <div className="w-7 h-7 shrink-0 bg-amber-500/20 rounded-full flex items-center justify-center mt-0.5">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-300 text-sm font-bold">Your teacher has a session for you</p>
                  <p className="text-amber-300/60 text-xs mt-0.5">
                    {student.subjects.find(s => s.teacherSuggested)?.label}
                    {student.subjects.find(s => s.teacherSuggested)?.subtopic
                      ? ` · ${student.subjects.find(s => s.teacherSuggested)!.subtopic}`
                      : ''}
                    {' '}— tap it below to start
                  </p>
                </div>
              </div>
            )}

            {/* Pending assignments banner */}
            {assignments.filter(a => a.submissionStatus === 'pending').length > 0 && (
              <div className="mb-6 px-4 py-3 bg-sky-500/10 border border-sky-500/25 rounded-2xl flex items-start gap-3">
                <div className="w-7 h-7 shrink-0 bg-sky-500/20 rounded-full flex items-center justify-center mt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <p className="text-sky-300 text-sm font-bold">
                    {assignments.filter(a => a.submissionStatus === 'pending').length} assignment{assignments.filter(a => a.submissionStatus === 'pending').length > 1 ? 's' : ''} pending
                  </p>
                  <p className="text-sky-300/60 text-xs mt-0.5">
                    Study the topic first, then complete your assignment
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3">
              Your Subjects
            </p>

            {/* Subjects from learning context */}
            {(student?.subjects.length ?? 0) > 0 ? (
              <div className="grid gap-3">
                {student!.subjects.map(card => (
                  <button
                    key={card.key}
                    onClick={() => startSession(card)}
                    className={`group w-full flex items-center justify-between px-4 py-4 border rounded-2xl text-left transition-all ${
                      card.teacherSuggested
                        ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-white/5 hover:bg-violet-500/10 border-white/8 hover:border-violet-500/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white text-sm">{card.label}</span>
                        {card.teacherSuggested && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] font-bold text-amber-300">
                            <BookOpen className="w-2.5 h-2.5" />
                            Teacher session
                          </span>
                        )}
                        {!card.teacherSuggested && card.recommended && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded-full text-[10px] font-bold text-violet-300">
                            <Star className="w-2.5 h-2.5" />
                            Recommended
                          </span>
                        )}
                      </div>
                      {card.subtopic && card.teacherSuggested && (
                        <p className="text-xs text-amber-300/70 mb-0.5">{card.subtopic}</p>
                      )}
                      <p className={`text-xs ${LEVEL_COLORS[card.level]}`}>
                        Level {card.level}/4 · {LEVEL_LABELS[card.level]}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${card.teacherSuggested ? 'text-amber-400/50 group-hover:text-amber-400' : 'text-white/20 group-hover:text-violet-400'}`} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-sm text-center py-12">
                No subject data yet. Your teacher needs to complete an assessment first.
              </p>
            )}

            <p className="text-center text-xs text-white/15 mt-10 pb-6">
              Sessions are 30 minutes · Progress is shared with your parent
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── State 2: Active Session ─────────────────────────────────────────────────
  // Layout: h-screen flex-col — messages flex-1 min-h-0 overflow-y-auto,
  // input shrink-0 at bottom. Input NEVER scrolls away.

  const timerColor = timeLeft <= 2 * 60
    ? 'text-red-400'
    : timeLeft <= WARNING_SECS
    ? 'text-amber-400'
    : 'text-white/50'

  return (
    <div className="h-screen bg-[#0a0a14] flex flex-col">

      {/* Top bar */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center gap-3">
        <button
          onClick={() => setPageState('subject_select')}
          className="text-white/30 hover:text-white/70 transition-colors p-1 -ml-1 shrink-0"
          aria-label="Back to subjects"
        >
          ←
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{activeSubject?.label}</p>
          <p className={`text-xs ${LEVEL_COLORS[activeSubject?.level ?? 2]}`}>
            Level {activeSubject?.level ?? '—'}/4 · {LEVEL_LABELS[activeSubject?.level ?? 2]}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="w-3.5 h-3.5 text-white/30" />
          <span className={`text-sm font-mono font-bold tabular-nums ${timerColor}`}>
            {fmt(timeLeft)}
          </span>
        </div>
      </div>

      {/* 25-min warning banner */}
      {showWarning && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center shrink-0">
          <p className="text-amber-300 text-xs font-medium">
            Tunamaliza hivi karibuni — {fmt(timeLeft)} imebaki
          </p>
        </div>
      )}

      {/* Messages — takes all remaining vertical space, scrolls internally */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'compass' && (
              <div className="w-7 h-7 shrink-0 bg-violet-600/20 border border-violet-500/20 rounded-full flex items-center justify-center mr-2 mt-1">
                <Compass className="w-3.5 h-3.5 text-violet-400" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'student'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-white/6 border border-white/8 text-white/90 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 shrink-0 bg-violet-600/20 border border-violet-500/20 rounded-full flex items-center justify-center mr-2 mt-1">
              <Compass className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
            </div>
            <div className="bg-white/6 border border-white/8 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar — always visible, never scrolls away */}
      <div className="px-4 py-3 border-t border-white/5 bg-[#0a0a14] shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={isLoading ? 'Compass is thinking...' : 'Type your answer...'}
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none disabled:opacity-40 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 shrink-0 bg-linear-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center disabled:opacity-30 hover:from-violet-500 hover:to-indigo-500 transition-all"
            aria-label="Send"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page wrapper (required for useSearchParams) ────────────────────────────────

export default function LearnPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LearnContent />
    </Suspense>
  )
}
