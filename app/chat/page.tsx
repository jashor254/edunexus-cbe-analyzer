'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import {
  Send, Mic, MicOff, Volume2, VolumeX,
  Plus, ChevronLeft, Maximize2, X,
  Zap, Star, Flame, Brain,
  Image as ImageIcon, Heart, Sparkles,
  RotateCcw, Clock
} from 'lucide-react'
import type { VisualAid } from '@/lib/ai/learningCompass'
import type { LessonOutcome, WeakTopic } from '@/lib/compass/lessonOutcomes'
import TopicChoice from '@/components/compass/TopicChoice'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: {
    pedagogy?:        { strategy: string; checkForUnderstanding?: string }
    parentInsight?:   any
    audioOptimized?:  string
    difficulty?:      number
    adaptationReason?: string
    visualAid?:       VisualAid
  }
  timestamp: Date
}

interface SessionState {
  timeOnTask:     number
  currentSubject: string
  currentConcept: string
}

interface Stats {
  streakDays:       number
  conceptsMastered: number
  tokens:           number
  hasSubscription:  boolean
}

// ─── Difficulty label ─────────────────────────────────────────────────────────
const DIFF_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'Foundational', color: 'text-red-400'    },
  2: { label: 'Building',     color: 'text-amber-400'  },
  3: { label: 'Grade Level',  color: 'text-green-400'  },
  4: { label: 'Challenge',    color: 'text-blue-400'   },
  5: { label: 'Advanced',     color: 'text-purple-400' },
}

const STRATEGY_LABEL: Record<string, string> = {
  concept_intro: 'New Concept',
  practice:      'Practice',
  challenge:     'Challenge',
  review:        'Review',
  break:         'Brain Break',
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Help me with fractions 🍕',
  'Explain photosynthesis 🌱',
  'I don\'t understand algebra',
  'What is the water cycle? 💧',
  'Help with essay writing ✍️',
  'Teach me about circuits ⚡',
]

// ─── Visual Aid renderer ──────────────────────────────────────────────────────
function VisualAidBlock({
  aid,
  onExpand,
}: {
  aid: VisualAid
  onExpand: (aid: VisualAid) => void
}) {
  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-3 py-2 bg-white/5">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
            {aid.subject || 'Diagram'}
          </span>
        </div>
        <button
          onClick={() => onExpand(aid)}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors"
        >
          <Maximize2 className="w-3 h-3" />
          Expand
        </button>
      </div>
      <pre
        className="p-4 font-mono text-xs text-emerald-300 bg-slate-950/60 overflow-x-auto whitespace-pre leading-relaxed cursor-pointer hover:bg-slate-950/80 transition-colors"
        onClick={() => onExpand(aid)}
      >
        {aid.content}
      </pre>
      {aid.caption && (
        <p className="px-3 py-1.5 text-xs text-white/40 italic bg-white/3">
          {aid.caption}
        </p>
      )}
    </div>
  )
}

