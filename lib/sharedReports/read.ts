import { SharedReportRepository, type SharedReportRpcRow } from '@/lib/repositories/sharedReport.repository'
import { isWellFormedShareToken } from './token'

export type SharedReportData = {
  strengths: string[]
  priorityAreas: string[]
  actionPlan: string[]
  subjectScores: Record<string, number>
  overallLevel: number
  overallLabel: string
}

// Where the report content came from. Anything unrecognised is treated as the
// least authoritative origin: the page must never claim more than is known.
export type SharedReportProvenance = 'client_supplied' | 'server_generated'

function toProvenance(value: string | null): SharedReportProvenance {
  return value === 'server_generated' ? 'server_generated' : 'client_supplied'
}

export type SharedReportLookup =
  | { status: 'not_found' }
  | { status: 'expired' }
  | {
      status: 'ok'
      studentName: string
      grade: string
      createdAt: string
      expiresAt: string
      provenance: SharedReportProvenance
      reportData: SharedReportData
    }

type FindByToken = (token: string) => Promise<SharedReportRpcRow | null>

function toLookup(row: SharedReportRpcRow | null): SharedReportLookup {
  if (!row) return { status: 'not_found' }
  if (row.status === 'expired') return { status: 'expired' }
  if (
    row.status !== 'ok' ||
    row.student_name === null || row.grade === null ||
    row.created_at === null || row.expires_at === null
  ) {
    return { status: 'not_found' }
  }
  return {
    status: 'ok',
    studentName: row.student_name,
    grade: row.grade,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    provenance: toProvenance(row.provenance),
    reportData: normaliseReportData(row.report_data),
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

// The database already projects report_data to these six keys; this re-asserts
// the shape so a malformed stored value can never reach the page as non-data.
function normaliseReportData(raw: unknown): SharedReportData {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const scores = src.subjectScores && typeof src.subjectScores === 'object'
    ? Object.entries(src.subjectScores as Record<string, unknown>)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    : []
  return {
    strengths: stringList(src.strengths),
    priorityAreas: stringList(src.priorityAreas),
    actionPlan: stringList(src.actionPlan),
    subjectScores: Object.fromEntries(scores),
    overallLevel: typeof src.overallLevel === 'number' ? src.overallLevel : 0,
    overallLabel: typeof src.overallLabel === 'string' ? src.overallLabel : '',
  }
}

export async function getSharedReportByToken(
  token: string,
  findByToken: FindByToken = (t) => new SharedReportRepository().findByToken(t),
): Promise<SharedReportLookup> {
  if (!isWellFormedShareToken(token)) return { status: 'not_found' }
  return toLookup(await findByToken(token))
}

export async function revokeSharedReport(
  token: string,
  ownerId: string,
  revoke: (token: string, ownerId: string) => Promise<boolean> =
    (t, o) => new SharedReportRepository().revokeOwned(t, o),
): Promise<boolean> {
  if (!isWellFormedShareToken(token)) return false
  return revoke(token, ownerId)
}
