# Plan

## Direction questions

- Should filtered views ("interview drill") get their own shareable route alias later (e.g. /b/[book]/drill)?
- Second book onboarding will exercise ParserOverrides — which book is next?

## Features

### v1: bootcamp-book as zoomable tiles

- [x] Phase 1: scaffold + parser + plain routes (bootcamp renders navigable)
- [x] Phase 2: parser hardening + tags + parse:check green (book grew to 17 modules / ~976 subs during build — parser handled them unchanged)
- [x] Phase 3: design pass (tokens, tile grids, chapter strip, zoom rails, dark theme)
- [x] Phase 4: View Transitions zoom morph — shipped tier 2 (manual startViewTransition wrapper in components/transitions.tsx; tier 1 unavailable: stable React 19.2 lacks unstable_ViewTransition). Known limit: browser back/forward doesn't animate.
- [x] Phase 5: content-type filters (chips + filtered reading sequence, cross-chapter interview drill)
- [x] Phase 6: polish (keyboard nav ←/→/Esc/[/], preamble block, excerpts, build green, commit)

### v2: multi-corpus + open source

- [x] open-source prep: renamed to Bookatlas, demo book bundled, public/local config split, MIT license, README
- [x] no-raw-md guarantee: mdBody blanked after render, intro/preamble pre-rendered, verified over the wire (dev + prod)

### v3: adoption docs

The OSS repo plus good docs is the product's free tier — these guides are what
make self-hosting and embedding viable without hand-holding.

- [x] docs/self-hosting.md — the filesystem constraint, long-running-server vs Vercel walkthroughs (fs-tracing gotcha), analytics opt-in, upstream-merge workflow
- [x] docs/embedding.md — run-alongside vs vendor-the-UI, recipe distilled from the modernqacourse.com reference integration
- [x] docs/parser-overrides.md — boundary rules, the full override contract, parse:check failure classes
- [x] README "Guides" section linking the three

### Later

- [ ] vitest suite for parseChapter (port parse-check assertions)
- [ ] search / ⌘K palette (CheatsheetClient pattern from modernQAcourse)
- [ ] syntax highlighting for code fences
- [ ] GIF/screenshot for README before publishing the repo
- [ ] parse:check: respect parser.fileOrder (loadBook orders/filters by it; the checker still sorts all filenames)
- [ ] embed-friendly component APIs — ChapterStrip should take precomputed hrefs instead of importing lib/slugs (the modernQAcourse vendoring had to rewrite it; makes the docs/embedding.md recipe near drop-in)
- [ ] publishable core package — extract lib/ (parsers, tags, slugs, nav) + interaction components into an npm package embedders can depend on instead of vendoring (builds on the embed-friendly APIs ticket)
