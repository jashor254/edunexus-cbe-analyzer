'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, TrendingUp, Clock, BookOpen, CheckCircle2,
  AlertTriangle, Loader2, ChevronRight, Heart, Target,
  Users, ArrowRight, Star
} from 'lucide-react'
import type { CareerMatchWithDetail } from '@/lib/career/types'

// ── Types ────────────────────────────────────────────────────────────────────

type StudentProfile = {
  id: string
  name: string
  grade: number
  date_of_birth?: string
}

type SubjectGap = {
  subject: string
  current_score: number
  required_score: number
  gap: number
  advice: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(dob?: string): number {
  if (!dob) return 14
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

function getAgeRange(age: number): string {
  if (age <= 13) return '10–13'
  if (age <= 16) return '14–16'
  if (age <= 19) return '17–19'
  return '20–24'
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 100) * 100
  const color = score >= 75 ? 'bg-green-500' : score >= 55 ? 'bg-amber-500' : 'bg-orange-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold w-10 text-right ${
        score >= 75 ? 'text-green-400' : score >= 55 ? 'text-amber-400' : 'text-orange-400'
      }`}>{score}%</span>
    </div>
  )
}

const PARENT_ACTIONS = [
  'Encourage daily reading in subjects that need improvement.',
  'Ask your child to explain one thing they learned today — teaching reinforces learning.',
  'Discuss the skill timeline together: "At your age, this is what successful people in this career were learning."',
  'Arrange a visit or call with a professional in their top career field.',
  'Praise effort and improvement, not just grades.',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareerReportPage() {
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null)
  const [matches, setMatches] = useState<CareerMatchWithDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingMatches, setGeneratingMatches] = useState(false)
  const [careerDetails, setCareerDetails] = useState<Record<string, { skill_timeline: Array<{ age_range: string; skills: string[]; why: string }> }>>({})

  useEffect(() => {
    fetch('/api/students/list')
      .then(r => r.json())
      .then(d => {
        const list: StudentProfile[] = d?.data?.students ?? []
        setStudents(list)
        if (list.length > 0) setSelectedStudent(list[0])
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedStudent) return
    setMatches([])
    fetch(`/api/career/match?studentId=${selectedStudent.id}`)
      .then(r => r.json())
      .then(d => setMatches(d?.data?.matches ?? []))
      .catch(() => null)
  }, [selectedStudent])

  // Load full career details (for skill timelines)
  useEffect(() => {
    if (matches.length === 0) return
    Promise.all(
      matches.map(m =>
        fetch(`/api/career/${m.career.slug}`)
          .then(r => r.json())
          .then(d => ({ slug: m.career.slug, career: d?.data?.career }))
          .catch(() => null)
      )
    ).then(results => {
      const map: typeof careerDetails = {}
      for (const r of results) {
        if (r?.career) map[r.slug] = r.career
      }
      setCareerDetails(map)
    })
  }, [matches])

  const handleGenerateMatches = async () => {
    if (!selectedStudent) return
    setGeneratingMatches(true)
    try {
      const res = await fetch('/api/career/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.id, force: true }),
      })
      const d = await res.json()
      setMatches(d?.data?.matches ?? [])
    } catch {
      // silent
    } finally {
      setGeneratingMatches(false)
    }
  }

  const studentAge = calcAge(selectedStudent?.date_of_birth)
  const currentAgeRange = getAgeRange(studentAge)
  const topMatch = matches[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-3 py-6">
          <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-4 py-2 text-violet-300 text-sm font-semibold">
            <Heart className="w-4 h-4" />
            Parent Report
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Career Reality Report
          </h1>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            Based on your child's assessment scores and interests — real Kenya context,
            honest gap analysis, and what you can do at home right now.
          </p>
        </div>

        {/* ── STUDENT SELECTOR ──────────────────────────────────────────────── */}
        {students.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  selectedStudent?.id === s.id
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {!selectedStudent ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-white/40">No student profiles found. Add a student first.</p>
          </div>
        ) : (
          <>
            {/* ── STUDENT SUMMARY ───────────────────────────────────────────── */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-bold text-xl mb-1">{selectedStudent.name}</h2>
              <div className="flex flex-wrap gap-4 text-sm text-white/50">
                <span>Grade {selectedStudent.grade}</span>
                <span>Age {studentAge}</span>
                <span className="text-violet-400">Current skill phase: <strong>{currentAgeRange}</strong></span>
              </div>
            </div>

            {/* ── TOP 3 CAREER MATCHES ──────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-xl flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-400" />
                  Top Career Matches
                </h2>
                <button
                  onClick={handleGenerateMatches}
                  disabled={generatingMatches}
                  className="text-sm text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 disabled:opacity-50"
                >
                  {generatingMatches
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    : <>Refresh <Sparkles className="w-3 h-3" /></>
                  }
                </button>
              </div>

              {matches.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-4">
                  <Target className="w-10 h-10 text-white/20 mx-auto" />
                  <p className="text-white/40 text-sm">No career matches yet for {selectedStudent.name}.</p>
                  <button
                    onClick={handleGenerateMatches}
                    disabled={generatingMatches}
                    className="mx-auto flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {generatingMatches
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing profile…</>
                      : <><Sparkles className="w-4 h-4" /> Generate Career Matches</>
                    }
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.slice(0, 3).map((match, i) => (
                    <div
                      key={match.id}
                      className={`rounded-2xl p-5 border ${
                        i === 0
                          ? 'bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border-violet-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          {i === 0 && (
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-wide mb-1 block">
                              Best Match
                            </span>
                          )}
                          <h3 className="text-white font-bold text-lg">{match.career.title}</h3>
                        </div>
                        <span className={`text-2xl font-black shrink-0 ${
                          match.match_score >= 75 ? 'text-green-400' :
                          match.match_score >= 55 ? 'text-amber-400' : 'text-orange-400'
                        }`}>{match.match_score}%</span>
                      </div>
                      <ScoreBar score={match.match_score} />
                      <p className="text-white/60 text-sm mt-3">{match.match_reasoning}</p>

                      {/* Subject gaps */}
                      {match.subject_gaps && (match.subject_gaps as SubjectGap[]).length > 0 && (
                        <div className="mt-3 space-y-1">
                          {(match.subject_gaps as SubjectGap[]).map(gap => (
                            <div key={gap.subject} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                              <span className="text-amber-400 text-xs font-semibold capitalize">{gap.subject}</span>
                              <span className="text-white/40 text-xs ml-2">
                                currently {gap.current_score}/4, needs {gap.required_score}/4
                              </span>
                              <p className="text-white/50 text-xs mt-0.5">{gap.advice}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <Link
                        href={`/career/${match.career.slug}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                      >
                        Full career details <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── SKILL AGE TIMELINE ────────────────────────────────────────── */}
            {topMatch && careerDetails[topMatch.career.slug] && (
              <section>
                <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-400" />
                  The Skill Timeline for {topMatch.career.title}
                </h2>
                <p className="text-white/40 text-sm mb-5">
                  At age {studentAge}, {selectedStudent.name} is in the <strong className="text-violet-400">{currentAgeRange}</strong> phase.
                </p>

                <div className="space-y-3">
                  {careerDetails[topMatch.career.slug].skill_timeline.map((phase, idx) => {
                    const isCurrentPhase = phase.age_range === currentAgeRange
                    return (
                      <div
                        key={phase.age_range}
                        className={`rounded-2xl p-5 border transition-all ${
                          isCurrentPhase
                            ? 'bg-violet-900/30 border-violet-500/40 ring-1 ring-violet-500/30'
                            : 'bg-white/5 border-white/10 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCurrentPhase ? 'bg-violet-600 text-white' : 'bg-white/10 text-white/40'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-white font-bold">Ages {phase.age_range}</div>
                            {isCurrentPhase && (
                              <div className="text-violet-400 text-xs">← {selectedStudent.name} is here now</div>
                            )}
                          </div>
                        </div>
                        <p className="text-white/50 text-sm mb-3 italic">{phase.why}</p>
                        <div className="flex flex-wrap gap-2">
                          {phase.skills.map(skill => (
                            <span key={skill} className={`text-xs px-2 py-1 rounded-lg border ${
                              isCurrentPhase
                                ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                                : 'bg-white/5 border-white/10 text-white/40'
                            }`}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── WHAT PARENT CAN DO ────────────────────────────────────────── */}
            <section className="bg-gradient-to-br from-green-900/20 to-teal-900/20 border border-green-500/20 rounded-2xl p-6">
              <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                What You Can Do at Home Right Now
              </h2>
              <p className="text-white/50 text-sm mb-4">
                You don't need to be an expert in these careers. Your role is to open doors and build confidence.
              </p>
              <ul className="space-y-3">
                {PARENT_ACTIONS.map((action, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-white/70 text-sm">{action}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── GAP SUMMARY ───────────────────────────────────────────────── */}
            {matches.some(m => m.subject_gaps && (m.subject_gaps as SubjectGap[]).length > 0) && (
              <section>
                <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Subject Gaps to Address
                </h2>
                <p className="text-white/50 text-sm mb-4">
                  These subjects appear in {selectedStudent.name}&apos;s gap analysis for multiple career matches.
                  Strengthening these will improve career options significantly.
                </p>
                <div className="space-y-3">
                  {Array.from(
                    new Map(
                      matches.flatMap(m => (m.subject_gaps as SubjectGap[] ?? []))
                        .map(g => [g.subject, g])
                    ).values()
                  ).map(gap => (
                    <div key={gap.subject} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-semibold capitalize">{gap.subject.replace(/_/g, ' ')}</span>
                        <span className="text-amber-400 text-sm">{gap.current_score}/4 → target {gap.required_score}/4</span>
                      </div>
                      <p className="text-white/50 text-sm">{gap.advice}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── LINK TO EXPLORE ───────────────────────────────────────────── */}
            <div className="text-center pb-8">
              <Link
                href="/career"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-violet-500/25 text-base"
              >
                <BookOpen className="w-5 h-5" />
                Explore All Careers with {selectedStudent.name}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
