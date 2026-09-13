import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — BookAtlas",
  description: "BookAtlas privacy policy: no data collected, no network access."
};

export default function PrivacyPage() {
  return (
    <main className="page">
      <header className="topbar">
        <Link href="/" className="brand">Bookatlas</Link>
        <Link href="/mac" className="topbar-book">BookAtlas for Mac</Link>
      </header>

      <h1 className="page-title">Privacy Policy</h1>
      <p className="hero-note">Last updated 13 September 2026.</p>

      <section className="landing-section">
        <p className="hero-note">
          BookAtlas for Mac is a document reader and light editor. It is built to keep your files
          private.
        </p>
        <ul className="hero-note">
          <li><strong>No data is collected.</strong> BookAtlas has no accounts, no analytics, and no tracking of any kind.</li>
          <li><strong>No network access.</strong> The app makes no internet connections. Your documents never leave your Mac.</li>
          <li><strong>Your files, read on request.</strong> BookAtlas reads only the files and folders you explicitly open or drop onto it, and it writes only when you edit a document and only to that document.</li>
          <li><strong>Nothing shared.</strong> Because no data is collected, nothing is shared with anyone.</li>
        </ul>
      </section>

      <section className="landing-section">
        <h2 className="page-title">This website</h2>
        <p className="hero-note">
          The policy above covers the Mac app. This website, bookatlas.dev, uses Google Analytics to
          count page visits; Google may set cookies for that. The site has no accounts and does not
          ask for any personal information.
        </p>
        <p className="hero-note">
          Questions: <a href="mailto:support@bookatlas.dev">support@bookatlas.dev</a>.
        </p>
      </section>

      <footer className="landing-footer">
        <Link href="/">bookatlas.dev</Link> · <Link href="/mac">Mac app</Link> · <Link href="/support">Support</Link>
      </footer>
    </main>
  );
}
