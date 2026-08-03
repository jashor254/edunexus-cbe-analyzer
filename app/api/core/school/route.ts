import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createSchool, getSchool, updateSchool, getSchoolSettings, upsertSchoolSettings } from '@/lib/core/school'
import { activateSchool } from '@/lib/core/schoolActivation'
import { requireAuthentication, requireSchoolMembership } from '@/lib/core/permissions'
import { UnauthorizedError, PermissionDeniedError, isEduNexusError } from '@/lib/core/errors'
import type { SchoolSettings } from '@/types/core'
import { z } from 'zod'

const CreateSchoolSchema = z.object({
  school_name: z.string().min(1),
  // Matches the live `schools_school_type_check` constraint (primary /
  // secondary / mixed / special) — previously a disjoint set
  // ('public_primary' etc.) that could never pass the DB constraint, so
  // every real request silently fell through to the column's own default
  // ('secondary') regardless of what was sent. See types/core.ts.
  school_type: z.enum(['primary', 'secondary', 'mixed', 'special']).optional(),
  grade_codes: z.array(z.string()).optional(),
  nemis_code: z.string().optional(),
  county: z.string().optional(),
  sub_county: z.string().optional(),
  ward: z.string().optional(),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional(),
  motto: z.string().optional(),
})

const UpdateSchoolSchema = z.object({
  school_name: z.string().min(1).optional(),
  county: z.string().optional(),
  sub_county: z.string().optional(),
  ward: z.string().optional(),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional(),
  logo_url: z.string().url().optional(),
  motto: z.string().optional(),
})

const UpdateSettingsSchema = z.object({
  curriculum_type: z.enum(['cbc', '844', 'igcse']).optional(),
  school_open_days: z.number().int().min(1).max(7).optional(),
  report_footer: z.string().optional(),
  sms_enabled: z.boolean().optional(),
  grade_boundaries: z.record(z.string(), z.object({ min: z.number() })).optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()
  const parsed = CreateSchoolSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    return errorResponse(err)
  }

  // grade_codes is an activation input, not a `schools` row column — split
  // it out before handing the rest to createSchool().
  const { grade_codes: gradeCodes, ...schoolInput } = parsed.data

  // No existing schoolId to check membership against yet — any authenticated
  // user may create a school, and becomes its first school_admin (unchanged).
  const { school, schoolUser } = await createSchool(schoolInput, userId)

  // Sprint 9C: activation runs exactly once, immediately after creation —
  // composed here at the route (not inside createSchool() itself) to avoid
  // a lib/core/school.ts <-> lib/core/schoolActivation.ts circular import,
  // per RAS §6's "a route composes two service calls" allowance. School
  // creation has already succeeded at this point (school.id exists and is
  // durable) — a failed activation is reported in the response body, never
  // silently retried here and never rolled back (lib/core/schoolActivation.ts's
  // documented recovery model is idempotent retry, not rollback). The
  // caller must check `data.activation.status === 'complete'` before
  // treating the school as ready — this is what "never leave ambiguous
  // success" means: the school-creation HTTP status (201) and the
  // activation outcome are reported separately, not conflated.
  const activation = await activateSchool(school.id, gradeCodes ? { gradeCodes } : {})

  return NextResponse.json({ data: { school, schoolUser, activation } }, { status: 201 })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  try {
    await requireSchoolMembership(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const [school, settings] = await Promise.all([
    getSchool(schoolId),
    getSchoolSettings(schoolId).catch(() => null),
  ])

  return NextResponse.json({ data: { school, settings } })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()
  const { schoolId, type, ...rest } = body

  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  try {
    // NOTE: intentionally NOT `requireSchoolAdmin` — this route's existing role
    // set is ['school_admin', 'headteacher'] only, excluding 'deputy_headteacher',
    // unlike every other admin-gated route in this batch. This is a pre-existing
    // inconsistency discovered during Sprint 1B migration, not one of the two
    // named security fixes for this sprint — preserved exactly, not touched,
    // per "business logic must remain IDENTICAL." Flagged for a future sprint.
    const membership = await requireSchoolMembership(supabase, schoolId)
    if (!['school_admin', 'headteacher'].includes(membership.role)) throw new PermissionDeniedError()
  } catch (err) {
    return errorResponse(err)
  }

  if (type === 'settings') {
    const parsed = UpdateSettingsSchema.safeParse(rest)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const data = await upsertSchoolSettings(schoolId, parsed.data as Partial<Omit<SchoolSettings, 'id' | 'school_id' | 'created_at' | 'updated_at'>>)
    return NextResponse.json({ data })
  }

  const parsed = UpdateSchoolSchema.safeParse(rest)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const data = await updateSchool(schoolId, parsed.data)
  return NextResponse.json({ data })
}
