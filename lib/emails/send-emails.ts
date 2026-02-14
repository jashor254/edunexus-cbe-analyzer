// lib/emails/send-emails.ts

import { resend, getEmailFrom } from '../resend-client';
import WelcomeEmail from '@/emails/templates/welcome';
import VerifyEmail from '@/emails/templates/verify-email';
import ResetPassword from '@/emails/templates/reset-password';

export async function sendWelcomeEmail(to: string, name: string) {
  try {
    const data = await resend.emails.send({
      from: getEmailFrom(),
      to,
      subject: `Karibu EduNexus, ${name}! 🇰🇪`,
      react: WelcomeEmail({
        name,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      }),
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  try {
    const data = await resend.emails.send({
      from: getEmailFrom(),
      to,
      subject: 'Verify your EduNexus account',
      react: VerifyEmail({ name, verifyUrl }),
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  try {
    const data = await resend.emails.send({
      from: getEmailFrom(),
      to,
      subject: 'Reset your EduNexus password',
      react: ResetPassword({ name, resetUrl }),
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}