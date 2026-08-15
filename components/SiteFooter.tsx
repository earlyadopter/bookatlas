// Single-book deployments: the branding moves out of the topbar and into a
// quiet cross-reference footer. Renders nothing on multi-book sites.
export function SiteFooter() {
  if (!process.env.SINGLE_BOOK) return null;
  return (
    <footer className="site-footer">
      Built with <a href="https://bookatlas.dev">Bookatlas</a> — markdown books as zoomable atlases.
    </footer>
  );
}
