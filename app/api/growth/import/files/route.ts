import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listOutputCsvFiles } from '@/lib/growth/services/csvImport'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const files = await listOutputCsvFiles()
    return apiSuccess({ files })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/import/files GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
