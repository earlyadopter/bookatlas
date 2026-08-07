// Pure, client-safe slug + href helpers. No fs imports here.

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’'‘`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export function bookHref(bookId: string, f?: string): string {
  return withFilter(`/b/${bookId}`, f);
}

export function chapterHref(bookId: string, chapterSlug: string, f?: string): string {
  return withFilter(`/b/${bookId}/${chapterSlug}`, f);
}

export function subHref(bookId: string, chapterSlug: string, subSlug: string, f?: string): string {
  return withFilter(`/b/${bookId}/${chapterSlug}/${subSlug}`, f);
}

function withFilter(href: string, f?: string): string {
  return f ? `${href}?f=${encodeURIComponent(f)}` : href;
}
