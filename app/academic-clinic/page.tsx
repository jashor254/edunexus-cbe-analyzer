// app/academic-clinic/page.tsx
//
// Phase 2.3 (Learner Report Architecture — orphaned legacy Clinic surface
// closure). This page was confirmed, across Phases 0/1/2/2.1/2.2, to have
// zero inbound navigation links anywhere in the app — reachable only by a
// hand-typed or historically-bookmarked URL. Its on-page preview called the
// legacy, non-canonical report engine (lib/academicClinic/reportGenerator.ts's
// generateSeniorGuidance()/CareerEngine, no canonical pathway/career/
// trajectory data) — the one production surface that could still show a
// learner a different pathway, career ranking, or trajectory than every
// other Clinic surface, which have all been canonical since Phase 2.1/2.2.
//
// Closure strategy: redirect, not delete or 404. The page's entire purpose —
// pick one of your own students, preview a Clinic report, download the PDF —
// is already fully served by the nav-reachable /dashboard/clinic (student
// list → "View Report" → the canonical, Projection/Career-Intelligence-backed
// report). A stale bookmark or hand-typed URL now lands somewhere real and
// correct instead of a 404, and instead of stale, non-canonical intelligence.
//
// This also removes the last production import of the legacy
// generateSeniorGuidance()/client-side CareerEngine preview path — see the
// Phase 2.3 closeout for the full duplicate-caller search.
import { redirect } from 'next/navigation'

export default function AcademicClinicPage() {
  redirect('/dashboard/clinic')
}
