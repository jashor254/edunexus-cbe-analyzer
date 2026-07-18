// app/teacher/core-readiness/page.tsx
//
// Sprint 10G renamed this page to app/teacher/core-office/ — the Sprint 10F
// comment this page used to carry ("the one canonical landing page for
// every Core operational screen") is exactly what Sprint 10G's School
// Office brief asked for, so the existing page was renamed in place
// instead of a second hub being built alongside it. This shim exists only
// so the old URL (already linked from OperationalBreadcrumb history / any
// bookmarks) still resolves.
import { redirect } from 'next/navigation'

export default function CoreReadinessRedirect() {
  redirect('/teacher/core-office')
}
