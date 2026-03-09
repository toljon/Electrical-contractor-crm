import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  // Use Turbopack (Next.js 16 default); canvas alias not needed server-side
  turbopack: {},
};

export default nextConfig;
