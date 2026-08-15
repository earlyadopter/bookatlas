import Link from "next/link";
import { notFound } from "next/navigation";
import type { Chapter } from "@bookatlas/core";
import { getBook } from "@/lib/loadBook";
import { chapterHref, matchesFilter, parseFilter } from "@bookatlas/core";
import { FilterChips } from "@bookatlas/core/components";
import { ThemeToggle } from "@/components/ThemeToggle";



// Consecutive chapters sharing a part/group render as one titled grid.
type Section = { group: string | null; part: string | null; chapters: Chapter[] };

export { generateStaticParams } from "@/lib/staticParams";

export default async function BookPage({
  params,
  searchParams
}: {
  params: Promise<{ book: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { book: bookId } = await params;
  // Static mode skips searchParams (filters read as off) so the page can
  // prerender; otherwise awaiting it keeps rendering per-request.
  const { f } = process.env.STATIC_BOOKS === "1" ? ({} as { f?: string }) : await searchParams;
  const book = await getBook(bookId);
  if (!book) notFound();
  const filter = parseFilter(f);
  const showFilters = book.filters !== false;

  const sections: Section[] = [];
  for (const ch of book.chapters) {
    const part = ch.part ?? null;
    const group = ch.partGroup ?? null;
    const last = sections[sections.length - 1];
    if (!last || last.part !== part || last.group !== group) {
      sections.push({ group, part, chapters: [ch] });
    } else {
      last.chapters.push(ch);
    }
  }

  let prevGroup: string | null = null;
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
      {showFilters ? (
        <FilterChips basePath={`/b/${book.id}`} active={filter} counts={book.tagCounts} />
      ) : null}
      {sections.map((section, si) => {
        const groupHeading = section.group && section.group !== prevGroup ? section.group : null;
        prevGroup = section.group;
        return (
          <section key={si} className="book-section">
            {groupHeading ? <h2 className="group-title">{groupHeading}</h2> : null}
            {section.part ? <h3 className="part-title">{section.part}</h3> : null}
            <div className="chapter-grid">
              {section.chapters.map((ch) => {
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
                    <span className="chapter-tile-title">{ch.title}</span>
                    <span className="chapter-tile-meta">
                      {ch.subchapters.length} sections
                      {matching !== null && matching > 0 ? ` · ${matching} matching` : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
