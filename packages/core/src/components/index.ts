// Interaction layer. Href-agnostic: every component takes precomputed hrefs,
// so any URL shape works (see docs/embedding.md in the repo root).
export {
  TransitionLink,
  RouteListener,
  navigateWithTransition,
  MORPH_NAME
} from "./transitions";
export { KeyNav } from "./KeyNav";
export { ChapterStrip, type StripItem } from "./ChapterStrip";
export { FilterChips } from "./FilterChips";
