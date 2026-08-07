"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { navigateWithTransition } from "@/components/transitions";

// Keyboard map for the zoom view: ←/→ prev/next sub-chapter (filter-aware,
// the hrefs are computed server-side), Esc/↑ up to the chapter grid,
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
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowLeft" && prevHref) navigateWithTransition(router, prevHref);
      else if (e.key === "ArrowRight" && nextHref) navigateWithTransition(router, nextHref);
      else if (e.key === "Escape" || e.key === "ArrowUp") navigateWithTransition(router, upHref);
      else if (e.key === "[" && prevChapterHref) router.push(prevChapterHref);
      else if (e.key === "]" && nextChapterHref) router.push(nextChapterHref);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref, upHref, prevChapterHref, nextChapterHref]);

  return null;
}
