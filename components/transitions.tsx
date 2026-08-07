"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useLayoutEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

// Zoom morph, tier 2 of the plan: manual document.startViewTransition around
// router.push, with a pathname-change promise so the snapshot holds until the
// new route commits. (Tier 1 — React's unstable_ViewTransition — is absent
// from stable React 19.2.) Browsers without the API get a plain push.
//
// Morph pairing: a clicked grid tile is stamped with the shared
// view-transition-name at click time; the zoom view's title carries the same
// name statically (see .stage-title in globals.css), so tile → title morphs
// on the way in and title → title morphs between sub-chapters. Only ever one
// name per document side — duplicates make the browser skip the animation.

export const MORPH_NAME = "zoom-target";

let pendingResolve: (() => void) | null = null;

type RouterLike = { push: (href: string) => void };

export function navigateWithTransition(router: RouterLike, href: string) {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") {
    router.push(href);
    return;
  }
  document.startViewTransition(() => {
    const ready = new Promise<void>((resolve) => {
      pendingResolve = resolve;
    });
    // Never freeze the page on a slow/failed navigation.
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1200));
    startTransition(() => router.push(href));
    return Promise.race([ready, timeout]);
  });
}

/** Mounted once in the root layout; releases the held snapshot on route commit. */
export function RouteListener() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    pendingResolve?.();
    pendingResolve = null;
  }, [pathname]);
  return null;
}

export function TransitionLink({
  href,
  morph,
  className,
  style,
  children,
  ...rest
}: {
  href: string;
  /** Stamp this element with the shared morph name on click (grid tiles). */
  morph?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Record<string, unknown>) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      style={style}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (typeof document.startViewTransition !== "function") return;
        e.preventDefault();
        if (morph) {
          (e.currentTarget as HTMLElement).style.viewTransitionName = MORPH_NAME;
        }
        navigateWithTransition(router, href);
      }}
    >
      {children}
    </Link>
  );
}
