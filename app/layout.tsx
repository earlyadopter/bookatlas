import type { Metadata } from "next";
import "./globals.css";
// Self-hosted fonts (Fontsource): bundled at build, no fonts.google.com
// dependency — transient CDN failures were breaking production deploys.
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/cyrillic-400.css";
import "@fontsource/ibm-plex-sans/cyrillic-500.css";
import "@fontsource/ibm-plex-sans/cyrillic-600.css";
import "@fontsource/ibm-plex-mono/400.css";
import { RouteListener } from "@bookatlas/core/components";

export const metadata: Metadata = {
  title: { default: "Bookatlas", template: "%s — Bookatlas" },
  description: "Markdown books as zoomable tile atlases"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Analytics is opt-in per deployment: set NEXT_PUBLIC_GA_MEASUREMENT_ID in
  // the environment. Self-hosted instances without it load no tracking at all.
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
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
        {gaId ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');`
              }}
            />
          </>
        ) : null}
        <RouteListener />
        {children}
      </body>
    </html>
  );
}
