import Link from "next/link";
import { connection } from "next/server";
import { listBooks } from "@/lib/loadBook";
import { bookHref } from "@/lib/hrefs";
import { ThemeToggle } from "@/components/ThemeToggle";



const GITHUB_URL = "https://github.com/earlyadopter/bookatlas";

// Books that are format demos, not the product's subject — badged on the card.
const DEMO_BOOK_IDS = new Set(["mulesoft-bootcamp"]);

// Content-in-repo deployments set STATIC_BOOKS=1: pages render once per
// deploy and serve from the full-route cache. Otherwise connection() keeps
// rendering per-request so live-edited books refresh immediately.
export default async function LibraryPage() {
  // Single-book deployments serve the book itself at the root.
  if (process.env.SINGLE_BOOK) {
    const { default: BookPage } = await import("./b/[book]/page");
    return BookPage({
      params: Promise.resolve({ book: process.env.SINGLE_BOOK }),
      searchParams: Promise.resolve({})
    });
  }
  if (process.env.STATIC_BOOKS !== "1") await connection();
  const books = await listBooks();

  return (
    <main className="page">
      <header className="topbar">
        <span className="brand">Bookatlas</span>
        <a href={GITHUB_URL} className="topbar-book" target="_blank" rel="noopener">
          GitHub
        </a>
        <ThemeToggle />
      </header>

      <section className="hero">
        <h1 className="hero-title">Markdown books as zoomable tile atlases</h1>
        <p className="hero-lede">
          Turn folders of markdown — saved LLM conversations, book drafts, course notes — into a
          spatial reading experience: chapters as tiles, sections as tiles, click to zoom into a
          reading view with neighboring sections on side rails. Built for texts that are too big to
          scroll and too structured to flatten. Open source, MIT, no database.
        </p>
        <p className="hero-actions">
          <a href={GITHUB_URL} className="chip current" target="_blank" rel="noopener">
            Get it on GitHub →
          </a>
        </p>
      </section>

      <h2 className="page-title">Try it — the demo book, live</h2>
      <p className="hero-note">
        The subject is incidental — any folder of markdown gets this treatment. This demo happens
        to be a 20-module MuleSoft bootcamp, generated in conversation with ChatGPT and rendered
        straight from its markdown files. Click the book, then a chapter, then any tile. Use{" "}
        <kbd>←</kbd>/<kbd>→</kbd> to read through.
      </p>
      <div className="book-grid">
        {books.map((book) => {
          const subCount = book.chapters.reduce((n, ch) => n + ch.subchapters.length, 0);
          return (
            <Link
              key={book.id}
              href={bookHref(book.id)}
              className={DEMO_BOOK_IDS.has(book.id) ? "book-card demo" : "book-card"}
              style={book.accent ? ({ "--g": book.accent } as React.CSSProperties) : undefined}
            >
              {DEMO_BOOK_IDS.has(book.id) ? <span className="demo-badge">DEMO</span> : null}
              {book.coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="book-card-cover" src={book.coverUrl} alt="" />
              ) : null}
              <span className="eyebrow">{book.chapters.length} chapters · {subCount} sections</span>
              <span className="book-card-title">{book.title}</span>
              {book.description ? <span className="book-card-desc">{book.description}</span> : null}
              <span className="book-card-meta">
                {book.tagCounts.interview} interview · {book.tagCounts.cheatsheet} cheat sheets ·{" "}
                {book.tagCounts.code} with code
              </span>
            </Link>
          );
        })}
      </div>
      {books.length === 0 ? (
        <p className="empty">No books configured. Add one to books.config.json.</p>
      ) : null}

      <section className="landing-section">
        <h2 className="page-title">The whole book on one screen</h2>
        <p className="hero-note">
          Chapter tiles with section counts and content-type filters — non-matching sections dim
          but stay in place, so the spatial map survives filtering.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="landing-shot" src="/shots/book-chapters.png" alt="Book view: chapter tiles with section counts and filter chips" />
      </section>

      <section className="landing-section">
        <h2 className="page-title">Drill mode</h2>
        <p className="hero-note">
          Filter to interview Q&A and read the filtered sequence — prev/next skips to the nearest
          matching section, across chapter boundaries.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="landing-shot" src="/shots/interview-drill.png" alt="Filtered reading view with rails showing only matching sections" />
      </section>

      <section className="landing-section">
        <h2 className="page-title">Run it on your own books</h2>
        <pre className="landing-code">{`git clone ${GITHUB_URL}.git
cd bookatlas
pnpm install && pnpm dev
# point books.config.json at any folder of .md files`}</pre>
        <p className="hero-note">
          Two parsing profiles, auto-applied: folders of chapter files (LLM-conversation exports,
          where heading depth lies) and single-file books with <code>Chapter N</code> headings.{" "}
          <a href={`${GITHUB_URL}#making-book-files-from-an-llm-conversation`} target="_blank" rel="noopener">
            How to make book files from an LLM conversation →
          </a>
        </p>
      </section>

      <footer className="landing-footer">
        <a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a> ·{" "}
        <a href="https://modernqacourse.com" target="_blank" rel="noopener">powers modernQAcourse</a> ·{" "}
        MIT © <a href="https://earlyadopterlabs.com" target="_blank" rel="noopener">Yuri Syuganov</a>
      </footer>
    </main>
  );
}
