/** @type {import('next').NextConfig} */
const nextConfig = {
  // Custom server handles serving — disable default server
  // NOTE: We use a custom server (server/index.ts), so output must NOT be 'export'
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // Ignore socket.io path from Next.js routing
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
