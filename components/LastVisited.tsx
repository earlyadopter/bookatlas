"use client";

import { useEffect } from "react";

// Records the reader's position per group in localStorage so the structure
// dropdown can offer "return to where I was" across Theory/Practice jumps.
// Purely client-side: free on any host, static included.
export function LastVisited({
  bookId,
  group,
  href,
  label
}: {
  bookId: string;
  group: string;
  href: string;
  label: string;
}) {
  useEffect(() => {
    if (!group) return;
    try {
      const key = `bookatlas:last:${bookId}`;
      const data = JSON.parse(localStorage.getItem(key) ?? "{}");
      data[group] = { href, label, ts: Date.now() };
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }, [bookId, group, href, label]);
  return null;
}

export type LastPositions = Record<string, { href: string; label: string; ts: number }>;

export function readLastPositions(bookId: string): LastPositions {
  try {
    return JSON.parse(localStorage.getItem(`bookatlas:last:${bookId}`) ?? "{}");
  } catch {
    return {};
  }
}
