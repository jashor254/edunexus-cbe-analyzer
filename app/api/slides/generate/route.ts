// app/api/slides/generate/route.ts
import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { generateSlideContent } from '@/lib/slides/aiSlideGenerator'
import { buildPptx } from '@/lib/slides/pptxBuilder'
import { apiError, getErrorMessage } from '@/lib/api/response'

const BodySchema = z.object({
  subject:    z.string().min(1).max(100),
  grade:      z.string().min(1).max(50),
  topic:      z.string().min(3).max(200),
  slideCount: z.number().int().min(8).max(20).default(10),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. Validate input
    const body   = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)
    }
    const { subject, grade, topic, slideCount } = parsed.data

    // 2. Auth + access check
    const access = await checkFeatureAccess('slides_generate')
    if (access.allowed === false) {
      const reason = access.reason
      return apiError(
        reason === 'unauthenticated'      ? 'Unauthorized'
        : reason === 'insufficient_tokens' ? 'Insufficient tokens. Please top up to generate slides.'
        : 'Access denied',
        reason === 'unauthenticated' ? 401 : 403,
      )
    }

    const rateLimit = await checkDailyCallLimit(access.userId, 'slides_generate')
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} slide generations reached. Resets at ${rateLimit.resetAt}`, 429)
    }

    // 3. Resolve teacher_id
    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', access.userId)
      .maybeSingle()

    if (!teacher) {
      return apiError('Teacher profile not found', 403)
    }

    // 4. Generate slide content via AI
    const slideData = await generateSlideContent(subject, grade, topic, slideCount)

    // 5. Build the PPTX buffer
    const pptxBuffer = await buildPptx(slideData)

    // 6. Deduct tokens AFTER successful generation
    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, 'slides_generate', access.cost)
    }

    // 7. Log the generation
    await db.from('slide_generations').insert({
      teacher_id:   teacher.id,
      subject,
      grade,
      topic,
      slides_count: slideData.slides.length,
    })

    // 8. Return the PPTX as a binary download
    const filename = `EduNexus_${subject}_${grade}_${topic}`
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80)

    return new Response(new Uint8Array(pptxBuffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}.pptx"`,
        'Content-Length':      String(pptxBuffer.length),
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[slides/generate]', err)
    return apiError(getErrorMessage(err), 500)
  }
}
