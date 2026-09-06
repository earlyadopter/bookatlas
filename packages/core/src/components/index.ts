// Interaction layer. Href-agnostic: every component takes precomputed hrefs,
// so any URL shape works (see docs/embedding.md in the repo root). Router-
// agnostic too: wrap your tree in AtlasNavProvider with your framework's
// Link/push/usePathname (the Next site does this in components/NextAtlasNav).
export {
  AtlasNavProvider,
  useAtlasNav,
  plainNavigation,
  type AtlasLinkProps,
  type AtlasNavigation
} from "./navigation";
export {
  TransitionLink,
  RouteListener,
  navigateWithTransition,
  MORPH_NAME
} from "./transitions";
export { KeyNav } from "./KeyNav";
export { ChapterStrip, type StripItem } from "./ChapterStrip";
export { FilterChips, type FilterHrefs } from "./FilterChips";
