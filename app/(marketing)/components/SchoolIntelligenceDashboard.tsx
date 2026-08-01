'use client'

// Extracted from the homepage's former #school section so the same
// dashboard mockup and capability grid can be reused, unduplicated,
// across both the homepage summary card and the /schools destination page.
// Content is unchanged from what was already trust-reviewed on the homepage.

import { BarChart3, Users, Target, TrendingUp, BookOpen, AlertCircle } from 'lucide-react'

export function SchoolIntelligenceDashboard() {
  return (
    <div className="bg-white/4 border border-white/10 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="bg-white/6 border-b border-white/10 px-5 py-3.5 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">🏫 School Intelligence</div>
          <div className="text-xs text-white/40">Sample School · Term 2, 2026</div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white/40">
          Illustrative example
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-b border-white/8">
        {[
          { val: '247', label: 'Learners'      },
          { val: '14',  label: 'Teachers'      },
          { val: '89%', label: 'Planning done' },
        ].map((stat) => (
          <div key={stat.label} className="px-5 py-4 border-r border-white/8 last:border-0">
            <div className="text-xl font-black text-white">{stat.val}</div>
            <div className="text-[10px] text-white/35 font-semibold uppercase tracking-wide mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Attention alert */}
      <div className="px-5 py-4 border-b border-white/8 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-white">18 learners need attention</div>
          <div className="text-xs text-white/40 mt-0.5">Below trajectory for 2+ weeks · intervention recommended</div>
        </div>
      </div>

      {/* Strand breakdown */}
      <div className="px-5 py-4 border-b border-white/8">
        <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-3">
          Strands below school average
        </div>
        {[
          { strand: 'Number Patterns',      subject: 'Mathematics', pct: 43 },
          { strand: 'Inference & Deduction', subject: 'English',    pct: 58 },
          { strand: 'Cell Biology',          subject: 'Science',    pct: 71 },
        ].map(({ strand, subject, pct }) => (
          <div key={strand} className="mb-2.5 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/70 font-medium">{strand}</span>
              <span className="text-xs text-white/35 font-semibold">{pct}%</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  pct < 50 ? 'bg-red-400/70' : pct < 70 ? 'bg-amber-400/70' : 'bg-green-400/70'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-white/50 mt-0.5">{subject}</div>
          </div>
        ))}
      </div>

      {/* Growth footer */}
      <div className="px-5 py-3.5 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-green-400" />
        <span className="text-sm text-green-400 font-semibold">
          +9% average learning growth this term
        </span>
      </div>
    </div>
  )
}

const CAPABILITIES = [
  {
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'text-blue-400',
    bg:    'bg-blue-500/10',
    title: 'Learning Trends',
    body:  'See which subjects and strands the school is gaining in — and where learning is stalling.',
  },
  {
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-amber-400',
    bg:    'bg-amber-500/10',
    title: 'Early Intervention',
    body:  'Know which learners need support before the end-of-term exam forces the conversation.',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    color: 'text-green-400',
    bg:    'bg-green-500/10',
    title: 'Teacher Planning',
    body:  'See planning completion across your staff. Know which classes are ready — and which are not.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    color: 'text-violet-400',
    bg:    'bg-violet-500/10',
    title: 'Parent Engagement',
    body:  'Low parent engagement is often the first signal of a struggling learner. Track it early.',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-teal-400',
    bg:    'bg-teal-500/10',
    title: 'Learning Growth',
    body:  'Not just marks — actual growth. Which learners improved this term, regardless of where they started.',
  },
  {
    icon: <Target className="w-5 h-5" />,
    color: 'text-pink-400',
    bg:    'bg-pink-500/10',
    title: 'Career Readiness',
    body:  'As learners progress, the platform builds a career intelligence picture that exceeds examination data.',
  },
]

export function SchoolCapabilitiesGrid() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {CAPABILITIES.map((cap) => (
        <div
          key={cap.title}
          className="bg-white/3 border border-white/8 rounded-xl p-4 hover:bg-white/5 transition-all"
        >
          <div className={`${cap.bg} ${cap.color} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}>
            {cap.icon}
          </div>
          <div className="text-sm font-bold text-white mb-1">{cap.title}</div>
          <p className="text-xs text-white/40 leading-relaxed">{cap.body}</p>
        </div>
      ))}
    </div>
  )
}
