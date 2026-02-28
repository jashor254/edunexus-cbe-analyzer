// app/layout.tsx
// ✅ Fixed ToastProvider syntax error
// ✅ Clean layout structure

import type { Metadata } from 'next'
import { ToastProvider } from '@/components/toast-system'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduNexus - CBC Pathway Guidance',
  description: 'Kenya\'s #1 CBC pathway analysis and career guidance platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main>{children}</main>

      
        <ToastProvider />
      </body>
    </html>
  )
}