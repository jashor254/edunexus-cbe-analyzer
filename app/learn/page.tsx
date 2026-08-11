'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Compass, Send, Trophy, Star, Clock, ChevronRight, BookOpen, AlertCircle, Mic, MicOff, Zap, TrendingUp } from 'lucide-react'

// ── Voice API types (not universally in lib.dom) ──────────────────────────────

interface SpeechRecognitionResultItem { readonly transcript: string }
interface SpeechRecognitionResult { readonly 0: SpeechRecognitionResultItem }
interface SpeechRecognitionResultList { readonly length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { readonly results: SpeechRecognitionResultList }
interface SpeechRecognitionInstance {
  lang:             string
  interimResults:   boolean
  continuous:       boolean
  maxAlternatives:  number
  onresult:         ((e: SpeechRecognitionEvent) => void) | null
  onend:            (() => void) | null
  onerror:          (() => void) | null
  start():  void
  stop():   void
  abort():  void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

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

interface SessionResult {
  xpEarned:         number
  totalSessions:    number
  sessionsThisWeek: number
  startingLevel:    number | null
  endingLevel:      number | null
  levelGained:      boolean
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
  hasTeacher?:      boolean
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

// Short CBC codes shown on the progress bar
const CBC_STEPS = ['BE', 'AE', 'ME', 'EE'] as const

// What each next level means — shown on subject cards as a carrot
const NEXT_LEVEL_HOOK: Record<Level, string> = {
  1: 'Work toward AE — you\'ll start answering with confidence',
  2: 'Work toward ME — you\'ll be able to tackle exam questions',
  3: 'Work toward EE — you\'ll be able to teach this to others',
  4: 'You\'ve reached the highest level in this subject!',
}

// Session count milestones — shown on completion screen
const SESSION_MILESTONES: Array<{ at: number; label: string; color: string }> = [
  { at:  5, label: '5 sessions — great start!',         color: 'bg-teal-500/20 border-teal-500/30 text-teal-300'    },
  { at: 10, label: '10 sessions — building real skill',  color: 'bg-violet-500/20 border-violet-500/30 text-violet-300' },
  { at: 25, label: '25 sessions — seriously dedicated',  color: 'bg-amber-500/20 border-amber-500/30 text-amber-300'   },
  { at: 50, label: '50 sessions — you are a champion',   color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200' },
]

function LevelBar({ level }: { level: Level }) {
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-sky-400']
  return (
    <div className="flex items-center gap-1 mt-1.5">
      {CBC_STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div className={`h-1.5 w-6 rounded-full transition-all ${
            i < level ? colors[level - 1] : 'bg-white/10'
          }`} />
          <span className={`text-[9px] font-bold ${
            i + 1 === level ? (LEVEL_COLORS[level] + ' opacity-100') : 'text-white/20'
          }`}>{step}</span>
        </div>
      ))}
    </div>
  )
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
  const [needsAssessmentInfo, setNeedsAssessmentInfo] = useState<{ studentId: string; hasTeacher: boolean } | null>(null)

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([])

  // Session state
  const [activeSubject,        setActiveSubject]        = useState<SubjectCard | null>(null)
  const [sessionId,            setSessionId]            = useState<string | null>(null)
  // Guards against ending the same session twice. Several paths can fire at
  // once — the idle wrap, the countdown hitting zero, and the eval-summary
  // handler's 1.5s delayed close all run while pageState is still
  // 'active_session', as does the manual end button. A ref (not state) because
  // the check has to see the update within the same tick.
  const endedSessionRef = useRef<string | null>(null)
  const [messages,             setMessages]             = useState<Message[]>([])
  const [conversationHistory,  setConversationHistory]  = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input,           setInput]           = useState('')
  const [isLoading,       setIsLoading]       = useState(false)
  const [exchangeCount,   setExchangeCount]   = useState(0)
  const [startedAt,       setStartedAt]       = useState<number>(0)
  const [timeLeft,        setTimeLeft]        = useState(SESSION_SECS)
  const [showWarning,     setShowWarning]     = useState(false)
  const [sessionSummary,  setSessionSummary]  = useState<string | null>(null)
  const [sessionResult,   setSessionResult]   = useState<SessionResult | null>(null)
  const [genuineProgress, setGenuineProgress] = useState(false)
  const lastMessageAt     = useRef<number>(0)
  const idleWrapTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLInputElement>(null)
  const warningShown    = useRef(false)

