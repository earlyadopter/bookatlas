import type { SubChapter } from "./types";
import type { ParsedChapter } from "./parseChapter";
import { computeTags } from "./tags";
import { slugify } from "./slugs";
import { extractExcerpt } from "./renderMarkdown";

// Parser profile for well-formed single-file books (one big book.md).
// Three heading conventions are auto-detected per book:
//   A: chapters `# Chapter N: Title` (H1), sub-chapters `##`
//   B: chapters `## Chapter N: Title` (H2), sub-chapters `###`
//   C: numbered outlines — chapters `# N. Title` (H1), sub-chapters `##`
//      (numbered `## N.M Title` or plain), plus `# N.M Title` H1s that
//      authors sometimes use for sub-chapters. PRDs, specs, plans.
//   D: labelled chapters — the author's own word plus a number, `# Module 1 —
//      Title`, `# Lesson 2: Title`, `# Scenario 3. Title` (H1), sub-chapters
//      `##`. Needs two headings sharing the word, so one `# Module 3 — …` at
//      the top of a folder's chapter file stays a chapter (that file's name
//      settles it first anyway). Trailing H1s after the last labelled chapter
//      ("Final Capstone") become unnumbered chapters of their own.
// `# PART ...` / `# Part ...` H1s are section dividers in every convention —
// they become a `part` label on following chapters. Appendix/Glossary-style
// trailing headings at the chapter depth (or H1) are unnumbered chapters.
// Unrecognized headings (stray code comments outside fences) stay in the body.
// A chapter with no sub-chapters becomes one section carrying the chapter's
// title, so every chapter is reachable in the zoom view and in reading order.

const APPENDIX_TITLE = /^(Appendix\s+[A-Z][:.]?\s*.*|Glossary\b.*|Conclusion\b.*|Epilogue\b.*|Bibliography\b.*|Further Reading\b.*|Index\b.*)$/;
const PART_RE = /^# ((?:PART|Part)\b.*)$/;

export type ParsedBook = {
  title: string | null;
  preambleMd: string | null;
  chapters: ParsedChapter[];
};

