import sentryNextConfig from "@sentry/nextjs/config";

const { withSentryConfig } = sentryNextConfig;

/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "*.supabase.co";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://${supabaseHostname} https://img.youtube.com`,
  `connect-src 'self' https://${supabaseHostname} https://*.supabase.co https://*.storage.supabase.co wss://${supabaseHostname} wss://*.supabase.co https://vercel.live wss://ws-us3.pusher.com wss://*.pusher.com`,
  "font-src 'self'",
  // ffmpeg.wasm spawns a module worker from our own origin (self); the blob:
  // fallback covers browsers/paths that inline the worker.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/**",
      },
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
    ],
  },
};
export default withSentryConfig(nextConfig, {
  // Error tracking is a no-op until a DSN is configured; silence all build noise.
  silent: true,
  // Proxy browser events through our own origin so the CSP connect-src stays tight.
  tunnelRoute: "/monitoring",
  disableLogger: true,
  // No source-map upload unless an auth token is provided for the build.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
