// emails/templates/welcome.tsx

import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '@/emails/components/Layout';
import { Button } from '@/emails/components/Button';

interface WelcomeEmailProps {
  name: string;
  dashboardUrl: string;
}

export default function WelcomeEmail({ name, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Karibu EduNexus, ${name}! 🇰🇪`}>
      <Heading style={styles.heading}>
        Karibu to EduNexus, {name}! 🎓
      </Heading>

      <Text style={styles.text}>
        You've just joined Kenya's smartest platform for CBC parents. We're excited to help you 
        guide your child to academic success!
      </Text>

      <Text style={styles.text}>
        <strong>Here's what you can do now:</strong>
      </Text>

      <Text style={styles.list}>
        ✅ Add your child's profile<br/>
        ✅ Record their latest assessments<br/>
        ✅ Get AI-powered career guidance<br/>
        ✅ Generate Academic Clinic reports
      </Text>

      <Button href={dashboardUrl}>
        Go to Your Dashboard
      </Button>

      <Text style={styles.tip}>
        💡 <strong>Pro Tip:</strong> Start by adding your child's profile, then input their most 
        recent assessment. Our AI will analyze their competency levels and recommend the best career pathway!
      </Text>

      <Text style={styles.text}>
        Need help? Just reply to this email - we're here to support your child's journey.
      </Text>

      <Text style={styles.signature}>
        Ahsante,<br/>
        <strong>The EduNexus Team</strong> 🇰🇪
      </Text>
    </EmailLayout>
  );
}

const styles = {
  heading: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1a1a1a',
    margin: '0 0 16px',
  },
  text: {
    fontSize: '16px',
    color: '#525f7f',
    lineHeight: '24px',
    margin: '16px 0',
  },
  list: {
    fontSize: '16px',
    color: '#525f7f',
    lineHeight: '28px',
    margin: '16px 0',
    paddingLeft: '20px',
  },
  tip: {
    fontSize: '14px',
    color: '#856404',
    backgroundColor: '#fff3cd',
    padding: '16px',
    borderRadius: '8px',
    lineHeight: '22px',
    margin: '24px 0',
  },
  signature: {
    fontSize: '16px',
    color: '#525f7f',
    margin: '32px 0 0',
  },
};