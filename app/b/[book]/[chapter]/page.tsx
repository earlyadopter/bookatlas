import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/loadBook";
import { chapterHref, subHref, matchesFilter, parseFilter } from "@bookatlas/core";
import { ChapterStrip, FilterChips, TransitionLink } from "@bookatlas/core/components";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const chapterIdx = book.chapters.findIndex((c) => c.slug === chapterSlug);
  if (chapterIdx === -1) notFound();
  const chapter = book.chapters[chapterIdx];
  const prevChapter = chapterIdx > 0 ? book.chapters[chapterIdx - 1] : null;
  const nextChapter = chapterIdx < book.chapters.length - 1 ? book.chapters[chapterIdx + 1] : null;
  const filter = parseFilter(f);
  const showFilters = book.filters !== false;

  const stripItems = book.chapters.map((c) => ({
    href: chapterHref(book.id, c.slug, filter ?? undefined),
    num: String(c.number).padStart(2, "0"),
    title: c.title,
    current: c.slug === chapter.slug
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
      <ChapterStrip items={stripItems} />
      <h1 className="page-title">{chapter.fullTitle}</h1>
      {showFilters ? (
        <FilterChips
          basePath={`/b/${book.id}/${chapter.slug}`}
          active={filter}
          counts={book.tagCounts}
        />
      ) : null}
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
                {showFilters ? (
                  <span className="sub-tile-badges">
                    {sub.tags.includes("interview") ? <span className="badge interview">Q&A</span> : null}
                    {sub.tags.includes("cheatsheet") ? <span className="badge cheatsheet">cheat sheet</span> : null}
                    {sub.tags.includes("code") ? <span className="badge code">code</span> : null}
                    {!sub.tags.includes("interview") && sub.hasInterviewBlocks ? (
                      <span className="badge dot" title="Interview Q&A inside">●</span>
                    ) : null}
                  </span>
                ) : null}
              </span>
              <span className="sub-tile-title">{sub.title}</span>
              {sub.excerpt ? <span className="sub-tile-excerpt">{sub.excerpt}</span> : null}
              <span className="sub-tile-meta">{sub.wordCount} words</span>
            </TransitionLink>
          );
        })}
      </div>
      <div className="pager">
        {prevChapter ? (
          <TransitionLink
            href={chapterHref(book.id, prevChapter.slug, filter ?? undefined)}
            className="pager-card"
          >
            <span className="eyebrow">← Previous</span>
            <span>{prevChapter.fullTitle}</span>
          </TransitionLink>
        ) : (
          <span />
        )}
        {nextChapter ? (
          <TransitionLink
            href={chapterHref(book.id, nextChapter.slug, filter ?? undefined)}
            className="pager-card next"
          >
            <span className="eyebrow">Next →</span>
            <span>{nextChapter.fullTitle}</span>
          </TransitionLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
