import { repos } from '@/lib/repositories'
import type { LearnerTransfer, TransferLearnerInput } from '@/types/core'

export async function transferLearner(
  processedBy: string,
  input: TransferLearnerInput
): Promise<LearnerTransfer> {
  const fromSchoolId = input.direction === 'out'
    ? await repos.learners.findSchoolId(input.learner_id)
    : (input.to_school_id ?? '')

  const transfer = await repos.learners.insertTransfer({
    learner_id: input.learner_id,
    from_school_id: fromSchoolId,
    to_school_id: input.to_school_id ?? null,
    to_school_name: input.to_school_name ?? null,
    direction: input.direction,
    transfer_date: input.transfer_date,
    reason: input.reason ?? null,
    document_urls: input.document_urls ?? [],
    processed_by: processedBy,
  })

  // Mark learner as transferred + withdraw active enrollment
  if (input.direction === 'out') {
    await repos.learners.updateStatusById(input.learner_id, { status: 'transferred' })
    await repos.learners.withdrawActiveEnrollments(input.learner_id, 'transferred')
  }

  return transfer
}

export async function getLearnerTransfers(learnerId: string): Promise<LearnerTransfer[]> {
  return repos.learners.listTransfers(learnerId)
}
