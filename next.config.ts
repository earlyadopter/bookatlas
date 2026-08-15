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
      afterFiles: [{ source: "/:path*", destination: `/b/${singleBook}/:path*` }],
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
