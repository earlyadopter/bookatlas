// Data layer: pure string → structure, no fs anywhere. Consumers own file
// loading (or fetch, or a database) and pass content in.
export * from "./types";
export { parseChapter, type ParsedChapter } from "./parseChapter";
export { parseSingleFileBook, type ParsedBook } from "./parseSingleFileBook";
export {
  renderSubChapterHtml,
  renderPlainHtml,
  extractExcerpt,
  type RenderOpts
} from "./renderMarkdown";
export { computeTags } from "./tags";
export { slugify, bookHref, chapterHref, subHref } from "./slugs";
export {
  flattenBook,
  getPrevNext,
  matchesFilter,
  parseFilter,
  type FlatSub
} from "./nav";
