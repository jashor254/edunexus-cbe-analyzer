// Extracted from the homepage's former #teachers section so the same
// content can be reused, unduplicated, across the homepage summary card
// and the /teachers destination page. Copy is unchanged from what was
// already trust-reviewed on the homepage.

const WORKSPACE_CARDS = [
  {
    icon: '📋',
    title: 'Schemes of Work',
    body: 'Your full term planned before it begins — CBC-aligned, TSC inspection ready. This is the structure the Blueprint reads against.',
  },
  {
    icon: '📖',
    title: 'Lesson Plans',
    body: "Every Friday, next week's plans land automatically. Objectives, activities, assessments — the record that becomes evidence.",
  },
  {
    icon: '📊',
    title: 'Class Intelligence',
    body: "See every learner's level at a glance. Know who needs support before the end-of-term results force the conversation.",
  },
]

export function TeacherWorkspaceCards() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {WORKSPACE_CARDS.map((card) => (
        <div
          key={card.title}
          className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:bg-white/5 hover:scale-[1.02] transition-all"
        >
          <div className="text-3xl mb-4">{card.icon}</div>
          <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
          <p className="text-sm text-white/45 leading-relaxed">{card.body}</p>
        </div>
      ))}
    </div>
  )
}

const TEACHER_TIMELINE = [
  { icon: '📋', label: 'SOW generated'     },
  { icon: '📖', label: 'Lesson plans sent' },
  { icon: '📊', label: 'Insights updated'  },
  { icon: '💬', label: 'Parents notified'  },
]

export function TeacherAutomationTimeline() {
  return (
    <div>
      <p className="text-center text-[10px] font-semibold text-white/50 uppercase tracking-widest mb-4">
        From classroom record to family insight
      </p>
      <div
        className="flex items-center justify-center overflow-x-auto [&::-webkit-scrollbar]:hidden pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {TEACHER_TIMELINE.map((step, i) => (
          <div key={step.label} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-base">{step.icon}</span>
              <span className="text-[10px] text-teal-400 font-medium whitespace-nowrap">{step.label}</span>
            </div>
            {i < TEACHER_TIMELINE.length - 1 && (
              <div className="w-8 md:w-14 shrink-0 mx-2 border-t border-dashed border-teal-500/30" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
