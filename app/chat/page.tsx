'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Fix for TypeScript Speech Recognition error
// @ts-ignore
const SpeechRecognition = typeof window !== 'undefined' && (window.speechRecognition || window.webkitSpeechRecognition);

type Message = { role: 'user' | 'assistant'; content: string; };
type Session = { id: string; title: string; created_at: string; };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Voice & Audio States
  const [speechRate, setSpeechRate] = useState(1);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from('chat_sessions').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) {
          setSessions(data);
          loadSession(data[0].id); // Auto-load chat ya mwisho
        }
      }
    };
    init();
  }, []);

  // --- TTS: Mwanafunzi akitaka kusikiliza (Manual) ---
  const speak = (text: string) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  };

  // --- STT: Mwanafunzi kuongea swali ---
  const startListening = () => {
    if (!SpeechRecognition) return alert("Browser yako haisupport voice input.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const loadSession = async (sId: string) => {
    setSessionId(sId);
    const { data } = await supabase.from('chat_messages').select('role, content').eq('session_id', sId).order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const currentQuestion = input;
    setMessages(prev => [...prev, { role: 'user', content: currentQuestion }]);
    setInput('');
    setIsLoading(true);

    try {
      let curId = sessionId;
      if (!curId) {
        const { data } = await supabase.from('chat_sessions').insert([{ 
          user_id: userId, 
          title: currentQuestion.substring(0, 30) + '...', 
          grade: 'Grade 7', 
          subject: 'Mathematics' 
        }]).select().single();
        curId = data.id;
        setSessionId(curId);
        setSessions(prev => [data, ...prev]);
      }
      await supabase.from('chat_messages').insert([{ session_id: curId, role: 'user', content: currentQuestion }]);
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentQuestion, conversationHistory: messages }),
      });
      const data = await res.json();
      if (data.text) {
        await supabase.from('chat_messages').insert([{ session_id: curId, role: 'assistant', content: data.text }]);
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden text-black">
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shadow-2xl">
        <div className="p-4 border-b border-slate-700 font-bold text-green-400">Guardian History</div>
        <div className="p-4 space-y-2 border-b border-slate-700">
          <label className="text-[10px] uppercase font-bold text-slate-400 italic">Reading Speed: {speechRate}x</label>
          <input type="range" min="0.5" max="1.5" step="0.1" value={speechRate} onChange={(e) => setSpeechRate(parseFloat(e.target.value))} className="w-full accent-green-500" />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => loadSession(s.id)} className={`w-full text-left p-2 text-xs rounded truncate transition-all ${sessionId === s.id ? 'bg-slate-700 border-l-4 border-green-500 text-green-400' : 'hover:bg-slate-800 text-slate-300'}`}>
              {s.title}
            </button>
          ))}
        </div>
        <button onClick={() => { window.speechSynthesis.cancel(); setMessages([]); setSessionId(null); }} className="m-4 p-3 bg-green-700 hover:bg-green-600 rounded-lg font-bold text-xs transition-colors">+ New Lesson</button>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        <div className="bg-green-600 text-white p-4 flex justify-between items-center shadow-lg z-10">
          <div>
            <h1 className="text-lg font-bold">Guardian AI Tutor</h1>
            <p className="text-[10px] opacity-90 italic underline">asteaste project - Phase 2</p>
          </div>
          <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1 rounded-full animate-pulse shadow-sm">BETA</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
               <div className="bg-white p-6 rounded-2xl border border-green-100 max-w-sm shadow-sm">
                  <h2 className="text-green-800 font-bold mb-2 uppercase text-xs tracking-widest">Our Mission</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">"Nurturing Grade 7 learners through CBC-aligned AI guidance for academic excellence."</p>
               </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm border ${msg.role === 'user' ? 'bg-blue-600 text-white border-blue-700 rounded-tr-none' : 'bg-white text-black border-slate-200 rounded-tl-none'}`}>
                <div className="flex justify-between items-center mb-2 gap-4">
                  <p className={`text-[9px] font-black uppercase tracking-tighter ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {msg.role === 'user' ? 'Mwanafunzi' : 'Mwalimu wa CBC'}
                  </p>
                  {msg.role === 'assistant' && (
                    <button onClick={() => speak(msg.content)} className="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded hover:bg-green-100 font-bold border border-green-200">
                      Sikiliza 🔊
                    </button>
                  )}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</div>
              </div>
            </div>
          ))}
          {isLoading && <div className="text-[10px] text-slate-400 animate-pulse font-bold ml-2">Mwalimu anaandaa majibu...</div>}
        </div>

        <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-200 shadow-inner">
          <div className="flex gap-2 max-w-5xl mx-auto items-center">
            <button type="button" onClick={startListening} className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {isListening ? '...' : '🎤'}
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Uliza swali lako hapa au tumia Mic..." className="flex-1 border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-green-500 outline-none text-black transition-all font-medium" />
            <button type="submit" disabled={isLoading} className="bg-green-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-green-700 disabled:bg-slate-300 shadow-md">TUMA</button>
          </div>
        </form>
      </div>
    </div>
  );
}