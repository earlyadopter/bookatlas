import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/loadBook";
import { chapterHref } from "@/lib/slugs";
import { matchesFilter, parseFilter } from "@/lib/nav";
import { FilterChips } from "@/components/FilterChips";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
  searchParams
}: {
  params: Promise<{ book: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { book: bookId } = await params;
  const { f } = await searchParams;
  const book = await getBook(bookId);
  if (!book) notFound();
  const filter = parseFilter(f);

  return (
    <main
      className="page"
      style={book.accent ? ({ "--g": book.accent } as React.CSSProperties) : undefined}
    >
      <header className="topbar">
        <Link href="/" className="brand">Bookatlas</Link>
        <ThemeToggle />
      </header>
      <h1 className="page-title">{book.title}</h1>
      <FilterChips basePath={`/b/${book.id}`} active={filter} counts={book.tagCounts} />
      <div className="chapter-grid">
        {book.chapters.map((ch) => {
          const matching = filter
            ? ch.subchapters.filter((s) => matchesFilter(s, filter)).length
            : null;
          const dimmed = matching !== null && matching === 0;
          return (
            <Link
              key={ch.slug}
              href={chapterHref(book.id, ch.slug, filter ?? undefined)}
              className={dimmed ? "chapter-tile dimmed" : "chapter-tile"}
            >
              <span className="chapter-tile-num">{String(ch.number).padStart(2, "0")}</span>
              {ch.part ? <span className="eyebrow">{ch.part}</span> : null}
              <span className="chapter-tile-title">{ch.title}</span>
              <span className="chapter-tile-meta">
                {ch.subchapters.length} sections
                {matching !== null && matching > 0 ? ` · ${matching} matching` : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
