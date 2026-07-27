// scripts/reference-school/07-seed-blueprint-demo.ts
//
// Seeds one reproducible, real, canonical-service-only Blueprint pilot
// demonstration scenario for the Reference School (Mwatate Ridge Senior
// School): a real evidenced learner gets a persisted Projection, one
// approved Blueprint action, delivered to both a real class assignment and
// Learning Compass, and one recorded educator review.
//
// Every domain write here goes through the same canonical services
// production code uses — lib/learnerBlueprint/actionPlan/lifecycle.ts,
// delivery/assignment.ts, delivery/compass.ts, review.ts — never a direct
// insert into blueprint_action_items, assignments,
// blueprint_compass_deliveries, or blueprint_action_reviews.
//
// The one script-only technique used here (no precedent elsewhere in this
// seed suite) is impersonating a real seeded teacher account via Supabase
// Admin's generateLink()+verifyOtp() to obtain a genuine authenticated
// session: 03-seed-staff.ts assigns each teacher a random throwaway
// password that is never stored, so there is no credential to sign in
// with directly. This is strictly a seed-time convenience — it is never
// reachable from a route, never accepts a caller-supplied email, and only
// ever targets an @mwatateridge.ac.ke.example account this same seed
// suite created. Every authorization check the impersonated session hits
// (canManageLearnerRecordCore, requireClassTeacher, ...) still runs for
// real and would reject a teacher who doesn't actually teach this class.
//
// What this script deliberately does NOT fabricate: real learner activity
// (an assignment submission or a genuine Compass tutoring exchange). Per
// docs/architecture/blueprint-execution-experience-phase3a.md §14, "this
// cannot be faked" without writing session/evidence rows no real learner
// or AI tutor ever produced — see
// docs/architecture/blueprint-pilot-demonstration-phase3b.md for the
// documented manual step that completes the demo honestly.
//
// Idempotent: re-running finds the existing demo action item by its own
// marker title rather than proposing a second one, both delivery calls
// are themselves idempotent (existing delivery is returned, not
// duplicated), and the review step is skipped once any review already
// exists for the action (reviewBlueprintAction() itself is deliberately
// append-only, so this script must not call it unconditionally).
//
// Refuses to run when NODE_ENV=production — the generateLink/verifyOtp
// impersonation technique is a strictly greater blast radius than any
// other script in this directory (a real, usable session for a real
// account), so unlike its siblings this script gets an explicit guard
// rather than relying on ".env.local scoping" alone.
//
// Run: npm run seed:blueprint-demo
import { config } from 'dotenv'
config({ path: '.env.local' })

if (process.env.NODE_ENV === 'production') {
  throw new Error('[blueprint-demo] refusing to run with NODE_ENV=production — this is reference-school demo seed data only.')
}

import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js'
import { db, SCHOOL_NAME } from './shared'
import { seedLegacyBridge } from './06-seed-legacy-bridge'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { proposeBlueprintAction, approveBlueprintAction, listBlueprintActionsForLearner } from '@/lib/learnerBlueprint/actionPlan/lifecycle'
import { deliverBlueprintActionAsAssignment } from '@/lib/learnerBlueprint/actionPlan/delivery/assignment'
import { deliverBlueprintActionToCompass } from '@/lib/learnerBlueprint/actionPlan/delivery/compass'
import { reviewBlueprintAction, getBlueprintActionReviewSnapshot } from '@/lib/learnerBlueprint/actionPlan/review'

export const DEMO_ACTION_TITLE = 'Strengthen Kiswahili comprehension through weekly guided practice'
const DEMO_SUBJECT_LABEL = 'Kiswahili'
const DEMO_COMPASS_SUBJECT = 'kiswahili'

