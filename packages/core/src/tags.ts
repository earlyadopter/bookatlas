import type { Tag } from "./types";

// Content-type detection, tuned on the bootcamp-book corpus. Two tiers:
// whole sub-chapters (tags) and Q&A blocks embedded inside teaching
// sections (hasInterviewBlocks).

const INTERVIEW_TITLE = /interview|questions they may ask|likely interview/i;
// Titles that ARE a quoted question: # 9.55 “What's a System API?”
const QUOTED_QUESTION_TITLE = /^["“].+["”?]$/;
const CHEATSHEET_TITLE = /cheat ?sheet/i;
const TEASER_TITLE = /^Next\s*[—:–-]/i;

// Fences in these languages signal "real" code content; bare ```text fences
// are mostly ASCII diagrams and never count toward the code tag.
const CODE_LANGS = /^(dataweave|json|xml|sql|http|yaml|javascript|typescript|csv|java)$/i;

const INTERVIEW_BLOCK_LINE = /^###\s+(Interview (phrase|answer|talking point)|Q:|["“])|^\*\*Q[:.]/;

export function computeTags(
  title: string,
  bodyLines: string[]
): { tags: Tag[]; hasInterviewBlocks: boolean; codeFenceCount: number } {
  const tags: Tag[] = [];

  if (INTERVIEW_TITLE.test(title) || QUOTED_QUESTION_TITLE.test(title.trim())) {
    tags.push("interview");
  }
  if (CHEATSHEET_TITLE.test(title)) tags.push("cheatsheet");
  if (TEASER_TITLE.test(title)) tags.push("teaser");

  let fenceCount = 0;
  let codeScore = 0;
  let inFence = false;
  let hasInterviewBlocks = false;

  for (const line of bodyLines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(?:```|~~~)(\w*)/);
    if (fenceMatch) {
      if (!inFence) {
        fenceCount++;
        if (CODE_LANGS.test(fenceMatch[1])) codeScore++;
      }
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (INTERVIEW_BLOCK_LINE.test(trimmed)) hasInterviewBlocks = true;
  }

  if (codeScore >= 1) tags.push("code");

  return { tags, hasInterviewBlocks, codeFenceCount: fenceCount };
}
