import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, getErrorMessage } from '@/lib/api/response'
import { buildAttentionFeed } from '@/lib/attentionFeed/aggregate'
import { dismissAttentionItem } from '@/lib/attentionFeed/dismissals'

const DismissSchema = z.object({
  itemKey: z.string().min(1),
})

async function getTeacherId(): Promise<{ teacherId: string } | { error: Response }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: apiUnauthorized() }

  const db = createServiceClient()
  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return { error: apiForbidden() }
  return { teacherId: teacher.id as string }
}

export async function GET(): Promise<Response> {
  try {
    const result = await getTeacherId()
    if ('error' in result) return result.error

    const items = await buildAttentionFeed(result.teacherId)
    return apiSuccess({ items })
  } catch (e: unknown) {
    console.error('[teacher/attention-feed GET]', getErrorMessage(e))
    return apiError('Failed to load attention feed')
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const result = await getTeacherId()
    if ('error' in result) return result.error

    const parsed = DismissSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    await dismissAttentionItem(result.teacherId, parsed.data.itemKey)
    return apiSuccess({ dismissed: true })
  } catch (e: unknown) {
    console.error('[teacher/attention-feed POST]', getErrorMessage(e))
    return apiError('Failed to dismiss attention item')
  }
}
