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

export type ParsedChapter = Omit<Chapter, "file" | "mtimeMs" | "introHtml" | "preambleHtml"> & {
  introMd: string | null;
  preambleMd: string | null;
};

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
        // Folder books often number the file's own heading ("# 4. Circle of
        // Fifths"); the tile already shows the number (from the file name),
        // so drop a leading "N." / "N.M" to avoid showing it twice.
        chapterTitle = trimmed.replace(/^#+\s*/, "").replace(/^\d+(?:\.\d+)?\.?\s+/, "");
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
  type Boundary = {
    line: number;
    number: string | null;
    displayNumber: string;
    title: string;
    kind: "nm" | "bare" | "plain";
    /** Major part of the number: 3 for "3.1" and for "3." */
    major: number | null;
    group?: string | null;
  };
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
          title: nm[3].trim(),
          kind: "nm",
          major: parseInt(nm[1], 10)
        });
        sawNumbered = true;
        continue;
      }
      const bare = text.match(BARE_ORDINAL);
      if (bare) {
        // Inside a numbered chapter file, "7. Vars" is section 1.7. In a file
        // with no chapter number of its own (a standalone numbered outline)
        // the bare ordinals ARE the top level: "3." is 3, never "0.3".
        const composed = chapterNumber > 0 ? `${chapterNumber}.${bare[1]}` : bare[1];
        boundaries.push({
          line: i,
          number: composed,
          displayNumber: composed,
          title: bare[2].trim(),
          kind: "bare",
          major: parseInt(bare[1], 10)
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
          boundaries.push({ line: i, number: null, displayNumber: "", title: text, kind: "plain", major: null });
        }
        continue;
      }
      // depth === 2: teasers and cheat sheets split; everything else stays in
      // the body (keeps module-05's "## Account" inside "# 5.2 …").
      if (sawNumbered && UNNUMBERED_H2_SPLIT.test(text)) {
        boundaries.push({ line: i, number: null, displayNumber: "", title: text, kind: "plain", major: null });
      }
    }
  }

  // Rescue pass: a chapter that produced no boundaries at all has no tiles —
  // its entire body renders as one undifferentiated intro. That happens to
  // perfectly ordinary documents: numbers pushed one level deeper ("## Phase
  // 1" carrying "### 1.1 Title"), or plain unnumbered "## Section" headings.
  // The scan above only looks at H1/H2 and only splits on numbers, by design
  // — depth is unreliable in the exported corpora it was built for.
  //
  // So rather than loosen that scan for everyone, retry only when it found
  // nothing. This cannot change any file that already yields sections, which
  // is what makes it safe to apply to every consumer at once.
  if (boundaries.length === 0) {
    type Candidate = { line: number; depth: number; text: string; quoteish: boolean };
    const headings: Candidate[] = [];
    let inFence = false;
    for (let i = chapterLine + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const h = trimmed.match(/^(#{2,4})\s+(.+)$/);
      if (!h) continue;
      const text = h[2].trim();
      // A pull quote cannot be a level, so it never votes on the depth — but
      // once a depth is chosen it is kept, because the same test reads an
      // identifier ("storageState", one lowercase word) as decoration and
      // would drop a real topic out of the grid.
      headings.push({ line: i, depth: h[1].length, text, quoteish: pullQuoteHeuristic && isPullQuote(text) });
    }

    // Pick the one depth that carries the document's structure. Numbering is
    // the strongest signal, so a depth that has it wins outright. Otherwise
    // the depth with the most DISTINCT titles wins — counting headings alone
    // picked boilerplate: a cheat sheet that gives every topic the same two
    // sub-headings ("## Topic" over "### 30-second explanation" / "### If
    // they ask more") has more sub-headings than topics, and the reader got a
    // grid of identical tile titles. Repetition marks a depth as the shape of
    // the topics rather than the topics themselves, while a genuine run of
    // sub-headings ("### Part I", "### Part II", …) is all distinct and still
    // wins over its shallower parent. Ties go to the shallower depth.
    const depths = [...new Set(headings.filter((h) => !h.quoteish).map((h) => h.depth))].sort((a, b) => a - b);
    const at = (depth: number) => headings.filter((h) => h.depth === depth && !h.quoteish);
    const numberedAt = (depth: number) =>
      at(depth).filter((h) => NUMBERED_NM.test(h.text) || BARE_ORDINAL.test(h.text)).length;
    const distinctAt = (depth: number) =>
      new Set(at(depth).map((h) => h.text.trim().toLowerCase())).size;

    let best: { depth: number; total: number } | null = null;
    for (const depth of depths) {
      if (numberedAt(depth) === 0) continue;
      if (!best || numberedAt(depth) > numberedAt(best.depth)) best = { depth, total: at(depth).length };
    }
    if (!best) {
      for (const depth of depths) {
        if (!best || distinctAt(depth) > distinctAt(best.depth)) best = { depth, total: at(depth).length };
      }
    }

    if (best && best.total > 0) {
      const chosen = best.depth;
      for (const h of headings) {
        if (h.depth !== chosen) continue;
        // The nearest shallower heading above becomes the group label, so
        // "## Phase 1" renders as a separator over its "### 1.x" run rather
        // than vanishing into the body.
        const parent = headings
          .filter((c) => c.line < h.line && c.depth < chosen)
          .pop();
        const nm = h.text.match(NUMBERED_NM);
        const bare = nm ? null : h.text.match(BARE_ORDINAL);
        const composed = bare ? (chapterNumber > 0 ? `${chapterNumber}.${bare[1]}` : bare[1]) : null;
        boundaries.push({
          line: h.line,
          number: nm ? `${nm[1]}.${nm[2]}` : composed,
          displayNumber: nm ? `${nm[1]}.${nm[2]}` : (composed ?? ""),
          title: (nm ? nm[3] : bare ? bare[2] : h.text).trim(),
          kind: nm || bare ? "nm" : "plain",
          major: nm ? parseInt(nm[1], 10) : bare ? parseInt(bare[1], 10) : null,
          group: parent ? parent.text : null
        });
      }
    }
  }

  // Standalone outlines: a top-level "N." heading with no text of its own
  // before its first "N.M" is structure, not content — it becomes the group
  // label of those sections instead of an empty tile. One that does carry
  // text stays a tile; its sections simply follow it.
  const kept: (Boundary & { end: number })[] = [];
  for (let idx = 0; idx < boundaries.length; idx++) {
    const b = boundaries[idx];
    const next = boundaries[idx + 1];
    const end = next ? next.line : lines.length;
    if (
      chapterNumber === 0 &&
      b.kind === "bare" &&
      next?.kind === "nm" &&
      next.major === b.major &&
      trimBody(lines.slice(b.line + 1, next.line)).length === 0
    ) {
      const label = `${b.major}. ${b.title}`;
      for (let j = idx + 1; j < boundaries.length && boundaries[j].kind === "nm" && boundaries[j].major === b.major; j++) {
        boundaries[j].group = label;
      }
      continue;
    }
    kept.push({ ...b, end });
  }

  const introEnd = boundaries.length > 0 ? boundaries[0].line : lines.length;
  const introMd = joinBody(lines.slice(chapterLine + 1, introEnd));

  const usedSlugs = new Set<string>();
  const subchapters: SubChapter[] = kept.map((b, idx) => {
    const end = b.end;
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
      excerpt: extractExcerpt(mdBody),
      group: b.group ?? null,
      sourceStart: b.line,
      sourceEnd: end
    };
  });

  return {
    slug,
    number: chapterNumber,
    title: chapterTitle,
    fullTitle,
    introMd,
    preambleMd,
    subchapters,
    sourceStart: Math.max(chapterLine, 0),
    sourceEnd: lines.length
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
