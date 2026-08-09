// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',     // Hizi hazitaonekana kwenye Google
        '/demo',           // Reviewer presentation — noindex until approved
        '/pitch',          // Google Africa pitch deck — shared by link, never indexed
        '/api/',
        '/admin/',
        '/_next/',         // Next.js internal files
        '/*.json$',        // JSON files
      ],
    },
    sitemap: 'https://www.edunexus.co.ke/sitemap.xml',
  }
}