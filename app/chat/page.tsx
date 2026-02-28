// app/chat/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  Volume2, 
  Mic, 
  Send,
  Lightbulb,
  Heart
} from 'lucide-react';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    pedagogy?: any;
    parentInsight?: any;
    audioOptimized?: string;
  };
  timestamp: Date;
}

interface LearnerStats {
  streakDays: number;
  conceptsMastered: number;
  avgCognitiveLoad: 'low' | 'optimal' | 'high';
  lastSessionQuality: number;
}

export default function MwalimuChat() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [stats, setStats] = useState<LearnerStats | null>(null);
  const [showParentMode, setShowParentMode] = useState(false);
  const [currentInsight, setCurrentInsight] = useState<any>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize
  useEffect(() => {
    initSession();
    initSpeechRecognition();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLearnerId(user.id);
    
    // Get or create session
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      setSessionId(existing.id);
      loadMessages(existing.id);
      loadStats(user.id);
    } else {
      createNewSession(user.id);
    }
  };

  const createNewSession = async (userId: string) => {
    const { data } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title: 'New Learning Journey',
        grade: 7,
        subject: 'Mathematics',
        status: 'active'
      })
      .select()
      .single();
    
    if (data) {
      setSessionId(data.id);
      setMessages([]);
    }
  };

  const loadMessages = async (sId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({
        ...m,
        timestamp: new Date(m.created_at),
        metadata: m.metadata || {}
      })));
    }
  };

  const loadStats = async (userId: string) => {
    // Aggregate learning analytics
    const { data } = await supabase
      .rpc('get_learner_dashboard_stats', { p_learner_id: userId });
    
    if (data) setStats(data);
  };

  // Speech Recognition
  const initSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
    };
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Voice input not supported in this browser');
      return;
    }
    recognitionRef.current.start();
  };

  // Text to Speech with optimization
  const speak = (text: string, isOptimized: boolean = false) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(isOptimized ? text : text.slice(0, 300));
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Send message
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !sessionId || !learnerId) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistic update
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

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
      });

      const data = await res.json();

      if (data.text) {
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.text,
          metadata: {
            pedagogy: data.pedagogy,
            parentInsight: data.parentInsight,
            audioOptimized: data.audioText
          },
          timestamp: new Date()
        };

        setMessages(prev => [...prev.filter(m => m.id !== tempId), assistantMsg]);
        setCurrentInsight(data.parentInsight);
        
        // Auto-read for younger learners (optional)
        if (data.audioText) {
          setTimeout(() => speak(data.audioText, true), 500);
        }
      }
    } catch (error) {
      console.error('Failed to send:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Render pedagogy badge
  const getStrategyBadge = (strategy: string) => {
    const badges: Record<string, { color: string; icon: any; label: string }> = {
      'socratic-questioning': { color: 'bg-purple-100 text-purple-700', icon: Lightbulb, label: 'Thinking Together' },
      'worked-example': { color: 'bg-blue-100 text-blue-700', icon: Brain, label: 'Learning by Example' },
      'break-concept': { color: 'bg-orange-100 text-orange-700', icon: AlertCircle, label: 'Step by Step' },
      'direct-instruction': { color: 'bg-green-100 text-green-700', icon: TrendingUp, label: 'Clear Guidance' },
    };
    return badges[strategy] || badges['direct-instruction'];
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-green-50 overflow-hidden">
      {/* LEFT SIDEBAR - Learning Analytics */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col hidden lg:flex shadow-lg">
        <div className="p-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Mwalimu AI
          </h1>
          <p className="text-green-100 text-sm mt-1">CBC-Aligned Learning Companion</p>
        </div>

        {stats && (
          <div className="p-4 space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-orange-800 font-bold mb-1">
                <TrendingUp className="w-4 h-4" />
                Learning Streak
              </div>
              <div className="text-2xl font-black text-orange-600">{stats.streakDays} days 🔥</div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-blue-800 font-bold text-sm mb-1">Concepts Mastered</div>
              <div className="text-2xl font-black text-blue-600">{stats.conceptsMastered}</div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="text-purple-800 font-bold text-sm mb-1">Learning Zone</div>
              <div className={`text-lg font-bold ${
                stats.avgCognitiveLoad === 'optimal' ? 'text-green-600' : 
                stats.avgCognitiveLoad === 'high' ? 'text-orange-600' : 'text-blue-600'
              }`}>
                {stats.avgCognitiveLoad === 'optimal' ? 'Perfect Challenge 🎯' :
                 stats.avgCognitiveLoad === 'high' ? 'Working Hard 💪' :
                 'Building Confidence 🌱'}
              </div>
            </div>
          </div>
        )}

        {/* Parent Mode Toggle */}
        <div className="mt-auto p-4 border-t border-slate-200">
          <button
            onClick={() => setShowParentMode(!showParentMode)}
            className="w-full flex items-center gap-2 p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-medium"
          >
            <Heart className="w-4 h-4 text-pink-500" />
            {showParentMode ? 'Hide Parent View' : 'Parent Insights'}
          </button>
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm z-10">
          <div>
            <h2 className="font-bold text-slate-800">Today's Lesson</h2>
            <p className="text-xs text-slate-500">Grade 7 • Mathematics • CBC Aligned</p>
          </div>
          <button
            onClick={() => createNewSession(learnerId!)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            New Topic
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                <Brain className="w-12 h-12 text-green-600" />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Karibu! Ready to learn?</h3>
                <p className="text-slate-600 mb-4">Ask me anything about your CBC subjects. I'm here to help you understand, not just give answers.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['How do fractions work?', 'Explain photosynthesis', 'Help with division'].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); }}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-full text-sm text-slate-600 hover:border-green-500 hover:text-green-600 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl w-full ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} flex gap-3`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-500' : 'bg-green-600'
                }`}>
                  <span className="text-white text-xs font-bold">
                    {msg.role === 'user' ? 'You' : 'M'}
                  </span>
                </div>

                {/* Content */}
                <div className={`flex-1 space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Pedagogy Badge (for assistant) */}
                  {msg.role === 'assistant' && msg.metadata?.pedagogy && (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStrategyBadge(msg.metadata.pedagogy.strategy).color}`}>
                      {(() => {
                        const Icon = getStrategyBadge(msg.metadata.pedagogy.strategy).icon;
                        return <Icon className="w-3 h-3" />;
                      })()}
                      {getStrategyBadge(msg.metadata.pedagogy.strategy).label}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`p-4 rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                  }`}>
                    <div className="prose prose-sm max-w-none">
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className="mb-2 last:mb-0 leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => speak(msg.metadata?.audioOptimized || msg.content, !!msg.metadata?.audioOptimized)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-green-600 transition-colors"
                      >
                        <Volume2 className="w-3 h-3" />
                        Listen
                      </button>
                      {msg.metadata?.parentInsight && (
                        <button
                          onClick={() => setCurrentInsight(msg.metadata.parentInsight)}
                          className="flex items-center gap-1 text-xs text-pink-500 hover:text-pink-600 transition-colors"
                        >
                          <Heart className="w-3 h-3" />
                          Parent Tip
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-200" />
              <span className="text-sm">Mwalimu is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto flex gap-2">
            <button
              type="button"
              onClick={toggleListening}
              className="p-3 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"
              title="Voice input"
            >
              <Mic className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your question here... (or type 'help' for suggestions)"
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </form>
      </div>

      {/* PARENT INSIGHTS PANEL (Slide-over) */}
      {showParentMode && (
        <div className="w-96 bg-white border-l border-slate-200 shadow-xl overflow-y-auto">
          <div className="p-6 bg-pink-50 border-b border-pink-100">
            <h3 className="font-bold text-pink-900 flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Parent Insights
            </h3>
            <p className="text-sm text-pink-700 mt-1">Understand your child's learning journey</p>
          </div>

          <div className="p-6 space-y-6">
            {currentInsight ? (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Currently Learning</div>
                  <div className="text-slate-800 font-medium">{currentInsight.conceptAttempted}</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">How They Approached It</div>
                  <div className="text-slate-800">{currentInsight.childApproach}</div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Celebrate This! 🎉</div>
                  <div className="text-green-800 font-medium">{currentInsight.celebrationMoment}</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Practice at Home</div>
                  <div className="text-blue-800 text-sm">{currentInsight.practiceIdea}</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <p>Ask a question to see learning insights here.</p>
              </div>
            )}

            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-slate-800 mb-3">This Week's Progress</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Concepts explored</span>
                  <span className="font-bold text-slate-800">12</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Questions asked</span>
                  <span className="font-bold text-slate-800">28</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Learning time</span>
                  <span className="font-bold text-slate-800">3.5 hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}