  // Voice input — auto-cycles between sw-KE and en-US so students can speak either
  // language (or mix them) without any manual toggle
  const [isListening,  setIsListening]  = useState(false)
  const recognitionRef  = useRef<SpeechRecognitionInstance | null>(null)
  const isListeningRef  = useRef(false)   // ref copy for use inside callbacks
  const cycleLangRef    = useRef<'sw-KE' | 'en-US'>('sw-KE')

  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  const startCycle = useCallback((SR: SpeechRecognitionCtor, lang: 'sw-KE' | 'en-US') => {
    if (!isListeningRef.current) return

    const r = new SR()
    r.lang            = lang
    r.interimResults  = true
    r.continuous      = false
    r.maxAlternatives = 1

    r.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      if (transcript) setInput(transcript)
    }

    r.onend = () => {
      if (!isListeningRef.current) return
      // Alternate language and restart immediately — imperceptible gap
      const next: 'sw-KE' | 'en-US' = lang === 'sw-KE' ? 'en-US' : 'sw-KE'
      cycleLangRef.current = next
      startCycle(SR, next)
    }

    r.onerror = () => {
      if (!isListeningRef.current) return
      // On error keep the same lang and retry
      startCycle(SR, lang)
    }

    recognitionRef.current = r
    r.start()
  }, [])

