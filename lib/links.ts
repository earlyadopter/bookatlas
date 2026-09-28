// The three ways to use Bookatlas, in one place: the home page, /mac and the
// footers all link here. When the Mac app is approved, set APP_STORE_URL and
// every "coming soon" on the site turns into a real link.
export const GITHUB_URL = "https://github.com/earlyadopter/bookatlas";
export const CLOUD_URL = "https://cloud.bookatlas.dev";
export const APP_STORE_URL: string | null = "https://apps.apple.com/app/bookatlas-desktop/id6811368198";
export const MAC_PRICE = "$9.99 one-time";

// Apple's provider token, the `pt` half of an App Store campaign link.
//
// Empty on purpose. App Store Connect refuses to generate campaign links until
// the app has been installed on at least 5 accounts, so there is nothing to put
// here yet. Everything below is written to work without it and to start
// attributing the moment it is filled in — one constant, no other edits.
//
// To finish: App Store Connect → Analytics → Acquisition → Campaigns, generate
// any campaign link, copy the `pt=` value out of it, paste it here, redeploy.
export const APP_STORE_PROVIDER_TOKEN = "";

/**
 * App Store URL tagged with a campaign, when tagging is possible.
 *
 * Without a provider token this returns the plain store link, so the site works
 * exactly as it does today and no visitor ever meets a broken URL. Apple
 * ignores an unknown `ct` anyway, but a half-formed campaign link is the kind
 * of thing that silently attributes nothing while looking correct — so it is
 * all-or-nothing rather than partly applied.
 */
export function appStoreLink(campaign: string): string {
  if (!APP_STORE_URL) return "";
  if (!APP_STORE_PROVIDER_TOKEN) return APP_STORE_URL;
  const q = new URLSearchParams({
    pt: APP_STORE_PROVIDER_TOKEN,
    ct: campaign.slice(0, 40), // Apple truncates campaign tokens at 40 chars
    mt: "8"
  });
  return `${APP_STORE_URL}?${q}`;
}
