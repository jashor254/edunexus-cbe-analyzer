/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
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
      { source: '/blueprint',  destination: '/student/blueprint',  permanent: true },
      { source: '/career',     destination: '/student/career',     permanent: true },
      { source: '/career/:slug', destination: '/student/career/:slug', permanent: true },
      { source: '/holiday',    destination: '/student/holiday',    permanent: true },
      { source: '/progress',   destination: '/student/progress',   permanent: true },
      { source: '/resources',  destination: '/student/resources',  permanent: true },
      { source: '/calendar',   destination: '/student/calendar',   permanent: true },
    ]
  },
}

export default nextConfig
