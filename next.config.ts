/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', '@sparticuz/chromium', 'playwright-core'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.edunexus.co.ke',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/dashboard/career-explorer',
        destination: '/student/career',
        permanent: true,
      },
      // Sprint 3 (Platform Audit v1.0, Blocker #5) — the (student) route
      // group was consolidated into the canonical app/student/* tree.
      // These keep any existing external link (WhatsApp nudges, bookmarks)
      // working rather than 404ing.
      //
      // /resources and /calendar are deliberately NOT redirected here as of
      // Sprint 5 (Parent Experience Convergence): those two flat paths now
      // belong to real, family-wide parent pages (app/(parent)/resources,
      // app/(parent)/calendar) — redirecting them to /student/* would shadow
      // the new parent pages entirely (confirmed: a redirects() entry is
      // checked before Next.js resolves an actual page route).
      { source: '/blueprint',  destination: '/student/blueprint',  permanent: true },
      { source: '/career',     destination: '/student/career',     permanent: true },
      { source: '/career/:slug', destination: '/student/career/:slug', permanent: true },
      { source: '/holiday',    destination: '/student/holiday',    permanent: true },
      { source: '/progress',   destination: '/student/progress',   permanent: true },
    ]
  },
}

export default nextConfig
