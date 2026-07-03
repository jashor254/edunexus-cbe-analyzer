'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

export function NewsletterSignup() {
  const [email,   setEmail]   = useState('')
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')

    try {
      const res  = await fetch('/api/insights/newsletter', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }

      if (json.ok) {
        setStatus('success')
        setMessage("You're subscribed. We'll send the good stuff, nothing else.")
        setEmail('')
      } else {
        setStatus('error')
        setMessage(json.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-3 text-green-400">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col sm:flex-row gap-3 max-w-md">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        disabled={status === 'loading'}
        className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all disabled:opacity-50"
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={status === 'loading' || !email.trim()}
        className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
      >
        Subscribe
        <ArrowRight className="w-4 h-4" />
      </button>

      {status === 'error' && (
        <p className="text-xs text-red-400 mt-1 sm:col-span-2">{message}</p>
      )}
    </form>
  )
}
