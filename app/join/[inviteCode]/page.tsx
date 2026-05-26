'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

type JoinState =
  | { status: 'loading' }
  | { status: 'joining' }
  | { status: 'success'; className: string; grade: number }
  | { status: 'error'; message: string }
  | { status: 'unauthenticated' }

export default function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = use(params)
  const router = useRouter()
  const [state, setState] = useState<JoinState>({ status: 'loading' })

  useEffect(() => {
    // Check auth, then attempt to join
    let cancelled = false

    async function run() {
      try {
        // Verify auth by pinging a protected route
        const authCheck = await fetch('/api/auth/update-activity', { method: 'POST', body: JSON.stringify({}) })
        if (authCheck.status === 401) {
          if (!cancelled) setState({ status: 'unauthenticated' })
          return
        }

        // Attempt to join
        if (!cancelled) setState({ status: 'joining' })

        const res  = await fetch('/api/class/join', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ inviteCode }),
        })
        const json = await res.json()

        if (cancelled) return

        if (json.success) {
          setState({
            status:    'success',
            className: json.data.className,
            grade:     json.data.grade,
          })
        } else {
          setState({ status: 'error', message: json.error ?? 'Something went wrong.' })
        }
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'Could not connect. Please try again.' })
      }
    }

    run()
    return () => { cancelled = true }
  }, [inviteCode])

  // Auto-redirect after success
  useEffect(() => {
    if (state.status !== 'success') return
    const timer = setTimeout(() => router.push('/dashboard'), 3500)
    return () => clearTimeout(timer)
  }, [state, router])

  const signupUrl = `/signup?returnTo=/join/${inviteCode}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-black text-gray-900 tracking-tight">
            Edu<span className="text-teal-600">Nexus</span>
          </span>
          <p className="text-sm text-gray-500 mt-1">Kenya CBC Education Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

          {/* Loading */}
          {(state.status === 'loading' || state.status === 'joining') && (
            <div className="text-center py-4">
              <Loader2 className="w-10 h-10 text-teal-500 mx-auto mb-4 animate-spin" />
              <h2 className="text-lg font-black text-gray-900 mb-1">
                {state.status === 'loading' ? 'Checking your link…' : 'Connecting you to the class…'}
              </h2>
              <p className="text-sm text-gray-500">This will only take a moment.</p>
            </div>
          )}

          {/* Success */}
          {state.status === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">You're connected!</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                You are now connected to <strong>{state.className}</strong> (Grade {state.grade}).
                You'll receive email updates whenever your child's teacher marks work or sends an alert.
              </p>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-teal-700 font-medium">
                  Redirecting you to your dashboard in a moment…
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-block bg-teal-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-teal-700 transition text-sm"
              >
                Go to Dashboard →
              </Link>
            </div>
          )}

          {/* Unauthenticated */}
          {state.status === 'unauthenticated' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎓</span>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Almost there!</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Sign in or create a free account to connect with your child's class.
                Your invite link will still work after you sign up.
              </p>
              <div className="space-y-3">
                <Link
                  href={signupUrl}
                  className="block bg-teal-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-teal-700 transition text-sm text-center"
                >
                  Create Free Account
                </Link>
                <Link
                  href={`/login?returnTo=/join/${inviteCode}`}
                  className="block bg-white border border-gray-200 text-gray-700 font-bold px-6 py-3 rounded-xl hover:bg-gray-50 transition text-sm text-center"
                >
                  I Already Have an Account
                </Link>
              </div>
            </div>
          )}

          {/* Error */}
          {state.status === 'error' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-9 h-9 text-red-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Link not valid</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">{state.message}</p>
              <p className="text-sm text-gray-500">
                Ask your child's teacher to send you a fresh invite link.
              </p>
              <Link
                href="/dashboard"
                className="inline-block mt-5 text-sm text-teal-600 font-bold hover:underline"
              >
                Go to Dashboard →
              </Link>
            </div>
          )}

        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          EduNexus — Empowering Kenyan Education
        </p>
      </div>
    </div>
  )
}
