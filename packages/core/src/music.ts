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

/**
 * "C E G B♭" / "C C G G A A G" → absolute semitones by melodic contour:
 * a repeated note stays on the same pitch, and every move takes the nearest
 * octave (ties break upward) — so chord spellings stack upward while
 * melodies stay in register instead of climbing octaves.
 */
export function parseNoteSequence(text: string): { notes: ParsedNote[]; absolute: number[] } | null {
  const tokens = text.trim().split(/(?:\s*(?:→|->|—>)\s*|[\s,–-]+)/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 10) return null;
  const notes: ParsedNote[] = [];
  for (const t of tokens) {
    const n = parseNote(t);
    if (!n) return null;
    notes.push(n);
  }
  const absolute: number[] = [];
  for (const n of notes) {
    if (absolute.length === 0) {
      absolute.push(n.semitone);
      continue;
    }
    const prev = absolute[absolute.length - 1];
    const up = prev + ((n.semitone - prev) % 12 + 12) % 12;
    const down = up - 12;
    // Melodic-register rule: repeats stay put; leaps up to a fifth go up,
    // anything wider resolves downward (C→G reads as the rising fifth).
    absolute.push(up === prev ? prev : up - prev <= 7 ? up : down);
  }
  // Normalize into a non-negative register.
  const min = Math.min(...absolute);
  if (min < 0) {
    const shift = Math.ceil(-min / 12) * 12;
    for (let i = 0; i < absolute.length; i++) absolute[i] += shift;
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
  // Boxes widen (uniformly) when the longest label wouldn't fit at 15px;
  // height stays fixed so long chord symbols don't produce giant squares.
  const maxLen = Math.max(...items.map((i) => i.length));
  const BOXW = Math.max(62, maxLen * 8 + 16);
  const BOXH = 62;
  const GAP = 34;
  const width = items.length * BOXW + (items.length - 1) * GAP;
  const captionH = opts.caption || opts.figureLabel ? 34 : 8;
  const height = BOXH + captionH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 4} ${height + 4}" width="${width + 4}" height="${height + 4}">`
  );
  parts.push(`<g transform="translate(2 2)">`);
  items.forEach((item, i) => {
    const x = i * (BOXW + GAP);
    parts.push(
      `<rect x="${x}" y="0" width="${BOXW}" height="${BOXH}" fill="${PROGRESSION_GRAYS[i % PROGRESSION_GRAYS.length]}" stroke="#000" stroke-width="1.5"/>`
    );
    const fontSize = item.length > 4 ? 15 : item.length > 2 ? 18 : 21;
    parts.push(
      `<text x="${x + BOXW / 2}" y="${BOXH / 2}" ${FONT} font-size="${fontSize}" fill="#111" text-anchor="middle" dominant-baseline="central">${esc(item)}</text>`
    );
    if (i < items.length - 1) {
      const ax = x + BOXW + 6;
      const ay = BOXH / 2;
      parts.push(
        `<line x1="${ax}" y1="${ay}" x2="${ax + GAP - 18}" y2="${ay}" stroke="#000" stroke-width="2.5"/>` +
          `<path d="M ${ax + GAP - 18} ${ay - 5.5} L ${ax + GAP - 7} ${ay} L ${ax + GAP - 18} ${ay + 5.5} Z" fill="#000"/>`
      );
    }
  });
  parts.push(`</g>`);
  if (opts.caption || opts.figureLabel) {
    const y = BOXH + 26;
    const label = opts.figureLabel ? `<tspan font-weight="700">${esc(opts.figureLabel)}</tspan>&#160;&#160;` : "";
    parts.push(
      `<text x="4" y="${y}" ${FONT} font-size="15" fill="#000">${label}${esc(opts.caption ?? "")}</text>`
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}

// ── Staff notation ──────────────────────────────────────────────────────
// Whole-note chords/sequences on a treble staff: note heads with the
// classic rotated-hole look, ♯/♭ accidentals, ledger lines, clef glyph.

const LETTER_STEP: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const STAFF_GAP = 10; // distance between staff lines
// Diatonic step of E4, the bottom treble line, with C4 = step 28.
const E4_STEP = 30;
// Bottom line of the bass staff is G2 (C2 = step 14).
const G2_STEP = 18;

export type Clef = "treble" | "bass";

type StaffNote = { step: number; accidental: "" | "#" | "b" };

function toStaffNotes(seq: { notes: ParsedNote[]; absolute: number[] }, clef: Clef = "treble"): StaffNote[] {
  // parseNoteSequence normalizes the register to start near absolute 0; place
  // that base octave where it reads naturally for the clef (C4 vs C3).
  const base = clef === "bass" ? 21 : 28;
  return seq.notes.map((n, i) => ({
    step: Math.floor(seq.absolute[i] / 12) * 7 + LETTER_STEP[n.letter] + base,
    accidental: n.accidental
  }));
}

function staffGroup(
  staffNotes: StaffNote[],
  stacked: boolean,
  clef: Clef = "treble"
): { svg: string; width: number; height: number; midY: number } {
  const S = STAFF_GAP;
  const bottomStep = clef === "bass" ? G2_STEP : E4_STEP;
  // Vertical envelope: staff spans 4*S; leave headroom for ledger lines.
  const topPad = 3 * S;
  const bottomLineY = topPad + 4 * S;
  const yFor = (step: number) => bottomLineY - ((step - bottomStep) * S) / 2;

  const clefW = 40;
  const noteGap = stacked ? 0 : 34;
  const chordX = clefW + 26;
  const parts: string[] = [];

  // Note geometry first (to know width and required ledger lines).
  type Placed = { x: number; y: number; step: number; accidental: string };
  const placed: Placed[] = [];
  let x = chordX;
  let prevStep = -99;
  let prevOffset = false;
  for (const n of staffNotes) {
    let nx = x;
    if (stacked) {
      // Adjacent seconds in a stack offset to the right (inversion look).
      const offset: boolean = n.step - prevStep === 1 && !prevOffset;
      if (offset) nx += 11;
      prevOffset = offset;
      prevStep = n.step;
    } else {
      x += noteGap;
    }
    placed.push({ x: nx, y: yFor(n.step), step: n.step, accidental: n.accidental });
  }
  const lastX = Math.max(...placed.map((p) => p.x));
  const width = lastX + 34;

  // Staff lines.
  for (let i = 0; i < 5; i++) {
    const y = topPad + i * S;
    parts.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#000" stroke-width="1.1"/>`);
  }
  // Clef: musical glyph with wide font fallback; treble wraps the G line,
  // bass sits with its curl on the F line.
  const CLEF_FONT = `font-family="'Bravura Text', 'Apple Symbols', 'Noto Music', 'Segoe UI Symbol', serif"`;
  if (clef === "bass") {
    parts.push(`<text x="4" y="${bottomLineY + 1}" ${CLEF_FONT} font-size="${4.1 * S}" fill="#000">&#x1D122;</text>`);
  } else {
    parts.push(`<text x="2" y="${bottomLineY + 1}" ${CLEF_FONT} font-size="${4.6 * S}" fill="#000">&#x1D11E;</text>`);
  }

  // Ledger lines (below the staff and above it).
  const LEDGER_HALF = 12;
  for (const p of placed) {
    for (let step = bottomStep - 2; step >= p.step; step -= 2) {
      parts.push(
        `<line x1="${p.x - LEDGER_HALF}" y1="${yFor(step)}" x2="${p.x + LEDGER_HALF}" y2="${yFor(step)}" stroke="#000" stroke-width="1.1"/>`
      );
    }
    const topStep = bottomStep + 10;
    for (let step = topStep; step <= p.step; step += 2) {
      parts.push(
        `<line x1="${p.x - LEDGER_HALF}" y1="${yFor(step)}" x2="${p.x + LEDGER_HALF}" y2="${yFor(step)}" stroke="#000" stroke-width="1.1"/>`
      );
    }
  }

  // Accidentals, staggered when they'd collide vertically.
  let accCol = 0;
  for (const p of placed) {
    if (!p.accidental) continue;
    accCol = (accCol + 1) % 2;
    const ax = p.x - 15 - accCol * 9;
    parts.push(
      `<text x="${ax}" y="${p.y + 5}" ${FONT} font-size="17" fill="#000">${p.accidental === "#" ? "♯" : "♭"}</text>`
    );
  }

  // Whole-note heads: black ellipse with rotated white hole.
  for (const p of placed) {
    parts.push(
      `<g transform="translate(${p.x} ${p.y})">` +
        `<ellipse rx="7.6" ry="5.2" fill="#000"/>` +
        `<ellipse rx="4.2" ry="2.5" transform="rotate(-28)" fill="#fff"/>` +
        `</g>`
    );
  }

  const height = bottomLineY + 3 * S;
  return { svg: parts.join(""), width, height, midY: (topPad + bottomLineY) / 2 };
}

export type MusicFigureOpts = KeyboardDiagramOpts & {
  /** Force melody rendering even for third-stacks (e.g. arrow-notated motion). */
  sequence?: boolean;
  /** Staff clef — "bass" places the figure in left-hand register. */
  clef?: Clef;
  /** Force a keyboard diagram alongside the staff even for melodies. */
  keyboard?: boolean;
};

/**
 * Textbook figure. Third-stacks (chord spellings) pair stacked staff
 * notation with a keyboard diagram; anything else is a melody/sequence and
 * renders as staff notation alone, note by note.
 */
export function musicFigureSvg(noteText: string, opts: MusicFigureOpts = {}): string | null {
  const seq = parseNoteSequence(noteText);
  if (!seq) return null;
  const staffNotes = toStaffNotes(seq, opts.clef);
  const diffs = staffNotes.slice(1).map((n, i) => n.step - staffNotes[i].step);
  const stacked = !opts.sequence && staffNotes.length <= 6 && diffs.every((d) => d >= 1 && d <= 3);
  const staff = staffGroup(staffNotes, stacked, opts.clef);

  const captionH = opts.caption || opts.figureLabel ? 32 : 6;
  // Long captions must not clip: the viewBox is at least caption-wide.
  const captionApprox = opts.caption || opts.figureLabel
    ? ((opts.figureLabel?.length ?? 0) + (opts.caption?.length ?? 0)) * 8.4 + 24
    : 0;
  const caption = (contentH: number, parts: string[]) => {
    if (!opts.caption && !opts.figureLabel) return;
    const label = opts.figureLabel ? `<tspan font-weight="700">${esc(opts.figureLabel)}</tspan>&#160;&#160;` : "";
    parts.push(
      `<text x="2" y="${contentH + 22}" ${FONT} font-size="15" fill="#000">${label}${esc(opts.caption ?? "")}</text>`
    );
  };

  if (!stacked && !opts.keyboard) {
    // Melody: staff only.
    const width = Math.max(staff.width, captionApprox);
    const height = staff.height + captionH;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
      staff.svg
    ];
    caption(staff.height, parts);
    parts.push(`</svg>`);
    return parts.join("");
  }

  const keyboard = keyboardDiagramSvg(noteText, {});
  if (!keyboard) return null;
  const kbInner = keyboard.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const kbW = Number(keyboard.match(/width="(\d+)"/)?.[1] ?? 0);
  const kbH = Number(keyboard.match(/height="(\d+)"/)?.[1] ?? 0);

  const GAP = 26;
  const contentH = Math.max(staff.height, kbH);
  const width = Math.max(staff.width + GAP + kbW, captionApprox);
  const height = contentH + captionH;

  const staffY = Math.max(0, (contentH - staff.height) / 2);
  const kbY = Math.max(0, (contentH - kbH) / 2);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
  );
  parts.push(`<g transform="translate(0 ${staffY})">${staff.svg}</g>`);
  parts.push(`<g transform="translate(${staff.width + GAP} ${kbY})">${kbInner}</g>`);
  caption(contentH, parts);
  parts.push(`</svg>`);
  return parts.join("");
}