// ─── Expanded diagram modal ───────────────────────────────────────────────────
function DiagramModal({
  aid,
  onClose,
}: {
  aid: VisualAid
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">{aid.subject}</p>
              <p className="text-xs text-white/40">{aid.concept}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <pre className="p-8 font-mono text-sm text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
          {aid.content}
        </pre>
        {aid.caption && (
          <p className="px-6 py-3 text-sm text-white/50 italic border-t border-white/10 text-center">
            {aid.caption}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onExpand,
  onSpeak,
  onParentInsight,
}: {
  msg: Message
  onExpand:       (aid: VisualAid) => void
  onSpeak:        (text: string) => void
  onParentInsight:(insight: any) => void
}) {
  const isUser = msg.role === 'user'
  const diff   = msg.metadata?.difficulty
  const strat  = msg.metadata?.pedagogy?.strategy

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-2xl flex-shrink-0 flex items-center justify-center text-xs font-black shadow-lg ${
        isUser
          ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
          : 'bg-gradient-to-br from-violet-600 to-indigo-600'
      }`}>
        {isUser ? 'You' : <Brain className="w-4 h-4 text-white" />}
      </div>

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Metadata chips — assistant only */}
        {!isUser && (diff || strat) && (
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {strat && (
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                {STRATEGY_LABEL[strat] || strat}
              </span>
            )}
            {diff && DIFF_LABEL[diff] && (
              <span className={`text-[10px] font-bold uppercase tracking-wider ${DIFF_LABEL[diff].color}`}>
                • {DIFF_LABEL[diff].label}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={`px-4 py-3 rounded-2xl leading-relaxed text-sm ${
          isUser
            ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-br-sm'
            : 'bg-white/8 border border-white/10 text-white/90 rounded-bl-sm'
        }`}>
          {msg.content.split('\n').map((line, i) => (
            line.trim()
              ? <p key={i} className="mb-2 last:mb-0">{line}</p>
              : <div key={i} className="h-1" />
          ))}

          {/* Visual aid */}
          {!isUser && msg.metadata?.visualAid && (
            <VisualAidBlock aid={msg.metadata.visualAid} onExpand={onExpand} />
          )}
        </div>

        {/* Action row — assistant only */}
        {!isUser && (
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => onSpeak(msg.metadata?.audioOptimized || msg.content)}
              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors font-bold uppercase tracking-wider"
            >
              <Volume2 className="w-3 h-3" />
              Listen
            </button>
            {msg.metadata?.parentInsight && (
              <button
                onClick={() => onParentInsight(msg.metadata!.parentInsight)}
                className="flex items-center gap-1 text-[10px] text-pink-400/50 hover:text-pink-400 transition-colors font-bold uppercase tracking-wider"
              >
                <Heart className="w-3 h-3" />
                Parent tip
              </button>
            )}
            {msg.metadata?.visualAid && (
              <button
                onClick={() => onExpand(msg.metadata!.visualAid!)}
                className="flex items-center gap-1 text-[10px] text-amber-400/50 hover:text-amber-400 transition-colors font-bold uppercase tracking-wider"
              >
                <ImageIcon className="w-3 h-3" />
                Diagram
              </button>
            )}
            <span className="text-[10px] text-white/20 ml-auto">
              {msg.timestamp.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main chat content ────────────────────────────────────────────────────────
function ChatContent() {
  const [supabase]   = useState(() => createClient())
  const router       = useRouter()
  const searchParams = useSearchParams()
  const struggleTopicRef = useRef<string | null>(null)

  const [messages,        setMessages]        = useState<Message[]>([])
  const [input,           setInput]           = useState('')
  const [isLoading,       setIsLoading]       = useState(false)
  const [sessionId,       setSessionId]       = useState<string | null>(null)
  const [learnerId,       setLearnerId]       = useState<string | null>(null)
  const [student,         setStudent]         = useState<{ id: string; name: string; grade: number; curriculum_type: string } | null>(null)
  const [learningContext, setLearningContext] = useState<{
    first_subject: string
    session_goal: string
    guided_topics: string[]
    overall_tier: string
    recommended_pathway: string | null
    compass_bridge?: { firstConcept?: string; firstSubject?: string; sessionGoal?: string; teacherSuggested?: boolean } | null
  } | null>(null)
  const [topicSelected,   setTopicSelected]   = useState(false)
  const [stats,           setStats]           = useState<Stats | null>(null)
  const [sessionState,    setSessionState]    = useState<SessionState>({ timeOnTask: 0, currentSubject: 'mathematics', currentConcept: '' })
  const [expandedDiagram, setExpandedDiagram] = useState<VisualAid | null>(null)
  const [parentInsight,   setParentInsight]   = useState<any>(null)
  const [showParent,      setShowParent]      = useState(false)
  const [isSpeaking,      setIsSpeaking]      = useState(false)
  const [isListening,     setIsListening]     = useState(false)
  const [hasAccess,       setHasAccess]       = useState(false)
  const [freeLeft,        setFreeLeft]        = useState(1)
  const [showUpgrade,     setShowUpgrade]     = useState(false)
  const [initDone,        setInitDone]        = useState(false)
  const [currentOutcome,  setCurrentOutcome]  = useState<LessonOutcome | null>(null)
  const [outcomeStep,     setOutcomeStep]     = useState<number>(1)

  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLTextAreaElement>(null)
  const recognitionRef  = useRef<any>(null)
  const initCalledRef   = useRef(false)

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initCalledRef.current) return
    initCalledRef.current = true
    initSession()
  }, [])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const ADMIN_EMAIL = 'kariukidennis092@gmail.com'

  const initSession = async () => {
    // Use getSession() — reads localStorage, no network lock contention
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { router.push('/login'); return }
    const user = session.user

    // Load student profile (first student belonging to this user)
    const { data: studentData } = await supabase
      .from('students')
      .select('id, name, grade, curriculum_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (studentData) {
      setStudent(studentData)
      setLearnerId(studentData.id)
    } else {
      setLearnerId(user.id)
    }

    const effectiveLearnerId = studentData?.id || user.id

    // Load learning context saved by guidance/career pages
    const { data: ctx } = await supabase
      .from('student_learning_context')
      .select('first_subject, session_goal, guided_topics, overall_tier, recommended_pathway, compass_bridge')
      .eq('student_id', effectiveLearnerId)
      .maybeSingle()

    if (ctx) setLearningContext(ctx)

    // Load in-progress outcome
    const { data: outcomeData } = await supabase
      .from('compass_outcomes')
      .select('id, subject, concept, substrand, mastery_statement, mastery_evidence, milestones, status, sessions_spent, set_by, teacher_note')
      .eq('student_id', effectiveLearnerId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (outcomeData) {
      type DBMilestone = { step: number; description: string; checkQuestion: string; achieved: boolean; achievedAt?: string }
      const milestones = (outcomeData.milestones as DBMilestone[]).map(m => ({
        ...m,
        achievedAt: m.achievedAt ? new Date(m.achievedAt) : undefined,
      }))
      setCurrentOutcome({
        id:               outcomeData.id,
        subject:          outcomeData.subject as string,
        concept:          outcomeData.concept as string,
        substrand:        (outcomeData.substrand as string | null) ?? '',
        masteryStatement: outcomeData.mastery_statement as string,
        masteryEvidence:  (outcomeData.mastery_evidence as string[]) ?? [],
        milestones,
        status:   outcomeData.status as LessonOutcome['status'],
        sessionsSpent: outcomeData.sessions_spent as number,
        setBy:    (outcomeData.set_by as LessonOutcome['setBy']) ?? 'system',
        teacherNote: (outcomeData.teacher_note as string | null) ?? undefined,
      })
      setOutcomeStep(milestones.filter(m => m.achieved).length + 1)
    }

    const isAdmin = user.email === ADMIN_EMAIL

    // Check access
    const [{ data: tokenData }, { data: subscription }] = await Promise.all([
      supabase.from('token_balances').select('balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('plan').eq('user_id', user.id).eq('status', 'active').gt('expires_at', new Date().toISOString()).maybeSingle(),
    ])

    const tokens          = tokenData?.balance || 0
    const hasSubscription = !!subscription

    setStats({
      streakDays:       3,
      conceptsMastered: 0,
      tokens,
      hasSubscription: hasSubscription || isAdmin,
    })
    setHasAccess(true) // everyone gets free message (admin always gets access)

    // Load or create session
    const { data: existing } = await supabase
      .from('compass_sessions')
      .select('*')
      .eq('learner_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      setSessionId(existing.id)
      await loadMessages(existing.id)
    } else {
      await createNewSession(user.id)
    }

    // Init speech recognition
    initSpeech()
    setInitDone(true)
  }

  const loadMessages = async (sId: string) => {
    const { data } = await supabase
      .from('compass_messages')
      .select('*')
      .eq('session_id', sId)
      .order('created_at', { ascending: true })

    if (data && data.length > 0) {
      setMessages(data.map(m => ({
        id:        m.id,
        role:      m.role as 'user' | 'assistant',
        content:   m.content,
        metadata:  m.metadata || {},
        timestamp: new Date(m.created_at),
      })))
    }
  }

  const createNewSession = async (userId: string) => {
    // Close existing active sessions
    await supabase
      .from('compass_sessions')
      .update({ status: 'completed' })
      .eq('learner_id', userId)
      .eq('status', 'active')

    const { data } = await supabase
      .from('compass_sessions')
      .insert({
        learner_id:    userId,
        status:        'active',
        session_state: {},
      })
      .select('id, learner_id, status, session_state')
      .maybeSingle()

    if (data) {
      setSessionId(data.id)
      setMessages([])
    }
  }

  const initSpeech = () => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec           = new SR()
    rec.lang            = 'en-KE'
    rec.continuous      = false
    rec.interimResults  = false
    rec.onresult        = (e: any) => {
      setInput(e.results[0][0].transcript)
      setIsListening(false)
    }
    rec.onend = () => setIsListening(false)
    recognitionRef.current = rec
  }

  // ── Compute weak topics from compass_bridge priorities ──────────────────────
  const availableTopicsForChoice: WeakTopic[] = (() => {
    type Priority = { subject?: string; currentTier?: string; careerReason?: string; actionSteps?: string[] }
    const priorities = ((learningContext?.compass_bridge as { subjectPriorities?: Priority[] } | null | undefined)?.subjectPriorities) ?? []
    const tierToLevel = (t: string | undefined): number =>
      ({ below_expectation: 1, approaching_expectation: 2, meeting_expectation: 3, above_expectation: 4 }[t ?? ''] ?? 2)
    return priorities.flatMap(sp =>
      (sp.actionSteps ?? []).slice(0, 2).map(step => ({
        subject:      sp.subject ?? '',
        concept:      step,
        substrand:    step,
        displayName:  step.replace(/_/g, ' '),
        currentLevel: tierToLevel(sp.currentTier),
        whyItMatters: sp.careerReason ?? '',
      }))
    )
  })()

  // ── Generate outcome then start session ──────────────────────────────────────
  const generateOutcomeAndStart = async (
    concept: string,
    substrand: string,
    displayName: string,
    subject: string,
  ) => {
    if (learnerId) {
      try {
        const res = await fetch('/api/compass/outcome/generate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concept, substrand, subject, studentId: learnerId }),
        })
        if (res.ok) {
          const json = await res.json() as { data?: { outcome?: LessonOutcome } }
          if (json.data?.outcome) {
            setCurrentOutcome(json.data.outcome)
            setOutcomeStep(1)
          }
        }
      } catch {
        // non-critical — session continues without outcome
      }
    }
    sendMessage(`I want to work on ${displayName} in ${subject}`)
  }

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const speak = (text: string) => {
    window.speechSynthesis.cancel()
    if (isSpeaking) { setIsSpeaking(false); return }
    const u   = new SpeechSynthesisUtterance(text.substring(0, 400))
    u.rate    = 0.9
    u.pitch   = 1.05
    u.onend   = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const userMessage = (text || input).trim()
    if (!userMessage || isLoading || !sessionId || !learnerId) return

    setInput('')
    setIsLoading(true)

    // Optimistic
    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, {
      id:        tempId,
      role:      'user',
      content:   userMessage,
      timestamp: new Date(),
    }])

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:      userMessage,
          sessionId,
          learnerId,
          subjectId:    sessionState.currentSubject,
          grade:        student?.grade ?? 7,
          sessionState,
          previousMessages: messages
            .slice(-6)
            .map(m => ({ role: m.role, content: m.content, metadata: m.metadata })),
          struggleTopic: struggleTopicRef.current ?? undefined,
          subjectFilter: sessionState.currentSubject || undefined,
        }),
      })

      if (res.status === 403) {
        setShowUpgrade(true)
        setHasAccess(false)
        setMessages(prev => prev.filter(m => m.id !== tempId))
        return
      }

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`)
      }

      const data = await res.json()

      if (data.text) {
        setMessages(prev => [...prev, {
          id:      `msg-${Date.now()}`,
          role:    'assistant',
          content: data.text,
          metadata: {
            pedagogy:        data.pedagogy,
            parentInsight:   data.parentInsight,
            audioOptimized:  data.audioText,
            difficulty:      data.difficulty,
            adaptationReason: data.adaptationReason,
            visualAid:       data.visualAid || undefined,
          },
          timestamp: new Date(),
        }])

        if (data.parentInsight) setParentInsight(data.parentInsight)

        // Handle milestone advancement
        if (data.outcomeAdvanced) {
          const step = data.newOutcomeStep as number
          setOutcomeStep(step)
          setCurrentOutcome(prev => {
            if (!prev) return null
            return {
              ...prev,
              status: data.outcomeAchieved ? 'achieved' : 'in_progress',
              milestones: prev.milestones.map((m, i) =>
                i < step - 1 ? { ...m, achieved: true } : m
              ),
            }
          })
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id:        `milestone-${Date.now()}`,
              role:      'assistant' as const,
              content:   data.outcomeAchieved
                ? `You've got this one. ${currentOutcome?.concept?.replace(/_/g, ' ')} — done.`
                : `Step ${step - 1} done. Moving up.`,
              timestamp: new Date(),
            }])
          }, 400)
        }

        if (data.sessionUpdate) {
          setSessionState({
            timeOnTask:     data.sessionUpdate.timeOnTask,
            currentSubject: data.sessionUpdate.currentSubject || sessionState.currentSubject,
            currentConcept: data.sessionUpdate.currentConcept || '',
          })
        }

        if (data.tokensRemaining !== undefined) {
          setStats(prev => prev ? { ...prev, tokens: data.tokensRemaining } : null)
        }

        // Handle free message gate
        if (freeLeft > 0) {
          const remaining = freeLeft - 1
          setFreeLeft(remaining)
          if (remaining === 0 && data.tokensRemaining === 0 && !stats?.hasSubscription) {
            setShowUpgrade(true)
            setHasAccess(false)
          }
        }

        // Break nudge
        if (data.sessionUpdate?.needsBreak) {
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id:      `break-${Date.now()}`,
              role:    'assistant',
              content: `⏰ Pumzika kidogo! Take a ${data.sessionUpdate.breakDuration || 2}-minute break then come back stronger. Your brain is working hard! 💪`,
              timestamp: new Date(),
            }])
          }, 600)
        }
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setMessages(prev => [...prev, {
        id:      `err-${Date.now()}`,
        role:    'assistant',
        content: 'Pole! Kuna tatizo la mtandao. Jaribu tena.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
      struggleTopicRef.current = null
      inputRef.current?.focus()
    }
  }, [input, isLoading, sessionId, learnerId, sessionState, freeLeft, stats])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Loading screen (while initSession runs) ──────────────────────────────────
  if (!initDone && !hasAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
      </div>
    )
  }

  // ── Locked screen ────────────────────────────────────────────────────────────
  if (!hasAccess && !showUpgrade) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-violet-500/30">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Learning Compass</h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Unlock the Learning Compass — personalised to your child's exact level.
          </p>
          <Link href="/pricing" className="block w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-black hover:scale-105 transition-all shadow-xl mb-3">
            Unlock Now — From KES 500
          </Link>
          <Link href="/dashboard" className="block w-full py-3 bg-white/5 text-white/60 rounded-2xl font-bold hover:bg-white/10 transition-all">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#0a0a14] overflow-hidden">

      {/* ── LEFT SIDEBAR ───────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-white/5 bg-[#0d0d1a]">

        {/* Logo + back */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <ChevronLeft className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-white/80 text-sm tracking-tight">Compass</span>
          </Link>
          <button
            onClick={async () => { if (learnerId) await createNewSession(learnerId) }}
            className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors group"
            title="New session"
          >
            <Plus className="w-4 h-4 text-white/40 group-hover:text-white/70" />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/3 rounded-2xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Streak</span>
                </div>
                <div className="text-2xl font-black text-orange-400">{stats.streakDays}</div>
                <div className="text-[10px] text-white/30">days</div>
              </div>
              <div className="bg-white/3 rounded-2xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Tokens</span>
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {stats.hasSubscription ? '∞' : stats.tokens}
                </div>
                <div className="text-[10px] text-white/30">
                  {stats.hasSubscription ? 'unlimited' : 'left'}
                </div>
              </div>
            </div>

            {/* Current subject */}
            {sessionState.currentSubject && (
              <div className="bg-white/3 rounded-2xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Star className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Now Learning</span>
                </div>
                <div className="font-black text-white/80 capitalize text-sm">{sessionState.currentSubject}</div>
                {sessionState.currentConcept && (
                  <div className="text-[10px] text-white/30 mt-0.5">{sessionState.currentConcept}</div>
                )}
              </div>
            )}

            {/* Session time */}
            {sessionState.timeOnTask > 0 && (
              <div className="bg-white/3 rounded-2xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Session Time</span>
                </div>
                <div className="font-black text-cyan-400 text-sm">{sessionState.timeOnTask} min</div>
              </div>
            )}
          </div>
        )}

        {/* Parent insights toggle */}
        <div className="mt-auto p-4 border-t border-white/5">
          <button
            onClick={() => setShowParent(!showParent)}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
              showParent
                ? 'bg-pink-500/15 border border-pink-500/30 text-pink-300'
                : 'bg-white/3 border border-white/5 text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <Heart className="w-4 h-4" />
            {showParent ? 'Hide' : 'Parent'} Insights
          </button>
        </div>
      </aside>

      {/* ── MAIN CHAT ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0a0a14]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* Mobile back */}
            <Link href="/dashboard" className="lg:hidden w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-white/40" />
            </Link>
            <div>
              <h1 className="font-black text-white text-sm capitalize">
                {sessionState.currentSubject || 'Learning Compass'}
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-green-400 font-bold">
                  Personalised to your level · Parent can see all sessions
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile new session */}
            <button
              onClick={async () => { if (learnerId) await createNewSession(learnerId) }}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl text-xs font-bold text-white/50 hover:bg-white/10 hover:text-white/70 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
            {/* Mobile parent toggle */}
            <button
              onClick={() => setShowParent(!showParent)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                showParent
                  ? 'bg-pink-500/15 text-pink-400'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Parent</span>
            </button>
          </div>
        </header>

        {/* Outcome progress bar */}
        {currentOutcome && currentOutcome.status === 'in_progress' && (
          <div className="px-5 py-3 border-b border-white/5 bg-white/2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">Working toward</p>
              <span className="text-[10px] font-bold text-violet-400">Step {outcomeStep}/4</span>
            </div>
            <p className="text-xs font-bold text-white/70 mb-2 line-clamp-1">
              &ldquo;{currentOutcome.masteryStatement}&rdquo;
            </p>
            <div className="flex gap-1.5">
              {currentOutcome.milestones.map((m, i) => (
                <div
                  key={m.step}
                  title={m.description}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    m.achieved
                      ? 'bg-violet-500'
                      : i === outcomeStep - 1
                        ? 'bg-violet-500/40'
                        : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <p className="text-[10px] text-white/30 mt-1">
              {currentOutcome.milestones[Math.min(outcomeStep - 1, 3)]?.description}
            </p>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-5">

          {/* Empty state */}
          {messages.length === 0 && initDone && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-violet-600/30 rounded-full blur-3xl animate-pulse" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-violet-600/40">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
              </div>

              {learningContext ? (
                // ── PERSONALISED WELCOME ──────────────────────────────────
                (() => {
                  const cb = learningContext.compass_bridge
                  const hasSpecificConcept = !!(cb?.firstConcept && cb.firstConcept !== 'null')
                  const showTopicSelector  = !hasSpecificConcept && !topicSelected

                  return (
                    <>
                      <h2 className="text-2xl font-black text-white mb-1">Karibu! 🇰🇪</h2>

                      {hasSpecificConcept ? (
                        // compass_bridge has a specific concept — skip selector
                        <>
                          <p className="text-white/50 mb-1 text-sm">Today we start with</p>
                          <p className="text-xl font-black text-violet-300 mb-2 capitalize">
                            {(cb?.firstConcept ?? '').replace(/_/g, ' ')}
                          </p>
                          {cb?.teacherSuggested && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400/70 mb-2">
                              <span>📌</span>
                              <span>Your teacher suggested starting with this</span>
                            </div>
                          )}
                          {learningContext.session_goal && (
                            <p className="text-white/40 text-xs max-w-sm mb-6 leading-relaxed">
                              {learningContext.session_goal}
                            </p>
                          )}
                          <button
                            onClick={() => {
                              const concept = (cb?.firstConcept ?? '').replace(/_/g, ' ')
                              const subject = cb?.firstSubject ?? learningContext.first_subject
                              struggleTopicRef.current = cb?.firstConcept ?? null
                              sendMessage(`I want to work on ${concept} in ${subject}`)
                            }}
                            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl text-sm transition-colors mb-4"
                          >
                            Start →
                          </button>
                        </>
                      ) : showTopicSelector ? (
                        // No concept set — show personalised topic choice
                        <TopicChoice
                          studentName={student?.name ?? 'there'}
                          currentOutcome={currentOutcome}
                          availableTopics={availableTopicsForChoice}
                          teacherAssigned={null}
                          onSelect={(concept, substrand, displayName, subject) => {
                            setTopicSelected(true)
                            generateOutcomeAndStart(concept, substrand, displayName, subject)
                          }}
                          onContinue={() => {
                            if (currentOutcome) {
                              setTopicSelected(true)
                              struggleTopicRef.current = currentOutcome.substrand || currentOutcome.concept
                              sendMessage(`Let's continue with ${currentOutcome.concept.replace(/_/g, ' ')}`)
                            }
                          }}
                          onHelpDecide={() => {
                            setTopicSelected(true)
                            struggleTopicRef.current = 'help_me_decide'
                            sendMessage(`I need help deciding what to work on in ${learningContext.first_subject}`)
                          }}
                        />
                      ) : (
                        // topicSelected — already sent, show minimal state
                        <>
                          <p className="text-white/50 mb-1 text-sm">Learning</p>
                          <p className="text-xl font-black text-violet-300 mb-2 capitalize">
                            {learningContext.first_subject}
                          </p>
                        </>
                      )}

                      {/* Tier badge */}
                      <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs text-white/40 font-bold capitalize mt-2">
                        Level: {learningContext.overall_tier?.replace(/_/g, ' ')}
                        {learningContext.recommended_pathway && ` · ${learningContext.recommended_pathway} pathway`}
                      </div>
                    </>
                  )
                })()
              ) : (
                // ── GENERIC WELCOME FALLBACK ──────────────────────────────
                <>
                  <h2 className="text-2xl font-black text-white mb-2">Karibu! 🇰🇪</h2>
                  <p className="text-white/50 mb-8 max-w-sm leading-relaxed text-sm">
                    Mimi ni mwalimu wako wa kibinafsi. Niulize chochote — nitakusaidia kuelewa vizuri.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/40 rounded-full text-sm text-white/60 hover:text-white/90 font-medium transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-6 bg-white/5 border border-white/10 rounded-xl px-5 py-3 max-w-md mx-auto">
                <p className="text-xs text-white/40 text-center leading-relaxed">
                  Your progress is saved and visible to your parent.
                </p>
              </div>

              {/* Free message banner */}
              {freeLeft > 0 && !stats?.hasSubscription && (stats?.tokens || 0) === 0 && (
                <div className="mt-8 flex items-center gap-2 px-5 py-2.5 bg-green-500/10 border border-green-500/20 rounded-full">
                  <Sparkles className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-bold text-green-300">
                    🎁 {freeLeft} free message — try it now!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onExpand={setExpandedDiagram}
              onSpeak={speak}
              onParentInsight={setParentInsight}
            />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3 items-end">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="px-4 py-3 bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1.5">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ────────────────────────────────────────────────────── */}
        <div className="px-4 md:px-6 py-4 border-t border-white/5 bg-[#0a0a14]/90 backdrop-blur-xl">

          {/* Free message indicator */}
          {freeLeft > 0 && messages.length > 0 && !stats?.hasSubscription && (stats?.tokens || 0) === 0 && (
            <div className="flex justify-center mb-3">
              <span className="text-xs font-bold text-green-400/70 bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/15">
                🎁 {freeLeft} free message remaining
              </span>
            </div>
          )}

          <div className="flex gap-3 items-end max-w-3xl mx-auto">

            {/* Mic button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                  : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/8 hover:text-white/60'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  // Auto-resize
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening...' : 'Ask me anything... (Enter to send)'}
                rows={1}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm font-medium resize-none focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all leading-relaxed"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/25 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>

          <p className="text-center text-[10px] text-white/15 mt-3 font-medium">
            Shift+Enter for new line • Powered by DeepSeek AI • CBC Kenya aligned
          </p>
        </div>
      </div>

      {/* ── PARENT INSIGHTS PANEL ──────────────────────────────────────────── */}
      {showParent && (
        <aside className="fixed inset-0 z-30 lg:static lg:inset-auto lg:z-auto lg:w-80 border-l border-white/5 bg-[#0d0d1a] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="font-black text-white/80 text-sm">Parent Insights</span>
            </div>
            <button
              onClick={() => setShowParent(false)}
              className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1">
            {parentInsight ? (
              <>
                {[
                  { label: 'Learning Now',      value: parentInsight.conceptAttempted, color: 'text-violet-300' },
                  { label: 'Their Approach',    value: parentInsight.childApproach,    color: 'text-cyan-300'   },
                  { label: 'Celebrate! 🎉',     value: parentInsight.celebrationMoment,color: 'text-green-300' },
                  { label: 'Practice at Home',  value: parentInsight.practiceIdea,     color: 'text-amber-300' },
                  { label: 'Why This Task?',    value: parentInsight.whyThisTask,       color: 'text-white/60'  },
                ].map(({ label, value, color }) => value ? (
                  <div key={label} className="bg-white/3 border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-wider mb-2">{label}</p>
                    <p className={`text-sm font-medium leading-relaxed ${color}`}>{value}</p>
                  </div>
                ) : null)}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Heart className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-sm text-white/30 font-medium">
                  Insights appear after the first response
                </p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── UPGRADE MODAL ──────────────────────────────────────────────────── */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="relative w-full max-w-md bg-[#0d0d1a] rounded-3xl border border-white/10 p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-600/30">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Loved the Experience?</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Continue with personalised tutoring that adapts to your child's exact level.
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {[
                'Unlimited tutoring sessions',
                'Adapts to your child\'s CBC level',
                'Adapts to your child\'s exact CBC level',
                'Visual diagrams for Science & Geography',
                'Parent insights after every session',
                'Kenyan context — chapati, matatu & more',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 text-[10px]">✓</span>
                  </div>
                  <span className="text-sm text-white/70 font-medium">{f}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Link
                href="/pricing"
                className="block w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-black text-center hover:scale-[1.02] transition-all shadow-xl shadow-violet-600/25"
              >
                Unlock Full Access — From KES 500
              </Link>
              <button
                onClick={() => setShowUpgrade(false)}
                className="block w-full py-3 bg-white/5 text-white/50 rounded-2xl font-bold hover:bg-white/8 transition-all text-sm"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIAGRAM MODAL ──────────────────────────────────────────────────── */}
      {expandedDiagram && (
        <DiagramModal aid={expandedDiagram} onClose={() => setExpandedDiagram(null)} />
      )}
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function LearningCompassPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/30 text-sm font-bold">Loading Compass...</p>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}