// app/student/timeline/[learnerId]/page.tsx
//
// Sprint 6 — exposes the canonical Learner Record
// (lib/learnerRecord/timeline.ts's getLearnerTimeline(), CLAUDE.md: "the
// one function that answers 'what do we know about this learner, in
// order'") to the learner and their parent/teacher, not just the teacher
// API route that already existed
// (app/api/teacher/students/[studentId]/timeline). Same access gate as
// every other Sprint 6 page (requireLearnerAccess: self/parent/teacher-of-
// record/admin), same Core-learnerId-in-URL / legacy-id-internally
// bridging pattern the Blueprint page already established. No new
// computation — this is a straight read of an already-built, already-
// tested function.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireLearnerAccess } from '@/lib/core/permissions'
import { ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { getLearnerTimeline } from '@/lib/learnerRecord/timeline'
import Link from 'next/link'

const EVIDENCE_SOURCE_LABEL: Record<string, string> = {
  teacher_remark: 'Teacher note',
}

export default async function StudentTimelinePage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  const { learnerId } = await params
  const supabase = await createClient()

  try {
    await requireAuthentication(supabase)
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  let schoolId: string
  try {
    schoolId = await repos.learners.findSchoolId(learnerId)
  } catch {
    notFound()
  }

  try {
    await requireLearnerAccess(supabase, schoolId, learnerId)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) {
      return (
        <div className="max-w-2xl mx-auto py-6 px-4">
          <div role="alert" className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-2">
            <p className="text-sm font-black text-gray-900">You do not have access to this Timeline</p>
            <p className="text-xs text-gray-400">Contact your school administrator if you believe this is an error.</p>
          </div>
        </div>
      )
    }
    throw err
  }

  const legacyStudentId = await resolveLegacyStudentId(learnerId)
  const entries = legacyStudentId ? await getLearnerTimeline(legacyStudentId) : []

  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      <div className="mb-2">
        <h1 className="text-lg font-black text-gray-900">Timeline</h1>
        <Link href={`/student/blueprint/${learnerId}`} className="text-xs font-bold text-teal-700 hover:underline">
          ← Back to Blueprint
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {[...entries].reverse().map(entry => (
            <div
              key={entry.kind === 'evidence' ? entry.evidenceId : entry.promotionId}
              className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1"
            >
              <p className="text-[11px] text-gray-300">{new Date(entry.date).toLocaleDateString('en-KE', { dateStyle: 'long' })}</p>
              {entry.kind === 'evidence' ? (
                <>
                  <p className="text-sm font-bold text-gray-900">
                    {EVIDENCE_SOURCE_LABEL[entry.evidenceSource] ?? entry.subject}
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.subject}
                    {entry.score !== null && ` — ${entry.score}%`}
                    {entry.cbcLevel !== null && ` (Level ${entry.cbcLevel})`}
                  </p>
                  {entry.body && <p className="text-sm text-gray-700">{entry.body}</p>}
                  {entry.lifecycleState !== 'confirmed' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-gray-100 text-gray-500 border-gray-200">
                      {entry.lifecycleState}
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm font-bold text-gray-900">
                  Promoted{entry.fromGrade !== null ? ` from Grade ${entry.fromGrade}` : ''} to Grade {entry.toGrade} ({entry.academicYear})
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
