import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { getTopicsForSubject } from '@/lib/compass/topicSelector'

export async function GET(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const gradeParam = searchParams.get('grade')
    const subject = searchParams.get('subject')

    if (!gradeParam || !subject) return apiError('grade and subject are required', 400)

    const grade = parseInt(gradeParam, 10)
    if (isNaN(grade)) return apiError('grade must be a number', 400)

    const tree = await getTopicsForSubject(subject, grade, 'cbc')

    const substrands = tree.flatMap(strand =>
      strand.substrands.map(ss => ({
        id: ss.id,
        title: ss.title,
        displayName: ss.displayName,
        strandTitle: strand.strandTitle,
      }))
    )

    return apiSuccess({ substrands })
  } catch (e: unknown) {
    console.error('[assignments/substrands GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
