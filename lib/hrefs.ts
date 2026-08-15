import {
  bookHref as coreBookHref,
  chapterHref as coreChapterHref,
  subHref as coreSubHref
} from "@bookatlas/core";

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

export function subHref(bookId: string, chapterSlug: string, subSlug: string, f?: string): string {
  return SINGLE === bookId
    ? withFilter(`/${chapterSlug}/${subSlug}`, f)
    : coreSubHref(bookId, chapterSlug, subSlug, f);
}
