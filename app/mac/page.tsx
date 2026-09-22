import Link from "next/link";
import type { Metadata } from "next";
import { APP_STORE_URL, CLOUD_URL, GITHUB_URL, MAC_PRICE } from "@/lib/links";

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

      <section className="hero">
        <h1 className="hero-title">BookAtlas Desktop</h1>
        <p className="hero-sub">A native app for macOS 15 or later.</p>
        <p className="hero-lede">
          The desktop companion to the open-source Bookatlas. Drop a markdown file or a whole
          folder and read it as a zoomable atlas: files and chapters on strips up top, sections as
          tiles, click to zoom into a reading view with neighbouring sections on side rails. Open
          straight from Finder, adjust the text size, switch light and dark, and make quick edits in
          place — click any block to edit its markdown, click away to save.
        </p>
        <p className="hero-actions">
          {APP_STORE_URL ? (
            <a href={APP_STORE_URL} className="chip current">
              On the Mac App Store — {MAC_PRICE} →
            </a>
          ) : (
            <span className="chip">Coming soon to the Mac App Store</span>
          )}
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
