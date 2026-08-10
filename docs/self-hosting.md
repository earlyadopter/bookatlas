# Self-hosting Bookatlas

Bookatlas is a Next.js app that reads markdown books straight from the server's
filesystem at request time — no database, no CMS, no build step for content.
Self-hosting therefore comes down to two things: get the app running somewhere,
and make sure your book folders are on that machine's disk.

The [README](../README.md) covers writing books and registering them in
`books.config.json` / `books.config.local.json`. This guide covers deployment.

## The one constraint that shapes everything

Content is read with `fs` per request (with mtime caching — edit a file,
refresh the browser). That means:

- **Long-running server** (your machine, a VPS, Docker): books can live
  *anywhere* on disk, including outside the repo. Absolute paths in the config
  are fine. This is the most flexible mode.
- **Serverless** (Vercel and friends): only files traced into the deployment
  bundle exist at runtime. Books must live *inside the repo* and be listed in
  `outputFileTracingIncludes` — see the Vercel section below.

## Option A: a long-running server (VPS, home server, Docker)

```bash
pnpm install
pnpm build
pnpm start --port 3000
```

Put your books wherever you like and point `books.config.local.json` at them
with absolute paths (it's gitignored, so your library stays out of version
control and survives `git pull`):

```jsonc
{
  "books": [
    { "id": "kafka-notes", "title": "Kafka Notes", "path": "/srv/books/kafka-notes" }
  ]
}
```

Editing a chapter file (or dropping in a new one) shows up on the next browser
refresh — no restart, no rebuild. Put the usual reverse proxy (Caddy, nginx)
in front for TLS.

## Option B: Vercel (or another serverless platform)

This is how [bookatlas.dev](https://bookatlas.dev) runs. The demo book deploys
out of the box; for your own books:

1. **Fork the repo** — a private fork if your books are private.
2. **Put each book inside the repo**, e.g. `content/kafka-notes/`, and commit it.
3. **Register it in the committed config**, `books.config.json`.
   (`books.config.local.json` is gitignored, so it never reaches a serverless
   deploy — on a private fork, the committed config *is* your private library.)
4. **Trace the content directory** in `next.config.ts`. Serverless bundlers
   can't follow dynamic `fs` paths, so anything read at request time must be
   listed explicitly:

   ```ts
   outputFileTracingIncludes: {
     "/**": ["./demo/**", "./books.config.json", "./content/**"]
   }
   ```

   Symptom of skipping this: the landing page works, every book page 500s —
   the book folders simply aren't in the deployed bundle.
5. **Import the fork in Vercel.** Framework auto-detects; no env vars are
   required. Add your domain under Settings → Domains if you have one.

Run `pnpm parse:check` before deploying — it prints per-chapter section counts
and fails on structural anomalies, so you catch a mis-parsed corpus locally
instead of in production. If a book parses badly, see
[parser-overrides.md](parser-overrides.md).

## Analytics (opt-in)

Tracking is off by default. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` to a Google
Analytics measurement ID to enable it for a deployment; without the variable
the app loads no tracking at all. (It's a `NEXT_PUBLIC_` variable, so it's
baked in at build time — redeploy after setting it.)

## What's already handled for you

- **Raw markdown never leaves the server.** Everything renders to HTML
  server-side; source `.md` is not serialized to the client or reachable
  through any route.
- **The asset route is allowlisted.** `/b/<book>/asset/…` serves images from
  the book folder only, by extension allowlist — it won't serve `.md` or
  anything else.
- **Routes are dynamic on purpose** (`force-dynamic`): there is no static
  export of content, so edits are always live.

## Staying current

Your fork carries your `content/` and config on top of upstream. To pick up
Bookatlas updates:

```bash
git remote add upstream https://github.com/earlyadopter/bookatlas.git  # once
git fetch upstream && git merge upstream/main
```

Conflicts should be rare — your changes and upstream's touch different files
by design (content and config vs. app code).
