import fs from "node:fs";
import path from "node:path";
import {
  chordSymbolNotes,
  grandStaffSvg,
  keyboardDiagramSvg,
  musicFigureSvg,
  parseNoteSequence,
  parseProgression,
  progressionDiagramSvg
} from "@bookatlas/core";

// Generates textbook-style music figures (SVG) for a folder of chapter .md
// files and injects standard markdown image refs after the source lines.
//
//   pnpm illustrate /path/to/book [--dry]
//
// Auto-detected patterns (outside code fences, standalone lines):
//   **Cmaj7 = C E G B**            → keyboard diagram, captioned
//   ### Cmaj7  +  **C E G B**      → keyboard diagram, captioned with the chord
//   **ii–V–I** / I – IV – V – I    → boxed progression diagram
//
// Authoring tags (single-line HTML comments — invisible on the site, the tag
// stays in the source and its figure is injected after it):
//   <!--fig melody: C C G G A A G-->        staff, melodic register
//   <!--fig melody: C D E | bass-->         bass clef (left hand)
//   <!--fig melody: C D E | keys-->         staff + keyboard with dots
//   <!--fig chord: Cmaj7-->                 spelled chord: stacked staff + keyboard
//   <!--fig chord: C E G B | bass-->        explicit notes, left-hand register
//   <!--fig keys: C E G-->                  keyboard only
//   <!--fig hands: C E G / C G-->           grand staff, right hand / left hand
//   <!--fig progression: I - vi - ii - V--> boxed progression
//   … any of the above  | caption: text     override the caption
//   <!--explain: note to self-->            collected into about-explain-report.md
//
// Song auto-linking: if <book>/workshops-songbook.md exists, its table rows
// ("Title … youtube URL") drive linking — the first quoted mention of each
// song title per chapter file becomes a link to its canonical recording.
//
// Figures land in <book>/images/<mdbase>-<serial>.svg ("Figure <chapter>.<serial>"
// captions). Re-runs are idempotent: previously injected refs are stripped and
// everything is re-derived, so renumbering stays consistent as chapters grow.

