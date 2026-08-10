# Parser overrides and `parse:check`

Bookatlas ships two parsing profiles (see the README's "How parsing works"):
*chapter files* — tuned for LLM-exported markdown where heading depth lies —
and *single file* for well-formed `book.md` books. The defaults were tuned on
a real ~1,000-section corpus, but every corpus has its own tics. This page
covers the escape hatches for when a new book doesn't split cleanly.

Overrides apply to **chapter-files mode only**. Single-file mode auto-detects
its heading depth per book and takes no overrides — if a single-file book
parses badly, that's a bug worth reporting, not a config problem.

## First, see what the parser actually did

```bash
pnpm parse:check
```

For every configured book it prints per-chapter section counts and tag totals,
and exits non-zero on structural anomalies:

- **filename number ≠ chapter number** — the file is named `module-07.md` but
  the chapter heading says something else
- **body over 200 lines** — almost always a missed section split
- **numbered heading leaked into a body** — a `# 5.2 …` line ended up inside
  another section instead of starting its own
- **footnote definitions leaked into a body** — `[1]: https://…` blocks that
  should have been stripped

Run it every time a book grows or a new corpus arrives. The counts alone are
diagnostic: a chapter showing `1 subs` when you expected twelve means the
boundary patterns didn't match your headings.

## How section boundaries are decided

Knowing the rules makes the failures obvious. Scanning each chapter file
(code fences always skipped, `---` never splits):

1. A heading matching **`N.M Title`** (`# 5.2 Retry policies`, H1 or H2)
   always starts a section.
2. A heading matching a **bare ordinal** (`# 7. Variables`) starts a section
   numbered `<chapter>.<7>`.
3. After the first numbered section, an **unnumbered H1** starts an unnumbered
   section (cheat sheets, codas) — unless the pull-quote heuristic filters it
   (below). Before the first numbered section, H1s are treated as intro
   structure and stay in the chapter intro.
4. An **unnumbered H2** splits only if it looks like a teaser or cheat sheet
   (starts with `Next —` / contains `cheat sheet`). All other H2s stay inside
   the current section's body — that's what keeps a `## Account` subsection
   inside `# 5.2 …`.

## The overrides

Set them per book in the config, under `"parser"`:

```jsonc
{
  "id": "kafka-notes",
  "path": "./content/kafka-notes",
  "parser": {
    "chapterTitlePattern": "^#{1,2}\\s+Week\\s+(\\d+):\\s*(.+)$",
    "stripFootnotes": false,
    "pullQuoteHeuristic": false,
    "fileOrder": ["intro.md", "setup.md", "streams.md"]
  }
}
```

### `chapterTitlePattern` (string, regex source)

How the chapter's own title heading is recognized. Default:

```
^#{1,2}\s+Module\s+(\d+)\s*[—–-]\s*(.+)$
```

i.e. `# Module 3 — Dataweave` at H1 or H2. If your corpus says `Week 3:`,
`Chapter 3.`, or `Day 3 –`, override it. The contract:

- Matched against each line's trimmed text, *including* the leading `#`s
  (fences skipped). First match wins.
- **Capture group 1** → chapter number, **capture group 2** → chapter title.
  Keep both groups in your pattern.
- If nothing matches, the fallback kicks in: the first heading (up to H3)
  becomes the title, and the chapter number comes from the first digits in the
  filename. That fallback is why an untuned corpus usually still *renders* —
  just with raw heading text as titles.

The chapter number generally comes from the filename (`module-07.md` → 7);
the heading's number is the fallback and the cross-check `parse:check` verifies.

### `stripFootnotes` (boolean, default `true`)

ChatGPT answers with web citations end in `[1]: https://…` reference blocks.
By default a trailing run of those is trimmed from the end of each file (only
when actual footnote definitions are found there — normal endings are left
alone). Set `false` if your book ends with link-reference definitions you
actually want rendered.

### `pullQuoteHeuristic` (boolean, default `true`)

LLM-exported markdown sometimes uses `#` for *emphasis*, not structure:
`# **Idempotency**`, `# asynchronous`. The heuristic ignores unnumbered H1
candidates that are fully bolded, or ≤ 2 words starting lowercase. Set
`false` if your chapters legitimately use short lowercase H1 section titles
and sections are going missing.

### `fileOrder` (string array)

Chapter order is filename sort (`module-01.md … module-12.md`) by default.
`fileOrder` replaces it with an explicit list — and doubles as an allowlist:
files in the folder but not in the list are excluded from the book. Useful
for corpora with unsortable names, or to hide a draft chapter.

(Known gap: `parse:check` currently ignores `fileOrder` and checks all files
in sorted order — tracked in plan.md.)

## Workflow for onboarding a new corpus

1. Register the book with no overrides; run `pnpm parse:check`.
2. Read the counts. Wrong chapter titles → `chapterTitlePattern`. Missing
   sections → check the boundary rules above, try `pullQuoteHeuristic: false`.
   Giant bodies → your headings match none of the boundary patterns; if the
   numbering scheme is genuinely different (e.g. `5-2` instead of `5.2`),
   that's a parser gap — open an issue with a sample chapter.
3. Re-run until `parse:check OK`, then browse the book — the tile grid makes
   structural problems visible at a glance.
