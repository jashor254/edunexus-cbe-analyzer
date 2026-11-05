// lib/resend-client.ts

import { Resend } from 'resend';

// Created on first use, NOT at import. Importing this module happens during
// `next build` (page-data collection) in environments that deliberately hold no
// email credential (isolated Preview). Sending still fails closed: with no
// RESEND_API_KEY, getResend() throws before any request is made, and there is no
// fallback key.
let client: Resend | undefined;

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set');
  }
  client ??= new Resend(key);
  return client;
}

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