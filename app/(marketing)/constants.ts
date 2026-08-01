// Curriculum labels shown across the marketing site — one source of truth
// so the hero and footer can't drift out of sync with each other.

// Full labels, used wherever there's room to be explicit (hero pills).
export const CURRICULA = ['CBC', 'Cambridge IGCSE', '8-4-4', 'Grade 7–12'] as const

// Abbreviated labels for tight spaces (footer). Not a slice of CURRICULA —
// "IGCSE" vs "Cambridge IGCSE" is a deliberate space-saving abbreviation,
// not an accidental difference.
export const CURRICULA_COMPACT = ['CBC', 'IGCSE', '8-4-4'] as const

// Shared keyboard-focus indicator for every interactive element on the
// marketing site. One definition so focus styling can't drift per-component
// the way spacing/color/opacity did before this rehabilitation.
//
// Two variants exist because the site isn't visually uniform yet: most of
// the marketing site is dark (bg-black/slate-950), but /legal/* renders on
// a light background (bg-white/slate-50) — a white outline would have
// near-zero contrast there. This is a stopgap for that pre-existing light/
// dark split, not a new design decision; Phase 5 should resolve which
// theme /legal/* actually belongs to.
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'
export const FOCUS_RING_ON_LIGHT = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900/70'

// The one real-time human contact channel the business actually operates —
// used by both /early-access's family flow and any school-facing "talk to
// us" CTA. Single source so a phone-number change never has to be hunted
// down page by page.
export const WHATSAPP_NUMBER = '254710798030'

function buildWaLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

// School-demo request CTA destination. EduNexus has no dedicated demo-
// booking page or form — WhatsApp is the real, already-in-use contact
// channel (see /early-access), so a "Book a School Demo" button should
// open a real conversation there instead of pointing at the unrelated
// family early-access funnel.
export const SCHOOL_DEMO_WA_LINK = buildWaLink(
  `Habari EduNexus! 👋
I'd like to book a school demo.
School name: [school name]
Role: [principal / deputy / ICT coordinator / other]
Approx. number of learners: [number]
Best time to reach me: [day/time]`
)
