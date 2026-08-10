import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BookConfig } from "@bookatlas/core";

// Book registry. Two files, merged at load:
//   books.config.json        — committed; the demo book lives here
//   books.config.local.json  — gitignored; a deployment's private books.
//                              Entries with the same id override the public
//                              ones; a local "collections" array replaces the
//                              public one entirely.
// Entry kinds:
//   "books":       one entry per book (folder of chapter files, or a folder
//                  with a single book.md when mode is "single-file")
//   "collections": a directory whose subdirectories each contain a book.md —
//                  every subdirectory becomes a book with id = subdir name.
// Paths may be relative (resolved against the repo root) or absolute.
// Both files are re-read when their mtime changes.

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "books.config.json");
const LOCAL_CONFIG_PATH = path.join(ROOT, "books.config.local.json");

type CollectionConfig = {
  dir: string;
  mode?: "files" | "single-file";
  idPrefix?: string;
  accent?: string;
};

type ConfigFile = { books?: BookConfig[]; collections?: CollectionConfig[] };

let cached: { key: string; books: BookConfig[] } | null = null;

function mtimeOf(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return -1;
  }
}

export function loadBooksConfig(): BookConfig[] {
  const key = `${mtimeOf(CONFIG_PATH)}:${mtimeOf(LOCAL_CONFIG_PATH)}`;
  if (cached && cached.key === key) return cached.books;

  const publicCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as ConfigFile;
  const localCfg: ConfigFile = fs.existsSync(LOCAL_CONFIG_PATH)
    ? (JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, "utf8")) as ConfigFile)
    : {};

  const byId = new Map<string, BookConfig>();
  for (const book of publicCfg.books ?? []) byId.set(book.id, book);
  for (const book of localCfg.books ?? []) byId.set(book.id, book);
  const books = [...byId.values()];

  const collections = localCfg.collections ?? publicCfg.collections ?? [];
  for (const col of collections) {
    const dir = path.resolve(ROOT, col.dir);
    if (!fs.existsSync(dir)) {
      throw new Error(`books config: collection dir does not exist: ${col.dir}`);
    }
    const subdirs = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
    for (const name of subdirs) {
      const bookDir = path.join(dir, name);
      if (col.mode === "single-file" && !fs.existsSync(path.join(bookDir, "book.md"))) continue;
      const id = `${col.idPrefix ?? ""}${name}`.toLowerCase();
      if (byId.has(id)) continue; // explicit book entries win over collection expansion
      const entry: BookConfig = {
        id,
        title: "", // derived from the book's own title heading at load time
        path: bookDir,
        mode: col.mode ?? "files",
        accent: col.accent
      };
      byId.set(id, entry);
      books.push(entry);
    }
  }

  const seen = new Set<string>();
  for (const book of books) {
    if (!book.id || !/^[a-z0-9-]+$/.test(book.id)) {
      throw new Error(`books config: invalid book id "${book.id}" (use [a-z0-9-])`);
    }
    if (seen.has(book.id)) throw new Error(`books config: duplicate book id "${book.id}"`);
    seen.add(book.id);
    book.path = path.resolve(ROOT, book.path);
    if (!fs.existsSync(book.path)) {
      throw new Error(`books config: path for "${book.id}" does not exist: ${book.path}`);
    }
  }
  cached = { key, books };
  return books;
}

export function findBookConfig(id: string): BookConfig | null {
  return loadBooksConfig().find((b) => b.id === id) ?? null;
}
