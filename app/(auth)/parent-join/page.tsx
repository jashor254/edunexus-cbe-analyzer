'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

function ParentJoinContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const studentId    = searchParams.get('student')
  // Sprint 12 Wave 3 (Critical 1) — the Core guardian-claim path. Same page,
  // same flow, branching only on which query param is present rather than
  // duplicating this whole screen: a `guardian` link (from
  // lib/core/guardianInvites.ts) claims via /api/parent/link-guardian
  // (learner_guardians.user_id); a `student` link (legacy, unchanged) claims
  // via /api/parent/link-student (students.parent_user_id).
  const guardianId   = searchParams.get('guardian')
  const token        = searchParams.get('token')

  const [status, setStatus] = useState<'checking' | 'linking' | 'done' | 'error' | 'needs-signup'>('checking')
  const [studentName, setStudentName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if ((!studentId && !guardianId) || !token) {
      setStatus('error')
      setErrorMsg('Invalid invite link — missing student/guardian or token.')
      return
    }

    async function run() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in — redirect to signup with returnTo pointing back here
        const returnTo = studentId
          ? `/parent-join?student=${studentId}&token=${token}`
          : `/parent-join?guardian=${guardianId}&token=${token}`
        router.push(`/signup?returnTo=${encodeURIComponent(returnTo)}`)
        return
      }

      setStatus('linking')

      const res = studentId
        ? await fetch('/api/parent/link-student', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ student_id: studentId, token }),
          })
        : await fetch('/api/parent/link-guardian', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token }),
          })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setStatus('error')
        setErrorMsg(json.error ?? 'Failed to link account. The link may have expired.')
        return
      }

      setStudentName(json.data.student_name ?? json.data.learnerName ?? '')
      setStatus('done')

      // Redirect to dashboard after a brief pause
      setTimeout(() => router.push('/dashboard'), 2500)
    }

    run()
  }, [studentId, guardianId, token, router])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black text-white">EduNexus</span>
        </Link>

        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
          {(status === 'checking' || status === 'linking') && (
            <>
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-black text-white mb-2">
                {status === 'checking' ? 'Checking your link…' : 'Linking your account…'}
              </h2>
              <p className="text-white/40 text-sm">Just a moment</p>
            </>
          )}

          {status === 'done' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">You're all set! 🎉</h2>
              <p className="text-white/60 mb-2">
                Your account is now linked to <span className="font-bold text-white">{studentName}</span>.
              </p>
              <p className="text-violet-400 text-sm">Redirecting to your dashboard…</p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-black text-white mb-2">Couldn't link account</h2>
              <p className="text-white/50 text-sm mb-6">{errorMsg}</p>
              <Link
                href="/signup"
                className="w-full inline-block py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl transition-colors"
              >
                Sign up instead
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ParentJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ParentJoinContent />
    </Suspense>
  )
}
