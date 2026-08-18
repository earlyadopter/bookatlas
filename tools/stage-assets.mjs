import fs from "node:fs";
import path from "node:path";

// Stages book assets (images/, cover.png) into public/ before `next build`,
// so they serve as plain static files from the CDN instead of through the
// asset route handler — a serverless function whose responses also get
// cache-written (both are billed; static files are not).
//
// Single-book deployments (SINGLE_BOOK=<id>) stage that book at
// public/asset/…; every book also stages at public/b/<id>/asset/… so
// multi-book instances get the same treatment. The asset route stays as the
// dev-mode and fallback path — public/ wins when the file exists.

const root = process.cwd();
const configPath = ["books.config.local.json", "books.config.json"]
  .map((f) => path.join(root, f))
  .find((f) => fs.existsSync(f));
if (!configPath) {
  console.log("stage-assets: no books config, nothing to stage");
  process.exit(0);
}

const { books = [] } = JSON.parse(fs.readFileSync(configPath, "utf8"));
const singleBook = process.env.SINGLE_BOOK;

function copyInto(destBase, bookDir) {
  let n = 0;
  const imagesDir = path.join(bookDir, "images");
  if (fs.existsSync(imagesDir)) {
    const dest = path.join(destBase, "images");
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(imagesDir)) {
      if (f.startsWith(".")) continue;
      fs.copyFileSync(path.join(imagesDir, f), path.join(dest, f));
      n++;
    }
  }
  const cover = path.join(bookDir, "cover.png");
  if (fs.existsSync(cover)) {
    fs.mkdirSync(destBase, { recursive: true });
    fs.copyFileSync(cover, path.join(destBase, "cover.png"));
    n++;
  }
  return n;
}

for (const book of books) {
  const bookDir = path.isAbsolute(book.path) ? book.path : path.join(root, book.path);
  if (!fs.existsSync(bookDir)) continue;
  let n = copyInto(path.join(root, "public", "b", book.id, "asset"), bookDir);
  if (singleBook === book.id) n += copyInto(path.join(root, "public", "asset"), bookDir);
  console.log(`stage-assets: ${book.id} — ${n} files`);
}
