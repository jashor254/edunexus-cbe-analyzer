import { Heading, Text, Section, Link } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '@/emails/components/Layout';
import { Button } from '@/emails/components/Button';

interface ResetPasswordProps {
  name?: string;
  resetUrl: string;
}

export default function ResetPassword({
  name,
  resetUrl,
}: ResetPasswordProps) {
  return (
    <EmailLayout preview="Reset your EduNexus password — link expires in 1 hour">
      <Heading style={styles.heading}>
        Reset Your Password
      </Heading>

      <Text style={styles.text}>
        Hi {name || 'there'},
      </Text>

      <Text style={styles.text}>
        We received a request to reset your EduNexus password. Click the button
        below to create a new password:
      </Text>

      <Button href={resetUrl}>
        Reset Password
      </Button>

      <Section style={styles.warning}>
        <Text style={styles.warningText}>
          ⚠️ <strong>Security Notice:</strong> This link expires in 1 hour and
          can only be used once.
        </Text>
      </Section>

      <Text style={styles.troubleshoot}>
        <strong>Button not working?</strong> Copy and paste this link:
      </Text>

      <Link href={resetUrl} style={styles.link}>
        {resetUrl}
      </Link>

      <Section style={styles.alert}>
        <Text style={styles.alertText}>
          🔒 <strong>Didn't request this?</strong>
          <br />
          If you didn't request a password reset, please ignore this email.
          Your password will remain unchanged and your account is secure.
        </Text>
      </Section>

      <Text style={styles.meta}>
        Request generated on {new Date().toLocaleString()}
      </Text>
    </EmailLayout>
  );
}

const styles = {
  heading: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1a1a1a',
    margin: '0 0 24px',
  },
  text: {
    fontSize: '16px',
    color: '#525f7f',
    lineHeight: '24px',
    margin: '16px 0',
  },
  warning: {
    backgroundColor: '#fff3cd',
    padding: '16px',
    borderRadius: '8px',
    margin: '24px 0',
  },
  warningText: {
    fontSize: '14px',
    color: '#856404',
    margin: 0,
  },
  troubleshoot: {
    fontSize: '14px',
    color: '#525f7f',
    margin: '24px 0 8px',
  },
  link: {
    fontSize: '12px',
    color: '#667eea',
    wordBreak: 'break-all' as const,
    margin: '0 0 24px',
  },
  alert: {
    backgroundColor: '#f8d7da',
    padding: '16px',
    borderRadius: '8px',
    margin: '24px 0',
    borderLeft: '4px solid #dc3545',
  },
  alertText: {
    fontSize: '14px',
    color: '#721c24',
    margin: 0,
    lineHeight: '22px',
  },
  meta: {
    fontSize: '12px',
    color: '#8898aa',
    marginTop: '16px',
  },
};