/** Fence-aware count of chapter headings per convention. */
function countConventions(lines: string[]): {
  h1Chapters: number;
  h2Chapters: number;
  outline: number;
  /** Majors of `# N.` outline chapters, and of `## N.M` / `# N.M` sub-headings. */
  outlineMajors: Set<number>;
  subMajors: Set<number>;
  /** Convention D: lower-cased label → the numbers seen with it, in file order. */
  labels: Map<string, { label: string; numbers: Set<number> }>;
} {
  let h1Chapters = 0;
  let h2Chapters = 0;
  let outline = 0;
  const outlineMajors = new Set<number>();
  const subMajors = new Set<number>();
  const labels = new Map<string, { label: string; numbers: Set<number> }>();
  let inFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^# Chapter\s+\d+/.test(trimmed)) h1Chapters++;
    else if (/^## Chapter\s+\d+/.test(trimmed)) h2Chapters++;
    else {
      const ch = trimmed.match(OUTLINE_CHAPTER);
      if (ch) {
        outline++;
        outlineMajors.add(parseInt(ch[1], 10));
        continue;
      }
      const sub = trimmed.match(/^#{1,2}\s+(\d+)\.\d+\.?\s+\S/);
      if (sub) subMajors.add(parseInt(sub[1], 10));
      const labelled = trimmed.match(LABELLED_CHAPTER);
      if (labelled) {
        const key = labelled[1].toLowerCase();
        // "Part" opens a section divider, never a chapter.
        if (key === "part") continue;
        const entry = labels.get(key) ?? { label: labelled[1], numbers: new Set<number>() };
        entry.numbers.add(parseInt(labelled[2], 10));
        labels.set(key, entry);
      }
    }
  }
  return { h1Chapters, h2Chapters, outline, outlineMajors, subMajors, labels };
}

const OUTLINE_CHAPTER = /^# (\d+)\.\s+(\S.*)$/;
/** Convention D probe: `# <Word> <N>` optionally followed by a separator and a title. */
const LABELLED_CHAPTER = /^#\s+([A-Za-z][A-Za-z-]*)\s+(\d+)\s*(?:[—–:.-]\s*(.*))?$/;
/** The label used by the most chapters, when at least two share it. */
function dominantLabel(labels: Map<string, { label: string; numbers: Set<number> }>): string | null {
  let best: { label: string; numbers: Set<number> } | null = null;
  for (const entry of labels.values()) {
    if (entry.numbers.size < 2) continue;
    if (!best || entry.numbers.size > best.numbers.size) best = entry;
  }
  return best ? best.label : null;
}
/** Convention D chapter heading for one label: groups are (number, title). */
function labelledChapterRe(label: string): RegExp {
  return new RegExp(`^#\\s+${label}\\s+(\\d+)\\s*(?:[—–:.-]\\s*(.*))?$`, "i");
}
const OUTLINE_H1_SUB = /^#\s+\d+\.\d+\.?\s+(.+)$/;
/** File names that mark a chapter of a folder book: "module-01", "03-intro", "chapter 7". */
const CHAPTER_FILENAME = /^\d+[-_. ]|^(module|chapter|part|lesson|week|day|unit|section)[-_ ]?\d+/i;

/**
 * Does this file read as a whole book (chapters + sections) rather than as
 * one chapter? True for `# Chapter N` / `## Chapter N` books, and for
 * numbered outlines: at least two `# N. Title` headings AND at least one
 * `## N.M` / `# N.M` sub-heading under one of them (a file whose bare `N.`
 * headings have no sub-headings is one chapter with numbered sections, the
 * shape of chapter files in a folder), and for labelled chapters: at least two
 * H1s sharing a word and a number (`# Module 1 — …`, `# Module 2 — …`).
 * A chapter-style file name ("module-01.md") always means a chapter.
 */
export function looksLikeSingleFileBook(raw: string, filename?: string): boolean {
  const c = countConventions(raw.split(/\r?\n/));
  if (c.h1Chapters + c.h2Chapters > 0) return true;
  if (filename && CHAPTER_FILENAME.test(filename)) return false;
  if (dominantLabel(c.labels)) return true;
  if (c.outline < 2) return false;
  for (const m of c.subMajors) if (c.outlineMajors.has(m)) return true;
  return false;
}

export function parseSingleFileBook(raw: string): ParsedBook {
  const lines = raw.split(/\r?\n/);

  // Detect the heading convention, fence-aware.
  const { h1Chapters, h2Chapters, outline, labels } = countConventions(lines);
  const isOutline = h1Chapters + h2Chapters === 0 && outline >= 2;
  const label = h1Chapters + h2Chapters === 0 && !isOutline ? dominantLabel(labels) : null;
  const chapterDepth = h2Chapters > h1Chapters ? 2 : 1;
  const chapterRe = label
    ? labelledChapterRe(label)
    : isOutline
      ? OUTLINE_CHAPTER
      : new RegExp(`^#{${chapterDepth}} Chapter\\s+(\\d+)\\s*[:.]?\\s*(.*)$`);
  const appendixRe = new RegExp(`^#{1,${chapterDepth}} (.+)$`);
  const subDepth = chapterDepth + 1;
  // Outline authors sometimes write sub-chapters as `# 7.1 Title` H1s.
  const extraSubRes = isOutline ? [OUTLINE_H1_SUB] : [];

  type Boundary = { line: number; number: number | null; title: string; part: string | null };
  const boundaries: Boundary[] = [];
  let currentPart: string | null = null;
  const partLines = new Set<number>();

  {
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const part = trimmed.match(PART_RE);
      if (part) {
        currentPart = titleCasePart(part[1]);
        partLines.add(i);
        continue;
      }
      const ch = trimmed.match(chapterRe);
      if (ch) {
        boundaries.push({ line: i, number: parseInt(ch[1], 10), title: ch[2].trim(), part: currentPart });
        continue;
      }
      const app = trimmed.match(appendixRe);
      // Labelled books keep their trailing H1s ("Final Capstone", "Definition
      // of Done") as unnumbered chapters; elsewhere only Appendix/Glossary-
      // style titles graduate from body text to a chapter of their own.
      const trailing = label !== null && boundaries.length > 0;
      if (app && (trailing || APPENDIX_TITLE.test(app[1].trim()))) {
        boundaries.push({ line: i, number: null, title: app[1].trim(), part: currentPart });
      }
    }
  }

  // Book title: first H1 in the preamble region.
  let title: string | null = null;
  const preambleEnd = boundaries.length > 0 ? boundaries[0].line : lines.length;
  {
    let inFence = false;
    for (let i = 0; i < preambleEnd; i++) {
      const trimmed = lines[i].trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (!inFence && /^#\s+\S/.test(trimmed)) {
        title = trimmed.replace(/^#\s+/, "");
        break;
      }
    }
  }
  const preambleMd = joinTrimmed(lines.slice(0, preambleEnd));

  const usedChapterSlugs = new Set<string>();
  const chapters = boundaries.map((b, idx) => {
    const end = idx + 1 < boundaries.length ? boundaries[idx + 1].line : lines.length;
    // PART dividers are dropped from the body; origIndex keeps each kept
    // line's position in the file so sections can report source ranges.
    const bodyLines: string[] = [];
    const origIndex: number[] = [];
    for (let i = b.line + 1; i < end; i++) {
      if (partLines.has(i)) continue;
      bodyLines.push(lines[i]);
      origIndex.push(i);
    }
    const displayTitle = b.title || `${label ?? "Chapter"} ${b.number ?? idx + 1}`;

    let slug = b.number !== null ? `chapter-${String(b.number).padStart(2, "0")}` : slugify(displayTitle);
    let unique = slug;
    for (let n = 2; usedChapterSlugs.has(unique); n++) unique = `${slug}-${n}`;
    usedChapterSlugs.add(unique);

    const chapterNumber = b.number ?? idx + 1;
    return {
      slug: unique,
      number: chapterNumber,
      title: displayTitle,
      fullTitle: b.number !== null ? `${label ?? "Chapter"} ${b.number} — ${displayTitle}` : displayTitle,
      part: b.part,
      introMd: null as string | null,
      preambleMd: null as string | null,
      subchapters: splitByDepth(bodyLines, chapterNumber, subDepth, origIndex, end, extraSubRes, displayTitle),
      sourceStart: b.line,
      // Ends after the last body line kept, so a PART divider that opens
      // the next part is not counted as part of this chapter.
      sourceEnd: lastContentEnd(bodyLines, origIndex, b.line + 1)
    };
  });

  return { title, preambleMd, chapters };
}

function splitByDepth(
  bodyLines: string[],
  chapterNumber: number | null,
  subDepth: number,
  origIndex: number[],
  chapterEnd: number,
  extraSubRes: RegExp[] = [],
  chapterTitle = "Overview"
): SubChapter[] {
  const subRes = [new RegExp(`^#{${subDepth}}\\s+(.+)$`), ...extraSubRes];
  type SubBoundary = { line: number; title: string };
  const subs: SubBoundary[] = [];
  {
    let inFence = false;
    for (let i = 0; i < bodyLines.length; i++) {
      const trimmed = bodyLines[i].trim();
      if (/^(```|~~~)/.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      for (const re of subRes) {
        const h = trimmed.match(re);
        if (h) {
          subs.push({ line: i, title: h[1].trim() });
          break;
        }
      }
    }
  }

  const result: SubChapter[] = [];
  const usedSlugs = new Set<string>();

  const push = (
    rawTitle: string,
    body: string[],
    numbered: boolean,
    sourceStart: number,
    sourceEnd: number,
    explicitNumber?: string
  ) => {
    // Some books number their section headings themselves ("## 5.1 Origin…");
    // the tile chrome already shows the number, so drop it from the title.
    const titleText = rawTitle.replace(/^\d+\.\d+\.?\s+/, "");
    const bodyMd = joinTrimmed(body) ?? "";
    const { tags, hasInterviewBlocks, codeFenceCount } = computeTags(titleText, body);
    const displayNumber =
      explicitNumber ?? (numbered && chapterNumber !== null ? `${chapterNumber}.${result.length + 1}` : "");
    let slug = slugify(displayNumber ? `${displayNumber} ${titleText}` : titleText);
    if (!slug) slug = `section-${result.length + 1}`;
    let unique = slug;
    for (let n = 2; usedSlugs.has(unique); n++) unique = `${slug}-${n}`;
    usedSlugs.add(unique);
    result.push({
      slug: unique,
      number: displayNumber || null,
      displayNumber,
      ordinal: result.length,
      title: titleText,
      mdBody: bodyMd,
      html: "",
      tags,
      hasInterviewBlocks,
      wordCount: countWords(body),
      codeFenceCount,
      excerpt: extractExcerpt(bodyMd),
      sourceStart,
      sourceEnd
    });
  };
  // Exclusive end in file coordinates for a body-local end offset. The last
  // section ends after the last kept body line, so trailing PART dividers
  // (dropped from bodies) never fall inside an editable range.
  const fileEnd = (localEnd: number) =>
    localEnd < bodyLines.length ? origIndex[localEnd] : lastContentEnd(bodyLines, origIndex, chapterEnd);

  // Chapter intro (before the first ##): meaty ones become an "Overview" tile,
  // trivial ones are dropped (they're usually a single transition sentence).
  // A chapter with no sub-chapters at all IS its intro: one section, titled
  // like the chapter and numbered like it, so it stays readable in the zoom
  // view and in reading order.
  const introEnd = subs.length > 0 ? subs[0].line : bodyLines.length;
  const introLines = bodyLines.slice(0, introEnd);
  if (subs.length === 0) {
    if (introLines.some((l) => l.trim() !== "")) {
      push(chapterTitle, introLines, true, origIndex[0], fileEnd(introEnd), chapterNumber !== null ? String(chapterNumber) : "");
    }
  } else if (countWords(introLines) > 25) {
    push("Overview", introLines, true, origIndex[0], fileEnd(introEnd));
  }

  for (let i = 0; i < subs.length; i++) {
    const end = i + 1 < subs.length ? subs[i + 1].line : bodyLines.length;
    push(subs[i].title, bodyLines.slice(subs[i].line + 1, end), true, origIndex[subs[i].line], fileEnd(end));
  }
  return result;
}

// Exclusive file line after the last non-blank kept body line; trailing
// blanks and dropped PART dividers stay outside every editable range.
function lastContentEnd(bodyLines: string[], origIndex: number[], fallback: number): number {
  for (let k = bodyLines.length - 1; k >= 0; k--) {
    if (bodyLines[k].trim() !== "") return origIndex[k] + 1;
  }
  return fallback;
}

function titleCasePart(text: string): string {
  // "PART III: FOUNDATIONS -- HOW X WORKS" reads badly in chips; keep roman
  // numerals, title-case the shouting. Mixed-case parts ("Part I: SQL
  // Essentials") pass through untouched so acronyms survive.
  const normalized = text.replace(/\s*--\s*/g, " — ");
  const letters = normalized.replace(/[^A-Za-z]/g, "");
  if (letters !== letters.toUpperCase()) return normalized;
  return normalized.replace(/[A-Z][A-Z']+/g, (w) =>
    /^[IVX]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()
  );
}

function joinTrimmed(bodyLines: string[]): string | null {
  let start = 0;
  let end = bodyLines.length;
  const isNoise = (l: string) => l.trim() === "" || /^-{3,}$/.test(l.trim());
  while (start < end && isNoise(bodyLines[start])) start++;
  while (end > start && isNoise(bodyLines[end - 1])) end--;
  return end > start ? bodyLines.slice(start, end).join("\n") : null;
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
