// lib/resend-client.ts

import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// Email sender configuration
export const EMAIL_FROM = 'EduNexus <noreply@edunexus.app>';

// For development, use onboarding domain
export const EMAIL_FROM_DEV = 'EduNexus <onboarding@resend.dev>';

export const getEmailFrom = () => {
  return process.env.NODE_ENV === 'production' ? EMAIL_FROM : EMAIL_FROM_DEV;
};