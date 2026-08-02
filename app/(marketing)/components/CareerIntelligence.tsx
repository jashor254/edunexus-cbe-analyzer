// Extracted from the homepage's former #career section so the same
// content can be reused, unduplicated, across the homepage summary card
// and the /career destination page (named /career, not /career-intelligence
// — that path is already taken by the real logged-in parent product page
// at app/(parent)/career-intelligence). Copy is unchanged from what was
// already trust-reviewed on the homepage.

const SIGNALS = [
  {
    icon: '🌱',
    title: 'Early Pathway Signals',
    body: 'Performance patterns in early grades often predict subject strengths. EduNexus flags these early so learners can explore — not just react to results.',
  },
  {
    icon: '💡',
    title: 'Strength-Based Guidance',
    body: 'Not every learner is strong in the same way. Career intelligence recognises what a learner is genuinely good at — and what grows with them over time.',
  },
  {
    icon: '🗺️',
    title: 'School-Level Readiness',
    body: 'School leadership can see, across all learners, which career pathways are emerging — and whether the curriculum is building towards them.',
  },
]

export function CareerIntelligenceCards() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {SIGNALS.map((card) => (
        <div
          key={card.title}
          className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-6 hover:bg-indigo-500/8 hover:scale-[1.02] transition-all"
        >
          <div className="text-3xl mb-4">{card.icon}</div>
          <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
          <p className="text-sm text-white/45 leading-relaxed">{card.body}</p>
        </div>
      ))}
    </div>
  )
}

export function CareerIntelligenceCallout() {
  return (
    <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl px-8 py-5 text-center max-w-180 mx-auto">
      <p className="text-white/55 text-sm leading-relaxed">
        Career Intelligence is not a separate tool. It is the same evidence, the same
        noticing, carried forward — built into EduNexus from Grade 7, with no separate
        subscription.
      </p>
      <p className="text-indigo-400 font-semibold text-sm mt-2">
        EduNexus does not wait until Form 6 to think about where a learner is headed.
      </p>
    </div>
  )
}
