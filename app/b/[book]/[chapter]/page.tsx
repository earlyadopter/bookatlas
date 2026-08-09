import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/loadBook";
import { subHref } from "@/lib/slugs";
import { matchesFilter, parseFilter } from "@/lib/nav";
import { ChapterStrip } from "@/components/ChapterStrip";
import { FilterChips } from "@/components/FilterChips";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TransitionLink } from "@/components/transitions";

export const dynamic = "force-dynamic";

export default async function ChapterPage({
  params,
  searchParams
}: {
  params: Promise<{ book: string; chapter: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { book: bookId, chapter: chapterSlug } = await params;
  const { f } = await searchParams;
  const book = await getBook(bookId);
  if (!book) notFound();
  const chapter = book.chapters.find((c) => c.slug === chapterSlug);
  if (!chapter) notFound();
  const filter = parseFilter(f);

  const stripChapters = book.chapters.map((c) => ({
    slug: c.slug,
    number: c.number,
    title: c.title,
    subCount: c.subchapters.length
  }));

  return (
    <main
      className="page wide"
      style={book.accent ? ({ "--g": book.accent } as React.CSSProperties) : undefined}
    >
      <header className="topbar">
        <Link href="/" className="brand">Bookatlas</Link>
        <Link href={`/b/${book.id}`} className="topbar-book">{book.title}</Link>
        <ThemeToggle />
      </header>
      <ChapterStrip
        bookId={book.id}
        chapters={stripChapters}
        currentSlug={chapter.slug}
        filter={filter ?? undefined}
      />
      <h1 className="page-title">{chapter.fullTitle}</h1>
      <FilterChips
        basePath={`/b/${book.id}/${chapter.slug}`}
        active={filter}
        counts={book.tagCounts}
      />
      {chapter.preambleHtml ? (
        <details className="preamble">
          <summary>About this book</summary>
          <div className="doc" dangerouslySetInnerHTML={{ __html: chapter.preambleHtml }} />
        </details>
      ) : null}
      {chapter.introHtml ? (
        <div className="doc chapter-intro" dangerouslySetInnerHTML={{ __html: chapter.introHtml }} />
      ) : null}
      <div className="sub-grid">
        {chapter.subchapters.map((sub) => {
          const dimmed = filter !== null && !matchesFilter(sub, filter);
          return (
            <TransitionLink
              key={sub.slug}
              href={subHref(book.id, chapter.slug, sub.slug, filter ?? undefined)}
              className={dimmed ? "sub-tile dimmed" : "sub-tile"}
              morph
            >
              <span className="sub-tile-head">
                <span className="sub-tile-num">{sub.displayNumber || "•"}</span>
                <span className="sub-tile-badges">
                  {sub.tags.includes("interview") ? <span className="badge interview">Q&A</span> : null}
                  {sub.tags.includes("cheatsheet") ? <span className="badge cheatsheet">cheat sheet</span> : null}
                  {sub.tags.includes("code") ? <span className="badge code">code</span> : null}
                  {!sub.tags.includes("interview") && sub.hasInterviewBlocks ? (
                    <span className="badge dot" title="Interview Q&A inside">●</span>
                  ) : null}
                </span>
              </span>
              <span className="sub-tile-title">{sub.title}</span>
              {sub.excerpt ? <span className="sub-tile-excerpt">{sub.excerpt}</span> : null}
              <span className="sub-tile-meta">{sub.wordCount} words</span>
            </TransitionLink>
          );
        })}
      </div>
    </main>
  );
}
