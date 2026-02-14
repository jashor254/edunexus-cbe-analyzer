// emails/components/Button.tsx

import { Button as ReactEmailButton } from '@react-email/components';
import * as React from 'react';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
}

export function Button({ href, children }: ButtonProps) {
  return (
    <ReactEmailButton
      href={href}
      style={{
        backgroundColor: '#667eea',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '16px',
        fontWeight: 'bold',
        textDecoration: 'none',
        textAlign: 'center' as const,
        display: 'block',
        padding: '16px 32px',
        margin: '24px 0',
      }}
    >
      {children}
    </ReactEmailButton>
  );
}