"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type StripItem = {
  /** Precomputed destination — the component imposes no URL shape. */
  href: string;
  /** Display number, already formatted ("01", "IV", …). */
  num: string;
  title: string;
  current: boolean;
};

// Horizontal row of all chapters — the v1 answer to "chapters don't fit":
// scroll + edge fade + auto-center the current pill, no scaling logic.
// Hrefs come precomputed so embedders with their own routes can use it as-is.
export function ChapterStrip({
  items,
  label = "Chapters"
}: {
  items: StripItem[];
  label?: string;
}) {
  const currentRef = useRef<HTMLAnchorElement>(null);
  const currentHref = items.find((item) => item.current)?.href;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [currentHref]);

  return (
    <nav className="strip" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          ref={item.current ? currentRef : undefined}
          href={item.href}
          className={item.current ? "strip-pill current" : "strip-pill"}
          aria-current={item.current ? "page" : undefined}
        >
          <span className="strip-num">{item.num}</span>
          <span className="strip-title">{item.title}</span>
        </Link>
      ))}
    </nav>
  );
}
