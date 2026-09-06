"use client";

import type { Tag } from "../types";
import { useAtlasNav } from "./navigation";

const LABELS: { key: Exclude<Tag, "teaser">; label: string }[] = [
  { key: "interview", label: "Interview Q&A" },
  { key: "cheatsheet", label: "Cheat sheets" },
  { key: "code", label: "Code" }
];

/** Precomputed destinations, one per chip — the component imposes no URL shape. */
export type FilterHrefs = Record<"all" | Exclude<Tag, "teaser">, string>;

// Chips are plain links carrying the filter in the href so every filter
// state is a bookmarkable URL.
export function FilterChips({
  hrefs,
  active,
  counts
}: {
  hrefs: FilterHrefs;
  active: Tag | null;
  counts: Record<Tag, number>;
}) {
  const { Link } = useAtlasNav();
  return (
    <div className="chips" role="group" aria-label="Content filters">
      <Link href={hrefs.all} className={active === null ? "chip current" : "chip"}>
        All
      </Link>
      {LABELS.map(({ key, label }) => (
        <Link key={key} href={hrefs[key]} className={active === key ? "chip current" : "chip"}>
          {label} <span className="chip-count">{counts[key]}</span>
        </Link>
      ))}
    </div>
  );
}