  const toggleVoice = useCallback(() => {
    if (isListening) {
      isListeningRef.current = false
      recognitionRef.current?.abort()
      recognitionRef.current = null
      setIsListening(false)
      return
    }

    const w = typeof window !== 'undefined' ? window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    } : null

    const SR = w?.SpeechRecognition ?? w?.webkitSpeechRecognition
    if (!SR) return

    isListeningRef.current = true
    cycleLangRef.current   = 'sw-KE'
    setIsListening(true)
    startCycle(SR, 'sw-KE')
  }, [isListening, startCycle])

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
          setNeedsAssessmentInfo({ studentId: d.id, hasTeacher: Boolean(d.hasTeacher) })
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
        setNeedsAssessmentInfo({ studentId: d.id, hasTeacher: Boolean(d.hasTeacher) })
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

  // Clear idle-wrap timer whenever it's no longer needed
  const clearIdleTimer = useCallback(() => {
    if (idleWrapTimer.current) { clearTimeout(idleWrapTimer.current); idleWrapTimer.current = null }
  }, [])

  // End session — calls API and surfaces XP/streak on the completion screen
  const endCompassSession = useCallback(async (status: 'completed' | 'abandoned') => {
    if (!sessionId || !student?.id) return
    if (endedSessionRef.current === sessionId) return
    endedSessionRef.current = sessionId
    clearIdleTimer()
    const durationSeconds = Math.min(SESSION_SECS, Math.floor((Date.now() - startedAt) / 1000))
    try {
      const res  = await fetch('/api/learn/end', {
        method:  'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, studentId: student.id, status, durationSeconds, genuineProgress }),
      })
      const json = await res.json() as { success: boolean; data?: SessionResult }
      if (json.success && json.data) setSessionResult(json.data)
    } catch { /* non-fatal */ }
  }, [sessionId, student?.id, startedAt, genuineProgress, clearIdleTimer])

  // Auto-wrap: after 90s of student silence with ≥3 exchanges, close gracefully
  const scheduleIdleWrap = useCallback(() => {
    clearIdleTimer()
    idleWrapTimer.current = setTimeout(() => {
      if (exchangeCount >= 3) {
        endCompassSession('completed')
        setPageState('session_complete')
      }
    }, 90_000)
  }, [clearIdleTimer, endCompassSession, exchangeCount])

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
        void endCompassSession('completed')
        setPageState('session_complete')
      }
    }, 1000)

    return () => clearInterval(id)
  }, [pageState, startedAt, endCompassSession])

  // Start session — sends the opening message automatically
  const startSession = useCallback(async (card: SubjectCard) => {
    setActiveSubject(card)
    setMessages([])
    setConversationHistory([])
    setExchangeCount(0)
    setSessionSummary(null)
    setSessionResult(null)
    setGenuineProgress(false)
    setSessionId(null)
    setShowWarning(false)
    setTimeLeft(SESSION_SECS)
    warningShown.current = false
    clearIdleTimer()

    const now = Date.now()
    setStartedAt(now)
    setPageState('active_session')
    setIsLoading(true)

    const opening = card.subtopic
      ? `Let's work on ${card.subtopic} in ${card.label} today.`
      : `Let's begin our ${card.label} session.`

    try {
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
        setGenuineProgress(true)
        setTimeout(async () => {
          await endCompassSession('completed')
          setPageState('session_complete')
        }, 1500)
      } else {
        // Student replied — reset idle-wrap timer
        lastMessageAt.current = Date.now()
        scheduleIdleWrap()
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
  }, [input, isLoading, activeSubject, sessionId, student, conversationHistory, endCompassSession, scheduleIdleWrap])

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
    const levelLabels: Record<number, string> = { 1: 'BE', 2: 'AE', 3: 'ME', 4: 'EE' }
    const xp         = sessionResult?.xpEarned         ?? 0
    const total      = sessionResult?.totalSessions    ?? 0
    const weekly     = sessionResult?.sessionsThisWeek ?? 0
    const lvlGained  = sessionResult?.levelGained      ?? false
    const lvlFrom    = sessionResult?.startingLevel
    const lvlTo      = sessionResult?.endingLevel

    return (
      <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center px-6 py-10 text-center">

        {/* Trophy icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-yellow-900/30">
          <Trophy className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-2xl font-black text-white mb-1">Session Complete!</h2>
        <p className="text-white/40 text-sm mb-6">
          {activeSubject?.label} · {minutes > 0 ? `${minutes} min` : 'Quick session'} · {exchangeCount} exchange{exchangeCount !== 1 ? 's' : ''}
        </p>

        {/* XP + session count row */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {xp > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/15 border border-yellow-500/25 rounded-2xl">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-black text-lg">+{xp} XP</span>
            </div>
          )}
          {total > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/15 border border-violet-500/25 rounded-2xl">
              <Star className="w-4 h-4 text-violet-400" />
              <span className="text-violet-300 font-black text-lg">{total} session{total !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Milestone badge — only on exact milestone sessions */}
        {(() => {
          const milestone = SESSION_MILESTONES.find(m => m.at === total)
          if (!milestone) return null
          return (
            <div className={`flex items-center gap-2 px-4 py-2.5 border rounded-2xl mb-4 ${milestone.color}`}>
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="font-bold text-sm">{milestone.label}</span>
            </div>
          )
        })()}

        {/* Level gained badge */}
        {lvlGained && lvlFrom && lvlTo && (
          <div className="flex items-center gap-3 px-5 py-3 bg-teal-500/15 border border-teal-500/25 rounded-2xl mb-5">
            <TrendingUp className="w-5 h-5 text-teal-400 shrink-0" />
            <span className="text-teal-200 font-bold text-sm">
              Level up! {levelLabels[lvlFrom]} → {levelLabels[lvlTo]} in {activeSubject?.label}
            </span>
          </div>
        )}

        {/* AI summary */}
        {sessionSummary && (
          <p className="text-white/50 text-sm max-w-sm mb-6 leading-relaxed italic">
            "{sessionSummary}"
          </p>
        )}

        {/* Encouragement + what's achievable next — no shame for gaps */}
        <div className="px-5 py-3 bg-white/4 border border-white/8 rounded-2xl mb-5 max-w-xs">
          <p className="text-white/60 text-sm text-center leading-snug">
            {total === 1
              ? 'First session done. Every journey starts somewhere.'
              : total === 2
              ? 'Two sessions in. You\'re further than most.'
              : weekly >= 2
              ? `${weekly} sessions this week. Keep learning at your pace.`
              : `Session ${total} done. Come back when you're ready.`}
          </p>
          {activeSubject && activeSubject.level < 4 && (
            <p className="text-white/30 text-xs text-center mt-1.5 leading-snug">
              {NEXT_LEVEL_HOOK[activeSubject.level]}
            </p>
          )}
        </div>

        {/* Pending assignments */}
        {(() => {
          const subjectAssignments = assignments.filter(a => a.submissionStatus === 'pending')
          if (subjectAssignments.length === 0) return null
          return (
            <div className="w-full max-w-xs mt-2 mb-4">
              <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3 text-left">
                Your Assignments
              </p>
              <div className="grid gap-2">
                {subjectAssignments.map(a => (
                  <div key={a.id} className="px-4 py-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-left">
                    <p className="text-sm font-bold text-white">{a.title}</p>
                    <p className={`text-xs mt-0.5 ${a.isOverdue ? 'text-red-400' : 'text-sky-300/70'}`}>
                      {a.isOverdue
                        ? `Overdue by ${Math.abs(a.daysLeft)} day${Math.abs(a.daysLeft) !== 1 ? 's' : ''}`
                        : a.daysLeft === 0 ? 'Due today'
                        : `Due in ${a.daysLeft} day${a.daysLeft !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          <button
            onClick={() => {
              setPageState('subject_select')
              setMessages([])
              setConversationHistory([])
              setActiveSubject(null)
              setSessionResult(null)
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
    const hasTeacher = needsAssessmentInfo?.hasTeacher ?? true
    return (
      <div className="h-screen bg-[#0a0a14] flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-16 h-16 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
          <AlertCircle className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Nothing to work on yet</h2>
          <p className="text-white/50 max-w-xs">
            {/* Phase 2.5 / G-05 — this state now means "we hold no marks,
                no assessment and no classwork for this learner in any
                subject", not "no Academic Clinic assessment exists". A
                learner whose teacher has entered marks reaches Compass
                without ever visiting the Clinic. Deliberately plain
                educational language: no architecture terms. */}
            {hasTeacher
              ? "We don't have any subject results for this student yet, so the Compass can't tell what to work on. Once their teacher records some classwork or an assessment, this will open up."
              : "We don't have any subject results for this student yet. Add their first assessment and the Compass can start personalising their learning."}
          </p>
        </div>
        {hasTeacher ? (
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        ) : (
          <button
            onClick={() => router.push(`/dashboard/assessments/add?student=${needsAssessmentInfo?.studentId ?? ''}`)}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
          >
            Add Assessment
          </button>
        )}
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
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-2xl font-black text-white">
                Hey {student?.firstName ?? 'there'}.
              </h2>
              {/* Session count — shown after completing a session */}
              {sessionResult && sessionResult.totalSessions >= 1 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/15 border border-violet-500/25 rounded-full">
                  <Star className="w-3 h-3 text-violet-400" />
                  <span className="text-violet-300 font-black text-sm">{sessionResult.totalSessions}</span>
                </div>
              )}
            </div>
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
                      <LevelBar level={card.level} />
                      <p className="text-[10px] text-white/30 mt-1 leading-snug max-w-[220px]">
                        {NEXT_LEVEL_HOOK[card.level]}
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

  const progressPct = Math.min(100, Math.round(((SESSION_SECS - timeLeft) / SESSION_SECS) * 100))
  const progressColor = timeLeft <= 2 * 60
    ? 'bg-red-400'
    : timeLeft <= WARNING_SECS
    ? 'bg-amber-400'
    : 'bg-violet-500'

  return (
    <div className="h-screen bg-[#0a0a14] flex flex-col">

      {/* Top bar */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center gap-3">
        <button
          onClick={async () => {
            await endCompassSession('abandoned')
            setPageState('subject_select')
          }}
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

        <button
          onClick={async () => {
            await endCompassSession('completed')
            setPageState('session_complete')
          }}
          className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors px-2 py-1 shrink-0"
        >
          End Session
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="w-3.5 h-3.5 text-white/30" />
          <span className={`text-sm font-mono font-bold tabular-nums ${timerColor}`}>
            {fmt(timeLeft)}
          </span>
        </div>
      </div>

      {/* 30-min progress bar */}
      <div className="h-1 bg-white/5 shrink-0">
        <div
          className={`h-full transition-all duration-1000 ${progressColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* 25-min warning banner */}
      {showWarning && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center shrink-0">
          <p className="text-amber-300 text-xs font-medium">
            Almost there — finish strong! {fmt(timeLeft)} imebaki
          </p>
        </div>
      )}

      {/* Session goal banner — shown only at start (first 3 exchanges) */}
      {exchangeCount < 3 && activeSubject?.subtopic && (
        <div className="bg-violet-500/8 border-b border-violet-500/15 px-4 py-2 shrink-0 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <p className="text-violet-300/80 text-xs font-medium">
            Today&apos;s goal: <span className="text-violet-200 font-bold">{activeSubject.subtopic}</span>
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
              <Compass className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="bg-white/6 border border-white/8 rounded-2xl rounded-bl-sm px-4 py-3 w-56">
              <div className="flex flex-col gap-2 animate-pulse">
                <div className="h-2.5 bg-white/10 rounded-full w-3/4" />
                <div className="h-2.5 bg-white/10 rounded-full w-full" />
                <div className="h-2.5 bg-white/10 rounded-full w-1/2" />
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
            placeholder={isListening ? 'Listening...' : isLoading ? 'Compass is thinking...' : 'Type or speak your answer...'}
            disabled={isLoading}
            className={`flex-1 bg-white/5 border rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none disabled:opacity-40 transition-colors ${
              isListening ? 'border-red-500/60 animate-pulse' : 'border-white/10 focus:border-violet-500/50'
            }`}
          />

          {/* Mic button */}
          <button
            onClick={toggleVoice}
            disabled={isLoading}
            aria-label={isListening ? 'Stop recording' : 'Start voice input'}
            className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 ${
              isListening
                ? 'bg-red-500/20 border border-red-500/50 hover:bg-red-500/30'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            {isListening
              ? <MicOff className="w-4 h-4 text-red-400" />
              : <Mic className="w-4 h-4 text-white/50" />
            }
          </button>

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
