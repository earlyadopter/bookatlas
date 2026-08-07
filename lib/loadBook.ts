import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { Book, Chapter, Tag } from "./types";
import { findBookConfig, loadBooksConfig } from "./config";
import { parseChapter } from "./parseChapter";
import { renderSubChapterHtml } from "./renderMarkdown";

// Chapters re-read + re-parse only when the source file's mtime changes, so
// editing a book in Dropbox shows up on browser refresh without a restart.
const chapterCache = new Map<string, { mtimeMs: number; chapter: Chapter }>();

async function loadChapter(file: string, overrides?: Parameters<typeof parseChapter>[2]): Promise<Chapter> {
  const stat = await fs.stat(file);
  const hit = chapterCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.chapter;

  const raw = await fs.readFile(file, "utf8");
  const parsed = parseChapter(path.basename(file), raw, overrides);
  const chapter: Chapter = {
    ...parsed,
    file,
    mtimeMs: stat.mtimeMs,
    subchapters: parsed.subchapters.map((s) => ({ ...s, html: renderSubChapterHtml(s.mdBody) }))
  };
  chapterCache.set(file, { mtimeMs: stat.mtimeMs, chapter });
  return chapter;
}

export const getBook = cache(async (bookId: string): Promise<Book | null> => {
  const config = findBookConfig(bookId);
  if (!config) return null;

  const entries = await fs.readdir(config.path);
  let files = entries.filter((f) => f.endsWith(".md") && !f.startsWith("."));
  if (config.parser?.fileOrder) {
    const order = config.parser.fileOrder;
    files = order.filter((f) => files.includes(f));
  } else {
    files.sort((a, b) => a.localeCompare(b));
  }

  const chapters = await Promise.all(
    files.map((f) => loadChapter(path.join(config.path, f), config.parser))
  );

  const tagCounts: Record<Tag, number> = { interview: 0, cheatsheet: 0, teaser: 0, code: 0 };
  for (const ch of chapters) {
    for (const sub of ch.subchapters) {
      for (const tag of sub.tags) tagCounts[tag]++;
    }
  }

  return {
    id: config.id,
    title: config.title,
    description: config.description,
    dir: config.path,
    accent: config.accent,
    chapters,
    tagCounts
  };
});

export const listBooks = cache(async (): Promise<Book[]> => {
  const configs = loadBooksConfig();
  const books = await Promise.all(configs.map((c) => getBook(c.id)));
  return books.filter((b): b is Book => b !== null);
});
