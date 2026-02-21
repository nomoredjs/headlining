/**
 * One-shot diagnostic: fetches ra.co/dj/{slug} and shows every line
 * in __NEXT_DATA__ that contains the artist's numeric ID.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/debug-ra-id.ts domdolla 91935
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function main() {
  const [slug, knownId] = process.argv.slice(2);
  if (!slug || !knownId) {
    console.error("Usage: debug-ra-id.ts <ra-slug> <known-numeric-id>");
    console.error("Example: debug-ra-id.ts domdolla 91935");
    process.exit(1);
  }

  const res = await fetch(`https://ra.co/dj/${slug}`, {
    headers: { "User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "en-US,en;q=0.9" },
  });
  console.log(`HTTP ${res.status}`);
  const html = await res.text();

  const scriptMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const raw = scriptMatch?.[1] ?? "";

  if (!raw) { console.error("__NEXT_DATA__ not found"); process.exit(1); }
  console.log(`\n__NEXT_DATA__ length: ${raw.length} chars\n`);

  // Print every occurrence of the known ID with 80 chars of surrounding context
  let found = 0;
  const re = new RegExp(`.{0,80}${knownId}.{0,80}`, "g");
  for (const m of raw.matchAll(re)) {
    console.log(`[match ${++found}]  …${m[0]}…\n`);
    if (found >= 10) { console.log("(stopping at 10 matches)"); break; }
  }

  if (!found) console.log(`"${knownId}" not found in __NEXT_DATA__ at all — wrong ID or page blocked`);
}

main().catch(err => { console.error(err); process.exit(1); });
