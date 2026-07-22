import { z } from 'zod'

export const createActivitySchema = z.object({
  type: z.enum(['called', 'visited', 'whatsapp', 'email', 'meeting', 'demo', 'training', 'support']),
  contactId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
})
