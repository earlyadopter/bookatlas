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
  _req: Request,
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
    const buf = await fs.readFile(abs);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
