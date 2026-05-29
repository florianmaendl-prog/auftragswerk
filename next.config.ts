import type { NextConfig } from "next";

// Basis-Security-Headers für alle Routen. Bewusst minimal: HSTS, Clickjacking-
// Schutz, MIME-Sniff-Schutz, Referrer-Policy, Permissions-Policy. Kein
// striktes CSP – das bricht in der Praxis mehr als es schützt, kommt erst
// wenn das App-Verhalten klar genug ist.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
