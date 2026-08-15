"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StructureData } from "@/lib/structure";
import { readLastPositions } from "@/components/LastVisited";

// The "where am I" dropdown on deep pages: the current group's map page,
// its parts/semesters with the current one highlighted, and a jump to the
// other half of the course.
export function StructureNav(props: StructureData & { bookId: string; currentHref: string }) {
  const [open, setOpen] = useState(false);
  const [returns, setReturns] = useState<{ href: string; label: string }[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open) {
      // Read at open time — no SSR/hydration involvement.
      const positions = readLastPositions(props.bookId);
      const rows = Object.entries(positions)
        .filter(([group, pos]) => group !== (props.groupLabel ?? "") && pos.href !== props.currentHref)
        .sort((a, b) => b[1].ts - a[1].ts)
        .map(([, pos]) => ({ href: pos.href, label: pos.label }));
      setReturns(rows);
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="structure-nav" ref={rootRef}>
      <button
        type="button"
        className="map-toggle"
        aria-expanded={open}
        aria-label="Course map"
        title="Course map"
        onClick={toggle}
      >
        ☰
      </button>
      {open ? (
        <div className="structure-panel" role="menu">
          {props.groupLabel ? <div className="structure-group">{props.groupLabel}</div> : null}
          {props.overview ? (
            <Link
              href={props.overview.href}
              className={props.overview.current ? "structure-row overview current" : "structure-row overview"}
              onClick={() => setOpen(false)}
            >
              {props.overview.label}
            </Link>
          ) : null}
          {props.parts.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={p.current ? "structure-row current" : "structure-row"}
              onClick={() => setOpen(false)}
            >
              {p.label}
            </Link>
          ))}
          {props.other ? (
            <Link href={props.other.href} className="structure-row other" onClick={() => setOpen(false)}>
              {props.other.label} →
            </Link>
          ) : null}
          {returns.map((r) => (
            <Link key={r.href} href={r.href} className="structure-row return" onClick={() => setOpen(false)}>
              ⤺ Return to {r.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
