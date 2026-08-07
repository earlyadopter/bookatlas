import type { Chapter, ParserOverrides, SubChapter } from "./types";
import { computeTags } from "./tags";
import { slugify } from "./slugs";
import { extractExcerpt } from "./renderMarkdown";

// Splits one chapter file into sub-chapters. Heading DEPTH is unreliable in
// ChatGPT-exported books (first sub-chapter often H2, children sometimes H2
// under an H1 parent), so boundaries are decided by the numbering pattern and
// a small set of title heuristics — never by depth alone and never by `---`.

const DEFAULT_CHAPTER_TITLE = /^#{1,2}\s+Module\s+(\d+)\s*[—–-]\s*(.+)$/;
const NUMBERED_NM = /^(\d+)\.(\d+)\s+(.+)$/; // "5.2 Title"
const BARE_ORDINAL = /^(\d+)\.\s+(.+)$/; // "7. Title" (module-01 style)
const FOOTNOTE_DEF = /^\[\d+\]:\s+https?:\/\//;
const UNNUMBERED_H2_SPLIT = /^Next\s*[—:–-]|cheat ?sheet/i;

export type ParsedChapter = Omit<Chapter, "file" | "mtimeMs">;

export function parseChapter(
  filename: string,
  raw: string,
  overrides: ParserOverrides = {}
): ParsedChapter {
  const chapterTitleRe = overrides.chapterTitlePattern
    ? new RegExp(overrides.chapterTitlePattern)
    : DEFAULT_CHAPTER_TITLE;
  const pullQuoteHeuristic = overrides.pullQuoteHeuristic ?? true;

  let lines = raw.split(/\r?\n/);
  if (overrides.stripFootnotes ?? true) lines = stripTrailingFootnotes(lines);

  const slug = filename.replace(/\.md$/i, "");
  const fileNumber = slug.match(/(\d+)/);

  // Locate the chapter heading (fence-aware).
  let chapterLine = -1;
  let headingNumber: number | null = null;
  let chapterTitle = "";
  let fullTitle = "";
  {
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const m = trimmed.match(chapterTitleRe);
      if (m) {
        chapterLine = i;
        headingNumber = m[1] ? parseInt(m[1], 10) : null;
        chapterTitle = (m[2] ?? m[0].replace(/^#+\s*/, "")).trim();
        fullTitle = trimmed.replace(/^#+\s*/, "");
        break;
      }
    }
  }
  if (chapterLine === -1) {
    // Generic fallback: first heading of any depth is the chapter title.
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (!inFence && /^#{1,3}\s+\S/.test(trimmed)) {
        chapterLine = i;
        chapterTitle = trimmed.replace(/^#+\s*/, "");
        fullTitle = chapterTitle;
        break;
      }
    }
  }
  if (chapterLine === -1) {
    chapterLine = -1;
    chapterTitle = slug;
    fullTitle = slug;
  }

  const chapterNumber = fileNumber ? parseInt(fileNumber[1], 10) : (headingNumber ?? 0);
  const preambleMd = chapterLine > 0 ? joinBody(lines.slice(0, chapterLine)) : null;

  // Boundary scan after the chapter heading.
  type Boundary = { line: number; number: string | null; displayNumber: string; title: string };
  const boundaries: Boundary[] = [];
  {
    let inFence = false;
    let sawNumbered = false;
    for (let i = chapterLine + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const h = trimmed.match(/^(#{1,2})\s+(.+)$/);
      if (!h) continue;
      const depth = h[1].length;
      const text = h[2].trim();

      const nm = text.match(NUMBERED_NM);
      if (nm) {
        boundaries.push({
          line: i,
          number: `${nm[1]}.${nm[2]}`,
          displayNumber: `${nm[1]}.${nm[2]}`,
          title: nm[3].trim()
        });
        sawNumbered = true;
        continue;
      }
      const bare = text.match(BARE_ORDINAL);
      if (bare) {
        boundaries.push({
          line: i,
          number: `${chapterNumber}.${bare[1]}`,
          displayNumber: `${chapterNumber}.${bare[1]}`,
          title: bare[2].trim()
        });
        sawNumbered = true;
        continue;
      }

      // Unnumbered candidates.
      if (pullQuoteHeuristic && isPullQuote(text)) continue;
      if (depth === 1) {
        // Cheat sheets, codas ("# Module 4 cheat sheet") — only once real
        // sub-chapters exist; earlier H1s would be intro structure.
        if (sawNumbered) {
          boundaries.push({ line: i, number: null, displayNumber: "", title: text });
        }
        continue;
      }
      // depth === 2: teasers and cheat sheets split; everything else stays in
      // the body (keeps module-05's "## Account" inside "# 5.2 …").
      if (sawNumbered && UNNUMBERED_H2_SPLIT.test(text)) {
        boundaries.push({ line: i, number: null, displayNumber: "", title: text });
      }
    }
  }

  const introEnd = boundaries.length > 0 ? boundaries[0].line : lines.length;
  const introMd = joinBody(lines.slice(chapterLine + 1, introEnd));

  const usedSlugs = new Set<string>();
  const subchapters: SubChapter[] = boundaries.map((b, idx) => {
    const end = idx + 1 < boundaries.length ? boundaries[idx + 1].line : lines.length;
    const bodyLines = trimBody(lines.slice(b.line + 1, end));
    const mdBody = bodyLines.join("\n");
    const { tags, hasInterviewBlocks, codeFenceCount } = computeTags(b.title, bodyLines);

    let subSlug = slugify(b.displayNumber ? `${b.displayNumber} ${b.title}` : b.title);
    if (!subSlug) subSlug = `section-${idx + 1}`;
    let unique = subSlug;
    for (let n = 2; usedSlugs.has(unique); n++) unique = `${subSlug}-${n}`;
    usedSlugs.add(unique);

    return {
      slug: unique,
      number: b.number,
      displayNumber: b.displayNumber,
      ordinal: idx,
      title: b.title,
      mdBody,
      html: "", // filled by loadBook (rendering lives there)
      tags,
      hasInterviewBlocks,
      wordCount: countWords(bodyLines),
      codeFenceCount,
      excerpt: extractExcerpt(mdBody)
    };
  });

  return {
    slug,
    number: chapterNumber,
    title: chapterTitle,
    fullTitle,
    introMd,
    preambleMd,
    subchapters
  };
}

function stripTrailingFootnotes(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0) {
    const trimmed = lines[end - 1].trim();
    if (trimmed === "" || FOOTNOTE_DEF.test(trimmed)) {
      end--;
      continue;
    }
    break;
  }
  // Only trim if we actually saw a footnote definition in the dropped range.
  const dropped = lines.slice(end);
  return dropped.some((l) => FOOTNOTE_DEF.test(l.trim())) ? lines.slice(0, end) : lines;
}

// Garbage unnumbered H1s that are emphasis, not structure ("# **Idempotency**",
// "# asynchronous").
function isPullQuote(text: string): boolean {
  if (/^\*\*.+\*\*$/.test(text)) return true;
  const words = text.split(/\s+/);
  return words.length <= 2 && /^[a-z]/.test(text);
}

function trimBody(bodyLines: string[]): string[] {
  let start = 0;
  let end = bodyLines.length;
  const isNoise = (l: string) => l.trim() === "" || /^-{3,}$/.test(l.trim());
  while (start < end && isNoise(bodyLines[start])) start++;
  while (end > start && isNoise(bodyLines[end - 1])) end--;
  return bodyLines.slice(start, end);
}

function joinBody(bodyLines: string[]): string | null {
  const trimmed = trimBody(bodyLines);
  return trimmed.length > 0 ? trimmed.join("\n") : null;
}

function countWords(bodyLines: string[]): number {
  let count = 0;
  let inFence = false;
  for (const line of bodyLines) {
    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    count += line.split(/\s+/).filter(Boolean).length;
  }
  return count;
}
