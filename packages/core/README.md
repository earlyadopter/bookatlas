# @bookatlas/core

The reusable heart of [Bookatlas](https://bookatlas.dev): markdown-book
parsers and the zoomable-atlas interaction components, extracted so embedders
can depend on a package instead of vendoring files. MIT.

```ts
import { parseChapter, parseSingleFileBook, renderSubChapterHtml,
         flattenBook, getPrevNext, slugify } from "@bookatlas/core";
import { buildBook } from "@bookatlas/core";
import { AtlasNavProvider, TransitionLink, RouteListener, KeyNav,
         ChapterStrip, FilterChips } from "@bookatlas/core/components";
```

## Design contract

- **The data layer is pure string → structure.** No `fs`, no config files —
  you own loading (disk, fetch, database) and pass markdown in. The parsers
  are the corpus-tuned ones documented in
  [docs/parser-overrides.md](../../docs/parser-overrides.md).
- **Components are href-agnostic and router-agnostic.** `ChapterStrip`
  takes precomputed `StripItem`s (`{ href, num, title, current }`), `KeyNav`
  takes five hrefs, `FilterChips` takes one href per chip — no URL shape is
  imposed. They get their `Link`, `push()` and `usePathname()` from
  `AtlasNavProvider`; wrap your tree once with your framework's router (the
  repo's `components/NextAtlasNav.tsx` is the Next.js adapter; without a
  provider you get plain anchors and full page loads).
  `TransitionLink`/`RouteListener` provide the View Transitions zoom morph
  (mount `RouteListener` once inside the provider).
- **Book assembly is pure too.** `buildBook(files, options)` turns
  `{ name, content }` records into a rendered `Book`; `buildChapter` /
  `buildSingleFileChapters` / `assembleBook` are the layers underneath for
  callers that cache per file. Sections carry `sourceStart`/`sourceEnd` line
  ranges for editors.
- **The stylesheet ships with the package.** `import "@bookatlas/core/atlas.css"`
  once (tokens, tiles, strip, zoom view, rendered markdown, responsive rules)
  and override tokens such as `--accent` or `--font-*-stack` after it. Fonts
  are yours to load. See [docs/embedding.md](../../docs/embedding.md).

## Consuming

This package ships TypeScript source. In a Next.js app, add:

```ts
// next.config.ts
transpilePackages: ["@bookatlas/core"]
```

Peer dependencies: `next >= 15`, `react`/`react-dom >= 19`. Inside this repo
it is consumed as a pnpm workspace package; external consumption via npm is
planned (until then, a git dependency works).