const CHORD_LABEL_RE = /^[A-G][#♯b♭]?(?:maj|min|m|dim|aug|sus[24]?|add[0-9]+|[0-9])*[0-9]?(?:\/[A-G][#♯b♭]?)?$/;

type Figure = { afterLine: number; svg: string; alt: string };
type ExplainItem = { file: string; line: number; heading: string; note: string };
type TagProblem = { file: string; line: number; tag: string; reason: string };

const FIG_TAG_RE = /^<!--\s*fig\s+(melody|chord|keys|hands|progression)\s*:\s*(.+?)\s*-->$/;
const EXPLAIN_TAG_RE = /<!--\s*explain\s*:?\s*(.*?)\s*-->/;

/** Renders one authoring tag into SVG, or a string reason on failure. */
function renderFigTag(
  kind: string,
  payload: string,
  figureLabel: string
): { svg: string; caption: string } | string {
  const segments = payload.split("|").map((s) => s.trim());
  const main = segments[0];
  const flags = segments.slice(1);
  const bass = flags.some((f) => /^bass$/i.test(f));
  const keys = flags.some((f) => /^keys$/i.test(f));
  const captionFlag = flags.find((f) => /^caption\s*:/i.test(f))?.replace(/^caption\s*:\s*/i, "");

  switch (kind) {
    case "melody": {
      const caption = captionFlag ?? main;
      const svg = musicFigureSvg(main, {
        sequence: true,
        clef: bass ? "bass" : undefined,
        keyboard: keys,
        caption,
        figureLabel
      });
      return svg ? { svg, caption } : `not a playable note sequence: "${main}"`;
    }
    case "chord": {
      const spelled = CHORD_LABEL_RE.test(main) ? chordSymbolNotes(main) : null;
      const notes = spelled ?? main;
      if (!parseNoteSequence(notes)) return `not a chord symbol or note list: "${main}"`;
      const caption = captionFlag ?? (spelled ? `${main} = ${spelled}` : main);
      const svg = musicFigureSvg(notes, { clef: bass ? "bass" : undefined, caption, figureLabel });
      return svg ? { svg, caption } : `could not render chord: "${main}"`;
    }
    case "keys": {
      const caption = captionFlag ?? main;
      const svg = keyboardDiagramSvg(main, { caption, figureLabel });
      return svg ? { svg, caption } : `not a note list: "${main}"`;
    }
    case "hands": {
      const [rh, lh] = main.split("/").map((s) => s.trim());
      if (!rh || !lh) return `hands needs "right / left": "${main}"`;
      const caption = captionFlag ?? `RH ${rh} · LH ${lh}`;
      const svg = grandStaffSvg(rh, lh, { caption, figureLabel });
      return svg ? { svg, caption } : `could not render hands: "${main}"`;
    }
    case "progression": {
      const items = parseProgression(main);
      if (!items) return `not a progression (3–8 items): "${main}"`;
      const caption = captionFlag ?? items.join(" → ");
      const svg = progressionDiagramSvg(items, { caption, figureLabel });
      return svg ? { svg, caption } : `could not render progression: "${main}"`;
    }
  }
  return `unknown fig kind "${kind}"`;
}

/** Dedup key: the notes themselves, separators normalized away. */
function normalizeNotes(text: string): string {
  return text.trim().split(/(?:\s*(?:→|->|—>)\s*|[\s,–-]+)/).filter(Boolean).join(" ");
}

function detectFigures(
  lines: string[],
  chapterNum: number,
  startSerial: { n: number },
  ctx: { file: string; explains: ExplainItem[]; problems: TagProblem[] }
): Figure[] {
  const figures: Figure[] = [];
  // One figure per distinct musical content per SECTION (the atlas is read
  // nonlinearly — a repeat in a later section gets its own figure again).
  let seen = new Set<string>();
  let inFence = false;
  let lastChordHeading: string | null = null;
  let lastChordHeadingLine = -10;
  let lastHeadingText = "(top of file)";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const text = heading[2].trim();
      lastHeadingText = text;
      // H1/H2 delimit sections — reset the dedup window.
      if (heading[1].length <= 2) seen = new Set<string>();
      if (CHORD_LABEL_RE.test(text)) {
        lastChordHeading = text;
        lastChordHeadingLine = i;
      } else {
        lastChordHeading = null;
      }
      continue;
    }

    // Authoring tags first — explicit intent bypasses auto-detection dedup.
    const explain = line.match(EXPLAIN_TAG_RE);
    if (explain) {
      ctx.explains.push({ file: ctx.file, line: i + 1, heading: lastHeadingText, note: explain[1] || "(no note)" });
      continue;
    }
    const figTag = line.match(FIG_TAG_RE);
    if (figTag) {
      startSerial.n++;
      const rendered = renderFigTag(figTag[1], figTag[2], `Figure ${chapterNum}.${startSerial.n}`);
      if (typeof rendered === "string") {
        startSerial.n--;
        ctx.problems.push({ file: ctx.file, line: i + 1, tag: line, reason: rendered });
      } else {
        figures.push({ afterLine: i, svg: rendered.svg, alt: rendered.caption });
      }
      continue;
    }

    const makeFigure = (svg: string | null, alt: string, dedupKey?: string) => {
      const key = dedupKey ?? alt;
      if (!svg || seen.has(key)) return;
      seen.add(key);
      startSerial.n++;
      figures.push({ afterLine: i, svg, alt });
    };
    const figureLabel = () => `Figure ${chapterNum}.${startSerial.n + 1}`;

    // **Am** / **E7** — a standalone chord symbol spells itself.
    const bare = line.match(/^\*\*([A-G][#♯b♭]?[a-zA-Z0-9°ø+]{1,7})\*\*$/);
    if (bare) {
      const spelled = chordSymbolNotes(bare[1]);
      if (spelled) {
        const caption = `${bare[1]} = ${spelled}`;
        makeFigure(musicFigureSvg(spelled, { caption, figureLabel: figureLabel() }), caption, spelled);
        continue;
      }
    }

    // **Chord = notes**
    const eq = line.match(/^\*\*([^*=]{1,14}?)\s*=\s*([A-Ga-g#♯b♭ ,–-]{3,40})\*\*$/);
    if (eq && CHORD_LABEL_RE.test(eq[1].trim()) && parseNoteSequence(eq[2])) {
      const caption = `${eq[1].trim()} = ${eq[2].trim()}`;
      makeFigure(musicFigureSvg(eq[2], { caption, figureLabel: figureLabel() }), caption, normalizeNotes(eq[2]));
      continue;
    }

    // **C E G B** (bare note run; captioned by a nearby chord heading)
    const run = line.match(/^\*\*([A-Ga-g#♯b♭ ,–→>-]{3,40})\*\*$/);
    if (run && parseNoteSequence(run[1])) {
      const near = lastChordHeading && i - lastChordHeadingLine <= 4 ? lastChordHeading : null;
      const caption = near ? `${near} = ${run[1].trim()}` : run[1].trim();
      const isMotion = /→|->/.test(run[1]);
      makeFigure(
        musicFigureSvg(run[1], { caption, figureLabel: figureLabel(), sequence: isMotion }),
        caption,
        normalizeNotes(run[1])
      );
      continue;
    }

    // Standalone progression (roman numerals or chord names, 3–8 items)
    if (/^(\*\*)?[A-Za-z#♯b♭°oø0-9/]+(\s*(?:→|—>|->|–|—|>)\s*| - )/.test(line)) {
      const items = parseProgression(line);
      if (items) {
        const caption = items.join(" → ");
        makeFigure(progressionDiagramSvg(items, { caption, figureLabel: figureLabel() }), caption);
        continue;
      }
    }
  }
  return figures;
}

type Song = { title: string; url: string };

/** Rows of workshops-songbook.md: first cell = title, first YouTube URL wins. */
function loadSongbook(bookDir: string): Song[] {
  const file = path.join(bookDir, "workshops-songbook.md");
  if (!fs.existsSync(file)) return [];
  const songs: Song[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const url = line.match(/https:\/\/www\.youtube\.com\/watch\?v=[\w-]+/)?.[0];
    if (!url) continue;
    const title = line
      .split("|")[1]
      ?.replace(/\*\*/g, "")
      .replace(/[“”"]/g, "")
      .trim();
    if (title) songs.push({ title, url });
  }
  // Longest first so "Mack the Knife" wins over any shorter overlapping title.
  return songs.sort((a, b) => b.title.length - a.title.length);
}

/**
 * Links the first quoted mention (“Title”) of each song per file to its
 * canonical recording. Durable edit: once a link exists the song is skipped,
 * so re-runs and hand-tuned links are safe.
 */
function linkSongs(lines: string[], songs: Song[]): number {
  let inFence = false;
  const skip = lines.map((l) => {
    if (/^(```|~~~)/.test(l.trim())) {
      inFence = !inFence;
      return true;
    }
    return inFence;
  });
  let count = 0;
  for (const s of songs) {
    if (lines.some((l) => l.includes(`[“${s.title}`))) continue;
    const escaped = s.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`“(${escaped})([.,!?…]?)”`);
    for (let i = 0; i < lines.length; i++) {
      if (skip[i]) continue;
      const t = lines[i].trim();
      if (t.startsWith("#") || t.startsWith("![") || t.startsWith("<!--")) continue;
      if (re.test(lines[i])) {
        lines[i] = lines[i].replace(re, `[“$1$2”](${s.url})`);
        count++;
        break;
      }
    }
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry");
  const bookDir = args[0];
  if (!bookDir || !fs.existsSync(bookDir)) {
    console.error("usage: pnpm illustrate /path/to/book [--dry]");
    process.exit(1);
  }
  const imagesDir = path.join(bookDir, "images");
  // Chapters carry numbers (module-01, workshop-003, …); digitless .md files
  // are notes/front-matter and are left untouched.
  const mdFiles = fs
    .readdirSync(bookDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith(".") && /\d/.test(f))
    .sort((a, b) => a.localeCompare(b));

  let totalFigures = 0;
  let totalLinks = 0;
  const written = new Set<string>();
  const explains: ExplainItem[] = [];
  const problems: TagProblem[] = [];
  const songs = loadSongbook(bookDir);

  for (const file of mdFiles) {
    const mdBase = file.replace(/\.md$/i, "");
    const chapterNum = parseInt(mdBase.match(/(\d+)/)?.[1] ?? "0", 10);
    const raw = fs.readFileSync(path.join(bookDir, file), "utf8");

    // Strip previously injected refs (self-healing renumbering).
    const refRe = new RegExp(`^!\\[[^\\]]*\\]\\(images/${mdBase}-\\d+\\.svg\\)\\s*$`);
    const lines = raw.split("\n").filter((l) => !refRe.test(l.trim()));

    const serial = { n: 0 };
    const figures = detectFigures(lines, chapterNum, serial, { file, explains, problems });
    const links = songs.length > 0 ? linkSongs(lines, songs) : 0;
    totalLinks += links;
    if (figures.length === 0 && links === 0) continue;

    if (!dry && figures.length > 0 && !fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);
    // Insert bottom-up so line indexes stay valid.
    let out = [...lines];
    figures
      .map((fig, idx) => ({ ...fig, serial: idx + 1 }))
      .sort((a, b) => b.afterLine - a.afterLine)
      .forEach((fig) => {
        const name = `${mdBase}-${String(fig.serial).padStart(2, "0")}.svg`;
        if (!dry) fs.writeFileSync(path.join(imagesDir, name), fig.svg);
        written.add(name);
        out.splice(fig.afterLine + 1, 0, "", `![${fig.alt}](images/${name})`);
      });

    if (!dry) fs.writeFileSync(path.join(bookDir, file), out.join("\n"));
    totalFigures += figures.length;
    const linkNote = links > 0 ? `, ${links} song link${links === 1 ? "" : "s"}` : "";
    console.log(`  ${file}: ${figures.length} figure${figures.length === 1 ? "" : "s"}${linkNote}`);
  }

  // Remove orphaned SVGs from earlier runs.
  if (!dry && fs.existsSync(imagesDir)) {
    for (const f of fs.readdirSync(imagesDir)) {
      if (/\.svg$/.test(f) && !written.has(f)) fs.unlinkSync(path.join(imagesDir, f));
    }
  }

  // Explain-report: everything the author tagged as needing more depth, plus
  // any fig tags that failed to render. "about-" prefix keeps it off the site.
  const reportPath = path.join(bookDir, "about-explain-report.md");
  if (explains.length > 0 || problems.length > 0) {
    const report: string[] = ["# Explain report", "", `Generated by \`pnpm illustrate\`. Do not edit — edit the tags instead.`, ""];
    if (explains.length > 0) {
      report.push(`## Concepts marked "explanation needed" (${explains.length})`, "");
      for (const e of explains) report.push(`- **${e.file}:${e.line}** — _${e.heading}_ — ${e.note}`);
      report.push("");
    }
    if (problems.length > 0) {
      report.push(`## Fig tags that could not render (${problems.length})`, "");
      for (const p of problems) report.push(`- **${p.file}:${p.line}** — \`${p.tag}\` — ${p.reason}`);
      report.push("");
    }
    if (!dry) fs.writeFileSync(reportPath, report.join("\n"));
    console.log(
      `${dry ? "[dry] " : ""}explain report: ${explains.length} note${explains.length === 1 ? "" : "s"}, ${problems.length} bad tag${problems.length === 1 ? "" : "s"} → about-explain-report.md`
    );
  } else if (!dry && fs.existsSync(reportPath)) {
    fs.unlinkSync(reportPath);
  }

  const songNote = songs.length > 0 ? `, ${totalLinks} song links (${songs.length} songs in songbook)` : "";
  console.log(`${dry ? "[dry] " : ""}${totalFigures} figures across ${mdFiles.length} files${songNote}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
