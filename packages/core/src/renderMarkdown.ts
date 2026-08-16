import { marked } from "marked";

// Server-side markdown → HTML for ChatGPT-exported book content.
// Cleanup passes are corpus-specific: citation residue, heading demotion,
// blockquotes-as-model-answers, ASCII-diagram detection.

export type RenderOpts = { assetBase?: string };

export function renderSubChapterHtml(markdown: string, opts: RenderOpts = {}): string {
  const cleaned = cleanSource(markdown);
  let html = marked.parse(cleaned, markedOptions(opts)) as string;

  // In-body headings sit under page-chrome titles; demote 2 levels so the
  // article scale stays consistent regardless of source depth (h1→h3 … h4→h6).
  html = html.replace(/(<\/?)h([1-4])\b/g, (_m, open: string, d: string) => {
    return `${open}h${Math.min(Number(d) + 2, 6)}`;
  });

  // Blockquotes in this corpus are "say this in the interview" model answers.
  html = html.replaceAll("<blockquote>", '<blockquote class="answer">');

  return html;
}

export function renderPlainHtml(markdown: string, opts: RenderOpts = {}): string {
  return marked.parse(cleanSource(markdown), markedOptions(opts)) as string;
}

/**
 * Fence-aware source cleanup:
 * - strip inline ChatGPT citation refs `([Label][1])` (their definitions are
 *   removed by the parser, so they'd render as dead literal text)
 * - strip single-line HTML comments: the renderer escapes literal HTML, so
 *   authoring tags (`<!--fig …-->`, `<!--explain …-->`) would otherwise show
 *   as text. Dropping them here keeps unprocessed tags invisible to readers.
 */
function cleanSource(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    const cleaned = line.replace(/\s*\(\[[^\]]+\]\[\d+\]\)/g, "").replace(/<!--.*?-->/g, "");
    // A line that was only a comment vanishes entirely (no stray blank paragraph).
    if (cleaned.trim() === "" && line.trim() !== "") continue;
    out.push(cleaned);
  }
  return out.join("\n");
}

function markedOptions(opts: RenderOpts = {}) {
  const renderer = new marked.Renderer();

  // Relative image paths resolve against the book's asset route so books can
  // carry their own images (covers, diagrams) next to the markdown.
  renderer.image = ({ href, title, text }) => {
    let src = href ?? "";
    if (!/^(https?:)?\/\//i.test(src) && !src.startsWith("/") && opts.assetBase) {
      src = opts.assetBase + src.split("/").map(encodeURIComponent).join("/");
    }
    const titleAttr = title ? ` title="${escapeHtmlAttr(title)}"` : "";
    return `<img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(text ?? "")}"${titleAttr} loading="lazy" />`;
  };

  renderer.link = ({ href, title, text }) => {
    let rawHref = href ?? "";
    try {
      const url = new URL(rawHref);
      url.searchParams.delete("utm_source");
      rawHref = url.toString();
    } catch {
      // relative/anchor href — keep as-is
    }
    // Scheme allow-list: only web links, mail, anchors, and relative paths.
    if (!/^(https?:\/\/|mailto:|#|\/|\.)/i.test(rawHref)) {
      return text;
    }
    const rawTitle = title ? ` title="${escapeHtmlAttr(title)}"` : "";
    const external = /^https?:\/\//.test(rawHref);
    const target = external ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${escapeHtmlAttr(rawHref)}"${rawTitle}${target}>${text}</a>`;
  };

  // The corpus is plain markdown; literal HTML in the source is rendered as
  // text rather than passed through to dangerouslySetInnerHTML.
  renderer.html = ({ text }) => escapeHtmlText(text);

  // Box-drawing/arrow diagrams get a class so CSS renders the whole block in
  // one full-coverage monospace font (column alignment breaks otherwise).
  renderer.code = ({ text, lang }) => {
    const isDiagram = /[←-⇿─-◿]/.test(text) || !lang || lang === "text";
    const cls = isDiagram && /[←-⇿─-◿]/.test(text) ? ' class="diagram"' : "";
    const langCls = lang ? ` class="language-${escapeHtmlAttr(lang)}"` : "";
    const badge = lang && lang !== "text" ? ` data-lang="${escapeHtmlAttr(lang)}"` : "";
    return `<pre${cls}${badge}><code${langCls}>${escapeHtmlText(text)}\n</code></pre>\n`;
  };

  return { gfm: true, breaks: false, renderer, async: false as const };
}

/**
 * Plain-text excerpt from a sub-chapter body: first paragraph or blockquote,
 * markdown stripped, ~140 chars at a word boundary. Used on tiles.
 */
export function extractExcerpt(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  const paragraph: string[] = [];

  const finish = (parts: string[]): string | null => {
    const text = stripInlineMarkdown(parts.join(" ")).replace(/\s+/g, " ").trim();
    return text.length > 0 ? truncateAtWordBoundary(text, 140) : null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      if (paragraph.length > 0) return finish(paragraph);
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (trimmed === "") {
      if (paragraph.length > 0) return finish(paragraph);
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) continue;
    if (trimmed.startsWith("<!--")) continue;
    if (paragraph.length === 0 && (trimmed.startsWith("|") || trimmed.startsWith("!["))) continue;
    paragraph.push(trimmed.replace(/^>\s?/, ""));
  }
  return paragraph.length > 0 ? finish(paragraph) : null;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\s*\(\[[^\]]+\]\[\d+\]\)/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\b_([^_]+)_\b/g, "$1");
}

function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

function escapeHtmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtmlAttr(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
