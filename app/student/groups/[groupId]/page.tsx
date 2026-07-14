'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft, Copy, Share2, CheckCircle, X,
  Loader2, Trophy, Flame, Zap,
} from 'lucide-react'

type Challenge = {
  id:              string
  question:        string
  hint?:           string
  difficulty:      number
  kenyan_context?: string
  date:            string
}

type Member = {
  id:           string
  student_id:   string | null
  student_name: string
  points:       number
  streak_days:  number
}

type AnswerResult = {
  isCorrect:     boolean
  pointsEarned:  number
  correctAnswer: string | null
}

type GroupDetails = {
  id:          string
  name:        string
  subject:     string
  grade:       number
  invite_code: string
  ground_rules: string[]
}

const DIFF_LABEL: Record<number, string> = {
  1: 'Easy', 2: 'Building', 3: 'Grade Level', 4: 'Challenging', 5: 'Advanced',
}
const DIFF_COLOR: Record<number, string> = {
  1: 'text-emerald-400', 2: 'text-amber-400',
  3: 'text-blue-400',   4: 'text-orange-400', 5: 'text-rose-400',
}
const MEDALS = ['🥇', '🥈', '🥉']

export default function StudentGroupDetailPage() {
  const params  = useParams()
  const groupId = params.groupId as string

  const [group,          setGroup]          = useState<GroupDetails | null>(null)
  const [members,        setMembers]        = useState<Member[]>([])
  const [challenge,      setChallenge]      = useState<Challenge | null>(null)
  const [myStudentId,    setMyStudentId]    = useState<string | null>(null)
  const [myUserId,       setMyUserId]       = useState<string | null>(null)
  const [answer,         setAnswer]         = useState('')
  const [isAnonymous,    setIsAnonymous]    = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [result,         setResult]         = useState<AnswerResult | null>(null)
  const [alreadyAnswered,setAlreadyAnswered]= useState(false)
  const [copied,         setCopied]         = useState(false)
  const [loading,        setLoading]        = useState(true)

  const load = useCallback(async () => {
    const { createClient } = await import('@/utils/supabase/client')
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    setMyUserId(user.id)

    const { data: studentRow } = await sb
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (studentRow) setMyStudentId(studentRow.id)

    const today = new Date().toISOString().split('T')[0]

    const [{ data: grp }, { data: mems }, { data: todayChallenge }] = await Promise.all([
      sb.from('study_groups').select('id, name, subject, grade, invite_code, ground_rules').eq('id', groupId).single(),
      sb.from('study_group_members').select('id, student_id, student_name, points, streak_days').eq('group_id', groupId).order('points', { ascending: false }),
      sb.from('study_group_challenges').select('id, question, hint, difficulty, kenyan_context, date').eq('group_id', groupId).eq('date', today).maybeSingle(),
    ])

    setGroup(grp ?? null)
    setMembers((mems ?? []) as Member[])
    setChallenge(todayChallenge ?? null)

    if (todayChallenge) {
      const { data: ans } = await sb
        .from('study_group_answers')
        .select('id, is_correct, points_earned')
        .eq('challenge_id', todayChallenge.id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (ans) {
        setAlreadyAnswered(true)
        setResult({
          isCorrect:     ans.is_correct as boolean,
          pointsEarned:  ans.points_earned as number,
          correctAnswer: null,
        })
      }
    }

    setLoading(false)
  }, [groupId])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return
    setSubmitting(true)
    try {
      const res  = await fetch('/api/groups/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, answer, isAnonymous }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.data)
      setAlreadyAnswered(true)
      // refresh leaderboard
      const { createClient } = await import('@/utils/supabase/client')
      const sb = createClient()
      const { data: mems } = await sb
        .from('study_group_members')
        .select('id, student_id, student_name, points, streak_days')
        .eq('group_id', groupId)
        .order('points', { ascending: false })
      if (mems) setMembers(mems as Member[])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const copyCode = () => {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    if (!group) return
    const msg = encodeURIComponent(
      `Join my EduNexus study group!\n📚 ${group.name} — ${group.subject} | Grade ${group.grade}\n🔑 Invite code: ${group.invite_code}\n👉 edunexus.co.ke/student/groups`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  )

  if (!group) return (
    <div className="min-h-screen bg-[#07070f] flex items-center justify-center text-white/40">
      Group not found.
    </div>
  )

  const isMe = (m: Member) =>
    (myStudentId && m.student_id === myStudentId) ||
    (!myStudentId && m.student_id === null)

  const myMember = members.find(isMe)
  const myRank   = myMember ? members.findIndex(isMe) + 1 : null

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href="/student/groups"
            className="w-9 h-9 bg-white/[0.05] hover:bg-white/[0.1] rounded-xl flex items-center justify-center mt-0.5 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-black">{group.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="px-2.5 py-1 bg-indigo-500/15 border border-indigo-500/25 rounded-full text-xs font-bold text-indigo-300">
                {group.subject}
              </span>
              <span className="px-2.5 py-1 bg-white/[0.05] border border-white/[0.1] rounded-full text-xs text-white/40">
                Grade {group.grade}
              </span>
              <span className="text-xs text-white/25">
                {members.length}/8 members
              </span>
            </div>
          </div>
        </div>

        {/* My stats strip */}
        {myMember && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <Trophy size={14} className="text-amber-400" />, value: `${myMember.points} pts`, label: 'My Points' },
              { icon: <span className="text-sm">#{myRank}</span>, value: `Rank #${myRank}`, label: 'Leaderboard' },
              { icon: <Flame size={14} className="text-orange-400" />, value: myMember.streak_days > 0 ? `${myMember.streak_days}d` : '—', label: 'Streak' },
            ].map((s, i) => (
              <div key={i} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-3 py-3 text-center">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <div className="text-white font-black text-sm">{s.value}</div>
                <div className="text-white/30 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Invite code */}
        <div className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
          <div className="flex-1">
            <div className="text-xs text-white/30 font-bold uppercase tracking-wider mb-1">Invite Code</div>
            <div className="font-mono font-black text-lg tracking-[0.3em] text-white">{group.invite_code}</div>
          </div>
          <button
            onClick={copyCode}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.07] text-white/50 hover:bg-white/[0.12]'
            }`}
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={shareWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/25 text-green-400 rounded-xl text-xs font-bold transition-all"
          >
            <Share2 className="w-3.5 h-3.5" /> Invite
          </button>
        </div>

        {/* TODAY'S CHALLENGE */}
        <section>
          <h2 className="text-xs font-black text-amber-400/60 uppercase tracking-widest mb-4">Today's Challenge</h2>

          {!challenge ? (
            <div className="p-6 bg-amber-500/[0.05] border border-amber-500/15 rounded-2xl text-center">
              <p className="text-amber-400/50 text-sm">No challenge yet today. Check back later!</p>
              <p className="text-white/20 text-xs mt-2">
                <Zap className="w-3 h-3 inline mr-1" />
                Challenges are generated daily by AI
              </p>
            </div>
          ) : (
            <div className="p-5 bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-bold uppercase tracking-wider ${DIFF_COLOR[challenge.difficulty]}`}>
                  {DIFF_LABEL[challenge.difficulty]}
                </span>
              </div>

              <p className="font-bold text-white text-base leading-relaxed mb-3">
                {challenge.question}
              </p>

              {challenge.kenyan_context && (
                <p className="text-sm text-white/40 italic mb-4 bg-white/[0.04] rounded-xl px-3 py-2">
                  🇰🇪 {challenge.kenyan_context}
                </p>
              )}

              {challenge.hint && !alreadyAnswered && (
                <p className="text-xs text-amber-400/70 mb-4">💡 Hint: {challenge.hint}</p>
              )}

              {!alreadyAnswered ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-white/30 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={e => setIsAnonymous(e.target.checked)}
                      className="rounded"
                    />
                    Submit anonymously
                  </label>
                  <div className="flex gap-3">
                    <input
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Your answer…"
                      className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                      required
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black text-sm disabled:opacity-50 flex items-center gap-2 transition-all"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Submit
                    </button>
                  </div>
                </form>
              ) : result && (
                <div className={`p-4 rounded-xl ${
                  result.isCorrect
                    ? 'bg-emerald-500/15 border border-emerald-500/25'
                    : 'bg-rose-500/15 border border-rose-500/25'
                }`}>
                  {result.isCorrect ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="font-black text-emerald-300">Correct! +{result.pointsEarned} points 🎉</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <X className="w-5 h-5 text-rose-400" />
                        <span className="font-black text-rose-300">Not quite — +{result.pointsEarned} pts for trying!</span>
                      </div>
                      {result.correctAnswer && (
                        <p className="text-sm text-white/50 mt-1">
                          Answer: <span className="font-bold text-white">{result.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* LEADERBOARD */}
        <section>
          <h2 className="text-xs font-black text-violet-400/60 uppercase tracking-widest mb-4">Leaderboard</h2>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            {members.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0 ${
                  isMe(m) ? 'bg-indigo-500/10' : ''
                }`}
              >
                <div className="w-8 text-center font-black text-base">
                  {i < 3
                    ? MEDALS[i]
                    : <span className="text-white/25 text-sm">#{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-white truncate">
                    {m.student_name}
                    {isMe(m) && (
                      <span className="ml-1.5 text-[10px] text-indigo-400 font-black">(you)</span>
                    )}
                  </div>
                  {(m.streak_days as number) > 0 && (
                    <div className="text-xs text-white/25 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-400" />
                      {m.streak_days}d streak
                    </div>
                  )}
                </div>
                <div className="font-black text-violet-300">{m.points} pts</div>
              </div>
            ))}
          </div>
        </section>

        {/* GROUP RULES */}
        <section>
          <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-4">📋 Ground Rules</h2>
          <div className="p-5 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
            <ul className="space-y-2.5">
              {(group.ground_rules ?? []).map((rule, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                  <span className="text-white/20 font-bold shrink-0">{i + 1}.</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </section>

      </div>
    </div>
  )
}
