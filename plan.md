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

### Later

- [ ] vitest suite for parseChapter (port parse-check assertions)
- [ ] second book onboarding (exercise the config overrides)
- [ ] search / ⌘K palette (CheatsheetClient pattern from modernQAcourse)
- [ ] syntax highlighting for code fences
