// Music-diagram SVG generation, in the black-and-white piano-textbook idiom:
// keyboard diagrams with ringed keys, and boxed roman-numeral progressions
// with arrows. Pure string → SVG, no dependencies — usable by the illustrate
// CLI, by embedders, and (later) at render time for fenced music blocks.

const NOTE_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
// Black key after white index i (C→C#, D→D#, F→F#, G→G#, A→A#).
const BLACK_AFTER_WHITE = new Set([0, 1, 3, 4, 5]);

export type ParsedNote = { letter: string; accidental: "" | "#" | "b"; semitone: number };

export function parseNote(token: string): ParsedNote | null {
  const m = token.trim().match(/^([A-Ga-g])([#♯b♭]?)$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2] === "♯" || m[2] === "#" ? "#" : m[2] === "♭" || m[2] === "b" ? "b" : "";
  let semitone = NOTE_SEMITONES[letter];
  if (accidental === "#") semitone = (semitone + 1) % 12;
  if (accidental === "b") semitone = (semitone + 11) % 12;
  return { letter, accidental, semitone };
}

/** "C E G B♭" → ascending absolute semitones from an implicit low C. */
export function parseNoteSequence(text: string): { notes: ParsedNote[]; absolute: number[] } | null {
  const tokens = text.trim().split(/[\s,–-]+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 10) return null;
  const notes: ParsedNote[] = [];
  for (const t of tokens) {
    const n = parseNote(t);
    if (!n) return null;
    notes.push(n);
  }
  const absolute: number[] = [];
  let octave = 0;
  let prev = -1;
  for (const n of notes) {
    if (n.semitone <= prev % 12 && prev !== -1) octave++;
    const abs = octave * 12 + n.semitone;
    absolute.push(abs <= prev ? abs + 12 : abs);
    prev = absolute[absolute.length - 1];
    octave = Math.floor(prev / 12);
  }
  return { notes, absolute };
}

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const FONT = `font-family="ui-sans-serif, system-ui, sans-serif"`;

export type KeyboardDiagramOpts = {
  /** Caption under the keyboard, e.g. "Cmaj7 = C E G B". */
  caption?: string;
  /** Figure label rendered bold before the caption, e.g. "Figure 10.3". */
  figureLabel?: string;
};

/** Textbook keyboard diagram with the given notes ringed. */
export function keyboardDiagramSvg(noteText: string, opts: KeyboardDiagramOpts = {}): string | null {
  const seq = parseNoteSequence(noteText);
  if (!seq) return null;
  const { absolute } = seq;

  const maxAbs = Math.max(...absolute);
  const octaves = Math.max(2, Math.ceil((maxAbs + 1) / 12));
  const WHITE_W = 26;
  const WHITE_H = 104;
  const BLACK_W = 16;
  const BLACK_H = 66;
  const whiteCount = octaves * 7;
  const width = whiteCount * WHITE_W;
  const captionH = opts.caption || opts.figureLabel ? 34 : 10;
  const height = WHITE_H + captionH;

  const marked = new Set(absolute);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 4} ${height + 4}" width="${width + 4}" height="${height + 4}">`
  );
  parts.push(`<g transform="translate(2 2)" stroke="#000" fill="none" stroke-width="1.5">`);

  // White keys (with marker rings on marked white notes).
  for (let w = 0; w < whiteCount; w++) {
    const x = w * WHITE_W;
    parts.push(`<rect x="${x}" y="0" width="${WHITE_W}" height="${WHITE_H}" fill="#fff"/>`);
    const abs = Math.floor(w / 7) * 12 + WHITE_SEMITONES[w % 7];
    if (marked.has(abs)) {
      parts.push(`<circle cx="${x + WHITE_W / 2}" cy="${WHITE_H - 18}" r="7.5" stroke-width="1.8"/>`);
    }
  }
  // Black keys (marked ones get a white ring near the bottom).
  for (let w = 0; w < whiteCount; w++) {
    if (!BLACK_AFTER_WHITE.has(w % 7)) continue;
    if (w === whiteCount - 1) continue;
    const x = (w + 1) * WHITE_W - BLACK_W / 2;
    parts.push(`<rect x="${x}" y="0" width="${BLACK_W}" height="${BLACK_H}" fill="#000"/>`);
    const abs = Math.floor(w / 7) * 12 + WHITE_SEMITONES[w % 7] + 1;
    if (marked.has(abs)) {
      parts.push(
        `<circle cx="${x + BLACK_W / 2}" cy="${BLACK_H - 14}" r="5.5" fill="#fff" stroke="#fff" stroke-width="1.5"/>`
      );
    }
  }
  // Outer frame drawn last so key seams stay crisp.
  parts.push(`<rect x="0" y="0" width="${width}" height="${WHITE_H}" stroke-width="2.5"/>`);
  parts.push(`</g>`);

  if (opts.caption || opts.figureLabel) {
    const y = WHITE_H + 26;
    const label = opts.figureLabel ? `<tspan font-weight="700">${esc(opts.figureLabel)}</tspan>&#160;&#160;` : "";
    parts.push(
      `<text x="4" y="${y}" ${FONT} font-size="15" fill="#000">${label}${esc(opts.caption ?? "")}</text>`
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}

const PROGRESSION_GRAYS = ["#c8c8c8", "#8e8e8e", "#ababab", "#dfdfdf", "#bcbcbc", "#9c9c9c"];

export type ProgressionDiagramOpts = KeyboardDiagramOpts;

/** Boxed progression with arrows: ["ii","V","I"] or chord names. */
export function progressionDiagramSvg(items: string[], opts: ProgressionDiagramOpts = {}): string | null {
  if (items.length < 2 || items.length > 8) return null;
  const BOX = 62;
  const GAP = 34;
  const width = items.length * BOX + (items.length - 1) * GAP;
  const captionH = opts.caption || opts.figureLabel ? 34 : 8;
  const height = BOX + captionH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 4} ${height + 4}" width="${width + 4}" height="${height + 4}">`
  );
  parts.push(`<g transform="translate(2 2)">`);
  items.forEach((item, i) => {
    const x = i * (BOX + GAP);
    parts.push(
      `<rect x="${x}" y="0" width="${BOX}" height="${BOX}" fill="${PROGRESSION_GRAYS[i % PROGRESSION_GRAYS.length]}" stroke="#000" stroke-width="1.5"/>`
    );
    const fontSize = item.length > 4 ? 15 : item.length > 2 ? 18 : 21;
    parts.push(
      `<text x="${x + BOX / 2}" y="${BOX / 2}" ${FONT} font-size="${fontSize}" fill="#111" text-anchor="middle" dominant-baseline="central">${esc(item)}</text>`
    );
    if (i < items.length - 1) {
      const ax = x + BOX + 6;
      const ay = BOX / 2;
      parts.push(
        `<line x1="${ax}" y1="${ay}" x2="${ax + GAP - 18}" y2="${ay}" stroke="#000" stroke-width="2.5"/>` +
          `<path d="M ${ax + GAP - 18} ${ay - 5.5} L ${ax + GAP - 7} ${ay} L ${ax + GAP - 18} ${ay + 5.5} Z" fill="#000"/>`
      );
    }
  });
  parts.push(`</g>`);
  if (opts.caption || opts.figureLabel) {
    const y = BOX + 26;
    const label = opts.figureLabel ? `<tspan font-weight="700">${esc(opts.figureLabel)}</tspan>&#160;&#160;` : "";
    parts.push(
      `<text x="4" y="${y}" ${FONT} font-size="15" fill="#000">${label}${esc(opts.caption ?? "")}</text>`
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}

const ROMAN_RE = /^(i{1,3}|iv|v|vi{0,2}|I{1,3}|IV|V|VI{0,2})([°oø]|dim)?[0-9]?$/;
const CHORD_RE = /^[A-G][#♯b♭]?(maj|min|m|dim|aug|sus[24]?|add[0-9]+|[0-9])*[0-9]?(\/[A-G][#♯b♭]?)?$/;

/** Splits a standalone progression line into items, or null if it isn't one. */
export function parseProgression(text: string): string[] | null {
  const cleaned = text.replace(/\*\*/g, "").trim();
  const items = cleaned.split(/\s*(?:→|—>|->|–|—|>)\s*|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
  if (items.length < 3 || items.length > 8) return null;
  const allRoman = items.every((i) => ROMAN_RE.test(i));
  const allChords = items.every((i) => CHORD_RE.test(i));
  if (!allRoman && !allChords) return null;
  return items;
}
