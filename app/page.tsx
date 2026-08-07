import Link from "next/link";
import { listBooks } from "@/lib/loadBook";
import { bookHref } from "@/lib/slugs";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const books = await listBooks();

  return (
    <main className="page">
      <header className="topbar">
        <span className="brand">Textbook Viewer</span>
        <ThemeToggle />
      </header>
      <h1 className="page-title">Library</h1>
      <div className="book-grid">
        {books.map((book) => {
          const subCount = book.chapters.reduce((n, ch) => n + ch.subchapters.length, 0);
          return (
            <Link
              key={book.id}
              href={bookHref(book.id)}
              className="book-card"
              style={book.accent ? ({ "--g": book.accent } as React.CSSProperties) : undefined}
            >
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
    </main>
  );
}
