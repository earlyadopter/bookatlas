import {
  bookHref as coreBookHref,
  chapterHref as coreChapterHref,
  subHref as coreSubHref
} from "@bookatlas/core";
import type { FilterHrefs } from "@bookatlas/core/components";

// Single-book deployments emit root-relative links so the /b/<id> prefix
// never appears in the address bar (next.config rewrites route them).
const SINGLE = process.env.SINGLE_BOOK;

function withFilter(href: string, f?: string): string {
  return f ? `${href}?f=${encodeURIComponent(f)}` : href;
}

export function bookHref(bookId: string, f?: string): string {
  return SINGLE === bookId ? withFilter("/", f) : coreBookHref(bookId, f);
}

export function chapterHref(bookId: string, chapterSlug: string, f?: string): string {
  return SINGLE === bookId ? withFilter(`/${chapterSlug}`, f) : coreChapterHref(bookId, chapterSlug, f);
}

/** Chip destinations for a book page (no chapter) or a chapter page. */
export function filterHrefs(bookId: string, chapterSlug?: string): FilterHrefs {
  const to = (f?: string) => (chapterSlug ? chapterHref(bookId, chapterSlug, f) : bookHref(bookId, f));
  return { all: to(), interview: to("interview"), cheatsheet: to("cheatsheet"), code: to("code") };
}

export function subHref(bookId: string, chapterSlug: string, subSlug: string, f?: string): string {
  return SINGLE === bookId
    ? withFilter(`/${chapterSlug}/${subSlug}`, f)
    : coreSubHref(bookId, chapterSlug, subSlug, f);
}
