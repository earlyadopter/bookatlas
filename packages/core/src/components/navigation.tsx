"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AnchorHTMLAttributes, ComponentType, ReactNode, Ref } from "react";

// Router seam. The interaction components (TransitionLink, KeyNav,
// ChapterStrip, FilterChips) never import a framework router; they ask this
// context for a Link component, a push(), and a pathname hook. The Next site
// provides next/link + next/navigation; the Mac app's atlas bundle provides a
// hash router; with no provider at all, plain anchors and full page loads.

export type AtlasLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  ref?: Ref<HTMLAnchorElement>;
  children?: ReactNode;
};

export type AtlasNavigation = {
  /** Renders an anchor for an in-app href (client-side navigation if the router has it). */
  Link: ComponentType<AtlasLinkProps>;
  push: (href: string) => void;
  /** Current pathname; must re-render on route change (RouteListener relies on it). */
  usePathname: () => string;
};

function PlainLink({ href, children, ...rest }: AtlasLinkProps) {
  // React 19 passes `ref` as a regular prop, so it rides along in `rest`.
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function usePlainPathname(): string {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname
  );
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return pathname;
}

export const plainNavigation: AtlasNavigation = {
  Link: PlainLink,
  push: (href) => {
    window.location.assign(href);
  },
  usePathname: usePlainPathname
};

const AtlasNavContext = createContext<AtlasNavigation>(plainNavigation);

export function AtlasNavProvider({
  navigation,
  children
}: {
  navigation: AtlasNavigation;
  children: ReactNode;
}) {
  return <AtlasNavContext.Provider value={navigation}>{children}</AtlasNavContext.Provider>;
}

export function useAtlasNav(): AtlasNavigation {
  return useContext(AtlasNavContext);
}
