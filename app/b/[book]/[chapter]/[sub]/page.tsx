import Link from "next/link";
import { TransitionLink } from "@/components/transitions";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getBook } from "@/lib/loadBook";
import { chapterHref, subHref } from "@/lib/slugs";
import { getPrevNext, matchesFilter, parseFilter } from "@/lib/nav";
import { ChapterStrip } from "@/components/ChapterStrip";
import { KeyNav } from "@/components/KeyNav";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

// Takes only the outline fields, never a full SubChapter — keeps section
// content (html) out of this subtree so nothing can serialize it client-side.
function MiniTile({
  bookId,
  chapterSlug,
  slug,
  displayNumber,
  title,
  distance,
  filter
}: {
  bookId: string;
  chapterSlug: string;
  slug: string;
  displayNumber: string;
  title: string;
  distance: number;
  filter?: string;
}) {
  return (
    <TransitionLink
      href={subHref(bookId, chapterSlug, slug, filter)}
      className={distance <= 2 ? "mini" : "mini far"}
      style={{ "--d": distance } as CSSProperties}
    >
      <span className="mini-num">{displayNumber || "•"}</span>
      <span className="mini-title">{title}</span>
    </TransitionLink>
  );
}

export default async function SubChapterPage({
  params,
  searchParams
}: {
  params: Promise<{ book: string; chapter: string; sub: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { book: bookId, chapter: chapterSlug, sub: subSlug } = await params;
  const { f } = await searchParams;
  const book = await getBook(bookId);
  if (!book) notFound();
  const chapterIdx = book.chapters.findIndex((c) => c.slug === chapterSlug);
  if (chapterIdx === -1) notFound();
  const chapter = book.chapters[chapterIdx];
  const sub = chapter.subchapters.find((s) => s.slug === subSlug);
  if (!sub) notFound();
  const filter = parseFilter(f);
  const fParam = filter ?? undefined;

  // Rails: siblings within this chapter, respecting the active filter (the
  // current sub always shows even if it doesn't match).
  const siblings = chapter.subchapters.filter(
    (s) => s.slug === sub.slug || filter === null || matchesFilter(s, filter)
  );
  const currentPos = siblings.findIndex((s) => s.slug === sub.slug);
  const before = siblings.slice(0, currentPos); // reading order
  const after = siblings.slice(currentPos + 1);

  // Cross-chapter prev/next (filter-aware).
  const { prev, next, index, total } = getPrevNext(book, chapterSlug, subSlug, filter);
  const prevHref = prev ? subHref(book.id, prev.chapterSlug, prev.sub.slug, fParam) : null;
  const nextHref = next ? subHref(book.id, next.chapterSlug, next.sub.slug, fParam) : null;
  const upHref = chapterHref(book.id, chapter.slug, fParam);
  const prevChapter = chapterIdx > 0 ? book.chapters[chapterIdx - 1] : null;
  const nextChapter = chapterIdx < book.chapters.length - 1 ? book.chapters[chapterIdx + 1] : null;

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
      <KeyNav
        prevHref={prevHref}
        nextHref={nextHref}
        upHref={upHref}
        prevChapterHref={prevChapter ? chapterHref(book.id, prevChapter.slug, fParam) : null}
        nextChapterHref={nextChapter ? chapterHref(book.id, nextChapter.slug, fParam) : null}
      />
      <header className="topbar">
        <Link href="/" className="brand">Bookatlas</Link>
        <Link href={`/b/${book.id}`} className="topbar-book">{book.title}</Link>
        <ThemeToggle />
      </header>
      <ChapterStrip
        bookId={book.id}
        chapters={stripChapters}
        currentSlug={chapter.slug}
        filter={fParam}
      />
      <div className="zoom">
        {/* column-reverse: nearest-first DOM order renders bottom-up, so the
            rail starts scrolled to the neighbor adjacent to the article. */}
        <aside className="rail rail-left" aria-label="Earlier sections">
          {[...before].reverse().map((s, i) => (
            <MiniTile
              key={s.slug}
              bookId={book.id}
              chapterSlug={chapter.slug}
              slug={s.slug}
              displayNumber={s.displayNumber}
              title={s.title}
              distance={i + 1}
              filter={fParam}
            />
          ))}
        </aside>
        <article className="stage">
          <div className="stage-nav">
            <span className="eyebrow">
              {index + 1} / {total} · {chapter.fullTitle}
              {filter ? ` · filtered: ${filter}` : ""}
            </span>
            <span className="stage-nav-btns">
              {prevHref ? <TransitionLink href={prevHref} className="chip">← prev</TransitionLink> : null}
              <TransitionLink href={upHref} className="chip">⊞ all</TransitionLink>
              {nextHref ? <TransitionLink href={nextHref} className="chip">next →</TransitionLink> : null}
            </span>
          </div>
          <h1 className="stage-title">
            {sub.displayNumber ? <span className="stage-num">{sub.displayNumber}</span> : null}
            {sub.title}
          </h1>
          <div className="doc" dangerouslySetInnerHTML={{ __html: sub.html }} />
          <div className="pager">
            {prev ? (
              <TransitionLink href={prevHref!} className="pager-card">
                <span className="eyebrow">← Previous</span>
                <span>{prev.sub.displayNumber} {prev.sub.title}</span>
              </TransitionLink>
            ) : (
              <span />
            )}
            {next ? (
              <TransitionLink href={nextHref!} className="pager-card next">
                <span className="eyebrow">Next →</span>
                <span>{next.sub.displayNumber} {next.sub.title}</span>
              </TransitionLink>
            ) : (
              <span />
            )}
          </div>
        </article>
        <aside className="rail rail-right" aria-label="Later sections">
          {after.map((s, i) => (
            <MiniTile
              key={s.slug}
              bookId={book.id}
              chapterSlug={chapter.slug}
              slug={s.slug}
              displayNumber={s.displayNumber}
              title={s.title}
              distance={i + 1}
              filter={fParam}
            />
          ))}
        </aside>
      </div>
    </main>
  );
}
