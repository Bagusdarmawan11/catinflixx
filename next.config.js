/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts + scripts kita sendiri
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Style: Tailwind inline + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Font
      "font-src 'self' https://fonts.gstatic.com",
      // Gambar: TMDB + data URI
      "img-src 'self' data: https://image.tmdb.org",
      // Media: YouTube iframe untuk trailer / Watch Party
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      // WebSocket ke server kita sendiri
      `connect-src 'self' https://api.themoviedb.org wss: ws:${
        isProd
          ? ` ${process.env.NEXT_PUBLIC_BASE_URL || ""}`
          : " http://localhost:3000"
      }`,
    ]
      .filter(Boolean)
      .join("; "),
  },
];

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
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        // Terapkan ke semua route
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
