import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { readImportCsv, resolveOutputCsvPath, runImport } from '@/lib/growth/services/csvImport'
import { growthRepos } from '@/lib/growth/repositories'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

const RunImportSchema = z.object({ file: z.string().min(1) })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { id: founderId } = await requireGrowthUser(supabase)

    const parsed = RunImportSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const path = await resolveOutputCsvPath(parsed.data.file)
    const { records } = await readImportCsv(path)

    const readyCount = records.filter((r) => (r.ready_for_import ?? '').trim().toUpperCase() === 'TRUE').length
    if (readyCount === 0) {
      return apiBadRequest('No rows are marked ready_for_import=TRUE — nothing to import.')
    }

    const founder = await growthRepos.users.findById(founderId)
    const summary = await runImport(records, founder!.id)
    return apiSuccess({ summary })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && (err.message.startsWith('Invalid') || err.message.includes('ENOENT'))) {
      return apiBadRequest(err.message.includes('ENOENT') ? 'File not found' : err.message)
    }
    console.error('[growth/import/run POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
