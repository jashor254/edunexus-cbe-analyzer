import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createCohort } from '@/lib/academy/cohorts'

const CreateSchema = z.object({
  name:   z.string().min(3).max(80),
  school: z.string().max(120).optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
  if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const cohort = await createCohort(teacher.id, parsed.data.name, parsed.data.school ?? null)
    return NextResponse.json({ cohort })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
