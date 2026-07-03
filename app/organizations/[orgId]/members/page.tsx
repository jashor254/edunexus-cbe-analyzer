'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Users, Crown, Shield, User, UserMinus, Mail,
  Loader2, Plus, X, Check, AlertCircle,
} from 'lucide-react'

type Member = {
  id: string
  user_id: string
  role: string
  status: string
  joined_at: string | null
  user: { id: string; email: string; full_name: string | null; avatar_url: string | null }
}

type Invitation = {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
}

const ROLE_ICON: Record<string, React.ElementType> = {
  owner: Crown, admin: Shield, member: User, viewer: User,
  billing_admin: Shield, developer: User,
}

const ROLES = ['admin', 'member', 'billing_admin', 'developer', 'viewer']

export default function MembersPage() {
  const params = useParams()
  const orgId  = params.orgId as string

  const [members,     setMembers]     = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('member')
  const [inviting,    setInviting]    = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteOk,    setInviteOk]    = useState(false)
  const [showInvite,  setShowInvite]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`/api/organizations/${orgId}/members`),
        fetch(`/api/organizations/${orgId}/invitations`),
      ])
      const mData = await mRes.json()
      const iData = await iRes.json()
      setMembers(mData.members ?? [])
      setInvitations((iData.invitations ?? []).filter((i: Invitation) => i.status === 'pending'))
    } catch {
      setError('Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    try {
      const res = await fetch(`/api/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInviteOk(true)
      setInviteEmail('')
      setTimeout(() => { setInviteOk(false); setShowInvite(false); load() }, 2000)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  async function removeInvite(id: string) {
    await fetch(`/api/organizations/${orgId}/invitations?invitation_id=${id}`, { method: 'DELETE' })
    setInvitations(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
    </div>
  )

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-white/50 text-sm mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Invite panel */}
      {showInvite && (
        <div className="mb-6 bg-white/5 border border-teal-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">Invite a member</h2>
            <button onClick={() => { setShowInvite(false); setInviteError('') }}>
              <X className="w-4 h-4 text-white/40 hover:text-white/70" />
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              placeholder="email@school.ac.ke"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-500 transition-colors"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
            >
              {ROLES.map(r => <option key={r} value={r} className="bg-[#0c1929]">{r}</option>)}
            </select>
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {inviting   ? <Loader2 className="w-4 h-4 animate-spin" />
               : inviteOk ? <Check className="w-4 h-4" />
               :             <Mail className="w-4 h-4" />}
              {inviteOk ? 'Sent!' : 'Send'}
            </button>
          </div>
          {inviteError && <p className="mt-2 text-red-400 text-xs">{inviteError}</p>}
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2 mb-8">
        {members.map(m => {
          const RoleIcon = ROLE_ICON[m.role] ?? User
          const initials = (m.user.full_name ?? m.user.email)
            .split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
          return (
            <div key={m.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 text-sm font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{m.user.full_name ?? '—'}</p>
                <p className="text-white/40 text-xs truncate">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <RoleIcon className="w-3.5 h-3.5" />
                <span className="capitalize">{m.role}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                {m.status}
              </span>
            </div>
          )
        })}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h2 className="text-white font-semibold text-sm mb-3">Pending Invitations</h2>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{inv.email}</p>
                  <p className="text-white/40 text-xs capitalize">{inv.role} · expires {new Date(inv.expires_at).toLocaleDateString('en-KE')}</p>
                </div>
                <button
                  onClick={() => removeInvite(inv.id)}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
