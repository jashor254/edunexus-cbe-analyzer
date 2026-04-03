'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, X, ChevronLeft, Share2, Loader2, CheckCircle, Clock } from 'lucide-react'

const CBC_SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies',
  'Pre-Technical Studies', 'Creative Arts & Sports', 'Agriculture & Nutrition',
  'Biology', 'Chemistry', 'Physics', 'Computer Studies', 'Geography',
  'History & Citizenship', 'Business Studies', 'Home Science',
  'Music & Dance', 'Fine Arts', 'Theatre & Film', 'Sports & Recreation',
]

interface MyGroup {
  id: string
  name: string
  subject: string
  grade: number
  invite_code: string
  max_members: number
  memberCount: number
  myPoints: number
  myRank: number
  todayAnswered: boolean
}

export default function StudyGroupsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [groups,         setGroups]         = useState<MyGroup[]>([])
  const [loading,        setLoading]        = useState(true)
  const [showCreate,     setShowCreate]     = useState(false)
  const [creating,       setCreating]       = useState(false)
  const [joining,        setJoining]        = useState(false)
  const [inviteCode,     setInviteCode]     = useState('')
  const [joinStudentName,setJoinStudentName]= useState('')
  const [joinError,      setJoinError]      = useState('')
  const [joinSuccess,    setJoinSuccess]    = useState('')
  const [createName,     setCreateName]     = useState('')
  const [createSubject,  setCreateSubject]  = useState(CBC_SUBJECTS[0])
  const [createGrade,    setCreateGrade]    = useState(7)
  const [createStudentName, setCreateStudentName] = useState('')
  const [createdGroup,   setCreatedGroup]   = useState<{ inviteCode: string; groupId: string } | null>(null)

  const loadGroups = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const today = new Date().toISOString().split('T')[0]

    const { data: memberships } = await supabase
      .from('study_group_members')
      .select(`
        points,
        group_id,
        study_groups (
          id, name, subject, grade, invite_code, max_members
        )
      `)
      .eq('user_id', user.id)

    if (!memberships) { setLoading(false); return }

    const enriched: MyGroup[] = await Promise.all(
      memberships.map(async (m: any) => {
        const g = m.study_groups
        if (!g) return null

        const [{ count: memberCount }, { data: allMembers }, { data: todayChallenge }] = await Promise.all([
          supabase.from('study_group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id),
          supabase.from('study_group_members').select('points, user_id').eq('group_id', g.id).order('points', { ascending: false }),
          supabase.from('study_group_challenges').select('id').eq('group_id', g.id).eq('date', today).single(),
        ])

        const rank = allMembers ? allMembers.findIndex((mem: any) => mem.user_id === user.id) + 1 : 0

        let todayAnswered = false
        if (todayChallenge?.id) {
          const { data: ans } = await supabase
            .from('study_group_answers')
            .select('id')
            .eq('challenge_id', todayChallenge.id)
            .eq('user_id', user.id)
            .single()
          todayAnswered = !!ans
        }

        return {
          id: g.id, name: g.name, subject: g.subject, grade: g.grade,
          invite_code: g.invite_code, max_members: g.max_members,
          memberCount: memberCount || 0, myPoints: m.points, myRank: rank,
          todayAnswered,
        }
      })
    )

    setGroups(enriched.filter(Boolean) as MyGroup[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadGroups() }, [loadGroups])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName || !createStudentName) return
    setCreating(true)
    try {
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName, subject: createSubject, grade: createGrade, studentName: createStudentName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreatedGroup({ inviteCode: data.inviteCode, groupId: data.groupId })
      setCreateName(''); setCreateStudentName('')
      loadGroups()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(''); setJoinSuccess('')
    if (!inviteCode || !joinStudentName) { setJoinError('Enter invite code and your name.'); return }
    setJoining(true)
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, studentName: joinStudentName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setJoinSuccess(`Joined "${data.groupName}"! 🎉`)
      setInviteCode(''); setJoinStudentName('')
      loadGroups()
    } catch (err: any) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  const shareCreatedGroup = () => {
    if (!createdGroup) return
    const msg = encodeURIComponent(
      `Join my EduNexus study group!\nGroup: ${createSubject} | Grade ${createGrade}\nInvite code: ${createdGroup.inviteCode}\nJoin at: https://www.edunexus.co.ke/dashboard/groups`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="w-9 h-9 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-black">Study Groups</h1>
            <p className="text-white/50 text-sm">Collaborate, challenge, and grow together</p>
          </div>
        </div>

        {/* My Groups */}
        <section className="mb-10">
          <h2 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">My Groups</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 bg-white/3 border border-white/10 rounded-2xl">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No groups yet. Create or join one below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(g => (
                <Link key={g.id} href={`/dashboard/groups/${g.id}`}
                  className="block p-5 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-violet-500/30 rounded-2xl transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-black text-white">{g.name}</div>
                      <div className="text-xs text-white/50 mt-0.5">{g.subject} · Grade {g.grade}</div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      g.todayAnswered ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {g.todayAnswered ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {g.todayAnswered ? 'Answered' : 'Pending'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span>👥 {g.memberCount}/{g.max_members}</span>
                    <span>🏆 Rank #{g.myRank}</span>
                    <span>⭐ {g.myPoints} pts</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Create Group */}
        <section className="mb-10">
          <h2 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Create a Group</h2>

          {!showCreate && !createdGroup && (
            <button onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-4 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-2xl text-violet-300 font-bold transition-all">
              <Plus className="w-5 h-5" />
              Create New Study Group
            </button>
          )}

          {showCreate && !createdGroup && (
            <form onSubmit={handleCreate} className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">Group Name</label>
                <input value={createName} onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. Maths Squad 2026"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50" required />
              </div>
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">Your Name</label>
                <input value={createStudentName} onChange={e => setCreateStudentName(e.target.value)}
                  placeholder="Your name in the group"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">Subject</label>
                  <select value={createSubject} onChange={e => setCreateSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50">
                    {CBC_SUBJECTS.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">Grade</label>
                  <select value={createGrade} onChange={e => setCreateGrade(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50">
                    {[7,8,9,10,11,12].map(g => <option key={g} value={g} className="bg-slate-900">Grade {g}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 bg-white/5 text-white/50 rounded-xl font-bold text-sm hover:bg-white/8 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          )}

          {createdGroup && (
            <div className="p-5 bg-green-500/10 border border-green-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="font-black text-green-300">Group Created!</span>
              </div>
              <p className="text-sm text-white/70 mb-2">Share this invite code with friends:</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-black/30 rounded-xl px-4 py-3 font-mono font-black text-xl text-white tracking-widest text-center">
                  {createdGroup.inviteCode}
                </div>
              </div>
              <div className="flex gap-3">
                <Link href={`/dashboard/groups/${createdGroup.groupId}`}
                  className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-bold text-sm text-center hover:bg-violet-500 transition-all">
                  Open Group
                </Link>
                <button onClick={shareCreatedGroup}
                  className="flex items-center gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 rounded-xl font-bold text-sm transition-all">
                  <Share2 className="w-4 h-4" />
                  WhatsApp
                </button>
              </div>
              <button onClick={() => setCreatedGroup(null)}
                className="w-full mt-2 text-xs text-white/30 hover:text-white/50 transition-colors">
                Create another group
              </button>
            </div>
          )}
        </section>

        {/* Join Group */}
        <section>
          <h2 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Join a Group</h2>
          <form onSubmit={handleJoin} className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-3">
            <div>
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">Invite Code</label>
              <input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="6-character code"
                maxLength={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm tracking-widest focus:outline-none focus:border-amber-500/50 uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-1.5">Your Name</label>
              <input
                value={joinStudentName}
                onChange={e => setJoinStudentName(e.target.value)}
                placeholder="Your name in the group"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            {joinError && <p className="text-sm text-red-400 font-medium">{joinError}</p>}
            {joinSuccess && <p className="text-sm text-green-400 font-medium">{joinSuccess}</p>}
            <button type="submit" disabled={joining}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {joining ? 'Joining...' : 'Join Group'}
            </button>
          </form>
        </section>

      </div>
    </div>
  )
}
