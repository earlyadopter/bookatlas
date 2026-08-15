import fs from "node:fs/promises";
import path from "node:path";
import { findBookConfig } from "@/lib/config";

// Serves images that live next to a book's markdown (cover.png, inline
// diagrams). Extension allowlist + traversal guard; books are trusted local
// content but the URL space is not.

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ book: string; file: string[] }> }
) {
  const { book: bookId, file } = await params;
  const config = findBookConfig(bookId);
  if (!config) return new Response("Not found", { status: 404 });

  const rel = file.map(decodeURIComponent).join("/");
  const abs = path.normalize(path.join(config.path, rel));
  if (!abs.startsWith(config.path + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  const type = CONTENT_TYPES[path.extname(abs).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  try {
    // Locally, books are edited live (figures regenerate under the same
    // names), so browsers must revalidate every load — ETag keeps that a
    // cheap 304. Deployed, content only changes with a deploy: long CDN +
    // browser caching so assets stop consuming per-request platform quota.
    const stat = await fs.stat(abs);
    const etag = `"${stat.mtimeMs}-${stat.size}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    const cacheControl = process.env.VERCEL
      ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800"
      : "no-cache";
    const buf = await fs.readFile(abs);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": type, "Cache-Control": cacheControl, ETag: etag }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
