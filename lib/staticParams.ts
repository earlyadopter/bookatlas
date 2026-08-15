// Enables the full-route cache for book pages in STATIC_BOOKS mode: pages
// re-export this. When static mode is off it is undefined, which Next
// treats as "no generateStaticParams" — keeping default per-request
// rendering (an unconditional export makes dynamic API use a hard error).
export const generateStaticParams =
  process.env.STATIC_BOOKS === "1" ? async () => [] : (undefined as unknown as () => Promise<never[]>);
