import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * WHY script-src carries 'unsafe-inline', deliberately:
 *
 * Next's App Router serializes each page's React Flight payload into inline
 * <script> tags — three of them on the home page alone, and their contents
 * change with every build because they embed chunk filenames and the serialized
 * tree. Hashing them is not maintainable across ~10 prerendered pages, and a
 * nonce requires middleware, which would force every page out of static
 * prerendering and break the invariant this project protects: exactly one
 * dynamic route in the build, everything else prerendered. Worse, under CSP2+
 * adding ANY hash or nonce silently voids 'unsafe-inline', so the two cannot
 * coexist as a fallback.
 *
 * That trade is acceptable only because the XSS surface is currently empty: the
 * single dangerouslySetInnerHTML in the app builds JSON-LD from constants with
 * "<" escaped, and no user input is rendered anywhere. What this policy is
 * really buying is frame-ancestors, object-src, base-uri, form-action and
 * connect-src, none of which are weakened by 'unsafe-inline'.
 *
 * WHEN THE SIGN-IN UI SHIPS: add a middleware.ts whose matcher covers ONLY the
 * auth routes, generate a per-request nonce there, and serve those responses
 * with `script-src 'nonce-<n>' 'strict-dynamic'`. Auth routes must be
 * uncacheable anyway, so they lose nothing by going dynamic, and the static
 * exam pages keep their prerender. frame-ancestors must already be in place
 * before that form exists, which is why this ships now rather than in a later
 * "headers phase".
 *
 * No external origin appears anywhere in the built HTML: next/font self-hosts
 * Geist at build time and katex.min.css is bundled, with KaTeX's woff2 files
 * emitted under /_next/static/media. So 'self' genuinely covers fonts, and
 * there is no CDN to allowlist.
 */
const csp = [
  "default-src 'self'",
  // Development needs 'unsafe-eval' for React Fast Refresh, which Turbopack
  // implements with eval. Never shipped to production.
  isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind and Next both emit inline style attributes, and KaTeX computes
  // fraction geometry as inline styles it writes itself — see the note in
  // globals.css about why those must not be overridden from a stylesheet.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Same-origin /api/auth/* only. In development the extra ws: is the HMR
  // socket; 'self' does not reliably match a websocket scheme in every engine.
  isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
  "form-action 'self'",
  // Clickjacking. 'none' rather than 'self': nothing in this app frames itself.
  "frame-ancestors 'none'",
  // Stops an injected <base> from re-pointing every relative script URL at an
  // attacker's host.
  "base-uri 'none'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Redundant with frame-ancestors for modern browsers, but still honored by
  // engines that ignore the CSP directive.
  { key: "X-Frame-Options", value: "DENY" },
  // Without this the JSON question banks served as static chunks can be
  // MIME-sniffed into something executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

if (isProd) {
  // Deliberately NO `preload` directive. vercel.app is on the Public Suffix
  // List and cannot be preloaded, and preloading is effectively irreversible —
  // add it only once a custom domain is owned and the commitment is intended.
  //
  // Production-only because a browser ignores HSTS over plain http anyway, and
  // scoping it keeps localhost out of the question entirely.
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  // Drops the "X-Powered-By: Next.js" version banner, which tells a scanner
  // exactly which framework advisories to try.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
