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
// A hairline indicator below mirrors which slice of the strip is visible —
// a scrollbar's information without a scrollbar's chrome.
export function ChapterStrip({
  items,
  label = "Chapters"
}: {
  items: StripItem[];
  label?: string;
}) {
  const stripRef = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const currentHref = items.find((item) => item.current)?.href;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [currentHref]);

  useEffect(() => {
    const strip = stripRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!strip || !track || !thumb) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = strip;
      if (scrollWidth <= clientWidth + 1) {
        track.style.visibility = "hidden";
        return;
      }
      track.style.visibility = "visible";
      thumb.style.left = `${(scrollLeft / scrollWidth) * 100}%`;
      thumb.style.width = `${(clientWidth / scrollWidth) * 100}%`;
    };
    update();
    strip.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    return () => {
      strip.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items.length]);

  return (
    <>
      <nav ref={stripRef} className="strip" aria-label={label}>
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
      <div ref={trackRef} className="strip-progress" aria-hidden="true">
        <div ref={thumbRef} className="strip-progress-thumb" />
      </div>
    </>
  );
}
