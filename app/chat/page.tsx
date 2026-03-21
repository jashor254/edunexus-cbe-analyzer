// app/chat/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Brain, 
  Send,
  Mic,
  Volume2,
  Sparkles,
  ArrowLeft,
  Zap,
  Target,
  Heart,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  Flame,
  Star,
  Image as ImageIcon
} from 'lucide-react'
import Link from 'next/link'

// Import VisualAid type from LearningCompass
import type { VisualAid } from '@/lib/ai/learningCompass'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: {
    pedagogy?: any
    parentInsight?: any
    audioOptimized?: string
    difficulty?: number
    adaptationReason?: string
    visualAid?: VisualAid  // 👈 NEW: Visual aid support!
  }
  timestamp: Date
}

interface LearnerStats {
  streakDays: number
  conceptsMastered: number
  avgCognitiveLoad: string
  tokens: number
}

export default function LearningCompassChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [learnerId, setLearnerId] = useState<string | null>(null)
  const [stats, setStats] = useState<LearnerStats | null>(null)
  const [showParentMode, setShowParentMode] = useState(false)
  const [currentInsight, setCurrentInsight] = useState<any>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [freeMessagesLeft, setFreeMessagesLeft] = useState(1) // 🎁 1 FREE MESSAGE!
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [selectedImage, setSelectedImage] = useState<VisualAid | null>(null) // 👈 For full-screen diagram
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()

  useEffect(() => {
    initSession()
    initSpeechRecognition()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const initSession = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setLearnerId(user.id)
    
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        *,
        parent_profiles (subscription_tier),
        user_tokens (balance)
      `)
      .eq('id', user.id)
      .single()

    if (profile) {
      const planType = profile.parent_profiles?.[0]?.subscription_tier || 'trial'
      const tokenBalance = profile.user_tokens?.[0]?.balance || 0
      const isPremium = planType === 'single' || planType === 'family'
      
      setStats({
        streakDays: 3,
        conceptsMastered: 12,
        avgCognitiveLoad: 'optimal',
        tokens: tokenBalance
      })
      
      // 🎁 EVERYONE GETS 1 FREE MESSAGE!
      // Always allow access initially (free message)
      setHasAccess(true)
      setFreeMessagesLeft(1)
    }
    
    const { data: existing } = await supabase
      .from('compass_sessions')
      .select('*')
      .eq('learner_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      setSessionId(existing.id)
      loadMessages(existing.id)
    } else {
      createNewSession(user.id)
    }
  }

  const createNewSession = async (userId: string) => {
    const { data } = await supabase
      .from('compass_sessions')
      .insert({
        learner_id: userId,
        title: 'New Learning Journey',
        grade: 7,
        subject_id: 'mathematics',
        status: 'active'
      })
      .select()
      .single()
    
    if (data) {
      setSessionId(data.id)
      setMessages([])
    }
  }

  const loadMessages = async (sId: string) => {
    const { data } = await supabase
      .from('compass_messages')
      .select('*')
      .eq('session_id', sId)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data.map(m => ({
        ...m,
        timestamp: new Date(m.created_at),
        metadata: m.metadata || {}
      })))
    }
  }

  const initSpeechRecognition = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = false
    recognitionRef.current.lang = 'en-US'
    recognitionRef.current.onresult = (event: any) => {
      setInput(event.results[0][0].transcript)
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Voice input not supported')
      return
    }
    recognitionRef.current.start()
  }

  const speak = (text: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.substring(0, 300))
    utterance.rate = 0.9
    utterance.pitch = 1.1
    window.speechSynthesis.speak(utterance)
  }

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading || !sessionId || !learnerId) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    const tempId = Date.now().toString()
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          learnerId,
          subjectId: 'mathematics',
          grade: 7
        }),
      })

      const data = await res.json()

      if (data.text) {
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.text,
          metadata: {
            pedagogy: data.pedagogy,
            parentInsight: data.parentInsight,
            audioOptimized: data.audioText,
            difficulty: data.difficulty,
            adaptationReason: data.adaptationReason,
            visualAid: data.visualAid  // 👈 NEW: Visual aid from API
          },
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMsg])
        setCurrentInsight(data.parentInsight)
        
        // 🎁 HANDLE FREE MESSAGE TRACKING
        if (freeMessagesLeft > 0) {
          const newFreeMessagesLeft = freeMessagesLeft - 1
          setFreeMessagesLeft(newFreeMessagesLeft)
          
          // Show upgrade prompt after free message used
          if (newFreeMessagesLeft === 0) {
            // Check if they have tokens or subscription
            const { data: profile } = await supabase
              .from('profiles')
              .select(`
                parent_profiles (subscription_tier),
                user_tokens (balance)
              `)
              .eq('id', learnerId)
              .single()
            
            const planType = profile?.parent_profiles?.[0]?.subscription_tier || 'trial'
            const tokenBalance = profile?.user_tokens?.[0]?.balance || 0
            const isPremium = planType === 'single' || planType === 'family'
            
            if (!isPremium && tokenBalance < 1) {
              // No access - show upgrade prompt
              setShowUpgradePrompt(true)
              setHasAccess(false)
            } else {
              // Has tokens or subscription - continue
              setHasAccess(true)
            }
          }
        }
        
        if (data.tokensRemaining !== undefined) {
          setStats(prev => prev ? { ...prev, tokens: data.tokensRemaining } : null)
        }
      }
    } catch (error) {
      console.error('Failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getStrategyBadge = (strategy: string) => {
    const badges: Record<string, { color: string; icon: any; label: string }> = {
      'socratic-questioning': { color: 'from-purple-500/20 to-purple-600/20 border-purple-500/40 text-purple-300', icon: Lightbulb, label: 'Thinking Together' },
      'worked-example': { color: 'from-blue-500/20 to-blue-600/20 border-blue-500/40 text-blue-300', icon: Brain, label: 'Learning by Example' },
      'break-concept': { color: 'from-orange-500/20 to-orange-600/20 border-orange-500/40 text-orange-300', icon: AlertCircle, label: 'Step by Step' },
      'direct-instruction': { color: 'from-violet-500/20 to-violet-600/20 border-violet-500/40 text-violet-300', icon: TrendingUp, label: 'Clear Guidance' },
      'challenge': { color: 'from-red-500/20 to-red-600/20 border-red-500/40 text-red-300', icon: Zap, label: 'Challenge Mode' },
    }
    return badges[strategy] || badges['direct-instruction']
  }

  /**
   * 👩‍🎨 RENDER VISUAL AID (Diagram)
   * This renders ASCII diagrams beautifully
   */
  const renderVisualAid = (visualAid?: VisualAid) => {
    if (!visualAid) return null
    
    return (
      <div className="mt-4 mb-2">
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full mb-2">
          <ImageIcon className="w-3 h-3 text-amber-400" />
          <span className="text-xs font-bold text-amber-300">Diagram</span>
        </div>
        
        <div 
          className="bg-slate-900/80 backdrop-blur-sm border border-violet-500/30 rounded-2xl p-5 font-mono text-sm text-cyan-300 whitespace-pre overflow-x-auto cursor-pointer hover:border-violet-400 transition-colors"
          onClick={() => setSelectedImage(visualAid)}
        >
          {visualAid.content}
        </div>
        
        {visualAid.caption && (
          <p className="text-xs text-slate-400 mt-1 italic">
            {visualAid.caption}
          </p>
        )}
      </div>
    )
  }

  /**
   * 🖼️ FULL-SCREEN DIAGRAM MODAL
   */
  const renderFullScreenDiagram = () => {
    if (!selectedImage) return null
    
    return (
      <div 
        className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-8"
        onClick={() => setSelectedImage(null)}
      >
        <div 
          className="relative max-w-4xl w-full bg-slate-900 rounded-3xl border-4 border-violet-500/50 p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-red-500/20 hover:bg-red-500/40 rounded-full flex items-center justify-center text-white text-xl font-bold transition-colors"
          >
            ✕
          </button>
          
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-bold text-white">
              {selectedImage.subject || 'Diagram'} - {selectedImage.concept || ''}
            </h3>
          </div>
          
          <div className="bg-slate-950 rounded-xl p-8 font-mono text-lg text-cyan-300 whitespace-pre overflow-x-auto border-2 border-violet-500/30">
            {selectedImage.content}
          </div>
          
          {selectedImage.caption && (
            <p className="text-slate-300 mt-4 text-center">
              {selectedImage.caption}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative max-w-md w-full backdrop-blur-xl bg-white/5 rounded-[40px] p-8 border border-white/10 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Brain className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Learning Compass Locked</h2>
          <p className="text-violet-200 mb-8 text-lg">
            Unlock your AI-powered personal tutor with tokens or subscription.
          </p>
          <div className="space-y-3">
            <Link
              href="/pricing"
              className="block w-full py-4 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-2xl"
            >
              Unlock Now
            </Link>
            <Link
              href="/dashboard"
              className="block w-full py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[150px]" />
      </div>

      {/* LEFT SIDEBAR */}
      <div className="relative w-80 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/60 border-r border-white/10 flex-col hidden lg:flex">
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-violet-900/30 to-cyan-900/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500 blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                  <Brain className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Learning Compass</h1>
                <div className="flex items-center gap-1 text-xs text-violet-300 font-bold">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Tutor</span>
                </div>
              </div>
            </div>
            <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-xl transition-colors group">
              <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </Link>
          </div>
        </div>

        {stats && (
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-2xl p-5">
              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/20 rounded-full blur-2xl" />
              <div className="relative flex items-center gap-3 mb-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <div className="text-sm font-bold text-orange-300 uppercase tracking-wider">Streak</div>
              </div>
              <div className="text-4xl font-black text-orange-400">{stats.streakDays} days 🔥</div>
            </div>

            <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-violet-300 font-bold text-sm mb-2">
                <Star className="w-4 h-4" />
                Concepts Mastered
              </div>
              <div className="text-3xl font-black text-violet-400">{stats.conceptsMastered}</div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-5">
              <div className="text-cyan-300 font-bold text-sm mb-2">Learning Zone</div>
              <div className="text-lg font-black text-cyan-400">
                {stats.avgCognitiveLoad === 'optimal' ? 'Perfect! 🎯' :
                 stats.avgCognitiveLoad === 'high' ? 'Working Hard 💪' :
                 'Building Up 🌱'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm mb-2">
                <Zap className="w-5 h-5 fill-amber-400" />
                Tokens Left
              </div>
              <div className="text-3xl font-black text-amber-400">{stats.tokens}</div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-white/10 bg-slate-950/40">
          <button
            onClick={() => setShowParentMode(!showParentMode)}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-r from-pink-600/20 to-rose-600/20 hover:from-pink-600/30 hover:to-rose-600/30 border border-pink-500/30 text-pink-300 font-bold transition-all hover:scale-105"
          >
            <Heart className="w-5 h-5" />
            {showParentMode ? 'Hide' : 'Show'} Parent View
          </button>
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className="relative flex-1 flex flex-col">
        {/* Header */}
        <div className="backdrop-blur-2xl bg-slate-900/60 border-b border-white/10 p-4 flex justify-between items-center">
          <div>
            <h2 className="font-black text-white text-lg">Today's Learning</h2>
            <p className="text-xs text-violet-300 font-bold">Mathematics • CBC Aligned</p>
          </div>
          <button
            onClick={() => createNewSession(learnerId!)}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-xl text-sm font-black hover:scale-105 transition-all shadow-xl"
          >
            New Topic
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-8 px-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-full blur-3xl opacity-50 animate-pulse" />
                <div className="relative w-32 h-32 bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl">
                  <Sparkles className="w-16 h-16 text-white" />
                </div>
              </div>
              <div className="max-w-lg">
                <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Karibu! Ready to learn?</h3>
                <p className="text-xl text-violet-200 mb-6 font-medium">
                  I'm your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 font-black">personal AI tutor</span> - ask me anything!
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  {['How do fractions work?', 'Explain photosynthesis', 'Help with division'].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-violet-500/50 rounded-2xl text-sm text-violet-200 font-medium transition-all hover:scale-105 backdrop-blur-xl"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl w-full ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} flex gap-4 items-start`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                    : 'bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500'
                }`}>
                  {msg.role === 'user' ? (
                    <span className="text-white text-sm font-black">You</span>
                  ) : (
                    <Brain className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Metadata badges */}
                  {msg.role === 'assistant' && msg.metadata && (
                    <div className="flex flex-wrap gap-2">
                      {msg.metadata.pedagogy && (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r ${getStrategyBadge(msg.metadata.pedagogy.strategy).color} border backdrop-blur-xl`}>
                          {(() => {
                            const Icon = getStrategyBadge(msg.metadata.pedagogy.strategy).icon
                            return <Icon className="w-3.5 h-3.5" />
                          })()}
                          {getStrategyBadge(msg.metadata.pedagogy.strategy).label}
                        </div>
                      )}
                      {msg.metadata.difficulty && (
                        <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 backdrop-blur-xl">
                          Level {msg.metadata.difficulty}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className={`p-5 rounded-3xl shadow-2xl backdrop-blur-xl ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-tr-md' 
                      : 'bg-gradient-to-br from-white/10 to-white/5 border border-white/20 text-white rounded-tl-md'
                  }`}>
                    <div className="prose prose-sm max-w-none prose-invert">
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className="mb-3 last:mb-0 leading-relaxed font-medium">{line}</p>
                      ))}
                    </div>
                    
                    {/* 👩‍🎨 RENDER VISUAL AID HERE */}
                    {msg.role === 'assistant' && msg.metadata?.visualAid && renderVisualAid(msg.metadata.visualAid)}
                  </div>

                  {/* Actions */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => speak(msg.metadata?.audioOptimized || msg.content)}
                        className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-100 transition-colors font-bold group"
                      >
                        <Volume2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Listen
                      </button>
                      {msg.metadata?.parentInsight && (
                        <button
                          onClick={() => setCurrentInsight(msg.metadata.parentInsight)}
                          className="flex items-center gap-1.5 text-xs text-pink-300 hover:text-pink-100 transition-colors font-bold group"
                        >
                          <Heart className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          Parent Tip
                        </button>
                      )}
                      {msg.metadata?.visualAid && (
                        <button
                          onClick={() => setSelectedImage(msg.metadata.visualAid!)}
                          className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-100 transition-colors font-bold group"
                        >
                          <ImageIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          View Full Diagram
                        </button>
                      )}
                      {msg.metadata?.adaptationReason && (
                        <div className="text-xs text-cyan-300 font-medium">
                          {msg.metadata.adaptationReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 text-violet-300">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-bounce" />
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              <span className="text-sm font-bold">Compass thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="backdrop-blur-2xl bg-slate-900/60 border-t border-white/10 p-6">
          <div className="max-w-4xl mx-auto flex gap-3">
            <button
              type="button"
              onClick={toggleListening}
              className="p-4 text-violet-400 hover:text-violet-300 hover:bg-white/10 rounded-2xl transition-all hover:scale-105"
            >
              <Mic className="w-6 h-6" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={freeMessagesLeft > 0 ? "Try your FREE message! Ask anything..." : "Ask anything..."}
              className="flex-1 px-6 py-4 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 text-white placeholder-slate-400 font-medium transition-all backdrop-blur-xl text-lg"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-8 py-4 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-2xl font-black hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3 shadow-2xl"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </div>
          
          {/* Free message indicator */}
          {freeMessagesLeft > 0 && (
            <div className="max-w-4xl mx-auto mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-full backdrop-blur-xl">
                <Sparkles className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-green-300">
                  🎁 {freeMessagesLeft} FREE message left - Try it now!
                </span>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* PARENT INSIGHTS PANEL */}
      {showParentMode && (
        <div className="relative w-96 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/60 border-l border-white/10 overflow-y-auto">
          <div className="p-6 bg-gradient-to-r from-pink-900/30 to-rose-900/30 border-b border-white/10">
            <h3 className="font-black text-white flex items-center gap-2 text-xl tracking-tight mb-2">
              <Heart className="w-6 h-6 text-pink-400" />
              Parent Insights
            </h3>
            <p className="text-sm text-pink-200 font-medium">Understanding your child's journey</p>
          </div>

          <div className="p-6 space-y-4">
            {currentInsight ? (
              <>
                <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 backdrop-blur-xl">
                  <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">Learning Now</div>
                  <div className="text-white font-bold text-lg">{currentInsight.conceptAttempted}</div>
                </div>

                <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 backdrop-blur-xl">
                  <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Their Approach</div>
                  <div className="text-white font-medium">{currentInsight.childApproach}</div>
                </div>

                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-5">
                  <div className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">Celebrate! 🎉</div>
                  <div className="text-green-200 font-bold">{currentInsight.celebrationMoment}</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-2xl p-5">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Practice at Home</div>
                  <div className="text-blue-200 font-medium text-sm">{currentInsight.practiceIdea}</div>
                </div>

                {currentInsight.whyThisTask && (
                  <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Why This Task?</div>
                    <div className="text-amber-200 font-medium text-sm">{currentInsight.whyThisTask}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-slate-400 py-12">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="font-medium">Ask a question to see insights</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPGRADE PROMPT - Shows after free message used */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[40px] p-8 border-4 border-violet-500/50 shadow-2xl">
            <div className="absolute inset-0 overflow-hidden rounded-[40px]">
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
            </div>
            
            <div className="relative text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
              
              <h3 className="text-3xl font-black text-white mb-3 tracking-tight">Loved Your Free Taste?</h3>
              <p className="text-violet-200 text-lg mb-2">
                You just experienced the <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">Learning Compass</span>
              </p>
              <p className="text-violet-300 mb-8 font-medium">
                Personalized AI tutoring that adapts to YOUR level!
              </p>
              
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-white/20">
                <div className="text-sm text-violet-200 mb-4 font-bold">What You Get:</div>
                <div className="space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-white font-medium">Unlimited AI tutoring sessions</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-white font-medium">Adapts to your child's level</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-white font-medium">Parent insights every session</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-white font-medium">Kenyan CBC-aligned content</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-white font-medium">Rich diagrams for Biology, Geography, Physics!</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Link
                  href="/pricing"
                  className="block w-full py-5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-2xl"
                >
                  Unlock Full Access Now
                </Link>
                <button
                  onClick={() => setShowUpgradePrompt(false)}
                  className="block w-full py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ Full-screen diagram modal */}
      {renderFullScreenDiagram()}
    </div>
  )
}