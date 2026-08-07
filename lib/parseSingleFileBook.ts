import type { Chapter, SubChapter } from "./types";
import { computeTags } from "./tags";
import { slugify } from "./slugs";
import { extractExcerpt } from "./renderMarkdown";

// Parser profile for well-formed single-file books (one big book.md).
// Two depth conventions exist in the corpus and are auto-detected per book:
//   A: chapters `# Chapter N: Title` (H1), sub-chapters `##`
//   B: chapters `## Chapter N: Title` (H2), sub-chapters `###`
// `# PART ...` / `# Part ...` H1s are section dividers in both conventions —
// they become a `part` label on following chapters. Appendix/Glossary-style
// trailing headings at the chapter depth (or H1) are unnumbered chapters.
// Unrecognized headings (stray code comments outside fences) stay in the body.

const APPENDIX_TITLE = /^(Appendix\s+[A-Z][:.]?\s*.*|Glossary\b.*|Conclusion\b.*|Epilogue\b.*|Bibliography\b.*|Further Reading\b.*|Index\b.*)$/;
const PART_RE = /^# ((?:PART|Part)\b.*)$/;

export type ParsedBook = {
  title: string | null;
  preambleMd: string | null;
  chapters: Omit<Chapter, "file" | "mtimeMs">[];
};

export function parseSingleFileBook(raw: string): ParsedBook {
  const lines = raw.split(/\r?\n/);

  // Detect the chapter heading depth (convention A vs B), fence-aware.
  let h1Chapters = 0;
  let h2Chapters = 0;
  {
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
    }
  }
  const chapterDepth = h2Chapters > h1Chapters ? 2 : 1;
  const chapterRe = new RegExp(`^#{${chapterDepth}} Chapter\\s+(\\d+)\\s*[:.]?\\s*(.*)$`);
  const appendixRe = new RegExp(`^#{1,${chapterDepth}} (.+)$`);
  const subDepth = chapterDepth + 1;

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
      if (app && APPENDIX_TITLE.test(app[1].trim())) {
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
    const bodyLines = lines
      .slice(b.line + 1, end)
      .filter((_, off) => !partLines.has(b.line + 1 + off));
    const displayTitle = b.title || `Chapter ${b.number ?? idx + 1}`;

    let slug = b.number !== null ? `chapter-${String(b.number).padStart(2, "0")}` : slugify(displayTitle);
    let unique = slug;
    for (let n = 2; usedChapterSlugs.has(unique); n++) unique = `${slug}-${n}`;
    usedChapterSlugs.add(unique);

    const chapterNumber = b.number ?? idx + 1;
    return {
      slug: unique,
      number: chapterNumber,
      title: displayTitle,
      fullTitle: b.number !== null ? `Chapter ${b.number} — ${displayTitle}` : displayTitle,
      part: b.part,
      introMd: null as string | null,
      preambleMd: null as string | null,
      subchapters: splitByDepth(bodyLines, chapterNumber, subDepth)
    };
  });

  return { title, preambleMd, chapters };
}

function splitByDepth(
  bodyLines: string[],
  chapterNumber: number | null,
  subDepth: number
): SubChapter[] {
  const subRe = new RegExp(`^#{${subDepth}}\\s+(.+)$`);
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
      const h = trimmed.match(subRe);
      if (h) subs.push({ line: i, title: h[1].trim() });
    }
  }

  const result: SubChapter[] = [];
  const usedSlugs = new Set<string>();

  const push = (rawTitle: string, body: string[], numbered: boolean) => {
    // Some books number their section headings themselves ("## 5.1 Origin…");
    // the tile chrome already shows the number, so drop it from the title.
    const titleText = rawTitle.replace(/^\d+\.\d+\.?\s+/, "");
    const bodyMd = joinTrimmed(body) ?? "";
    const { tags, hasInterviewBlocks, codeFenceCount } = computeTags(titleText, body);
    const displayNumber =
      numbered && chapterNumber !== null ? `${chapterNumber}.${result.length + 1}` : "";
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
      excerpt: extractExcerpt(bodyMd)
    });
  };

  // Chapter intro (before the first ##): meaty ones become an "Overview" tile,
  // trivial ones are dropped (they're usually a single transition sentence).
  const introEnd = subs.length > 0 ? subs[0].line : bodyLines.length;
  const introLines = bodyLines.slice(0, introEnd);
  if (countWords(introLines) > 25) push("Overview", introLines, true);

  for (let i = 0; i < subs.length; i++) {
    const end = i + 1 < subs.length ? subs[i + 1].line : bodyLines.length;
    push(subs[i].title, bodyLines.slice(subs[i].line + 1, end), true);
  }
  return result;
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
