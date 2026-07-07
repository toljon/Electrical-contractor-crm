import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module — must stay external to the server bundle
  serverExternalPackages: ['better-sqlite3'],
  // Turbopack config for @react-pdf/renderer (canvas dependency)
  turbopack: {
    resolveAlias: {
      canvas: './empty-module.js',
    },
  },
  // Webpack fallback for @react-pdf/renderer (canvas dependency)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    return config
  },
};

export default nextConfig;
