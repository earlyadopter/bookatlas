import { listBooks } from "../lib/loadBook";

// CLI tripwire for the corpus-tuned parser: prints per-chapter stats and
// exits 1 on structural anomalies (missed splits, leaked headings, number
// mismatches). Run: pnpm parse:check

const NUMBERED_HEADING_IN_BODY = /^#{1,2}\s+\d+\.(\d+\s+|\s+)\S/;

async function main() {
  const books = await listBooks();
  let failures = 0;
  const fail = (msg: string) => {
    failures++;
    console.error(`  FAIL ${msg}`);
  };

  for (const book of books) {
    console.log(`\n== ${book.id} (${book.chapters.length} chapters) ==`);
    let total = 0;

    const structural = book.mode !== "single-file";
    for (const ch of book.chapters) {
      total += ch.subchapters.length;
      const numbered = ch.subchapters.filter((s) => s.number !== null).length;
      console.log(
        `  ${ch.slug}: ${ch.subchapters.length} subs (${numbered} numbered)` +
          `${ch.preambleMd ? " +preamble" : ""}${ch.introMd ? " +intro" : ""}  "${ch.fullTitle}"`
      );

      if (!structural) continue;
      const fileNum = ch.file.match(/(\d+)\.md$/)?.[1];
      if (fileNum && parseInt(fileNum, 10) !== ch.number) {
        fail(`${ch.slug}: filename number ${fileNum} != chapter number ${ch.number}`);
      }

      for (const sub of ch.subchapters) {
        const lines = sub.mdBody.split("\n");
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
        if (sub.mdBody.trim() === "" && !/four objects/i.test(sub.title)) {
          console.warn(`  warn ${ch.slug}/${sub.slug}: empty body`);
        }
        if (/\[\d+\]:\s+https?:/.test(sub.mdBody)) {
          fail(`${ch.slug}/${sub.slug}: footnote definitions leaked into body`);
        }
      }
    }

    console.log(
      `  TOTAL ${total} sub-chapters · tags: interview ${book.tagCounts.interview}, ` +
        `cheatsheet ${book.tagCounts.cheatsheet}, teaser ${book.tagCounts.teaser}, code ${book.tagCounts.code}`
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
