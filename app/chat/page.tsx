'use client';

import { useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Hifadhi swali la sasa kabla ya kufuta input
    const currentQuestion = input;
    const userMsg: Message = { role: 'user', content: currentQuestion };
    
    // Sasisha UI haraka
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentQuestion, // Inatakiwa iitwe 'message'
          subjectId: 'mathematics', 
          grade: 7,
          level: 2,
          conversationHistory: messages, // LAZIMA ilingane na jina lililoko kwenye route.ts
        }),
      });

      // Ikiwa response siyo 200 OK, jaribu kusoma error
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.text) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
      } else {
        throw new Error('Mwalimu hajatoa jibu lolote.');
      }
    } catch (error: any) {
      console.error('Chat Error Details:', error);
      setMessages((prev) => [
        ...prev, 
        { role: 'assistant', content: `🚨 Hitilafu: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-white">
      <div className="bg-green-600 text-white p-4 rounded-t-lg shadow-md">
        <h1 className="text-xl font-bold">Guardian Tutor - CBC Chat</h1>
        <p className="text-sm opacity-90">Mathematics | Grade 7</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 border-x bg-gray-50 shadow-inner">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p>👋 Karibu! Uliza swali lolote la hisabati mwanangu.</p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
            }`}>
              <p className="text-sm font-bold mb-1">
                {msg.role === 'user' ? 'Mwanafunzi' : 'Mwalimu'}
              </p>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border p-3 rounded-lg animate-pulse">
              <p className="text-sm text-gray-500 italic">Mwalimu anafikiria...</p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 p-4 border rounded-b-lg bg-white shadow-md">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Andika swali lako hapa..."
          className="flex-1 border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button 
          type="submit" 
          disabled={isLoading} 
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:bg-gray-400"
        >
          Tuma
        </button>
      </form>
    </div>
  );
}