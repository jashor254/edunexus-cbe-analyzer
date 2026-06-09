'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Compass, Send, Trophy, Star, Clock, ChevronRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageState = 'student_select' | 'subject_select' | 'active_session' | 'session_complete'
type Level = 1 | 2 | 3 | 4

interface SubjectCard {
  key:         string
  label:       string
  level:       Level
  recommended: boolean
  subtopic:    string | null
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
  id:        string
  firstName: string
  grade:     number
  isJunior:  boolean
  pathway:   string | null
  subjects:  Array<{ key: string; level: Level; recommended: boolean; subtopic: string | null }>
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
        setStudent({
          id:        d.id,
          firstName: d.firstName,
          grade:     d.grade,
          subjects:  d.subjects.map(s => ({ ...s, label: toLabel(s.key) })),
        })
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
      setStudent({
        id:        d.id,
        firstName: d.firstName,
        grade:     d.grade,
        subjects:  d.subjects.map(s => ({ ...s, label: toLabel(s.key) })),
      })
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
      const res  = await fetch('/api/learn', {
        method:       'POST',
        credentials:  'include',
        headers:      { 'Content-Type': 'application/json' },
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
      const json = await res.json() as LearnApiResponse
      if (json.success) {
        if (json.data.sessionId) setSessionId(json.data.sessionId)
        setMessages([{ id: `c-${Date.now()}`, role: 'compass', content: json.data.text }])
        setConversationHistory([
          { role: 'user',      content: opening       },
          { role: 'assistant', content: json.data.text },
        ])
        if (json.data.evalSummary) setSessionSummary(json.data.evalSummary)
        setExchangeCount(1)
      }
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
      const res  = await fetch('/api/learn', {
        method:       'POST',
        credentials:  'include',
        headers:      { 'Content-Type': 'application/json' },
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
      const json = await res.json() as LearnApiResponse
      if (json.success) {
        if (json.data.sessionId) setSessionId(json.data.sessionId)
        setConversationHistory([
          ...historyForRequest,
          { role: 'assistant', content: json.data.text },
        ])
        setMessages(prev => [...prev, { id: `c-${Date.now()}`, role: 'compass', content: json.data.text }])
        if (json.data.evalSummary) {
          setSessionSummary(json.data.evalSummary)
          setTimeout(() => setPageState('session_complete'), 1500)
        }
        setExchangeCount(prev => prev + 1)
      }
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
            <p className="text-white/50 text-sm mb-8">What would you like to work on today?</p>

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
                    className="group w-full flex items-center justify-between px-4 py-4 bg-white/5 hover:bg-violet-500/10 border border-white/8 hover:border-violet-500/30 rounded-2xl text-left transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white text-sm">{card.label}</span>
                        {card.recommended && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded-full text-[10px] font-bold text-violet-300">
                            <Star className="w-2.5 h-2.5" />
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${LEVEL_COLORS[card.level]}`}>
                        Level {card.level}/4 · {LEVEL_LABELS[card.level]}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-400 shrink-0 transition-colors" />
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
