export type Tag = "interview" | "cheatsheet" | "teaser" | "code";

export type ParserOverrides = {
  /** Drop trailing ChatGPT citation blocks ([1]: https://…). Default true. */
  stripFootnotes?: boolean;
  /** Regex source for the chapter-title heading. Default matches "Module N — Title" at depth 1–2. */
  chapterTitlePattern?: string;
  /** Filter garbage unnumbered H1 pull-quotes out of boundary candidates. Default true. */
  pullQuoteHeuristic?: boolean;
  /** Explicit chapter file order; default is filename sort. */
  fileOrder?: string[];
};

export type BookConfig = {
  id: string;
  title: string;
  path: string;
  /** "files": folder of chapter .md files (default). "single-file": one book.md. */
  mode?: "files" | "single-file";
  description?: string;
  accent?: string;
  parser?: ParserOverrides;
};

export interface SubChapter {
  slug: string;
  /** "5.2" — null for unnumbered trailing sections (cheat sheets, codas). */
  number: string | null;
  /** Same as number, but bare ordinals ("# 7. Vars") composed as "1.7". Empty for unnumbered. */
  displayNumber: string;
  /** 0-based position within the chapter, filter-independent. */
  ordinal: number;
  title: string;
  /** Body markdown WITHOUT its own heading line. Present in parser output;
      loadBook blanks it after rendering so raw source never reaches routes. */
  mdBody: string;
  html: string;
  tags: Tag[];
  /** Q&A blocks embedded inside a teaching section (second filter tier). */
  hasInterviewBlocks: boolean;
  wordCount: number;
  codeFenceCount: number;
  excerpt: string | null;
}

export interface Chapter {
  /** Filename minus .md, e.g. "module-01". */
  slug: string;
  number: number;
  /** "MuleSoft Mental Model" — the part after the em dash. */
  title: string;
  /** "Module 1 — MuleSoft Mental Model". */
  fullTitle: string;
  file: string;
  mtimeMs: number;
  /** Rendered HTML of content between the chapter heading and the first sub-chapter. */
  introHtml: string | null;
  /** Rendered HTML of content BEFORE the chapter heading (a book-wide TOC/front matter). */
  preambleHtml: string | null;
  /** "Part III — Foundations" divider label (single-file books). */
  part?: string | null;
  subchapters: SubChapter[];
}

export interface Book {
  id: string;
  title: string;
  description?: string;
  dir: string;
  mode: "files" | "single-file";
  coverUrl?: string;
  accent?: string;
  chapters: Chapter[];
  tagCounts: Record<Tag, number>;
}
