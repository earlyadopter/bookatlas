import fs from "node:fs";
import path from "node:path";
import { musicFigureSvg, parseNoteSequence, parseProgression, progressionDiagramSvg } from "@bookatlas/core";

// Generates textbook-style music figures (SVG) for a folder of chapter .md
// files and injects standard markdown image refs after the source lines.
//
//   pnpm illustrate /path/to/book [--dry]
//
// Detected patterns (outside code fences, standalone lines):
//   **Cmaj7 = C E G B**            → keyboard diagram, captioned
//   ### Cmaj7  +  **C E G B**      → keyboard diagram, captioned with the chord
//   **ii–V–I** / I – IV – V – I    → boxed progression diagram
//
// Figures land in <book>/images/<mdbase>-<serial>.svg ("Figure <chapter>.<serial>"
// captions). Re-runs are idempotent: previously injected refs are stripped and
// everything is re-derived, so renumbering stays consistent as chapters grow.

const CHORD_LABEL_RE = /^[A-G][#♯b♭]?(?:maj|min|m|dim|aug|sus[24]?|add[0-9]+|[0-9])*[0-9]?(?:\/[A-G][#♯b♭]?)?$/;

type Figure = { afterLine: number; svg: string; alt: string };

function detectFigures(lines: string[], chapterNum: number, startSerial: { n: number }): Figure[] {
  const figures: Figure[] = [];
  // One figure per distinct content per chapter — the text re-spells the
  // same chords for reinforcement; the figure only needs to appear once.
  const seen = new Set<string>();
  let inFence = false;
  let lastChordHeading: string | null = null;
  let lastChordHeadingLine = -10;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const text = heading[1].trim();
      if (CHORD_LABEL_RE.test(text)) {
        lastChordHeading = text;
        lastChordHeadingLine = i;
      } else {
        lastChordHeading = null;
      }
      continue;
    }

    const makeFigure = (svg: string | null, alt: string) => {
      if (!svg || seen.has(alt)) return;
      seen.add(alt);
      startSerial.n++;
      figures.push({ afterLine: i, svg, alt });
    };
    const figureLabel = () => `Figure ${chapterNum}.${startSerial.n + 1}`;

    // **Chord = notes**
    const eq = line.match(/^\*\*([^*=]{1,14}?)\s*=\s*([A-Ga-g#♯b♭ ,–-]{3,40})\*\*$/);
    if (eq && CHORD_LABEL_RE.test(eq[1].trim()) && parseNoteSequence(eq[2])) {
      const caption = `${eq[1].trim()} = ${eq[2].trim()}`;
      makeFigure(musicFigureSvg(eq[2], { caption, figureLabel: figureLabel() }), caption);
      continue;
    }

    // **C E G B** (bare note run; captioned by a nearby chord heading)
    const run = line.match(/^\*\*([A-Ga-g#♯b♭ ,–-]{3,40})\*\*$/);
    if (run && parseNoteSequence(run[1])) {
      const near = lastChordHeading && i - lastChordHeadingLine <= 4 ? lastChordHeading : null;
      const caption = near ? `${near} = ${run[1].trim()}` : run[1].trim();
      makeFigure(musicFigureSvg(run[1], { caption, figureLabel: figureLabel() }), caption);
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

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry");
  const bookDir = args[0];
  if (!bookDir || !fs.existsSync(bookDir)) {
    console.error("usage: pnpm illustrate /path/to/book [--dry]");
    process.exit(1);
  }
  const imagesDir = path.join(bookDir, "images");
  const mdFiles = fs
    .readdirSync(bookDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .sort((a, b) => a.localeCompare(b));

  let totalFigures = 0;
  const written = new Set<string>();

  for (const file of mdFiles) {
    const mdBase = file.replace(/\.md$/i, "");
    const chapterNum = parseInt(mdBase.match(/(\d+)/)?.[1] ?? "0", 10);
    const raw = fs.readFileSync(path.join(bookDir, file), "utf8");

    // Strip previously injected refs (self-healing renumbering).
    const refRe = new RegExp(`^!\\[[^\\]]*\\]\\(images/${mdBase}-\\d+\\.svg\\)\\s*$`);
    const lines = raw.split("\n").filter((l) => !refRe.test(l.trim()));

    const serial = { n: 0 };
    const figures = detectFigures(lines, chapterNum, serial);
    if (figures.length === 0) continue;

    if (!dry && !fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);
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
    console.log(`  ${file}: ${figures.length} figure${figures.length === 1 ? "" : "s"}`);
  }

  // Remove orphaned SVGs from earlier runs.
  if (!dry && fs.existsSync(imagesDir)) {
    for (const f of fs.readdirSync(imagesDir)) {
      if (/\.svg$/.test(f) && !written.has(f)) fs.unlinkSync(path.join(imagesDir, f));
    }
  }

  console.log(`${dry ? "[dry] " : ""}${totalFigures} figures across ${mdFiles.length} files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
