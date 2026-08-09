# Bookatlas

Turn folders of markdown — saved LLM conversations, book drafts, course notes — into a **zoomable tile atlas**: chapters as tiles, sections as tiles, click to zoom into a reading view with neighboring sections on side rails and the chapter strip on top. Built for texts that are too big to scroll and too structured to flatten.

Born from a real workflow: long ChatGPT conversations saved as markdown "books" (the bundled demo is one — a 20-module MuleSoft bootcamp generated while onboarding into an unfamiliar stack), then navigated spatially instead of linearly. Bookatlas powers the book library at [modernqacourse.com](https://modernqacourse.com).

## Features

- **Spatial navigation** — library → book → chapter grid → zoomed section with distance-compressed rails ("deck" effect); every state is a bookmarkable URL
- **Zoom morph** via the View Transitions API (graceful fallback to instant swap)
- **Keyboard-first** — `←`/`→` prev/next section, `Esc`/`↑` up a level, `[`/`]` switch chapters
- **Content-type filters** — e.g. interview Q&A sections detected at parse time; filtered prev/next crosses chapter boundaries (a book-wide "drill mode")
- **Two parsing profiles**, auto-applied:
  - *chapter files* — a folder of `.md` files, sections split by numbered headings (`# 5.2 Title`); tuned for LLM-exported conversations where heading depth is unreliable
  - *single file* — one `book.md` with `# Chapter N:` (or `## Chapter N:`) headings, `PART` dividers, appendices; depth auto-detected per book
- **Live sources** — books are read from disk per request with mtime caching; edit or extend a book and refresh
- **No database, no build step for content** — markdown in, HTML out, server-rendered
- **Warm-paper design** with dark mode, no CSS framework

## Quickstart

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 — the demo book (20 chapters, ~1,000 sections) renders from `demo/mulesoft-bootcamp/`.

## Adding your books

Books are registered in `books.config.json` (committed) and optionally `books.config.local.json` (gitignored — your private library; same-id entries override public ones):

```jsonc
{
  "books": [
    {
      "id": "my-book",              // URL segment
      "title": "My Book",           // optional for single-file books (derived from the title heading)
      "path": "./content/my-book",  // relative to repo root, or absolute
      "mode": "single-file",        // omit for a folder of chapter files
      "accent": "#5b4a8a"           // per-book accent color
    }
  ],
  "collections": [
    {
      "dir": "/path/to/library",    // every subdirectory with a book.md becomes a book
      "mode": "single-file"
    }
  ]
}
```

Check how your corpus parses before styling anything:

```bash
pnpm parse:check
```

It prints per-chapter section counts and fails on structural anomalies (missed splits, leaked headings) — useful as a tripwire when a book grows or a new corpus arrives with slightly different heading conventions. Per-book `parser` overrides (custom chapter-title pattern, heuristic toggles) are the escape hatch for corpora the defaults don't fit.

## How parsing works (and why it's weird)

LLM-exported markdown lies about structure: the first section of a chapter might be `##` while the rest are `#`, children sometimes sit *deeper* than their parents, and stray `# emphasis` lines aren't headings at all. Bookatlas therefore splits sections by **numbering patterns and title heuristics, never by heading depth alone** — and treats well-formed single-file books (where depth *is* reliable) as the easy special case. Code fences are always respected; a `# comment` inside a fence never becomes a section.

## Notes for deployers

- All markdown is rendered to HTML **server-side**; raw `.md` content is never serialized to the client, exposed by any route, or reachable through the asset endpoint (images only, extension-allowlisted).
- Content outside the repo is read at request time — deploy needs the book directories on the server's filesystem.
- Routes are dynamic (`force-dynamic`); there is intentionally no static export of content.

## License

MIT © Yuri Syuganov
