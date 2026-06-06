'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Brain, RotateCcw, ChevronRight, Trophy, Send } from 'lucide-react'
import TopicChoice, { type TopicSelectParams } from '@/components/compass/TopicChoice'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id:          string
  role:        'compass' | 'student'
  content:     string
  choices?:    string[]
  isQuestion?: boolean
}

interface SessionProgress {
  attempted: number
  correct:   number
  streak:    number
}

interface SessionSummary {
  topic:       string
  attempted:   number
  correct:     number
  mastery:     number
  timeMinutes: number
  nextTopic:   string | null
}

type Screen = 'topic_pick' | 'session' | 'complete'

interface Student {
  id:              string
  name:            string
  grade:           number
  curriculum_type: string
  current_pathway: string | null
}

// ── Mastery bar ───────────────────────────────────────────────────────────────

function MasteryBar({ score }: { score: number }) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-white/40 font-medium">Mastery</span>
        <span className={`text-xs font-bold ${
          score >= 80 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-white/40'
        }`}>
          {score}%
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-violet-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// ── Main content ──────────────────────────────────────────────────────────────

function LearnContent() {
  const [supabase]    = useState(() => createClient())
  const searchParams  = useSearchParams()
  const studentId     = searchParams.get('student')

  const [student, setStudent]           = useState<Student | null>(null)
  const [screen, setScreen]             = useState<Screen>('topic_pick')
  const [sessionId, setSessionId]       = useState<string | null>(null)
  const [questionNum, setQuestionNum]   = useState(1)
  const [isLoading, setIsLoading]       = useState(false)
  const [masteryScore, setMasteryScore] = useState(0)
  const [progress, setProgress]         = useState<SessionProgress>({ attempted: 0, correct: 0, streak: 0 })
  const [summary, setSummary]           = useState<SessionSummary | null>(null)
  const [startTime, setStartTime]       = useState(Date.now())
  const [topicDisplay, setTopicDisplay] = useState('')
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load student: URL param → own student account → nothing
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (studentId) {
        const { data } = await supabase
          .from('students')
          .select('id, name, grade, curriculum_type, current_pathway')
          .eq('id', studentId)
          .maybeSingle()
        if (data) setStudent(data as Student)
      } else {
        const { data: selfStudent } = await supabase
          .from('students')
          .select('id, name, grade, curriculum_type, current_pathway')
          .eq('user_id', user.id)
          .maybeSingle()
        if (selfStudent) setStudent(selfStudent as Student)
      }
    }
    init()
  }, [supabase, studentId])

  const resetSession = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setQuestionNum(0)
    setMasteryScore(0)
    setProgress({ attempted: 0, correct: 0, streak: 0 })
    setTopicDisplay('')
  }, [])

  // Start session when topic is picked
  const handleTopicSelect = useCallback(async (params: TopicSelectParams) => {
    setIsLoading(true)
    setTopicDisplay(params.displayName)
    setStartTime(Date.now())

    try {
      const res  = await fetch('/api/learn', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject:      params.subject,
          topic:        params.substrand,
          topicDisplay: params.displayName,
          grade:        params.grade,
          studentId:    student?.id ?? null,
        }),
      })
      const data = await res.json() as {
        success: boolean
        data: {
          sessionId: string
          question:  { text: string; type: string; choices?: string[] }
        }
      }

      if (data.success) {
        const firstQ = data.data.question
        setMessages([{
          id:         'q-1',
          role:       'compass',
          content:    firstQ.text,
          choices:    firstQ.choices ?? undefined,
          isQuestion: true,
        }])
        setSessionId(data.data.sessionId)
        setQuestionNum(1)
        setMasteryScore(0)
        setProgress({ attempted: 0, correct: 0, streak: 0 })
        setStartTime(Date.now())
        setScreen('session')
      }
    } catch (err) {
      console.error('[handleTopicSelect]', err)
    } finally {
      setIsLoading(false)
    }
  }, [student])

  const handleSend = useCallback(async (forcedInput?: string) => {
    const answer = (forcedInput || input).trim()
    if (!answer || isLoading || !sessionId) return

    setInput('')
    setIsLoading(true)

    setMessages(prev => [...prev, {
      id:      `s-${Date.now()}`,
      role:    'student' as const,
      content: answer,
    }])

    try {
      const res = await fetch('/api/learn', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessionId,
          questionNum,
          studentAnswer: answer,
          timeTaken: Math.round((Date.now() - startTime) / 1000),
        }),
      })

      const data = await res.json() as {
        success: boolean
        data: {
          isCorrect:        boolean
          encouragement:    string
          feedback:         string
          nextAction:       'continue' | 'complete'
          masteryScore:     number
          progress?:        SessionProgress
          nextQuestion?:    { text: string; type: string; choices?: string[] }
          nextQuestionNum?: number
          sessionSummary?:  SessionSummary
        }
      }

      if (data.success) {
        setMasteryScore(data.data.masteryScore)
        if (data.data.progress) setProgress(data.data.progress)

        setMessages(prev => [...prev, {
          id:      `c-${Date.now()}`,
          role:    'compass' as const,
          content: `${data.data.encouragement} ${data.data.feedback}`,
        }])

        if (data.data.nextAction === 'complete') {
          if (data.data.sessionSummary) setSummary(data.data.sessionSummary)
          setTimeout(() => setScreen('complete'), 1500)

        } else if (data.data.nextQuestion) {
          const nextQ   = data.data.nextQuestion
          const nextNum = data.data.nextQuestionNum ?? questionNum + 1
          setQuestionNum(nextNum)
          setStartTime(Date.now())

          setTimeout(() => {
            setMessages(prev => [...prev, {
              id:         `q-${nextNum}`,
              role:       'compass' as const,
              content:    nextQ.text,
              choices:    nextQ.choices ?? undefined,
              isQuestion: true,
            }])
          }, 600)
        }
      }
    } catch (err) {
      console.error('[handleSend]', err)
      setMessages(prev => [...prev, {
        id:      `err-${Date.now()}`,
        role:    'compass' as const,
        content: 'Something went wrong. Try again.',
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, sessionId, questionNum, startTime])

  // ── RENDER ───────────────────────────────────────────────────────────────────

  if (screen === 'topic_pick') {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex flex-col">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 bg-linear-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white text-sm">Learning Compass</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Brain className="w-8 h-8 text-violet-400 animate-pulse" />
              <p className="text-white/40 text-sm">Starting your session...</p>
            </div>
          ) : (
            <TopicChoice
              studentName={student?.name ?? 'there'}
              studentGrade={student?.grade ?? 9}
              curriculumType={student?.curriculum_type ?? 'cbc'}
              currentPathway={student?.current_pathway ?? null}
              currentOutcome={null}
              weakAreas={[]}
              onSelect={handleTopicSelect}
              onContinue={() => {}}
            />
          )}
        </div>
      </div>
    )
  }

  if (screen === 'session') {
    return (
      <div className="flex flex-col h-screen bg-[#0a0a14]">

        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => { resetSession(); setScreen('topic_pick') }}
              className="text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              ← Topics
            </button>
            <div className="text-center">
              <p className="text-xs text-white/60 font-bold">{topicDisplay}</p>
              <p className="text-[10px] text-white/30">Q{questionNum} · {masteryScore}% mastery</p>
            </div>
            <div className="w-16" />
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                masteryScore >= 80 ? 'bg-green-400'
                : masteryScore >= 50 ? 'bg-amber-400'
                : 'bg-violet-500'
              }`}
              style={{ width: `${masteryScore}%` }}
            />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'student'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-white/8 border border-white/10 text-white/90 rounded-bl-sm'
              }`}>
                {msg.content}

                {msg.choices && msg.role === 'compass' && (
                  <div className="mt-3 space-y-2">
                    {msg.choices.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(c[0])}
                        disabled={isLoading}
                        className="w-full text-left px-3 py-2.5 bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/30 rounded-xl text-xs text-white/70 hover:text-white disabled:opacity-30 transition-all"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
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

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/5 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={isLoading ? 'Compass is thinking...' : 'Type your answer...'}
              disabled={isLoading}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/50 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 shrink-0 bg-linear-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-white/15 mt-2">
            Tap A, B or C — or type your answer
          </p>
        </div>
      </div>
    )
  }

  if (screen === 'complete' && summary) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center px-5">
        <div className="w-20 h-20 bg-linear-to-br from-amber-500/20 to-orange-500/20 rounded-3xl flex items-center justify-center mb-6">
          <Trophy className="w-10 h-10 text-amber-400" />
        </div>

        <h2 className="text-2xl font-black text-white mb-1">Session Complete</h2>
        <p className="text-white/40 text-sm mb-8">{summary.topic}</p>

        <div className="w-full max-w-sm space-y-3 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <MasteryBar score={summary.mastery} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Questions', value: summary.attempted, color: '' },
              { label: 'Correct',   value: summary.correct,   color: 'text-green-400' },
              { label: 'Minutes',   value: summary.timeMinutes, color: '' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                <div className={`text-2xl font-black mb-1 ${color || 'text-white'}`}>{value}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          <div className={`rounded-2xl p-4 text-center ${
            summary.mastery >= 80
              ? 'bg-green-500/10 border border-green-500/20'
              : summary.mastery >= 60
              ? 'bg-amber-500/10 border border-amber-500/20'
              : 'bg-white/5 border border-white/10'
          }`}>
            <p className={`font-bold text-sm ${
              summary.mastery >= 80 ? 'text-green-400'
              : summary.mastery >= 60 ? 'text-amber-400'
              : 'text-white/60'
            }`}>
              {summary.mastery >= 80
                ? 'Mastered! Ready for next topic.'
                : summary.mastery >= 60
                ? 'Good progress. Another session will solidify this.'
                : "Keep practicing. You're building understanding."}
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {summary.nextTopic && summary.mastery >= 80 && (
            <button
              onClick={() => { resetSession(); setScreen('topic_pick') }}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2"
            >
              Start {summary.nextTopic}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => { resetSession(); setScreen('topic_pick') }}
            className="w-full py-3 bg-white/5 border border-white/10 text-white/60 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Pick Another Topic
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ── Page wrapper with Suspense for useSearchParams ────────────────────────────

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
          <Brain className="w-8 h-8 text-violet-400 animate-pulse" />
        </div>
      }
    >
      <LearnContent />
    </Suspense>
  )
}
