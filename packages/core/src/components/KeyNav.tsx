"use client";

import { useEffect } from "react";
import { useAtlasNav } from "./navigation";
import { navigateWithTransition } from "./transitions";

// Keyboard map for the zoom view: ←/→ prev/next sub-chapter (filter-aware,
// the hrefs are computed by the caller), Esc/↑ up to the chapter grid,
// [ / ] prev/next chapter.
export function KeyNav({
  prevHref,
  nextHref,
  upHref,
  prevChapterHref,
  nextChapterHref
}: {
  prevHref: string | null;
  nextHref: string | null;
  upHref: string;
  prevChapterHref: string | null;
  nextChapterHref: string | null;
}) {
  const nav = useAtlasNav();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowLeft" && prevHref) navigateWithTransition(nav, prevHref);
      else if (e.key === "ArrowRight" && nextHref) navigateWithTransition(nav, nextHref);
      else if (e.key === "Escape" || e.key === "ArrowUp") navigateWithTransition(nav, upHref);
      else if (e.key === "[" && prevChapterHref) nav.push(prevChapterHref);
      else if (e.key === "]" && nextChapterHref) nav.push(nextChapterHref);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, prevHref, nextHref, upHref, prevChapterHref, nextChapterHref]);

  return null;
}
