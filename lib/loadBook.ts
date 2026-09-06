import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { Book, Chapter, ParserOverrides } from "@bookatlas/core";
import { findBookConfig, loadBooksConfig } from "./config";
import {
  assembleBook,
  buildChapter,
  buildSingleFileChapters,
  selectChapterFiles
} from "@bookatlas/core";

// Disk adapter over the pure builders in @bookatlas/core. Sources re-read +
// re-parse only when the file's mtime changes, so editing a book in Dropbox
// shows up on browser refresh without a restart. Section markdown is never
// kept on the result (keepSource stays false): raw source must not be
// reachable from route handlers or serialized into RSC payloads.
const chapterCache = new Map<string, { mtimeMs: number; chapter: Chapter }>();
const singleFileCache = new Map<
  string,
  { mtimeMs: number; title: string | null; chapters: Chapter[] }
>();

async function loadChapterFile(
  file: string,
  assetBase: string,
  overrides?: ParserOverrides
): Promise<Chapter> {
  const stat = await fs.stat(file);
  const hit = chapterCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.chapter;

  const content = await fs.readFile(file, "utf8");
  const chapter = buildChapter(
    { name: path.basename(file), path: file, content, mtimeMs: stat.mtimeMs },
    { assetBase, parser: overrides }
  );
  chapterCache.set(file, { mtimeMs: stat.mtimeMs, chapter });
  return chapter;
}

async function loadSingleFile(file: string, assetBase: string) {
  const stat = await fs.stat(file);
  const hit = singleFileCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit;

  const content = await fs.readFile(file, "utf8");
  const { title, chapters } = buildSingleFileChapters(
    { name: path.basename(file), path: file, content, mtimeMs: stat.mtimeMs },
    { assetBase }
  );
  const entry = { mtimeMs: stat.mtimeMs, title, chapters };
  singleFileCache.set(file, entry);
  return entry;
}

export const getBook = cache(async (bookId: string): Promise<Book | null> => {
  const config = findBookConfig(bookId);
  if (!config) return null;

  const assetBase =
    process.env.SINGLE_BOOK === config.id ? "/asset/" : `/b/${config.id}/asset/`;
  let chapters: Chapter[];
  let derivedTitle: string | null = null;

  if (config.mode === "single-file") {
    const loaded = await loadSingleFile(path.join(config.path, "book.md"), assetBase);
    chapters = loaded.chapters;
    derivedTitle = loaded.title;
  } else {
    const files = selectChapterFiles(await fs.readdir(config.path), {
      ignore: config.ignore,
      fileOrder: config.parser?.fileOrder
    });
    chapters = await Promise.all(
      files.map((f) => loadChapterFile(path.join(config.path, f), assetBase, config.parser))
    );
  }

  const coverUrl = existsSync(path.join(config.path, "cover.png"))
    ? `${assetBase}cover.png`
    : undefined;

  return assembleBook(chapters, {
    id: config.id,
    title: config.title,
    derivedTitle,
    description: config.description,
    mode: config.mode ?? "files",
    dir: config.path,
    coverUrl,
    accent: config.accent,
    filters: config.filters,
    parts: config.parts
  });
});

export const listBooks = cache(async (): Promise<Book[]> => {
  const configs = loadBooksConfig();
  const books = await Promise.all(configs.map((c) => getBook(c.id)));
  return books.filter((b): b is Book => b !== null);
});
