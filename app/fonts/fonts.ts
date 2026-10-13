// app/fonts/fonts.ts
// Self-hosted font definitions (next/font/local) for every layout.
//
// Why local, not next/font/google: next/font/google downloads the font files
// from Google during `next build`, and that download intermittently fails —
// Turbopack then reports "Can't resolve '@vercel/turbopack-next/internal/font/
// google/font'" and the build goes red with no code change (seen on next
// 16.3.3 and 16.3.8; docs/security/findings.md SEC-2026-10-12-13). Bundling
// the files makes builds deterministic and drops a third-party fetch.
//
// Files: Latin-subset VARIABLE fonts from Fontsource 5.3.0
// (@fontsource-variable/inter, @fontsource-variable/montserrat) — the same
// Google Fonts faces, one file covering every weight. SIL Open Font License
// 1.1; licence text kept next to each file (OFL.txt).
//
// next/font options must be literals, so each loader spells out its src.
// Same weights as before: Montserrat 600–800 for headings, Inter 400–600 body
// (the variable file serves any weight in range).

import localFont from 'next/font/local'

// Root layout (app/layout.tsx) — referenced by globals.css as
// var(--font-montserrat) / var(--font-inter).
export const montserrat = localFont({
  src: './montserrat/montserrat-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-montserrat',
  display: 'swap',
})

export const inter = localFont({
  src: './inter/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
})

// /demo and /pitch — their .demo-shell styles reference
// var(--font-demo-heading) / var(--font-demo-body).
export const demoHeading = localFont({
  src: './montserrat/montserrat-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-demo-heading',
  display: 'swap',
})

export const demoBody = localFont({
  src: './inter/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-demo-body',
  display: 'swap',
})
