"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { AtlasNavProvider, type AtlasLinkProps, type AtlasNavigation } from "@bookatlas/core/components";

// Next.js adapter for the core components' router seam: next/link for
// prefetching anchors, router.push for programmatic navigation, and Next's
// pathname hook so RouteListener sees route commits.
function Link(props: AtlasLinkProps) {
  return <NextLink {...props} />;
}

export function NextAtlasNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigation = useMemo<AtlasNavigation>(
    () => ({ Link, push: (href) => router.push(href), usePathname }),
    [router]
  );
  return <AtlasNavProvider navigation={navigation}>{children}</AtlasNavProvider>;
}
