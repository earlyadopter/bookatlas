import { NextRequest, NextResponse } from "next/server";
import { APP_STORE_URL, appStoreLink } from "@/lib/links";

export const dynamic = "force-dynamic";

// Channel redirect: bookatlas.dev/go/<channel> → the Mac App Store.
//
// This exists because a URL you have already published cannot be changed. A
// LinkedIn post or a README that links straight to apps.apple.com is
// unattributable forever — and App Store campaign links cannot be generated
// until the app has 5 installs, which is exactly the period when the first
// posts go out. Pointing published links here keeps the destination editable:
// when the provider token arrives, every link posted months earlier starts
// attributing, with no edits to anything already published.
//
// It also gives channel-level click counts today, from the access log alone,
// with no analytics script and no cookie.

// A channel is used verbatim as Apple's `ct` campaign token, so it is
// constrained to what Apple accepts and what is safe to interpolate. Anything
// else still redirects — a marketing link must never 404 because someone
// typed it in caps — it just travels untagged.
const CHANNEL = /^[a-z0-9][a-z0-9-]{0,39}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ channel: string }> }
) {
  if (!APP_STORE_URL) return NextResponse.redirect(new URL("/mac", _req.url), 302);

  const { channel } = await params;
  const slug = channel.toLowerCase();
  const target = CHANNEL.test(slug) ? appStoreLink(slug) : APP_STORE_URL;

  // 302, not 301: the destination is meant to change once campaign links
  // exist. A 301 would be cached by browsers and intermediaries and would
  // pin the untagged URL in place — permanently, which is what "permanent"
  // means and is the opposite of the point.
  const res = NextResponse.redirect(target, 302);
  // Counting is the whole job; a cached redirect is an uncounted visit.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
