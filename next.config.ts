import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

// Single-book deployments (SINGLE_BOOK=<book-id>) serve that book at the
// site root: clean URLs rewrite into /b/<id>/*, old prefixed URLs redirect.
const singleBook = process.env.SINGLE_BOOK;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    if (!singleBook) return [];
    // :path+ (not *) so the bare book URL doesn't redirect — the root
    // rewrite internally targets it, and a bare redirect would loop.
    return [{ source: `/b/${singleBook}/:path+`, destination: "/:path+", permanent: true }];
  },
  async rewrites() {
    if (!singleBook) return { beforeFiles: [], afterFiles: [], fallback: [] };
    return {
      beforeFiles: [],
      // Only rewrites when no file/page matched (/_next, robots.txt, /b/*
      // stay intact); the root is handled by app/page.tsx rendering the book.
      //
      // Sources are constrained to real URL shapes — slug-charset segments at
      // chapter/sub depth, plus the asset fallback — instead of a `/:path*`
      // catch-all. Anything else (scanner probes like /wp-login.php, /.env,
      // deep or dotted paths) falls through to the prebuilt static 404. With
      // the old catch-all each such URL reached the ISR-enabled book routes
      // and bought a billed cache write for a 404 nobody requests twice.
      afterFiles: [
        { source: "/asset/:file*", destination: `/b/${singleBook}/asset/:file*` },
        { source: "/:chapter([A-Za-z0-9_-]+)", destination: `/b/${singleBook}/:chapter` },
        {
          source: "/:chapter([A-Za-z0-9_-]+)/:sub([A-Za-z0-9_-]+)",
          destination: `/b/${singleBook}/:chapter/:sub`
        }
      ],
      fallback: []
    };
  },
  // The core package ships TypeScript source (no build step); Next compiles it.
  transpilePackages: ["@bookatlas/core"],
  // Book content and config are read with fs at request time; serverless
  // bundlers can't trace dynamic paths, so include them explicitly (Vercel).
  outputFileTracingIncludes: {
    "/**": ["./demo/**", "./books.config.json"]
  },
  turbopack: {
    // Prevent Next from inferring a parent "workspace root" (e.g. a Dropbox lockfile).
    root: configDir
  }
};

export default nextConfig;
