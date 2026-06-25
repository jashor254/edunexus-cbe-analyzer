'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, Plus, Share2, CheckCircle, Clock, Loader2,
  ChevronLeft, Trophy, Flame, Zap, ArrowRight,
} from 'lucide-react'

const CBC_SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies',
  'Pre-Technical Studies', 'Creative Arts & Sports', 'Agriculture & Nutrition',
  'Biology', 'Chemistry', 'Physics', 'Computer Studies', 'Geography',
  'History & Citizenship', 'Business Studies', 'Home Science',
]

type MyGroup = {
  id:             string
  name:           string
  subject:        string
  grade:          number
  invite_code:    string
  max_members:    number
  memberCount:    number
  myPoints:       number
  myRank:         number
  todayAnswered:  boolean
  streak_days:    number
}

type Step = 'list' | 'create' | 'join'

export default function StudentGroupsPage() {
  const [groups,       setGroups]       = useState<MyGroup[]>([])
  const [loading,      setLoading]      = useState(true)
  const [step,         setStep]         = useState<Step>('list')
  const [creating,     setCreating]     = useState(false)
  const [joining,      setJoining]      = useState(false)
  const [createName,   setCreateName]   = useState('')
  const [createSubject,setCreateSubject]= useState(CBC_SUBJECTS[0])
  const [createGrade,  setCreateGrade]  = useState(7)
  const [inviteCode,   setInviteCode]   = useState('')
  const [createError,  setCreateError]  = useState('')
  const [joinError,    setJoinError]    = useState('')
  const [createdGroup, setCreatedGroup] = useState<{ inviteCode: string; groupId: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all memberships with group data via client-side Supabase
      const { createClient } = await import('@/utils/supabase/client')
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      // Resolve this user's student_id
      const { data: studentRow } = await sb
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!studentRow) { setLoading(false); return }

      const today = new Date().toISOString().split('T')[0]

      const { data: memberships } = await sb
        .from('study_group_members')
        .select('points, streak_days, group_id, study_groups(id, name, subject, grade, invite_code, max_members)')
        .eq('student_id', studentRow.id)

      if (!memberships) { setLoading(false); return }

      const enriched = await Promise.all(
        memberships.map(async (m) => {
          const g = m.study_groups as unknown as {
            id: string; name: string; subject: string; grade: number;
            invite_code: string; max_members: number
          } | null
          if (!g) return null

          const [{ count: memberCount }, { data: allMembers }, { data: todayChallenge }] = await Promise.all([
            sb.from('study_group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id),
            sb.from('study_group_members').select('points, student_id').eq('group_id', g.id).order('points', { ascending: false }),
            sb.from('study_group_challenges').select('id').eq('group_id', g.id).eq('date', today).maybeSingle(),
          ])

          const rank = allMembers
            ? allMembers.findIndex((mem) => mem.student_id === studentRow.id) + 1
            : 0

          let todayAnswered = false
          if (todayChallenge?.id) {
            const { data: ans } = await sb
              .from('study_group_answers')
              .select('id')
              .eq('challenge_id', todayChallenge.id)
              .eq('user_id', user.id)
              .maybeSingle()
            todayAnswered = !!ans
          }

          return {
            id: g.id, name: g.name, subject: g.subject, grade: g.grade,
            invite_code: g.invite_code, max_members: g.max_members,
            memberCount: memberCount ?? 0,
            myPoints: (m.points as number) ?? 0,
            myRank: rank,
            todayAnswered,
            streak_days: (m.streak_days as number) ?? 0,
          } satisfies MyGroup
        })
      )

      setGroups(enriched.filter(Boolean) as MyGroup[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName) return
    setCreating(true)
    setCreateError('')
    try {
      const res  = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName, subject: createSubject, grade: createGrade }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Failed to create group'); return }
      setCreatedGroup({ inviteCode: data.data.inviteCode, groupId: data.data.groupId })
      setCreateName('')
      load()
    } catch {
      setCreateError('Network error. Try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode) return
    setJoining(true)
    setJoinError('')
    try {
      const res  = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      })
      const data = await res.json()
      if (!res.ok) { setJoinError(data.error ?? 'Failed to join group'); return }
      setInviteCode('')
      setStep('list')
      load()
    } catch {
      setJoinError('Network error. Try again.')
    } finally {
      setJoining(false)
    }
  }

  const shareGroup = (g: MyGroup) => {
    const msg = encodeURIComponent(
      `Join my study group on EduNexus!\n📚 ${g.name} — ${g.subject} | Grade ${g.grade}\n🔑 Invite code: ${g.invite_code}\n👉 edunexus.co.ke/student/groups`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/student"
            className="w-9 h-9 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-black">Study Groups</h1>
            <p className="text-white/40 text-sm">Compete, collaborate, and level up together</p>
          </div>
        </div>

        {/* Tab bar */}
        {!createdGroup && (
          <div className="flex gap-2 mb-8 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-1">
            {(['list', 'create', 'join'] as Step[]).map(s => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={[
                  'flex-1 py-2 rounded-xl text-sm font-bold transition-all capitalize',
                  step === s
                    ? 'bg-indigo-600 text-white'
                    : 'text-white/40 hover:text-white/70',
                ].join(' ')}
              >
                {s === 'list' ? 'My Groups' : s === 'create' ? '+ Create' : 'Join'}
              </button>
            ))}
          </div>
        )}

        {/* ── MY GROUPS ─────────────────────────────────────────────────── */}
        {step === 'list' && (
          <section>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.03] border border-white/[0.07] rounded-3xl">
                <Users className="w-12 h-12 text-white/15 mx-auto mb-4" />
                <p className="text-white/50 font-semibold mb-1">No study groups yet</p>
                <p className="text-white/25 text-sm mb-6">Create one or join with an invite code</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setStep('create')}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all"
                  >
                    Create Group
                  </button>
                  <button
                    onClick={() => setStep('join')}
                    className="px-5 py-2.5 bg-white/[0.07] hover:bg-white/[0.12] text-white font-bold text-sm rounded-xl transition-all"
                  >
                    Join with Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(g => (
                  <div key={g.id} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden">
                    {/* Group header row */}
                    <Link
                      href={`/student/groups/${g.id}`}
                      className="flex items-start justify-between p-5 hover:bg-white/[0.03] transition-colors"
                    >
                      <div>
                        <div className="font-black text-white text-base mb-1">{g.name}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-full">
                            {g.subject}
                          </span>
                          <span className="text-[11px] text-white/30">Grade {g.grade}</span>
                          <span className="text-[11px] text-white/30">👥 {g.memberCount}/{g.max_members}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={[
                          'text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-full',
                          g.todayAnswered
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400',
                        ].join(' ')}>
                          {g.todayAnswered
                            ? <><CheckCircle className="w-3 h-3" /> Done</>
                            : <><Clock className="w-3 h-3" /> Challenge</>}
                        </span>
                        <ArrowRight className="w-4 h-4 text-white/20" />
                      </div>
                    </Link>

                    {/* Stats strip */}
                    <div className="flex items-center gap-4 px-5 pb-4 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        <span className="font-bold text-amber-400">{g.myPoints} pts</span>
                      </span>
                      {g.myRank > 0 && (
                        <span>Rank #{g.myRank}</span>
                      )}
                      {g.streak_days > 0 && (
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-400" />
                          {g.streak_days}d streak
                        </span>
                      )}
                      <button
                        onClick={() => shareGroup(g)}
                        className="ml-auto flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors"
                      >
                        <Share2 className="w-3 h-3" />
                        Invite
                      </button>
                    </div>
                  </div>
                ))}

                <div className="pt-2 text-center">
                  <p className="text-white/25 text-xs">
                    <Zap className="w-3 h-3 inline mr-1 text-amber-400" />
                    Earn +5 group pts automatically when you complete a Compass session in the group's subject
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── CREATE GROUP ─────────────────────────────────────────────── */}
        {step === 'create' && !createdGroup && (
          <section>
            <form onSubmit={handleCreate} className="bg-white/[0.04] border border-white/[0.07] rounded-3xl p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">Group Name</label>
                <input
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. Maths Champions 2026"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">Subject</label>
                  <select
                    value={createSubject}
                    onChange={e => setCreateSubject(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  >
                    {CBC_SUBJECTS.map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">Grade</label>
                  <select
                    value={createGrade}
                    onChange={e => setCreateGrade(Number(e.target.value))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  >
                    {[7,8,9,10,11,12].map(g => <option key={g} value={g} className="bg-[#1a1a2e]">Grade {g}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-xs text-indigo-300">
                Your name will be pulled automatically from your student profile. No manual entry needed.
              </div>

              {createError && (
                <p className="text-sm text-rose-400">{createError}</p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? 'Creating…' : 'Create Group'}
              </button>
            </form>
          </section>
        )}

        {/* Created success */}
        {createdGroup && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-black text-emerald-300 text-lg">Group Created!</span>
            </div>
            <p className="text-white/60 text-sm mb-3">Share this invite code with your classmates:</p>
            <div className="bg-black/30 rounded-2xl px-6 py-4 font-mono font-black text-3xl text-white tracking-[0.3em] text-center mb-5">
              {createdGroup.inviteCode}
            </div>
            <div className="flex gap-3">
              <Link
                href={`/student/groups/${createdGroup.groupId}`}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm text-center transition-all"
              >
                Open Group
              </Link>
              <button
                onClick={() => {
                  const msg = encodeURIComponent(`Join my EduNexus study group!\n🔑 Invite code: ${createdGroup.inviteCode}\n👉 edunexus.co.ke/student/groups`)
                  window.open(`https://wa.me/?text=${msg}`, '_blank')
                }}
                className="flex items-center gap-2 px-5 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 rounded-xl font-bold text-sm transition-all"
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </button>
            </div>
            <button
              onClick={() => { setCreatedGroup(null); setStep('list') }}
              className="w-full mt-3 text-xs text-white/25 hover:text-white/50 transition-colors"
            >
              Back to groups
            </button>
          </div>
        )}

        {/* ── JOIN GROUP ───────────────────────────────────────────────── */}
        {step === 'join' && (
          <section>
            <form onSubmit={handleJoin} className="bg-white/[0.04] border border-white/[0.07] rounded-3xl p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-2">Invite Code</label>
                <input
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="6-CHARACTER CODE"
                  maxLength={6}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white font-mono text-lg tracking-[0.3em] placeholder-white/15 focus:outline-none focus:border-amber-500/50 text-center uppercase"
                />
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-xs text-indigo-300">
                Your name will be pulled automatically from your student profile.
              </div>

              {joinError && (
                <p className="text-sm text-rose-400">{joinError}</p>
              )}

              <button
                type="submit"
                disabled={joining || inviteCode.length !== 6}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
              >
                {joining && <Loader2 className="w-4 h-4 animate-spin" />}
                {joining ? 'Joining…' : 'Join Group'}
              </button>
            </form>
          </section>
        )}

      </div>
    </div>
  )
}
