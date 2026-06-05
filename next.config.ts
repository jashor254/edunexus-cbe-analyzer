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
        destination: '/career',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
