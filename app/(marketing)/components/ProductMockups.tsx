// app/(marketing)/components/ProductMockups.tsx
'use client'

import {
  Compass,
  FileText,
  Users,
  Search,
  BookOpen,
  Moon,
  Send,
  Download,
  Share2,
  TrendingUp,
} from 'lucide-react'

// ─── Shared helper ─────────────────────────────────────────────────────────────
function ProgressBar({
  value,
  color,
  max = 100,
}: {
  value: number
  color: string
  max?: number
}) {
  return (
    <div className="w-full bg-white/10 rounded-full h-3">
      <div
        className={`h-3 rounded-full ${color}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  )
}

// ─── MOCKUP 1: Learning Compass ────────────────────────────────────────────────
export function LearningCompassMockup() {
  return (
    <div className="relative w-full">
      {/* Glow */}
      <div className="absolute -inset-2 bg-linear-to-br from-amber-500 to-orange-500 rounded-3xl blur-2xl opacity-25 pointer-events-none" />

      <div className="relative bg-slate-900 border border-white/10 rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-black text-white">Learning Compass</div>
              <div className="text-[10px] text-white/40">With Grace — Grade 8</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Moon className="w-3 h-3 text-white/50" />
            <div className="text-[9px] bg-white/5 border border-white/10 text-white/50 px-2 py-0.5 rounded-full font-black">
              🧭 Personalised · 👨‍👩‍👧 Parent can see all
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/10 bg-white/3">
          <span className="text-xs font-semibold text-white/40">Illustrative example</span>
        </div>

        {/* Chat area */}
        <div className="px-4 py-4 space-y-3 min-h-[220px]">
          {/* Student message */}
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <p className="text-xs text-white/80">Sijui simultaneous equations kabisa 😭</p>
            </div>
          </div>

          {/* AI message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] space-y-1.5">
              <div className="bg-linear-to-r from-amber-500/30 to-orange-500/30 border border-amber-400/30 rounded-2xl rounded-br-sm px-4 py-3">
                <p className="text-xs text-white/90">
                  Sawa Grace! Bei ya unga — 2 packets na 1 sugar = KES 180. Hiyo ni equation yako ya kwanza...
                </p>
              </div>
              <div className="flex justify-end">
                <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-black">
                  Grade 8 level ✓
                </span>
              </div>
            </div>
          </div>

          {/* Student message 2 */}
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <p className="text-xs text-white/80">OH! So x ni unga na y ni sugar? Nimeelewa! 🤔</p>
            </div>
          </div>

          {/* AI message 2 */}
          <div className="flex justify-end">
            <div className="max-w-[85%] space-y-1.5">
              <div className="bg-linear-to-r from-amber-500/30 to-orange-500/30 border border-amber-400/30 rounded-2xl rounded-br-sm px-4 py-3">
                <p className="text-xs text-white/90">Exactly! Sasa tuweke equation ya pili...</p>
              </div>
              <div className="flex justify-end">
                <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-black">
                  Level adjusted up ↑
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-white/10 bg-white/3 flex items-center gap-2">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <span className="text-[11px] text-white/50">Uliza swali lolote la CBC...</span>
          </div>
          <button tabIndex={-1} aria-hidden="true" className="w-8 h-8 bg-linear-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shrink-0">
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MOCKUP 2: Academic Clinic ─────────────────────────────────────────────────
export function AcademicClinicMockup() {
  const subjects = [
    { name: 'Mathematics', level: 'EE', score: 87, color: 'bg-green-500', labelColor: 'text-green-300', note: 'Exceeding — strong' },
    { name: 'Integrated Science', level: 'ME', score: 72, color: 'bg-blue-500', labelColor: 'text-blue-300', note: 'Meeting expectations' },
    { name: 'English', level: 'AE', score: 55, color: 'bg-amber-500', labelColor: 'text-amber-300', note: 'Needs work on writing' },
    { name: 'Kiswahili', level: 'BE', score: 38, color: 'bg-red-500', labelColor: 'text-red-300', note: '⚠ Action needed — grammar' },
    { name: 'Social Studies', level: 'ME', score: 66, color: 'bg-blue-400', labelColor: 'text-blue-300', note: 'Steady' },
  ]

  return (
    <div className="relative w-full">
      <div className="absolute -inset-2 bg-linear-to-br from-violet-500 to-purple-500 rounded-3xl blur-2xl opacity-25 pointer-events-none" />

      <div className="relative bg-slate-900 border border-white/10 rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-linear-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-black text-white">Academic Clinic Report</div>
              <div className="text-[10px] text-white/40">Term 2, 2025 · Grade 8</div>
            </div>
          </div>
          <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-black">
            PDF ready
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/10 bg-white/3">
          <span className="text-xs font-semibold text-white/40">Illustrative example</span>
        </div>

        {/* Subject bars */}
        <div className="px-4 py-4 space-y-3">
          {subjects.map((s) => (
            <div key={s.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black ${s.labelColor} w-6`}>{s.level}</span>
                  <span className="text-xs text-white/80">{s.name}</span>
                </div>
                <span className="text-xs font-black text-white/60">{s.score}%</span>
              </div>
              <ProgressBar value={s.score} color={s.color} />
              <p className="text-[10px] text-white/40">{s.note}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-white/3">
          <p className="text-[10px] text-white/50 mb-2">Clinic Report · Parent Verified</p>
          <div className="flex gap-2">
            <button tabIndex={-1} aria-hidden="true" className="flex-1 flex items-center justify-center gap-1.5 bg-linear-to-r from-violet-500 to-purple-500 text-white py-2 rounded-xl text-[11px] font-black">
              <Download className="w-3 h-3" /> Download PDF
            </button>
            <button tabIndex={-1} aria-hidden="true" className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 border border-white/10 text-white/60 py-2 rounded-xl text-[11px] font-black">
              <Share2 className="w-3 h-3" /> Share with Teacher
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MOCKUP 3: Teacher Dashboard ───────────────────────────────────────────────
export function TeacherDashboardMockup() {
  const students = [
    { name: 'Brian Otieno', score: 38, label: 'Below', color: 'bg-red-500', textColor: 'text-red-300' },
    { name: 'Grace Wanjiku', score: 58, label: 'Approaching', color: 'bg-amber-500', textColor: 'text-amber-300' },
    { name: 'Amina Juma', score: 72, label: 'Meets', color: 'bg-green-500', textColor: 'text-green-300' },
    { name: 'Kamau Ndungu', score: 91, label: 'Exceeds', color: 'bg-purple-500', textColor: 'text-purple-300' },
  ]

  return (
    <div className="relative w-full">
      <div className="absolute -inset-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-3xl blur-2xl opacity-25 pointer-events-none" />

      <div className="relative bg-slate-900 border border-white/10 rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 bg-linear-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-black text-white">Class 8B — Mathematics</div>
              <div className="text-[10px] text-white/40">Mwalimu Kamau · 35 students</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/10 bg-white/3">
          <span className="text-xs font-semibold text-white/40">Illustrative example</span>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Class average */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-white/70">Class Average: 2.4/4</span>
              <span className="text-[10px] text-amber-300 font-black">Approaching</span>
            </div>
            <ProgressBar value={60} color="bg-amber-500" />
          </div>

          {/* Student rows */}
          <div className="space-y-2">
            {students.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-[11px] text-white/70 w-24 shrink-0 truncate">{s.name}</span>
                <div className="flex-1">
                  <ProgressBar value={s.score} color={s.color} />
                </div>
                <span className={`text-[10px] font-black ${s.textColor} w-20 text-right shrink-0`}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Alert */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-red-300 font-black">⚠️ Brian inactive 8 days</p>
              <button tabIndex={-1} aria-hidden="true" className="text-[10px] bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded-lg font-black">
                Send Reminder
              </button>
            </div>
          </div>

          {/* Bottom badges */}
          <div className="flex gap-2">
            <span className="flex-1 text-center text-[10px] bg-teal-500/10 border border-teal-500/20 text-teal-300 py-1.5 rounded-xl font-black">
              🎯 KNEC CBA Export Ready
            </span>
            <span className="flex-1 text-center text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded-xl font-black">
              📋 SOW Generated
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MOCKUP 4: Career Explorer ─────────────────────────────────────────────────
export function CareerExplorerMockup() {
  const careers = [
    {
      icon: '🏆',
      title: 'Software Engineer',
      match: 91,
      salary: 'KES 120,000 – 350,000/mo',
      strong: 'Mathematics, Science',
      color: 'from-cyan-500 to-blue-500',
      borderColor: 'border-cyan-500/20',
      bgColor: 'bg-cyan-500/5',
    },
    {
      icon: '🔬',
      title: 'Data Scientist',
      match: 84,
      salary: 'KES 100,000 – 280,000/mo',
      strong: 'Mathematics, English',
      color: 'from-blue-500 to-indigo-500',
      borderColor: 'border-blue-500/20',
      bgColor: 'bg-blue-500/5',
    },
    {
      icon: '⚕️',
      title: 'Clinical Officer',
      match: 78,
      salary: 'KES 60,000 – 150,000/mo',
      strong: 'Biology, Chemistry',
      color: 'from-green-500 to-teal-500',
      borderColor: 'border-green-500/20',
      bgColor: 'bg-green-500/5',
    },
  ]

  return (
    <div className="relative w-full">
      <div className="absolute -inset-2 bg-linear-to-br from-cyan-500 to-blue-500 rounded-3xl blur-2xl opacity-25 pointer-events-none" />

      <div className="relative bg-slate-900 border border-white/10 rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-linear-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-black text-white">Career Intelligence · Grade 10</div>
              <div className="text-[10px] text-white/40">Illustrative example — based on a sample learner profile</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3">
          {careers.map((c, i) => (
            <div key={c.title} className={`${c.bgColor} border ${c.borderColor} rounded-2xl p-3`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.icon}</span>
                  <div>
                    <div className="text-xs font-black text-white">{c.title}</div>
                    <div className="text-[10px] text-white/40">{c.salary}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-white">{c.match}%</div>
                  <div className="text-[10px] text-white/40">match</div>
                </div>
              </div>
              <ProgressBar value={c.match} color={`bg-linear-to-r ${c.color}`} />
              <p className="text-[10px] text-white/40 mt-1.5">Strong: {c.strong}</p>
              {i === 0 && (
                <button tabIndex={-1} aria-hidden="true" className={`mt-2 w-full text-[10px] font-black bg-linear-to-r ${c.color} text-white py-1.5 rounded-xl`}>
                  Explore Path
                </button>
              )}
            </div>
          ))}

          <p className="text-[10px] text-white/50 text-center">200+ careers · Updated 2026 🇰🇪</p>
        </div>
      </div>
    </div>
  )
}

// ─── MOCKUP 5: Scheme of Work ──────────────────────────────────────────────────
export function SchemeOfWorkMockup() {
  const rows = [
    { wk: 1, ls: 1, strand: 'Numbers', substrand: 'Integers and operations' },
    { wk: 1, ls: 2, strand: 'Numbers', substrand: 'Factors and multiples' },
    { wk: 1, ls: 3, strand: 'Numbers', substrand: 'Fractions — proper' },
    { wk: 2, ls: 1, strand: 'Algebra', substrand: 'Introduction to algebra' },
    { wk: 2, ls: 2, strand: 'Algebra', substrand: 'Simple equations' },
  ]

  return (
    <div className="relative w-full">
      <div className="absolute -inset-2 bg-linear-to-br from-blue-500 to-indigo-500 rounded-3xl blur-2xl opacity-25 pointer-events-none" />

      <div className="relative bg-slate-900 border border-white/10 rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-black text-white">Scheme of Work Generator</div>
                <div className="text-[10px] text-white/40">Mathematics · Grade 8 · Term 2</div>
              </div>
            </div>
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-black">
              ⚡ 4 min
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/10 bg-white/3">
          <span className="text-xs font-semibold text-white/40">Illustrative example</span>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Table */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[28px_28px_70px_1fr] gap-2 px-3 py-2 border-b border-white/10 bg-white/5">
              <span className="text-[10px] font-black text-white/40">WK</span>
              <span className="text-[10px] font-black text-white/40">LS</span>
              <span className="text-[10px] font-black text-white/40">STRAND</span>
              <span className="text-[10px] font-black text-white/40">SUBSTRAND</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[28px_28px_70px_1fr] gap-2 px-3 py-1.5 border-b border-white/5 last:border-0"
              >
                <span className="text-[11px] text-white/60 font-black">{r.wk}</span>
                <span className="text-[11px] text-white/60">{r.ls}</span>
                <span className="text-[11px] text-blue-300 font-black">{r.strand}</span>
                <span className="text-[11px] text-white/70 truncate">{r.substrand}</span>
              </div>
            ))}
          </div>

          {/* Quality badge */}
          <div className="flex gap-2">
            <span className="flex-1 text-center text-[10px] bg-green-500/10 border border-green-500/20 text-green-300 py-1.5 rounded-xl font-black">
              ✅ KICD-Aligned · CBC Grade 8
            </span>
            <span className="flex-1 text-center text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded-xl font-black">
              📄 PDF Download Ready
            </span>
          </div>

          <p className="text-[10px] text-white/50 text-center">
            KICD-aligned · 13 weeks · 52 lessons
          </p>

          <div className="flex gap-2">
            <button tabIndex={-1} aria-hidden="true" className="flex-1 flex items-center justify-center gap-1.5 bg-linear-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-xl text-[11px] font-black">
              <Download className="w-3 h-3" /> Download PDF
            </button>
            <button tabIndex={-1} aria-hidden="true" className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 border border-white/10 text-white/60 py-2 rounded-xl text-[11px] font-black">
              <TrendingUp className="w-3 h-3" /> Save Scheme
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