export type GrandStaffOpts = KeyboardDiagramOpts & {
  /** Force melody (left-to-right) rendering per hand; default auto like musicFigureSvg. */
  sequence?: boolean;
};

/**
 * Grand staff: right hand on a treble staff over left hand on a bass staff,
 * joined by a brace. Each hand's notes follow the same stack-vs-melody
 * heuristic as musicFigureSvg.
 */
export function grandStaffSvg(trebleText: string, bassText: string, opts: GrandStaffOpts = {}): string | null {
  const trebleSeq = parseNoteSequence(trebleText);
  const bassSeq = parseNoteSequence(bassText);
  if (!trebleSeq || !bassSeq) return null;

  const build = (seq: NonNullable<ReturnType<typeof parseNoteSequence>>, clef: Clef) => {
    const notes = toStaffNotes(seq, clef);
    const diffs = notes.slice(1).map((n, i) => n.step - notes[i].step);
    const stacked = !opts.sequence && notes.length <= 6 && diffs.every((d) => d >= 1 && d <= 3);
    return staffGroup(notes, stacked, clef);
  };
  const treble = build(trebleSeq, "treble");
  const bass = build(bassSeq, "bass");

  const BRACE_W = 14;
  // Each staffGroup carries 3 spaces of padding top and bottom; overlap them
  // so the staves sit a musical distance apart instead of doubled padding.
  const STAVE_GAP = -4 * STAFF_GAP;
  // Long captions must not clip: the viewBox is at least caption-wide.
  const captionApprox = opts.caption || opts.figureLabel
    ? ((opts.figureLabel?.length ?? 0) + (opts.caption?.length ?? 0)) * 8.4 + 24
    : 0;
  const width = Math.max(BRACE_W + Math.max(treble.width, bass.width), captionApprox);
  const bassY = treble.height + STAVE_GAP;
  const contentH = bassY + bass.height;
  const captionH = opts.caption || opts.figureLabel ? 32 : 6;
  const height = contentH + captionH;

  // Brace spans from the treble top line to the bass bottom line.
  const S = STAFF_GAP;
  const braceTop = 3 * S;
  const braceBottom = bassY + 3 * S + 4 * S;
  const bm = (braceTop + braceBottom) / 2;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
  );
  // Drawn brace: two mirrored cubic curves meeting in a point at the middle.
  parts.push(
    `<path d="M ${BRACE_W - 2} ${braceTop} C 2 ${braceTop + 12}, 10 ${bm - 14}, 1 ${bm} C 10 ${bm + 14}, 2 ${braceBottom - 12}, ${BRACE_W - 2} ${braceBottom}" fill="none" stroke="#000" stroke-width="2.2"/>`
  );
  // Connecting barline at the staves' left edge.
  parts.push(
    `<line x1="${BRACE_W}" y1="${braceTop}" x2="${BRACE_W}" y2="${braceBottom}" stroke="#000" stroke-width="1.4"/>`
  );
  parts.push(`<g transform="translate(${BRACE_W} 0)">${treble.svg}</g>`);
  parts.push(`<g transform="translate(${BRACE_W} ${bassY})">${bass.svg}</g>`);

  if (opts.caption || opts.figureLabel) {
    const label = opts.figureLabel ? `<tspan font-weight="700">${esc(opts.figureLabel)}</tspan>&#160;&#160;` : "";
    parts.push(
      `<text x="2" y="${contentH + 22}" ${FONT} font-size="15" fill="#000">${label}${esc(opts.caption ?? "")}</text>`
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}

// ── Chord symbols ───────────────────────────────────────────────────────
// "Am" → "A C E": degree/semitone formulas spelled with correct letters
// (thirds advance the letter; accidental = offset from the natural note).

const QUALITY_FORMULAS: Record<string, [number, number][]> = {
  "": [[1, 0], [3, 4], [5, 7]],
  maj: [[1, 0], [3, 4], [5, 7]],
  m: [[1, 0], [3, 3], [5, 7]],
  min: [[1, 0], [3, 3], [5, 7]],
  dim: [[1, 0], [3, 3], [5, 6]],
  "°": [[1, 0], [3, 3], [5, 6]],
  o: [[1, 0], [3, 3], [5, 6]],
  aug: [[1, 0], [3, 4], [5, 8]],
  "+": [[1, 0], [3, 4], [5, 8]],
  "7": [[1, 0], [3, 4], [5, 7], [7, 10]],
  maj7: [[1, 0], [3, 4], [5, 7], [7, 11]],
  m7: [[1, 0], [3, 3], [5, 7], [7, 10]],
  min7: [[1, 0], [3, 3], [5, 7], [7, 10]],
  mmaj7: [[1, 0], [3, 3], [5, 7], [7, 11]],
  dim7: [[1, 0], [3, 3], [5, 6], [7, 9]],
  m7b5: [[1, 0], [3, 3], [5, 6], [7, 10]],
  "ø7": [[1, 0], [3, 3], [5, 6], [7, 10]],
  "ø": [[1, 0], [3, 3], [5, 6], [7, 10]],
  "6": [[1, 0], [3, 4], [5, 7], [6, 9]],
  m6: [[1, 0], [3, 3], [5, 7], [6, 9]],
  "9": [[1, 0], [3, 4], [5, 7], [7, 10], [9, 14]],
  maj9: [[1, 0], [3, 4], [5, 7], [7, 11], [9, 14]],
  m9: [[1, 0], [3, 3], [5, 7], [7, 10], [9, 14]],
  add9: [[1, 0], [3, 4], [5, 7], [9, 14]],
  sus2: [[1, 0], [2, 2], [5, 7]],
  sus4: [[1, 0], [4, 5], [5, 7]]
};

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_SEMITONE = [0, 2, 4, 5, 7, 9, 11];

/**
 * Spells a chord symbol as note names ("Am7" → "A C E G"), or null when the
 * symbol has no quality suffix (a bare "A" is ambiguous: note or chord).
 */
export function chordSymbolNotes(symbol: string): string | null {
  const m = symbol.trim().match(/^([A-G])([#♯b♭]?)(.+)$/);
  if (!m) return null;
  // Normalize unicode accidentals in the quality ("m7♭5" → "m7b5") and the
  // degree-circle-seven spelling ("°7"/"o7" → dim7).
  const quality = m[3].trim().replace(/♭/g, "b").replace(/♯/g, "#").replace(/^[°o]7$/, "dim7");
  const formula = QUALITY_FORMULAS[quality];
  if (!formula) return null;
  const rootLetterIdx = LETTERS.indexOf(m[1]);
  const rootSemitone =
    LETTER_SEMITONE[rootLetterIdx] + (m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0);

  const out: string[] = [];
  for (const [degree, semis] of formula) {
    const letterIdx = (rootLetterIdx + degree - 1) % 7;
    const octaves = Math.floor((rootLetterIdx + degree - 1) / 7);
    const natural = LETTER_SEMITONE[letterIdx] + octaves * 12;
    const target = rootSemitone + semis;
    const diff = target - natural;
    if (diff < -1 || diff > 1) return null; // would need a double accidental
    out.push(`${LETTERS[letterIdx]}${diff === 1 ? "♯" : diff === -1 ? "♭" : ""}`);
  }
  return out.join(" ");
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
