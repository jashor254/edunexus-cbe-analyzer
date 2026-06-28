import { createServiceClient } from '@/utils/supabase/service'
import type { LearnerTransfer, TransferLearnerInput } from '@/types/core'

const TRANSFER_COLS = 'id, learner_id, from_school_id, to_school_id, to_school_name, direction, transfer_date, reason, document_urls, processed_by, created_at, updated_at'

export async function transferLearner(
  processedBy: string,
  input: TransferLearnerInput
): Promise<LearnerTransfer> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('learner_transfers')
    .insert({
      learner_id: input.learner_id,
      from_school_id: input.direction === 'out' ? await getSchoolForLearner(input.learner_id) : (input.to_school_id ?? ''),
      to_school_id: input.to_school_id ?? null,
      to_school_name: input.to_school_name ?? null,
      direction: input.direction,
      transfer_date: input.transfer_date,
      reason: input.reason ?? null,
      document_urls: input.document_urls ?? [],
      processed_by: processedBy,
    })
    .select(TRANSFER_COLS)
    .single()
  if (error) throw new Error(`transferLearner: ${error.message}`)

  // Mark learner as transferred + withdraw active enrollment
  if (input.direction === 'out') {
    await supabase
      .from('learners')
      .update({ status: 'transferred' })
      .eq('id', input.learner_id)

    await supabase
      .from('learner_enrollments')
      .update({ status: 'transferred' })
      .eq('learner_id', input.learner_id)
      .eq('status', 'active')
  }

  return data
}

export async function getLearnerTransfers(learnerId: string): Promise<LearnerTransfer[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learner_transfers')
    .select(TRANSFER_COLS)
    .eq('learner_id', learnerId)
    .order('transfer_date', { ascending: false })
  if (error) throw new Error(`getLearnerTransfers: ${error.message}`)
  return data
}

async function getSchoolForLearner(learnerId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('learners')
    .select('school_id')
    .eq('id', learnerId)
    .single()
  if (!data) throw new Error(`Learner ${learnerId} not found`)
  return data.school_id
}
