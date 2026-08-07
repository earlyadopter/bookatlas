import type { Metadata } from "next";
import "./globals.css";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { RouteListener } from "@/components/transitions";

const displayFont = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal"],
  variable: "--font-display"
});

const sansFont = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-sans"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: { default: "Textbook Viewer", template: "%s — Textbook Viewer" },
  description: "Markdown books as zoomable tiles"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}
    >
      <body>
        {/* Runs before anything below it paints — prevents a theme flash.
            Must live inside <body>: React 19 can't order sync scripts that sit
            directly under <html>. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var theme = localStorage.getItem('tv_theme');
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  } catch (e) {}
})();`
          }}
        />
        <RouteListener />
        {children}
      </body>
    </html>
  );
}
