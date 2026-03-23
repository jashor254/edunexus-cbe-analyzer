/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.edunexus.co.ke',
      },
    ],
  },
}

export default nextConfig
