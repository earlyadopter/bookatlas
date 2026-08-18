import { listBooks } from "./loadBook";

// STATIC_BOOKS mode: real build-time params, so every page is baked into the
// build output. On-demand rendering after deploys was writing each of the
// ~18K pages into Vercel's cache on first hit — ISR writes are billed, and
// every deploy resets the cache, so crawler sweeps re-bought the whole site
// each time. Baking at build converts that recurring cost into build minutes.
//
// When static mode is off the exports are undefined, which Next treats as
// "no generateStaticParams" — keeping default per-request rendering (an
// unconditional export makes dynamic API use a hard error).

const staticMode = process.env.STATIC_BOOKS === "1";

type Params<T> = () => Promise<T[]>;

export const bookStaticParams = (staticMode
  ? async () => (await listBooks()).map((b) => ({ book: b.id }))
  : undefined) as Params<{ book: string }>;

export const chapterStaticParams = (staticMode
  ? async () =>
      (await listBooks()).flatMap((b) =>
        b.chapters.map((c) => ({ book: b.id, chapter: c.slug }))
      )
  : undefined) as Params<{ book: string; chapter: string }>;

export const subStaticParams = (staticMode
  ? async () =>
      (await listBooks()).flatMap((b) =>
        b.chapters.flatMap((c) =>
          c.subchapters.map((s) => ({ book: b.id, chapter: c.slug, sub: s.slug }))
        )
      )
  : undefined) as Params<{ book: string; chapter: string; sub: string }>;
