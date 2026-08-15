import { slugify, type Book, type Chapter } from "@bookatlas/core";
import { bookHref, chapterHref } from "./hrefs";

// Data for the structure-map dropdown: the current group's parts (linking
// to anchored headings on the book page), its overview "map" chapter, and
// a cross-link to the other group.

export type StructureData = {
  groupLabel: string | null;
  overview: { label: string; href: string; current: boolean } | null;
  parts: { label: string; href: string; current: boolean }[];
  other: { label: string; href: string } | null;
};

export function partAnchor(label: string): string {
  return slugify(label);
}

export function buildStructure(book: Book, current: Chapter): StructureData | null {
  const group = current.partGroup ?? null;
  if (!group && !current.part) {
    // Ungrouped chapter (no parts configured) — nothing to map.
    if (!book.chapters.some((c) => c.partGroup)) return null;
  }
  const parts: StructureData["parts"] = [];
  const seen = new Set<string>();
  let overview: StructureData["overview"] = null;

  for (const ch of book.chapters) {
    if ((ch.partGroup ?? null) !== group) continue;
    if (!ch.part) {
      if (!overview) {
        overview = {
          label: ch.title,
          href: chapterHref(book.id, ch.slug),
          current: ch.slug === current.slug
        };
      }
      continue;
    }
    if (!seen.has(ch.part)) {
      seen.add(ch.part);
      parts.push({
        label: ch.part,
        href: `${bookHref(book.id)}#${partAnchor(ch.part)}`,
        current: ch.part === current.part
      });
    }
  }

  const otherOverview = book.chapters.find(
    (c) => c.partGroup && (c.partGroup ?? null) !== group && !c.part
  );
  const other = otherOverview
    ? {
        label: `${otherOverview.partGroup} — ${otherOverview.title}`,
        href: chapterHref(book.id, otherOverview.slug)
      }
    : null;

  return { groupLabel: group, overview, parts, other };
}
