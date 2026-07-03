import { repos } from '@/lib/repositories'
import type { RecordOfWork } from './pdfRenderer'

export async function buildRecordOfWork(
  sowId: string,
  weekNumber: number
): Promise<RecordOfWork> {
  return repos.curriculum.buildRecordOfWork(sowId, weekNumber)
}
