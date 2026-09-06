import type { Book, BookPart, Chapter, ParserOverrides, Tag } from "./types";
import { parseChapter } from "./parseChapter";
import { parseSingleFileBook } from "./parseSingleFileBook";
import { renderPlainHtml, renderSubChapterHtml } from "./renderMarkdown";

// Pure book assembly: markdown strings in, a rendered Book out. No fs. The
// Next site feeds this from disk (lib/loadBook.ts, with an mtime cache per
// file); the Mac app and any browser-side consumer feed it from wherever
// their bytes come from. Three layers so callers can cache at the level
// they need:
//   buildChapter / buildSingleFileChapters   one file → Chapter(s)
//   assembleBook                             Chapter[] + metadata → Book
//   buildBook                                everything at once

export type SourceFile = {
  /** Basename, e.g. "module-01.md" — drives the chapter slug and ordering. */
  name: string;
  content: string;
  /** Recorded on Chapter.file; defaults to name. */
  path?: string;
  mtimeMs?: number;
};

export type BuildOptions = {
  /** URL prefix for relative image refs inside the markdown. */
  assetBase?: string;
  parser?: ParserOverrides;
  /**
   * Keep each section's markdown on the result (editing UIs). Default false:
   * mdBody is blanked after rendering so raw source can never leak through a
   * server's serialization of the object graph.
   */
  keepSource?: boolean;
};

export type AssembleOptions = {
  id: string;
  /** Explicit title; falls back to derivedTitle (single-file books) then id. */
  title?: string;
  derivedTitle?: string | null;
  description?: string;
  mode?: "files" | "single-file";
  dir?: string;
  coverUrl?: string;
  accent?: string;
  filters?: boolean;
  parts?: BookPart[];
};

export type BuildBookOptions = BuildOptions &
  Omit<AssembleOptions, "derivedTitle"> & {
    /** Filename prefixes to exclude (notes, drafts in the same folder). */
    ignore?: string[];
  };

/** Which files form a "files"-mode book, in reading order. */
export function selectChapterFiles(
  names: string[],
  opts: { ignore?: string[]; fileOrder?: string[] } = {}
): string[] {
  let files = names.filter(
    (f) =>
      /\.(md|markdown)$/i.test(f) &&
      !f.startsWith(".") &&
      !(opts.ignore ?? []).some((prefix) => f.startsWith(prefix))
  );
  if (opts.fileOrder) {
    // An explicit order is also an allowlist.
    const order = opts.fileOrder;
    files = order.filter((f) => files.includes(f));
  } else {
    files.sort((a, b) => a.localeCompare(b));
  }
  return files;
}

export function buildChapter(file: SourceFile, opts: BuildOptions = {}): Chapter {
  const { introMd, preambleMd, ...parsed } = parseChapter(file.name, file.content, opts.parser);
  return {
    ...parsed,
    file: file.path ?? file.name,
    mtimeMs: file.mtimeMs ?? 0,
    introHtml: introMd ? renderPlainHtml(introMd, { assetBase: opts.assetBase }) : null,
    preambleHtml: preambleMd ? renderPlainHtml(preambleMd, { assetBase: opts.assetBase }) : null,
    subchapters: parsed.subchapters.map((s) => ({
      ...s,
      html: renderSubChapterHtml(s.mdBody, { assetBase: opts.assetBase }),
      mdBody: opts.keepSource ? s.mdBody : ""
    }))
  };
}

export function buildSingleFileChapters(
  file: SourceFile,
  opts: BuildOptions = {}
): { title: string | null; chapters: Chapter[] } {
  const parsed = parseSingleFileBook(file.content);
  // Single-file chapters never carry their own preamble; the book-level
  // front matter (title page, About, TOC) rides on the first chapter as the
  // collapsible "About this book" block.
  const chapters: Chapter[] = parsed.chapters.map(({ introMd, preambleMd: _unused, ...ch }, idx) => ({
    ...ch,
    file: file.path ?? file.name,
    mtimeMs: file.mtimeMs ?? 0,
    introHtml: introMd ? renderPlainHtml(introMd, { assetBase: opts.assetBase }) : null,
    preambleHtml:
      idx === 0 && parsed.preambleMd
        ? renderPlainHtml(parsed.preambleMd, { assetBase: opts.assetBase })
        : null,
    subchapters: ch.subchapters.map((s) => ({
      ...s,
      html: renderSubChapterHtml(s.mdBody, { assetBase: opts.assetBase }),
      mdBody: opts.keepSource ? s.mdBody : ""
    }))
  }));
  return { title: parsed.title, chapters };
}

export function assembleBook(chapters: Chapter[], opts: AssembleOptions): Book {
  const tagCounts: Record<Tag, number> = { interview: 0, cheatsheet: 0, teaser: 0, code: 0 };
  for (const ch of chapters) {
    for (const sub of ch.subchapters) {
      for (const tag of sub.tags) tagCounts[tag]++;
    }
  }

  // Config-driven part grouping (chapter-number ranges). Single-file PART
  // dividers stay unless the config explicitly maps the chapter.
  if (opts.parts?.length) {
    for (const ch of chapters) {
      const part = opts.parts.find(
        (p) =>
          (!p.prefix || ch.slug.startsWith(p.prefix)) &&
          (p.from === undefined || ch.number >= p.from) &&
          (p.to === undefined || ch.number <= p.to)
      );
      if (part) {
        ch.part = part.label;
        ch.partGroup = part.group ?? null;
      }
    }
  }

  return {
    id: opts.id,
    title: opts.title || opts.derivedTitle || opts.id,
    description: opts.description,
    dir: opts.dir ?? "",
    mode: opts.mode ?? "files",
    coverUrl: opts.coverUrl,
    accent: opts.accent,
    filters: opts.filters ?? true,
    chapters,
    tagCounts
  };
}

/**
 * One-shot build. "files" mode: every markdown file is a chapter, ordered by
 * name (or parser.fileOrder). "single-file" mode: the file named book.md, or
 * the only file given, is parsed as a whole book.
 */
export function buildBook(files: SourceFile[], opts: BuildBookOptions): Book {
  const { ignore, id, title, description, mode, dir, coverUrl, accent, filters, parts, ...build } = opts;
  const assemble = { id, title, description, mode, dir, coverUrl, accent, filters, parts };

  if (mode === "single-file") {
    const file = files.find((f) => f.name === "book.md") ?? files[0];
    if (!file) return assembleBook([], assemble);
    const { title: derivedTitle, chapters } = buildSingleFileChapters(file, build);
    return assembleBook(chapters, { ...assemble, derivedTitle });
  }

  const byName = new Map(files.map((f) => [f.name, f]));
  const names = selectChapterFiles([...byName.keys()], { ignore, fileOrder: build.parser?.fileOrder });
  const chapters = names.map((n) => buildChapter(byName.get(n)!, build));
  return assembleBook(chapters, assemble);
}
