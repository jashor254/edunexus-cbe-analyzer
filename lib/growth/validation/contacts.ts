import { z } from 'zod'

export const createContactSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  role: z.enum(['principal', 'deputy', 'dos', 'ict_teacher', 'other']).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  preferredContact: z.enum(['call', 'whatsapp', 'email']).nullable().optional(),
  relationshipScore: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})
