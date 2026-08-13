import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { Book, Chapter, Tag } from "@bookatlas/core";
import { findBookConfig, loadBooksConfig } from "./config";
import { parseChapter, parseSingleFileBook, renderPlainHtml, renderSubChapterHtml } from "@bookatlas/core";

// Sources re-read + re-parse only when the file's mtime changes, so editing a
// book in Dropbox shows up on browser refresh without a restart.
const chapterCache = new Map<string, { mtimeMs: number; chapter: Chapter }>();
const singleFileCache = new Map<
  string,
  { mtimeMs: number; title: string | null; preambleMd: string | null; chapters: Chapter[] }
>();

async function loadChapterFile(
  file: string,
  assetBase: string,
  overrides?: Parameters<typeof parseChapter>[2]
): Promise<Chapter> {
  const stat = await fs.stat(file);
  const hit = chapterCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.chapter;

  const raw = await fs.readFile(file, "utf8");
  const { introMd, preambleMd, ...parsed } = parseChapter(path.basename(file), raw, overrides);
  const chapter: Chapter = {
    ...parsed,
    file,
    mtimeMs: stat.mtimeMs,
    introHtml: introMd ? renderPlainHtml(introMd, { assetBase }) : null,
    preambleHtml: preambleMd ? renderPlainHtml(preambleMd, { assetBase }) : null,
    // mdBody is blanked after rendering: raw markdown must never be reachable
    // from route handlers or serialized into RSC payloads.
    subchapters: parsed.subchapters.map((s) => ({
      ...s,
      html: renderSubChapterHtml(s.mdBody, { assetBase }),
      mdBody: ""
    }))
  };
  chapterCache.set(file, { mtimeMs: stat.mtimeMs, chapter });
  return chapter;
}

async function loadSingleFile(file: string, assetBase: string) {
  const stat = await fs.stat(file);
  const hit = singleFileCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit;

  const raw = await fs.readFile(file, "utf8");
  const parsed = parseSingleFileBook(raw);
  const chapters: Chapter[] = parsed.chapters.map(({ introMd, preambleMd, ...ch }, idx) => ({
    ...ch,
    file,
    mtimeMs: stat.mtimeMs,
    introHtml: introMd ? renderPlainHtml(introMd, { assetBase }) : null,
    // Book-level front matter (title page, About, TOC) rides on the first
    // chapter as the collapsible "About this book" block.
    preambleHtml:
      idx === 0 && parsed.preambleMd ? renderPlainHtml(parsed.preambleMd, { assetBase }) : null,
    subchapters: ch.subchapters.map((s) => ({
      ...s,
      html: renderSubChapterHtml(s.mdBody, { assetBase }),
      mdBody: ""
    }))
  }));
  const entry = {
    mtimeMs: stat.mtimeMs,
    title: parsed.title,
    preambleMd: parsed.preambleMd,
    chapters
  };
  singleFileCache.set(file, entry);
  return entry;
}

export const getBook = cache(async (bookId: string): Promise<Book | null> => {
  const config = findBookConfig(bookId);
  if (!config) return null;

  const assetBase = `/b/${config.id}/asset/`;
  let chapters: Chapter[];
  let derivedTitle: string | null = null;

  if (config.mode === "single-file") {
    const loaded = await loadSingleFile(path.join(config.path, "book.md"), assetBase);
    chapters = loaded.chapters;
    derivedTitle = loaded.title;
  } else {
    const entries = await fs.readdir(config.path);
    let files = entries.filter((f) => f.endsWith(".md") && !f.startsWith("."));
    if (config.parser?.fileOrder) {
      const order = config.parser.fileOrder;
      files = order.filter((f) => files.includes(f));
    } else {
      files.sort((a, b) => a.localeCompare(b));
    }
    chapters = await Promise.all(
      files.map((f) => loadChapterFile(path.join(config.path, f), assetBase, config.parser))
    );
  }

  const tagCounts: Record<Tag, number> = { interview: 0, cheatsheet: 0, teaser: 0, code: 0 };
  for (const ch of chapters) {
    for (const sub of ch.subchapters) {
      for (const tag of sub.tags) tagCounts[tag]++;
    }
  }

  // Config-driven part grouping (chapter-number ranges). Single-file PART
  // dividers stay unless the config explicitly maps the chapter.
  if (config.parts?.length) {
    for (const ch of chapters) {
      const part = config.parts.find((p) => ch.number >= p.from && ch.number <= p.to);
      if (part) {
        ch.part = part.label;
        ch.partGroup = part.group ?? null;
      }
    }
  }

  const coverUrl = existsSync(path.join(config.path, "cover.png"))
    ? `${assetBase}cover.png`
    : undefined;

  return {
    id: config.id,
    title: config.title || derivedTitle || config.id,
    description: config.description,
    dir: config.path,
    mode: config.mode ?? "files",
    coverUrl,
    accent: config.accent,
    filters: config.filters ?? true,
    chapters,
    tagCounts
  };
});

export const listBooks = cache(async (): Promise<Book[]> => {
  const configs = loadBooksConfig();
  const books = await Promise.all(configs.map((c) => getBook(c.id)));
  return books.filter((b): b is Book => b !== null);
});
