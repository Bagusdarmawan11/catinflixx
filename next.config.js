/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  eslint: {
    // ESLint tidak diinstall di project ini, skip saat build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Tetap check TypeScript, tapi tidak block build
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
