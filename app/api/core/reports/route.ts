import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generateReportCards, publishReportCards, getReportCard, listClassReportCards, updateReportCard } from '@/lib/core/report-cards'
import { getSchoolSettings } from '@/lib/core/school'
import { requireSchoolMembership, requireSchoolAdmin, canEditReport } from '@/lib/core/permissions'
import { UnauthorizedError, PermissionDeniedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

const GenerateSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
})

const PublishSchema = z.object({
  schoolId: z.string().uuid(),
  termId: z.string().uuid(),
  classId: z.string().uuid().optional(),
})

const UpdateSchema = z.object({
  schoolId: z.string().uuid(),
  reportId: z.string().uuid(),
  class_teacher_comment: z.string().optional(),
  headteacher_comment: z.string().optional(),
  days_present: z.number().int().min(0).optional(),
  days_absent: z.number().int().min(0).optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
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

  const learnerId = req.nextUrl.searchParams.get('learnerId')
  const termId = req.nextUrl.searchParams.get('termId')
  const classId = req.nextUrl.searchParams.get('classId')

  // Security Hotfix SH-001: requireSchoolMembership above only proves the
  // caller belongs to `schoolId` — it never proved learnerId/classId
  // belong to that school. getReportCard/listClassReportCards now verify
  // that themselves and throw if not. Caught here as 404 (not 403): a
  // cross-school resource and a genuinely nonexistent one are
  // intentionally indistinguishable to the caller.
  if (learnerId && termId) {
    try {
      const data = await getReportCard(learnerId, termId, schoolId)
      return NextResponse.json({ data })
    } catch {
      return NextResponse.json({ error: 'Report card not found' }, { status: 404 })
    }
  }

  if (classId && termId) {
    try {
      const data = await listClassReportCards(classId, termId, schoolId)
      return NextResponse.json({ data, count: data.length })
    } catch {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
  }

  return NextResponse.json({ error: 'learnerId+termId or classId+termId required' }, { status: 400 })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const body = await req.json()

  if (body.action === 'publish') {
    const parsed = PublishSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    try {
      await requireSchoolAdmin(supabase, parsed.data.schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    const data = await publishReportCards(parsed.data.schoolId, parsed.data.termId, parsed.data.classId)
    return NextResponse.json({ data })
  }

  if (body.action === 'update') {
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    // SECURITY FIX (Stage 0 census, gap #2): previously membership-only,
    // inconsistent with the admin-gated `publish`/generate actions in this
    // same file. Now consistently admin-gated via the canonical `canEditReport`
    // (conservative default — see lib/core/permissions.ts's doc comment for
    // the still-open "admin-or-class-teacher" product decision).
    try {
      await requireSchoolMembership(supabase, parsed.data.schoolId)
      if (!(await canEditReport(supabase, parsed.data.schoolId))) throw new PermissionDeniedError()
    } catch (err) {
      return errorResponse(err)
    }
    const { schoolId, reportId, ...updates } = parsed.data
    const data = await updateReportCard(reportId, schoolId, updates as Parameters<typeof updateReportCard>[2])
    return NextResponse.json({ data })
  }

  // Generate
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    await requireSchoolAdmin(supabase, parsed.data.schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const settings = await getSchoolSettings(parsed.data.schoolId)
  try {
    const data = await generateReportCards(parsed.data.schoolId, parsed.data.classId, parsed.data.termId, settings.grade_boundaries)
    return NextResponse.json({ data })
  } catch (err) {
    // Sprint 5B: generateReportCards throws a plain Error (not an
    // EduNexusError — this is a state conflict, not an authorization
    // failure) when it refuses to overwrite already-published report
    // cards. Surfaced explicitly per the sprint's Failure Behaviour
    // requirement, rather than falling through to a generic 500.
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate report cards' }, { status: 409 })
  }
}
