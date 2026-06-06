'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Send, Brain, RotateCcw } from 'lucide-react'

interface Message {
  id:      string
  role:    'compass' | 'student'
  content: string
}

const SUBJECTS = [
  { id: 'mathematics',        label: 'Mathematics' },
  { id: 'english',            label: 'English' },
  { id: 'kiswahili',          label: 'Kiswahili' },
  { id: 'integrated_science', label: 'Integrated Science' },
  { id: 'social_studies',     label: 'Social Studies' },
  { id: 'agriculture',        label: 'Agriculture' },
  { id: 'pre_technical',      label: 'Pre-Technical' },
  { id: 'creative_arts',      label: 'Creative Arts' },
  { id: 'biology',            label: 'Biology' },
  { id: 'chemistry',          label: 'Chemistry' },
  { id: 'physics',            label: 'Physics' },
  { id: 'history',            label: 'History' },
  { id: 'geography',          label: 'Geography' },
]

function LearnContent() {
  const [supabase] = useState(() => createClient())
  const searchParams = useSearchParams()
  const studentId = searchParams.get('student')

  // Student
  const [studentName, setStudentName] = useState('there')
  const [grade, setGrade]             = useState(9)
  const [level, setLevel]             = useState(2)

  // Session
  const [subject, setSubject]         = useState<string | null>(null)
  const [topic, setTopic]             = useState<string>('')
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [rightStreak, setRightStreak] = useState(0)
  const [wrongStreak, setWrongStreak] = useState(0)
  const [started, setStarted]         = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load student
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const query = studentId
        ? supabase
            .from('students')
            .select('name, grade, student_learning_context(overall_level)')
            .eq('id', studentId)
            .maybeSingle()
        : supabase
            .from('students')
            .select('name, grade, student_learning_context(overall_level)')
            .eq('user_id', user.id)
            .maybeSingle()

      const { data } = await query
      if (data) {
        setStudentName(data.name?.split(' ')[0] || 'there')
        setGrade(data.grade || 9)
        const ctx = Array.isArray(data.student_learning_context)
          ? data.student_learning_context[0]
          : data.student_learning_context
        setLevel((ctx as { overall_level?: number } | null)?.overall_level || 2)
      }
    }
    init()
  }, [supabase, studentId])

  // Start session
  const startSession = useCallback(async (
    selectedSubject: string,
    selectedTopic:   string,
  ) => {
    setSubject(selectedSubject)
    setTopic(selectedTopic)
    setMessages([])
    setRightStreak(0)
    setWrongStreak(0)
    setStarted(true)
    setIsLoading(true)

    try {
      const res = await fetch('/api/learn', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     `Let's start with ${selectedTopic}`,
          subject:     selectedSubject,
          topic:       selectedTopic,
          level,
          grade,
          studentName,
          history:     [],
          rightStreak: 0,
          wrongStreak: 0,
        }),
      })

      const data = await res.json() as { success: boolean; data: { text: string } }

      if (data.success) {
        setMessages([{
          id:      'compass-1',
          role:    'compass',
          content: data.data.text,
        }])
      }
    } catch (err) {
      console.error('[startSession]', err)
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [level, grade, studentName])

  // Send message
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading || !subject) return

    setInput('')
    const newMsg: Message = {
      id:      `s-${Date.now()}`,
      role:    'student',
      content: text,
    }
    const newMessages = [...messages, newMsg]
    setMessages(newMessages)
    setIsLoading(true)

    const lower = text.toLowerCase()
    const looksCorrect = /correct|right|yes|got it|understand|nimeelewa|sawa|vizuri/i.test(lower)
    const looksWrong   = /wrong|no|don't understand|confused|help|sijui/i.test(lower)

    const newRight = looksCorrect ? rightStreak + 1 : 0
    const newWrong = looksWrong   ? wrongStreak + 1 : 0
    setRightStreak(newRight)
    setWrongStreak(newWrong)

    try {
      const res = await fetch('/api/learn', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     text,
          subject,
          topic,
          level,
          grade,
          studentName,
          history:     newMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          rightStreak: newRight,
          wrongStreak: newWrong,
        }),
      })

      const data = await res.json() as { success: boolean; data: { text: string } }

      if (data.success) {
        setMessages(prev => [...prev, {
          id:      `c-${Date.now()}`,
          role:    'compass',
          content: data.data.text,
        }])
      }
    } catch (err) {
      console.error('[sendMessage]', err)
      setMessages(prev => [...prev, {
        id:      `err-${Date.now()}`,
        role:    'compass',
        content: 'Something went wrong. Try again.',
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, subject, topic, level, grade, studentName, messages, rightStreak, wrongStreak])

  // Reset
  const reset = () => {
    setSubject(null)
    setTopic('')
    setMessages([])
    setStarted(false)
    setRightStreak(0)
    setWrongStreak(0)
    setInput('')
  }

  // ── SCREEN 1: Topic picker ─────────────────────────────────────────────────

  if (!started) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex flex-col">

        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 bg-linear-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-black text-white text-sm">Learning Compass</p>
            <p className="text-[10px] text-white/30">Personalised to your level</p>
          </div>
        </div>

        <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full">

          <h2 className="text-xl font-black text-white mb-1">Hey {studentName}.</h2>
          <p className="text-white/50 text-sm mb-8">What would you like to work on?</p>

          <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3">
            Choose a subject
          </p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {SUBJECTS.map(s => (
              <button
                key={s.id}
                onClick={() => startSession(s.id, s.label)}
                className="px-4 py-3 bg-white/5 hover:bg-violet-500/15 border border-white/10 hover:border-violet-500/30 rounded-xl text-sm text-white/70 hover:text-white font-medium text-left transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2">
            Or type a specific topic
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Fractions, Cell Structure, Essay Writing..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && topic.trim()) {
                  startSession('general', topic.trim())
                }
              }}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => { if (topic.trim()) startSession('general', topic.trim()) }}
              disabled={!topic.trim()}
              className="px-4 py-3 bg-violet-600 rounded-xl text-white text-sm font-bold disabled:opacity-30 transition-all"
            >
              Start
            </button>
          </div>

          <p className="text-center text-xs text-white/20 mt-8">
            Your progress is visible to your parent.
          </p>
        </div>
      </div>
    )
  }

  // ── SCREEN 2: Chat session ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#0a0a14]">

      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
        <button
          onClick={reset}
          className="text-white/40 hover:text-white/70 text-sm flex items-center gap-1 transition-colors"
        >
          ← Topics
        </button>
        <div className="text-center">
          <p className="text-xs font-bold text-white/70 capitalize">{topic}</p>
          <p className="text-[10px] text-white/30">Level {level}/4 · Grade {grade}</p>
        </div>
        <button
          onClick={reset}
          className="text-white/30 hover:text-white/60 transition-colors"
          title="Change topic"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'student'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-white/8 border border-white/10 text-white/90 rounded-bl-sm'
            }`}>
              {msg.content}
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

      <div className="px-4 py-3 border-t border-white/5 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
            placeholder={isLoading ? 'Compass is thinking...' : 'Type your answer...'}
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 shrink-0 bg-linear-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center disabled:opacity-30 transition-all"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <Brain className="w-8 h-8 text-violet-400 animate-pulse" />
      </div>
    }>
      <LearnContent />
    </Suspense>
  )
}
