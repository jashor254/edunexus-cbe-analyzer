import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { runAnnualPromotion, previewPromotion } from '@/lib/core/promotions'
import { isSchoolAdmin } from '@/lib/core/school-users'
import { z } from 'zod'

const PromotionSchema = z.object({
  schoolId: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  decisions: z.array(z.object({
    learner_id: z.string().uuid(),
    promotion_type: z.enum(['promoted', 'repeated', 'graduated']),
    to_class_id: z.string().uuid().optional(),
    to_academic_year_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  })).min(1),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const academicYearId = req.nextUrl.searchParams.get('academicYearId')
  if (!schoolId || !academicYearId) return NextResponse.json({ error: 'schoolId and academicYearId required' }, { status: 400 })

  const admin = await isSchoolAdmin(user.id, schoolId)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await previewPromotion(schoolId, academicYearId)
  return NextResponse.json({ data, count: data.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PromotionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, academic_year_id, decisions } = parsed.data
  const admin = await isSchoolAdmin(user.id, schoolId)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await runAnnualPromotion(schoolId, user.id, { academic_year_id, decisions })
  return NextResponse.json({ data })
}
