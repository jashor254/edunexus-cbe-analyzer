// emails/templates/verify-email.tsx

import { Heading, Text, Section } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '@/emails/components/Layout';
import { Button } from '@/emails/components/Button';

interface VerifyEmailProps {
  name: string;
  verifyUrl: string;
}

export default function VerifyEmail({ name, verifyUrl }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Verify your EduNexus account">
      <Heading style={styles.heading}>
        Verify Your Email Address
      </Heading>

      <Text style={styles.text}>
        Hi {name},
      </Text>

      <Text style={styles.text}>
        Thanks for signing up for EduNexus! To get started tracking your child's CBC journey, 
        please verify your email address by clicking the button below:
      </Text>

      <Button href={verifyUrl}>
        Verify Email Address
      </Button>

      <Section style={styles.warning}>
        <Text style={styles.warningText}>
          ⚠️ <strong>Important:</strong> This link expires in 24 hours for security reasons.
        </Text>
      </Section>

      <Text style={styles.troubleshoot}>
        <strong>Button not working?</strong> Copy and paste this link into your browser:
      </Text>
      <Text style={styles.link}>
        {verifyUrl}
      </Text>

      <Text style={styles.help}>
        If you didn't create an EduNexus account, you can safely ignore this email.
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
  help: {
    fontSize: '14px',
    color: '#8898aa',
    fontStyle: 'italic' as const,
    margin: '24px 0 0',
  },
};