import type { NextConfig } from 'next';

const config: NextConfig = {
  // One self-contained folder (server.js + only the modules it needs) that the website container runs.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Pictures come from the API's signed S3 links, which change on every request — there is nothing
  // for an image optimiser to cache, so the browser loads them directly.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Google's and Apple's sign-in popups talk back to the page that opened them.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
};

export default config;
