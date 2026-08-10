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

This is the modernqacourse.com path: the atlas lives *inside* your app —
your routes, your data pipeline, your auth — with Bookatlas providing the
parsers and interaction components.

### Preferred: depend on `@bookatlas/core`

The reusable pieces live in [`packages/core`](../packages/core) as the
`@bookatlas/core` package — parsers and helpers from `.`, interaction
components from `./components`. The components are **href-agnostic**
(`ChapterStrip` takes precomputed `{ href, num, title, current }` items,
`KeyNav` takes five hrefs), so they drop into any route shape without
surgery. It ships TypeScript source: add
`transpilePackages: ["@bookatlas/core"]` to your `next.config.ts`, and until
it's on npm, consume it as a git dependency. See the
[package README](../packages/core/README.md) for the API contract.

What the package does *not* carry yet is the CSS — copy the atlas block from
`app/globals.css` and adapt it (step 1 below).

### Fallback: what to vendor

If you'd rather own the files outright (the original modernqacourse.com
approach — it predates the package), the trade is manually re-applying
upstream fixes to whatever you copied:

The interaction layer — it's small and self-contained:

- **`packages/core/src/components/transitions.tsx`** — the View Transitions
  zoom morph (`TransitionLink`, the router listener). The heart of the feel.
- **`packages/core/src/components/KeyNav.tsx`** — the keyboard map
  (`←`/`→`, `Esc`/`↑`, `[`/`]`).
- **`packages/core/src/components/ChapterStrip.tsx`** — the chapter rail on
  top of the reading view.
- **`packages/core/src/components/FilterChips.tsx`** — only if you want
  content-type filters.
- **The atlas CSS block from `app/globals.css`** — grids, tiles, rails, stage.
- **A parser from `packages/core/src/`** — only if your content is markdown
  books in Bookatlas's shape (`parseChapter` for chapter-file books,
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
4. **Compute hrefs yourself, pass them in.** The components take precomputed
   hrefs (`ChapterStrip` items, `KeyNav`'s five targets) — your app decides
   the URL shape, typically in the server components that assemble each page.
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

- The CSS is not bundled with the package yet — copying and adapting the
  atlas block from `app/globals.css` is a real (one-time) chunk of the work.
- If you vendor instead of depending on the package, a vendored parser is a
  fork: upstream parsing fixes don't reach you automatically. Give copied
  files one home (a `components/atlas/` directory) rather than importing
  across route groups.

### Attribution

Appreciated, not required (MIT): a small "Tile view built with
[Bookatlas](https://bookatlas.dev)" credit wherever the atlas renders.
