import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BookConfig } from "./types";

// books.config.json lives at the repo root and points at EXTERNAL folders of
// markdown chapters. Re-read when its mtime changes.

const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "books.config.json");

let cached: { mtimeMs: number; books: BookConfig[] } | null = null;

export function loadBooksConfig(): BookConfig[] {
  const stat = fs.statSync(CONFIG_PATH);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.books;

  const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as { books?: BookConfig[] };
  const books = parsed.books ?? [];

  const seen = new Set<string>();
  for (const book of books) {
    if (!book.id || !/^[a-z0-9-]+$/.test(book.id)) {
      throw new Error(`books.config.json: invalid book id "${book.id}" (use [a-z0-9-])`);
    }
    if (seen.has(book.id)) throw new Error(`books.config.json: duplicate book id "${book.id}"`);
    seen.add(book.id);
    if (!path.isAbsolute(book.path)) {
      throw new Error(`books.config.json: path for "${book.id}" must be absolute`);
    }
    if (!fs.existsSync(book.path)) {
      throw new Error(`books.config.json: path for "${book.id}" does not exist: ${book.path}`);
    }
  }
  cached = { mtimeMs: stat.mtimeMs, books };
  return books;
}

export function findBookConfig(id: string): BookConfig | null {
  return loadBooksConfig().find((b) => b.id === id) ?? null;
}
