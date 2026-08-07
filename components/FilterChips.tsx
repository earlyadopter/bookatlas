import Link from "next/link";
import type { Tag } from "@/lib/types";

const LABELS: { key: Tag; label: string }[] = [
  { key: "interview", label: "Interview Q&A" },
  { key: "cheatsheet", label: "Cheat sheets" },
  { key: "code", label: "Code" }
];

// Server component: chips are plain links carrying ?f= so every filter state
// is a bookmarkable URL.
export function FilterChips({
  basePath,
  active,
  counts
}: {
  basePath: string;
  active: Tag | null;
  counts: Record<Tag, number>;
}) {
  return (
    <div className="chips" role="group" aria-label="Content filters">
      <Link href={basePath} className={active === null ? "chip current" : "chip"}>
        All
      </Link>
      {LABELS.map(({ key, label }) => (
        <Link
          key={key}
          href={`${basePath}?f=${key}`}
          className={active === key ? "chip current" : "chip"}
        >
          {label} <span className="chip-count">{counts[key]}</span>
        </Link>
      ))}
    </div>
  );
}
