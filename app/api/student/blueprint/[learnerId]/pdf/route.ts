import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireLearnerAccess } from '@/lib/core/permissions'
import { ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { BLUEPRINT_PDF_HEADINGS, renderBlueprintPdf } from '@/lib/learnerBlueprint/pdfExport'

type Params = {
  params: Promise<{ learnerId: string }>
}

type RouteDeps<TClient> = {
  createSupabaseClient: () => Promise<TClient>
  requireAuthentication: (client: TClient) => Promise<unknown>
  requireLearnerAccess: (client: TClient, schoolId: string, learnerId: string) => Promise<unknown>
  findSchoolId: (learnerId: string) => Promise<string>
  findLearnerById: (learnerId: string, schoolId: string) => Promise<{
    first_name: string | null
    middle_name: string | null
    last_name: string | null
  }>
  renderBlueprintPdf: typeof renderBlueprintPdf
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function safeFileTag(value: string): string {
  // Printable ASCII only (space through tilde) — strips non-ASCII AND
  // control characters (tabs, newlines, nulls) in one pass, which is both
  // stricter than the previous \x00-\x7F range (that kept control chars)
  // and avoids eslint's no-control-regex flag on a literal \x00 in a regex.
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')

  return normalized.length > 0 ? normalized.toUpperCase() : 'LEARNER_BLUEPRINT'
}

type RouteClient = Awaited<ReturnType<typeof createClient>>

const defaultDeps: RouteDeps<RouteClient> = {
  createSupabaseClient: createClient,
  requireAuthentication,
  requireLearnerAccess,
  findSchoolId: (learnerId) => repos.learners.findSchoolId(learnerId),
  findLearnerById: (learnerId, schoolId) => repos.learners.findById(learnerId, schoolId),
  renderBlueprintPdf,
}

export async function handleBlueprintPdfGetWithDeps<TClient>(
  req: NextRequest,
  { params }: Params,
  deps: RouteDeps<TClient>,
): Promise<Response> {
  const { learnerId } = await params
  const supabase = await deps.createSupabaseClient()

  try {
    await deps.requireAuthentication(supabase)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw err
  }

  let schoolId: string
  try {
    schoolId = await deps.findSchoolId(learnerId)
  } catch {
    return NextResponse.json({ error: 'Learner not found' }, { status: 404 })
  }

  try {
    await deps.requireLearnerAccess(supabase, schoolId, learnerId)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }

  const cookieHeader = req.headers.get('cookie')
  if (!cookieHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let learnerName = 'Learner_Blueprint'
  try {
    const learner = await deps.findLearnerById(learnerId, schoolId)
    learnerName = [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(' ') || learnerName
  } catch {
    // Best-effort filename only — the canonical page render below is the
    // only export source of truth.
  }

  try {
    const pdf = await deps.renderBlueprintPdf({
      origin: new URL(req.url).origin,
      learnerId,
      cookieHeader,
    })
    const body = toArrayBuffer(pdf)

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Learner_Blueprint_${safeFileTag(learnerName)}.pdf"`,
        'Content-Length': pdf.byteLength.toString(),
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        'X-Blueprint-Headings-Verified': BLUEPRINT_PDF_HEADINGS.length.toString(),
        'X-Blueprint-Export-Source': `/student/blueprint/${learnerId}`,
      },
    })
  } catch (err) {
    console.error('[student/blueprint/pdf]', err)
    return NextResponse.json(
      { error: 'Failed to generate learner blueprint PDF' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest, context: Params): Promise<Response> {
  return handleBlueprintPdfGetWithDeps(req, context, defaultDeps)
}
