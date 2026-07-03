'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

type InvitationMeta = {
  organization_name: string
  role: string
  invited_by_email: string
  expires_at: string
}

type PageState = 'loading' | 'ready' | 'accepting' | 'success' | 'error'

export default function AcceptInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const token  = params.token as string

  const [state, setState]   = useState<PageState>('loading')
  const [meta,  setMeta]    = useState<InvitationMeta | null>(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    // Fetch invitation details via the accept endpoint (it will validate the token)
    // We use a GET to preview; POST to accept
    fetch(`/api/invitations/${token}/accept`, { method: 'GET' })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setState('error') }
        else            { setMeta(data.invitation); setState('ready') }
      })
      .catch(() => { setError('Invalid or expired invitation link'); setState('error') })
  }, [token])

  async function accept() {
    setState('accepting')
    try {
      const res  = await fetch(`/api/invitations/${token}/accept`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState('success')
      setTimeout(() => router.push(`/organizations/${data.organization_id}`), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#060d18] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <Logo variant="dark" size="md" />
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto" />
            <p className="text-white/50">Validating invitation…</p>
          </div>
        )}

        {state === 'ready' && meta && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-8 h-8 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">You're invited!</h1>
            <p className="text-white/60 text-sm mb-6">
              <strong className="text-white">{meta.invited_by_email}</strong> has invited you to join
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
              <p className="text-white font-semibold text-lg">{meta.organization_name}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Users className="w-4 h-4 text-teal-400" />
                <span className="text-teal-400 text-sm capitalize">{meta.role}</span>
              </div>
            </div>
            <p className="text-white/30 text-xs mb-6">
              Expires {new Date(meta.expires_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={accept}
              className="w-full bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              Accept Invitation
            </button>
          </div>
        )}

        {state === 'accepting' && (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto" />
            <p className="text-white/50">Joining organization…</p>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 className="w-12 h-12 text-teal-400 mx-auto" />
            <p className="text-white font-semibold text-lg">Welcome aboard!</p>
            <p className="text-white/50 text-sm">Redirecting to your organization…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h2 className="text-white font-semibold mb-2">Invitation invalid</h2>
            <p className="text-white/50 text-sm mb-6">{error}</p>
            <a href="/organizations" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
              Go to my organizations →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
