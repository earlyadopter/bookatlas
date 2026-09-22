import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — BookAtlas Desktop",
  description: "Help and contact for BookAtlas, the markdown atlas reader for Mac."
};

export default function SupportPage() {
  return (
    <main className="page">
      <header className="topbar">
        <Link href="/" className="brand">Bookatlas</Link>
        <Link href="/mac" className="topbar-book">BookAtlas Desktop</Link>
      </header>

      <h1 className="page-title">Support</h1>
      <p className="hero-note">
        BookAtlas is a markdown reader and light editor for Mac. Here are answers to the most common
        questions; if yours isn&rsquo;t covered, email{" "}
        <a href="mailto:support@bookatlas.dev">support@bookatlas.dev</a>.
      </p>

      <section className="landing-section">
        <h2 className="page-title">Getting started</h2>
        <ul className="hero-note">
          <li><strong>Open a file or folder.</strong> Right-click a markdown file in Finder ▸ Open With ▸ BookAtlas, drag a file or folder onto the window, or press ⌘O. To try it first, click one of the sample books on the start screen (also under Help ▸ Sample Books); &ldquo;A Short User Guide to BookAtlas&rdquo; is a tour of the app.</li>
          <li><strong>&ldquo;It only shows one file.&rdquo;</strong> macOS shares just the file you opened. The first time, BookAtlas asks once to see the folder so it can list the other files; choosing your home folder answers it for good. You can change this in Settings.</li>
          <li><strong>Navigate.</strong> On a page of tiles, → opens the first one; in the reading view → and ← move between sections. At the end of a book, → lights up the next file in the strip on top and a second → opens it. Esc goes up a level; the ⊞ pill with the folder&rsquo;s name, or the folder name in the sidebar, shows all its files again. ⌘+, ⌘−, and ⌘0 change text size.</li>
          <li><strong>Edit.</strong> In the reading view, click a paragraph or heading to edit its markdown; click elsewhere or press Esc and the change is saved to the file.</li>
        </ul>
      </section>

      <section className="landing-section">
        <h2 className="page-title">Privacy</h2>
        <p className="hero-note">
          BookAtlas reads only the files you open and makes no network connections. See the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>

      <section className="landing-section">
        <h2 className="page-title">Contact</h2>
        <p className="hero-note">
          Email <a href="mailto:support@bookatlas.dev">support@bookatlas.dev</a>, or open an issue on{" "}
          <a href="https://github.com/earlyadopter/bookatlas" target="_blank" rel="noopener">GitHub</a>.
        </p>
      </section>

      <footer className="landing-footer">
        <Link href="/">bookatlas.dev</Link> · <Link href="/mac">Desktop</Link> · <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
