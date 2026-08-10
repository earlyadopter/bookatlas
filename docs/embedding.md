# Embedding Bookatlas in your site

There are two honest ways to put the tile atlas on a site you already run.
The first is cheap and needs no code. The second is what
[modernqacourse.com](https://modernqacourse.com) — the reference integration —
actually did, and it is a *copy-and-adapt*, not a package install. This page
documents both, including the sharp edges.

## Option 1: run Bookatlas next to your site

Deploy Bookatlas as its own app (see [self-hosting.md](self-hosting.md)) on a
subdomain — `books.example.com` — and link to it from your site. You get the
whole experience (zoom morph, keyboard nav, filters) with zero integration
code; theming is limited to per-book accent colors unless you fork the CSS.

Choose this unless the atlas must live *inside* your app — shared login,
shared nav, a paywall, or content that isn't markdown files on disk.

## Option 2: vendor the UI into your own Next.js app

This is the modernqacourse.com path: a subset of Bookatlas's components was
copied into the host app as first-party code, adapted to the host's data
model, and mounted as ordinary route groups. There is no npm package today —
you are taking ownership of the copied files. The trade is real: full control
over data, auth, and theming, in exchange for manually re-applying any
upstream fixes to what you copied.

### What to copy

The interaction layer — it's small and self-contained:

- **`components/transitions.tsx`** — the View Transitions zoom morph
  (`TransitionLink`, the router listener). The heart of the feel.
- **`components/KeyNav.tsx`** — the keyboard map (`←`/`→`, `Esc`/`↑`, `[`/`]`).
- **`components/ChapterStrip.tsx`** — the chapter rail on top of the reading
  view.
- **`components/FilterChips.tsx`** — only if you want content-type filters.
- **The atlas CSS block from `app/globals.css`** — grids, tiles, rails, stage.
- **A parser from `lib/`** — only if your content is markdown books in
  Bookatlas's shape (`parseChapter` for chapter-file books,
  `parseSingleFileBook` for one-file books). If your site already has a
  content pipeline, keep it and skip the parsers entirely.

### What *not* to copy

`lib/config.ts` (the `books.config.json` registry), `lib/loadBook.ts`,
`lib/renderMarkdown.ts`, the asset route. These assume Bookatlas's file
layout and rendering stack; your site already has its own. The reference
integration renders markdown with the host's renderer and derives its "books"
from the host's existing content tree — no book registry at all.

### The recipe, from the reference integration

1. **Namespace the CSS.** Prefix every copied selector (the reference used
   `.atl-`) so the atlas styles can't collide with yours, and swap Bookatlas's
   tokens (`--bg`, `--ink`, `--accent`, …) for your site's existing ones —
   the atlas then inherits your theme, including dark mode, for free.
2. **Wrap each mount in a "realm" class.** A layout-level
   `<div className="atl-realm atl-realm-books">` gives you a hook to theme
   different atlas mounts differently later without touching components.
3. **Mirror the zoom hierarchy in your own routes.** Whatever your URL shape,
   keep the three levels — book/library grid → chapter grid → section stage —
   with every zoom state a bookmarkable URL. That's what makes the morph and
   browser back/forward feel right.
4. **Decouple components from Bookatlas's slug helpers.** `ChapterStrip`
   imports `chapterHref` from `lib/slugs`; the reference rewrote it to accept
   precomputed items (`{ href, num, title, current }`) so the host computes
   hrefs its own way. Expect to do the same to anything that builds links.
5. **Compose your own chrome.** Render your site's topbar/footer around the
   atlas `<main>` per page; drop Bookatlas's `ThemeToggle` if your site has
   theming.
6. **Mind SEO.** If the tile view duplicates content your site already
   indexes canonically elsewhere, set `robots: { index: false, follow: true }`
   on the atlas layouts.
7. **Gate content in the data loader, not the UI.** If some sections are
   paid/locked, never render their HTML into the payload — ship titles and
   excerpts with an empty body for locked sections. This matches Bookatlas's
   own no-raw-markdown stance: what shouldn't reach the client must not be in
   the object graph at all, where a CSS overlay could be inspected away.
8. **Mark every vendored file** with a header comment naming the upstream
   file and commit. Parser and interaction fixes land here first; you'll
   re-apply them by hand, and the marker is how future-you finds what drifted.

### Known friction (so you can budget for it)

- The components were extracted from an app, not designed as a library —
  expect light API surgery (step 4) rather than drop-in reuse. Making them
  embed-friendly upstream is on the roadmap (see plan.md).
- A vendored parser is a fork: upstream parsing fixes don't reach you
  automatically.
- If you copy pieces into different route groups, give the shared files one
  home (a `components/atlas/` directory) rather than importing across route
  groups.

### Attribution

Appreciated, not required (MIT): a small "Tile view built with
[Bookatlas](https://bookatlas.dev)" credit wherever the atlas renders.
