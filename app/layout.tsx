// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/toast-system'
import { Analytics } from '@vercel/analytics/react'
import WhatsAppButton from '@/components/WhatsAppButton'
import Script from 'next/script'
import './globals.css'

// ✅ SEO na Marketing ya Kenya
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://edunexus.co.ke'),
  title: {
    default: 'EduNexus | Mwongozo wa CBC na Mustakabali wa Taaluma',
    template: '%s | EduNexus Kenya'
  },
  description: 'Gundua uwezo wa mtoto wako kwa CBC. Tunakusaidia kuchagua njia sahihi ya masomo, kuona mustakabali wa taaluma, na kufanya maamuzi ya kitaalamu kwa ujasiri.',
  keywords: [
    'CBC Kenya',
    'mwongozo wa CBC',
    'uchambuzi wa masomo',
    'pathway analysis',
    'STEM Kenya',
    'elimu ya CBC',
    'mbinu za kusoma',
    'maamuzi ya taaluma',
    'EduNexus',
    'CBC Academic Clinic'
  ],
  authors: [{ name: 'EduNexus Team', url: 'https://edunexus.co.ke' }],
  creator: 'EduNexus Kenya',
  publisher: 'EduNexus',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  
  // ✅ Open Graph - Inaonekana kwenye WhatsApp, Facebook
  openGraph: {
    title: 'EduNexus | Mwongozo wa CBC na Mustakabali wa Taaluma',
    description: 'Tunaonyesha wazazi na wanafunzi njia sahihi ya CBC - kutoka chaguo la masomo hadi mustakabali wa kazi.',
    url: 'https://edunexus.co.ke',
    siteName: 'EduNexus Kenya',
    images: [
      {
        url: 'https://edunexus.co.ke/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'EduNexus - Mwongozo wa CBC Kenya',
      },
    ],
    locale: 'en_KE',
    type: 'website',
  },

  // ✅ Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'EduNexus | Mwongozo wa CBC',
    description: 'Gundua uwezo wa mtoto wako na uchague njia sahihi ya masomo.',
    images: ['https://edunexus.co.ke/og-image.jpg'],
    creator: '@edunexus',
  },

  // ✅ Icons
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png' },
    ],
  },
  manifest: '/site.webmanifest',

  // ✅ Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
  },

  // ✅ Canonical URL
  alternates: {
    canonical: 'https://edunexus.co.ke',
    languages: {
      'en-KE': 'https://edunexus.co.ke',
    },
  },

  category: 'education',
}

export const viewport: Viewport = {
  themeColor: '#0a0a23',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* ✅ Structured Data - Inaonyesha kwenye Google Search */}
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              "name": "EduNexus Kenya",
              "url": "https://edunexus.co.ke",
              "logo": "https://edunexus.co.ke/logo.png",
              "description": "Mwongozo wa CBC na mustakabali wa taaluma kwa wanafunzi wa Kenya",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "KE",
                "addressLocality": "Nairobi"
              },
              "sameAs": [
                "https://facebook.com/edunexuskenya",
                "https://tiktok.com/@edunexuscbe",
                "https://wa.me/254710798030"
              ],
              "offers": {
                "@type": "Offer",
                "description": "Academic Clinic Report - Uchambuzi kamili wa masomo ya mtoto wako",
                "price": "500",
                "priceCurrency": "KES"
              }
            })
          }}
        />
      </head>
      <body className="antialiased font-sans min-h-screen bg-white text-slate-900">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:p-4 focus:bg-white focus:z-50">
          Ruka hadi kwenye maudhui
        </a>

        <main id="main-content">
          {children}
        </main>

        <footer className="bg-slate-950 border-t border-white/5 py-4 text-center">
          <p className="text-xs text-white/30">
            © 2026 EduNexus &middot; Developed by{' '}
            <span className="text-white/50 font-medium">Jashor Technologies</span>
            {' '}&middot; Kenya
          </p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/legal/privacy" className="text-xs text-white/30 hover:text-white/60 transition-colors">Privacy Policy</a>
            <a href="/legal/terms" className="text-xs text-white/30 hover:text-white/60 transition-colors">Terms of Use</a>
            <a href="/legal/refund" className="text-xs text-white/30 hover:text-white/60 transition-colors">Refund Policy</a>
          </div>
        </footer>

        <WhatsAppButton />
        <ToastProvider />
        <Analytics />
      </body>
    </html>
  )
}