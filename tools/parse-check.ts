import fs from "node:fs";
import path from "node:path";
import { loadBooksConfig } from "../lib/config";
import { parseChapter, parseSingleFileBook, type ParsedChapter, type Tag } from "@bookatlas/core";

// CLI tripwire for the corpus-tuned parsers: prints per-chapter stats and
// exits 1 on structural anomalies (missed splits, leaked headings, number
// mismatches). Works on raw parser output — the runtime object graph
// deliberately carries no markdown (see loadBook), so this tool parses the
// sources itself. Run: pnpm parse:check

const NUMBERED_HEADING_IN_BODY = /^#{1,2}\s+\d+\.(\d+\s+|\s+)\S/;

async function main() {
  let failures = 0;
  const fail = (msg: string) => {
    failures++;
    console.error(`  FAIL ${msg}`);
  };

  for (const config of loadBooksConfig()) {
    const structural = config.mode !== "single-file";
    let chapters: (ParsedChapter & { file: string })[];

    if (config.mode === "single-file") {
      const file = path.join(config.path, "book.md");
      const parsed = parseSingleFileBook(fs.readFileSync(file, "utf8"));
      chapters = parsed.chapters.map((ch) => ({ ...ch, file }));
    } else {
      let files = fs
        .readdirSync(config.path)
        .filter((f) => f.endsWith(".md") && !f.startsWith("."));
      // Same ordering rules as loadBook: an explicit fileOrder replaces the
      // filename sort and acts as an allowlist.
      if (config.parser?.fileOrder) {
        const order = config.parser.fileOrder;
        files = order.filter((f) => files.includes(f));
      } else {
        files.sort((a, b) => a.localeCompare(b));
      }
      chapters = files.map((f) => {
        const file = path.join(config.path, f);
        return { ...parseChapter(f, fs.readFileSync(file, "utf8"), config.parser), file };
      });
    }

    console.log(`\n== ${config.id} (${chapters.length} chapters) ==`);
    let total = 0;
    const tagCounts: Record<Tag, number> = { interview: 0, cheatsheet: 0, teaser: 0, code: 0 };

    for (const ch of chapters) {
      total += ch.subchapters.length;
      const numbered = ch.subchapters.filter((s) => s.number !== null).length;
      console.log(
        `  ${ch.slug}: ${ch.subchapters.length} subs (${numbered} numbered)` +
          `${ch.preambleMd ? " +preamble" : ""}${ch.introMd ? " +intro" : ""}  "${ch.fullTitle}"`
      );

      for (const sub of ch.subchapters) {
        for (const tag of sub.tags) tagCounts[tag]++;
      }

      if (!structural) continue;

      const fileNum = ch.file.match(/(\d+)\.md$/)?.[1];
      if (fileNum && parseInt(fileNum, 10) !== ch.number) {
        fail(`${ch.slug}: filename number ${fileNum} != chapter number ${ch.number}`);
      }

      for (const sub of ch.subchapters) {
        // Injected figure refs aren't prose — don't let them tip the
        // missed-split heuristic.
        const lines = sub.mdBody.split("\n").filter((l) => !/^!\[[^\]]*\]\([^)]*\)\s*$/.test(l.trim()));
        if (lines.length > 200) {
          fail(`${ch.slug}/${sub.slug}: body is ${lines.length} lines — missed split?`);
        }
        let inFence = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (/^(```|~~~)/.test(trimmed)) {
            inFence = !inFence;
            continue;
          }
          if (!inFence && NUMBERED_HEADING_IN_BODY.test(trimmed)) {
            fail(`${ch.slug}/${sub.slug}: numbered heading leaked into body: "${trimmed}"`);
          }
        }
        if (/\[\d+\]:\s+https?:/.test(sub.mdBody)) {
          fail(`${ch.slug}/${sub.slug}: footnote definitions leaked into body`);
        }
      }
    }

    console.log(
      `  TOTAL ${total} sub-chapters · tags: interview ${tagCounts.interview}, ` +
        `cheatsheet ${tagCounts.cheatsheet}, teaser ${tagCounts.teaser}, code ${tagCounts.code}`
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log("\nparse:check OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
