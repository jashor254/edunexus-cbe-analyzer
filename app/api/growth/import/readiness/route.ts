import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { computeImportReadiness, readImportCsv, resolveOutputCsvPath } from '@/lib/growth/services/csvImport'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)

    const file = request.nextUrl.searchParams.get('file')
    if (!file) return apiBadRequest('Missing "file" query parameter')

    const path = await resolveOutputCsvPath(file)
    const { records } = await readImportCsv(path)
    const stats = computeImportReadiness(records)
    return apiSuccess({ stats })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && (err.message.startsWith('Invalid') || err.message.includes('ENOENT'))) {
      return apiBadRequest(err.message.includes('ENOENT') ? 'File not found' : err.message)
    }
    console.error('[growth/import/readiness GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
