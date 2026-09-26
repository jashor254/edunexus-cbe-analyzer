// app/sow/page.tsx
//
// Legacy Scheme of Work wizard, closed. It expected /api/sow/generate to
// return the finished scheme synchronously; generation has run as a
// background job for some time, so this page could no longer produce a
// scheme at all. It also saved without naming the generation it came from,
// which /api/sow/save now requires so every saved scheme was generated and
// paid for (the first one free) — see lib/sow/generationJob.ts.
//
// Redirect rather than delete: /teacher/lesson-plans linked here, and old
// bookmarks should land on the real wizard, not a 404.
import { redirect } from 'next/navigation'

export default function SOWPage() {
  redirect('/teacher/scheme-of-work/new')
}
