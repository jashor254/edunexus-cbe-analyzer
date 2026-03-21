'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Loader2, UserPlus, Mail, Lock, CheckCircle } from 'lucide-react'
import Link from 'next/link'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const productId = searchParams.get('product')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      // Kama amekuja kununua, mpeleke kwa pricing baada ya sekunde 2
      if (productId) {
        setTimeout(() => router.push(`/pricing?product=${productId}`), 2000)
      }
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-12 text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600 w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Check your email!</h2>
          <p className="text-slate-500 font-bold mb-8">Tumevuma link ya kuthibitisha akaunti yako. Karibu EduNexus.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 to-blue-500" />
        
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserPlus className="text-white w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">Join EduNexus<span className="text-green-600">.</span></h1>
          <p className="text-slate-400 text-sm font-bold mt-2">Start your child's success journey today.</p>
        </div>

        {error && <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100">{error}</div>}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-4 text-slate-400" size={18} />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-50 p-4 pl-12 rounded-2xl font-bold text-black outline-none focus:border-green-500 transition-all" placeholder="Email Address" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-4 text-slate-400" size={18} />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-50 p-4 pl-12 rounded-2xl font-bold text-black outline-none focus:border-green-500 transition-all" placeholder="Create Password" />
          </div>
          <button disabled={loading} className="w-full bg-black text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-xl">
            {loading ? <Loader2 className="animate-spin" /> : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-400 text-sm font-bold">
          Already a member? <Link href={`/login${productId ? `?product=${productId}` : ''}`} className="text-green-600 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense fallback={<div>Loading...</div>}><SignupForm /></Suspense>
}