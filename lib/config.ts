import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BookConfig } from "./types";

// books.config.json lives at the repo root and points at EXTERNAL content.
// Two entry kinds:
//   "books":       one entry per book (folder of chapter files, or a folder
//                  with a single book.md when mode is "single-file")
//   "collections": a directory whose subdirectories each contain a book.md —
//                  every subdirectory becomes a book with id = subdir name.
// Re-read when the config file's mtime changes.

const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "books.config.json");

type CollectionConfig = {
  dir: string;
  mode?: "files" | "single-file";
  idPrefix?: string;
  accent?: string;
};

let cached: { mtimeMs: number; books: BookConfig[] } | null = null;

export function loadBooksConfig(): BookConfig[] {
  const stat = fs.statSync(CONFIG_PATH);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.books;

  const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as {
    books?: BookConfig[];
    collections?: CollectionConfig[];
  };
  const books: BookConfig[] = [...(parsed.books ?? [])];

  for (const col of parsed.collections ?? []) {
    if (!path.isAbsolute(col.dir) || !fs.existsSync(col.dir)) {
      throw new Error(`books.config.json: collection dir does not exist: ${col.dir}`);
    }
    const subdirs = fs
      .readdirSync(col.dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
    for (const name of subdirs) {
      const bookDir = path.join(col.dir, name);
      if (col.mode === "single-file" && !fs.existsSync(path.join(bookDir, "book.md"))) continue;
      books.push({
        id: `${col.idPrefix ?? ""}${name}`.toLowerCase(),
        title: "", // derived from the book's own title heading at load time
        path: bookDir,
        mode: col.mode ?? "files",
        accent: col.accent
      });
    }
  }

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
