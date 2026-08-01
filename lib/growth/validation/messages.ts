import { z } from 'zod'
import { MESSAGE_TEMPLATES } from '@/lib/growth/messaging/templates'

const TEMPLATE_IDS = MESSAGE_TEMPLATES.map((t) => t.id) as [string, ...string[]]

export const getWorkspaceQuerySchema = z.object({
  templateId: z.enum(TEMPLATE_IDS).nullable().optional(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'call', 'visit']).nullable().optional(),
  meetingDate: z.string().max(50).nullable().optional(),
  meetingTime: z.string().max(50).nullable().optional(),
})

export const logMessageSentSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'call', 'visit']),
  templateId: z.enum(TEMPLATE_IDS),
  edited: z.boolean(),
  outcomeNote: z.string().max(2000).nullable().optional(),
})

export const sendMessageSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  templateId: z.enum(TEMPLATE_IDS),
  body: z.string().min(1).max(4096),
  edited: z.boolean(),
})
