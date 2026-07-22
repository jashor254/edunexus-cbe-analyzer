import { z } from 'zod'

export const createFollowUpSchema = z.object({
  task: z.string().trim().min(1).max(500),
  dueDate: z.string().date(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
})

export const rescheduleFollowUpSchema = z.object({
  dueDate: z.string().date(),
})
