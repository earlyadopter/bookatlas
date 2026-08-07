"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { chapterHref } from "@/lib/slugs";

export type StripChapter = {
  slug: string;
  number: number;
  title: string;
  subCount: number;
};

// Horizontal row of all chapters — the v1 answer to "chapters don't fit":
// scroll + edge fade + auto-center the current pill, no scaling logic.
export function ChapterStrip({
  bookId,
  chapters,
  currentSlug,
  filter
}: {
  bookId: string;
  chapters: StripChapter[];
  currentSlug: string | null;
  filter?: string;
}) {
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [currentSlug]);

  return (
    <nav className="strip" aria-label="Chapters">
      {chapters.map((ch) => {
        const current = ch.slug === currentSlug;
        return (
          <Link
            key={ch.slug}
            ref={current ? currentRef : undefined}
            href={chapterHref(bookId, ch.slug, filter)}
            className={current ? "strip-pill current" : "strip-pill"}
            aria-current={current ? "page" : undefined}
          >
            <span className="strip-num">{String(ch.number).padStart(2, "0")}</span>
            <span className="strip-title">{ch.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
