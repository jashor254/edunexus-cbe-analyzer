// lib/resend-client.ts

import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// Email sender configuration
export const EMAIL_FROM = 'EduNexus <hello@edunexus.co.ke>';

// For development, use onboarding domain
export const EMAIL_FROM_DEV = 'EduNexus <onboarding@resend.dev>';

export const getEmailFrom = () => {
  return process.env.NODE_ENV === 'production' ? EMAIL_FROM : EMAIL_FROM_DEV;
};

// hello@edunexus.co.ke has no inbox behind it (Resend only sends — the
// domain's MX records don't point at a real mailbox), so replies to any
// outbound email would otherwise vanish. Route them to a monitored inbox
// until a real hello@ mailbox exists (e.g. Google Workspace/Zoho on the
// domain).
export const EMAIL_REPLY_TO = 'kariukidennis092@gmail.com';