function weeksFromNow(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Obtains a real, authenticated Supabase client for an already-existing
 * auth user, without knowing their password. See module header for why
 * this is safe here and would not be safe as a general-purpose helper.
 */
async function impersonateExistingUser(userId: string): Promise<{ client: SupabaseClient; email: string }> {
  const supabase = db()
  const { data: authUser, error: getErr } = await supabase.auth.admin.getUserById(userId)
  if (getErr || !authUser?.user?.email) {
    throw new Error(`[blueprint-demo] could not resolve an email for auth user ${userId}: ${getErr?.message ?? 'no email on record'}`)
  }
  const email = authUser.user.email

  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link) throw new Error(`[blueprint-demo] generateLink failed for ${email}: ${linkErr?.message}`)
  const hashedToken = link.properties?.hashed_token
  if (!hashedToken) throw new Error(`[blueprint-demo] generateLink returned no hashed_token for ${email}`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('[blueprint-demo] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.local)')

  const client = createSupabaseJsClient(url, anonKey)
  const { data: verified, error: verifyErr } = await client.auth.verifyOtp({ token_hash: hashedToken, type: 'magiclink' })
  if (verifyErr || !verified.session) throw new Error(`[blueprint-demo] verifyOtp failed for ${email}: ${verifyErr?.message}`)

  return { client, email }
}

async function pickDemoLearner() {
  const supabase = db()

  const { data: school, error: schoolErr } = await supabase.from('schools').select('id').eq('school_name', SCHOOL_NAME).maybeSingle()
  if (schoolErr) throw schoolErr
  if (!school) throw new Error('[blueprint-demo] reference school not found — run `npm run seed:reference-school` first')
  const schoolId = school.id as string

  const { data: grade, error: gradeErr } = await supabase.from('grades').select('id').eq('code', 'G10').maybeSingle()
  if (gradeErr) throw gradeErr
  if (!grade) throw new Error('[blueprint-demo] G10 grade not found')

  const { data: cls, error: classErr } = await supabase
    .from('classes')
    .select('id, display_name, class_teacher_id')
    .eq('school_id', schoolId)
    .eq('grade_id', grade.id)
    .order('display_name')
    .limit(1)
    .maybeSingle()
  if (classErr) throw classErr
  if (!cls) throw new Error('[blueprint-demo] no G10 class found — run `npm run seed:reference-school` first')
  if (!cls.class_teacher_id) throw new Error(`[blueprint-demo] class ${cls.display_name} has no class_teacher_id`)

  const { data: enrollments, error: enrollErr } = await supabase
    .from('learner_enrollments')
    .select('learner_id')
    .eq('class_id', cls.id)
    .eq('status', 'active')
  if (enrollErr) throw enrollErr
  if (!enrollments?.length) throw new Error(`[blueprint-demo] no active enrollments in class ${cls.display_name}`)

  const { data: learner, error: learnerErr } = await supabase
    .from('learners')
    .select('id, first_name, last_name, admission_number')
    .in('id', enrollments.map((e) => e.learner_id))
    .order('admission_number')
    .limit(1)
    .maybeSingle()
  if (learnerErr) throw learnerErr
  if (!learner) throw new Error(`[blueprint-demo] could not resolve a demo learner in class ${cls.display_name}`)

  return { schoolId, coreClassId: cls.id as string, className: cls.display_name as string, coreLearnerId: learner.id as string, learnerName: `${learner.first_name} ${learner.last_name}` }
}

async function resolveTeacherAndLegacyClass(coreClassId: string, coreLearnerId: string) {
  const supabase = db()

  const { data: legacyStudent, error: studentErr } = await supabase
    .from('students')
    .select('id, teacher_id')
    .eq('external_id', coreLearnerId)
    .maybeSingle()
  if (studentErr) throw studentErr
  if (!legacyStudent?.teacher_id) {
    throw new Error(`[blueprint-demo] no bridged legacy student/teacher for learner ${coreLearnerId} — run \`npm run seed:reference-school\` first (legacy bridge step)`)
  }

  const { data: legacyTeacher, error: teacherErr } = await supabase
    .from('teachers')
    .select('id, user_id, full_name')
    .eq('id', legacyStudent.teacher_id)
    .maybeSingle()
  if (teacherErr) throw teacherErr
  if (!legacyTeacher) throw new Error(`[blueprint-demo] bridged legacy teacher ${legacyStudent.teacher_id} not found`)

  const { data: legacyClass, error: legacyClassErr } = await supabase
    .from('teacher_classes')
    .select('id')
    .eq('external_id', coreClassId)
    .maybeSingle()
  if (legacyClassErr) throw legacyClassErr
  if (!legacyClass) throw new Error(`[blueprint-demo] no bridged legacy class for Core class ${coreClassId}`)

  return {
    legacyStudentId: legacyStudent.id as string,
    legacyTeacherId: legacyTeacher.id as string,
    legacyTeacherUserId: legacyTeacher.user_id as string,
    legacyTeacherName: legacyTeacher.full_name as string,
    legacyClassId: legacyClass.id as string,
  }
}

export async function seedBlueprintDemo() {
  console.log(`Seeding Blueprint pilot demonstration data for ${SCHOOL_NAME}`)

  // Ensures Core structure, evidence, and the legacy bridge all exist —
  // idempotent, cheap on a re-run against an already-seeded school.
  await seedLegacyBridge()

  const { coreClassId, className, coreLearnerId, learnerName } = await pickDemoLearner()
  const { legacyStudentId, legacyTeacherUserId, legacyTeacherName, legacyClassId } = await resolveTeacherAndLegacyClass(coreClassId, coreLearnerId)

  console.log(`[demo learner] ${learnerName} (${className}), core learner id ${coreLearnerId}`)
  console.log(`[demo teacher] ${legacyTeacherName}`)

  const projection = await recomputeLearnerProjection(legacyStudentId)
  console.log(`[projection] recomputed — academic present: ${projection.academic !== null}`)

  const { client: teacherClient } = await impersonateExistingUser(legacyTeacherUserId)

  const existingActions = await listBlueprintActionsForLearner(teacherClient, coreLearnerId)
  let action = existingActions.find((a) => a.title === DEMO_ACTION_TITLE) ?? null

  if (!action) {
    action = await proposeBlueprintAction(teacherClient, {
      coreLearnerId,
      context: 'current_term',
      priority: 'high',
      visibility: 'shared',
      title: DEMO_ACTION_TITLE,
      rationale: `Recent ${DEMO_SUBJECT_LABEL} evidence shows comprehension below the level expected for this term.`,
      intendedOutcome: `The learner shows improved ${DEMO_SUBJECT_LABEL} comprehension in the next assessed task.`,
      learnerAction: 'Complete two guided comprehension passages per week and review corrections with the subject teacher.',
      teacherAction: 'Set weekly comprehension passages and check progress at the next class check-in.',
      successIndicator: `${DEMO_SUBJECT_LABEL} CAT or topical-check score improves by at least one CBC performance level.`,
      targetCapability: `${DEMO_SUBJECT_LABEL} comprehension`,
      reviewDate: weeksFromNow(3),
      proposalSource: 'teacher',
    })
    console.log(`[action] proposed ${action.id}`)
  } else {
    console.log(`[action] already exists: ${action.id} (status: ${action.status})`)
  }

  if (['proposed', 'edited', 'deferred'].includes(action.status)) {
    action = await approveBlueprintAction(teacherClient, action.id, {
      decisionReason: `Approved after reviewing Term 2 ${DEMO_SUBJECT_LABEL} evidence with the learner.`,
    })
    console.log(`[action] approved ${action.id}`)
  } else {
    console.log(`[action] already decided: ${action.status}`)
  }

  const assignmentResult = await deliverBlueprintActionAsAssignment(teacherClient, action.id, {
    classId: legacyClassId,
    confirmClassWideDelivery: true,
    subject: DEMO_SUBJECT_LABEL,
    topic: 'Comprehension practice',
    dueDate: weeksFromNow(2),
  })
  console.log(`[assignment delivery] assignment ${assignmentResult.assignment.id} (alreadyDelivered: ${assignmentResult.alreadyDelivered})`)

  const compassResult = await deliverBlueprintActionToCompass(teacherClient, action.id, {
    confirmCompassDelivery: true,
    subject: DEMO_COMPASS_SUBJECT,
  })
  console.log(`[compass delivery] delivery ${compassResult.delivery.id} (alreadyDelivered: ${compassResult.alreadyDelivered})`)

  // reviewBlueprintAction() is deliberately append-only (a review is never
  // updated, only followed by another) — calling it unconditionally on
  // every re-run would keep stacking duplicate "no_decision" reviews,
  // violating this script's own idempotency contract. Check first.
  const existingSnapshot = await getBlueprintActionReviewSnapshot(teacherClient, action.id)
  let reviewId: string
  if (existingSnapshot.previousReviews.length === 0) {
    const reviewResult = await reviewBlueprintAction(teacherClient, action.id, {
      decision: 'no_decision',
      notes: 'Delivered to class assignment and Learning Compass today. No learner activity recorded yet — will review again once the learner has had a chance to engage.',
    })
    reviewId = reviewResult.review.id
    console.log(`[review] recorded ${reviewId} (decision: ${reviewResult.review.decision})`)
  } else {
    reviewId = existingSnapshot.previousReviews[0].id
    console.log(`[review] already exists: ${reviewId} (decision: ${existingSnapshot.previousReviews[0].decision})`)
  }

  return {
    coreLearnerId,
    legacyStudentId,
    coreClassId,
    legacyClassId,
    actionItemId: action.id,
    assignmentId: assignmentResult.assignment.id,
    compassDeliveryId: compassResult.delivery.id,
    reviewId,
  }
}

if (require.main === module) {
  seedBlueprintDemo()
    .then((r) => {
      console.log('\n=== Blueprint Demo Seed Complete ===')
      console.log(`Learner Blueprint URL: /student/blueprint/${r.coreLearnerId}`)
      console.log(JSON.stringify(r, null, 2))
    })
    .catch((e) => { console.error(e); process.exit(1) })
}
