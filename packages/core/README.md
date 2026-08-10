# @bookatlas/core

The reusable heart of [Bookatlas](https://bookatlas.dev): markdown-book
parsers and the zoomable-atlas interaction components, extracted so embedders
can depend on a package instead of vendoring files. MIT.

```ts
import { parseChapter, parseSingleFileBook, renderSubChapterHtml,
         flattenBook, getPrevNext, slugify } from "@bookatlas/core";
import { TransitionLink, RouteListener, KeyNav,
         ChapterStrip, FilterChips } from "@bookatlas/core/components";
```

## Design contract

- **The data layer is pure string → structure.** No `fs`, no config files —
  you own loading (disk, fetch, database) and pass markdown in. The parsers
  are the corpus-tuned ones documented in
  [docs/parser-overrides.md](../../docs/parser-overrides.md).
- **Components are href-agnostic.** `ChapterStrip` takes precomputed
  `StripItem`s (`{ href, num, title, current }`), `KeyNav` takes five hrefs,
  `FilterChips` takes a base path — no URL shape is imposed, so they drop
  into any route structure. `TransitionLink`/`RouteListener` provide the
  View Transitions zoom morph (mount `RouteListener` once in your root
  layout).
- **Styles are not bundled (yet).** Copy the atlas CSS block from the repo's
  `app/globals.css` and adapt its tokens to your site — see
  [docs/embedding.md](../../docs/embedding.md) for the full recipe.

## Consuming

This package ships TypeScript source. In a Next.js app, add:

```ts
// next.config.ts
transpilePackages: ["@bookatlas/core"]
```

Peer dependencies: `next >= 15`, `react`/`react-dom >= 19`. Inside this repo
it is consumed as a pnpm workspace package; external consumption via npm is
planned (until then, a git dependency works).
