import type { Book, SubChapter, Tag } from "./types";

// Flattened reading order across all chapters, optionally restricted to a
// content-type filter — prev/next then crosses chapter boundaries (the
// book-wide "interview drill" behavior).

export type FlatSub = {
  chapterSlug: string;
  chapterNumber: number;
  sub: SubChapter;
};

export function matchesFilter(sub: SubChapter, filter: Tag | null): boolean {
  if (!filter) return !sub.tags.includes("teaser");
  if (filter === "interview") return sub.tags.includes("interview") || sub.hasInterviewBlocks;
  return sub.tags.includes(filter);
}

export function flattenBook(
  book: Book,
  filter: Tag | null,
  alwaysInclude?: { chapterSlug: string; subSlug: string }
): FlatSub[] {
  const out: FlatSub[] = [];
  for (const ch of book.chapters) {
    for (const sub of ch.subchapters) {
      const forced =
        alwaysInclude !== undefined &&
        ch.slug === alwaysInclude.chapterSlug &&
        sub.slug === alwaysInclude.subSlug;
      if (forced || matchesFilter(sub, filter)) {
        out.push({ chapterSlug: ch.slug, chapterNumber: ch.number, sub });
      }
    }
  }
  return out;
}

export function getPrevNext(
  book: Book,
  chapterSlug: string,
  subSlug: string,
  filter: Tag | null
): { prev: FlatSub | null; next: FlatSub | null; index: number; total: number } {
  // The current sub is force-included even when it doesn't match the sequence
  // (a teaser section, or reading a non-matching section with a filter on) —
  // prev/next then step to the nearest matching neighbors.
  const flat = flattenBook(book, filter, { chapterSlug, subSlug });
  const idx = flat.findIndex((f) => f.chapterSlug === chapterSlug && f.sub.slug === subSlug);
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
    index: idx,
    total: flat.length
  };
}

export function parseFilter(f: string | undefined): Tag | null {
  return f === "interview" || f === "cheatsheet" || f === "code" ? f : null;
}
