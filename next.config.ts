import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "frame-src 'self' https://drive.google.com https://www.youtube.com https://docs.google.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net",
              "font-src 'self' data: https://cdn.jsdelivr.net",
            ].join('; ')
          }
        ]
      }
    ]
  }
};

export default nextConfig;