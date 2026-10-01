import Link from "next/link";
import type { Metadata } from "next";
import { APP_STORE_URL, appStoreLink, CLOUD_URL, GITHUB_URL, MAC_PRICE } from "@/lib/links";

export const metadata: Metadata = {
  title: "BookAtlas Desktop for Mac",
  description:
    "BookAtlas Desktop is a native Mac app that turns any folder of markdown into a zoomable tile atlas — read, navigate, and make quick edits in place."
};

export default function MacPage() {
  return (
    <main className="page">
      <header className="topbar">
        <Link href="/" className="brand">Bookatlas</Link>
        <a href={CLOUD_URL} className="topbar-book">Cloud</a>
        <Link href="/" className="topbar-book">Web version</Link>
      </header>

      {/* The demo leads, the price follows.
          The Mac App Store has no trial for a one-time purchase, so a visitor
          is otherwise asked to pay $9.99 for something they have never seen,
          from a developer they do not know, on a listing with no ratings yet.
          The open web version IS the trial — it is the same parser and the same
          reading view — so the first action on this page is to go use it. */}
      <section className="hero">
        <h1 className="hero-title">BookAtlas Desktop</h1>
        <p className="hero-sub">Read a folder of markdown as a map, not a scroll.</p>
        <p className="hero-lede">
          Chapters and sections become tiles. Click one to zoom into the reading view, with its
          neighbours on the side rails; the arrow keys read straight through a whole folder.
          BookAtlas Desktop does it natively on macOS, from files already on your disk — opened
          from Finder, nothing imported, nothing uploaded — and lets you edit a block in place.
        </p>
        <p className="hero-actions">
          <Link href="/b/american-history" className="chip current">
            Try it now in your browser — no download →
          </Link>
          {APP_STORE_URL ? (
            <a href={appStoreLink("site-mac-page")} className="chip">
              Get the Mac app — {MAC_PRICE} →
            </a>
          ) : (
            <span className="chip">Coming soon to the Mac App Store</span>
          )}
        </p>
        <p className="hero-note">
          The browser version is the same reader, open source and free. The Mac app adds Finder
          integration, offline use and in-place editing. macOS 15 or later.
        </p>
      </section>

      <section className="landing-section">
        <h2 className="page-title">What it does</h2>
        <ul className="hero-note">
          <li><strong>Reads what is on disk.</strong> Your markdown files stay where they are; nothing is imported or uploaded.</li>
          <li><strong>Folders and single files.</strong> A folder becomes a book of chapters; a long structured file becomes chapters and sections.</li>
          <li><strong>Finder-native.</strong> Right-click ▸ Open With, or drag onto the window. Sub-folders show up as a tree.</li>
          <li><strong>Read with the keyboard.</strong> → opens the first tile and reads on section by section, then on to the next book in the folder; ← walks back; Esc goes up a level.</li>
          <li><strong>Sample books included.</strong> A short user guide, American history, two adulting handbooks and a music theory course to try before opening your own files.</li>
          <li><strong>Edit in place.</strong> Click a paragraph or heading to edit its markdown; leaving the block saves that part of the file.</li>
          <li><strong>Private by design.</strong> No account, no network, no tracking. The app reads only the files you open.</li>
        </ul>
      </section>

      <section className="landing-section">
        <h2 className="page-title">Open source at the core</h2>
        <p className="hero-note">
          BookAtlas is built on <a href={GITHUB_URL} target="_blank" rel="noopener">Bookatlas</a>,
          MIT-licensed. The web version and the parsing engine are free and open; the Mac app packages
          them as a polished, sandboxed desktop reader. To publish a book online instead of reading it
          locally, <a href={CLOUD_URL}>Bookatlas Cloud</a> hosts it at a shareable URL.
        </p>
      </section>

      <footer className="landing-footer">
        <Link href="/">bookatlas.dev</Link> ·{" "}
        <Link href="/support">Support</Link> ·{" "}
        <Link href="/privacy">Privacy</Link> ·{" "}
        <a href={CLOUD_URL}>Cloud</a> ·{" "}
        <a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
      </footer>
    </main>
  );
}
