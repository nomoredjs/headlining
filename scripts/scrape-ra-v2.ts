/**
 * Resident Advisor gig scraper.
 *
 * Step 1 — ID resolution (plain HTML, no auth):
 *   Fetch https://ra.co/dj/{slug}
 *   Pull numeric artist ID from the embedded __NEXT_DATA__ JSON blob.
 *   Cache it in artists.ra_id so we never re-resolve.
 *
 * Step 2 — Event fetch (RA GraphQL, public endpoint):
 *   POST https://ra.co/graphql with the resolved numeric ID.
 *   Paginate past events and upcoming tour-dates separately.
 *   Extract co-artists from every lineup.
 *
 * Slug format: lowercase artist name, all non-alphanumeric removed.
 *   "Dom Dolla"  → "domdolla"
 *   "Carl Cox"   → "carlcox"
 *   "Amelie Lens"→ "amelielens"
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --all
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --dry-run dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --debug dom-dolla   ← dumps raw GQL response
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --reset-id dom-dolla ← clears bad cached ID
 */

import * as cheerio from "cheerio";
import { getSupabase } from "./lib/supabase.js";
import { inferGigType } from "./lib/gig-utils.js";

const RATE_LIMIT_MS = 2000;
const PAGE_SIZE     = 50;   // max RA allows per GraphQL page
const MAX_PAGES     = 100;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const RA_GRAPHQL = "https://ra.co/graphql";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Slug ─────────────────────────────────────────────────────────────────────

function toRaSlug(artistName: string): string {
  return artistName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":      UA,
      "Accept":          "text/html,application/xhtml+xml,*/*;q=0.9",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer":         "https://ra.co/",
    },
  });
  if (!res.ok) { console.log(`  HTTP ${res.status}  ${url}`); return null; }
  return res.text();
}

let DEBUG = false;

async function postGraphql(body: object): Promise<unknown> {
  const res = await fetch(RA_GRAPHQL, {
    method: "POST",
    headers: {
      "User-Agent":      UA,
      "Content-Type":    "application/json",
      "Accept":          "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Origin":          "https://ra.co",
      "Referer":         "https://ra.co/",
      "ra-country":      "AU",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (DEBUG) {
    console.log("\n  ── raw GraphQL response ──");
    console.log(JSON.stringify(json, null, 2).slice(0, 3000));
    console.log("  ──────────────────────────\n");
  }
  return json;
}

// ─── Step 1: resolve numeric RA ID from __NEXT_DATA__ ─────────────────────────
// The artist page embeds all SSR props inside <script id="__NEXT_DATA__">.
// The numeric ID appears at several paths — we walk the whole tree and collect
// every "id"-shaped value, then pick the one that appears in artist context.

async function resolveRaId(slug: string, artistName: string): Promise<string | null> {
  const url  = `https://ra.co/dj/${slug}`;
  console.log(`  Resolving RA ID from ${url}`);
  const html = await fetchHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").html() ?? "";
  if (!raw) { console.log("  __NEXT_DATA__ not found"); return null; }

  let nd: Record<string, unknown>;
  try { nd = JSON.parse(raw); }
  catch { console.log("  Failed to parse __NEXT_DATA__"); return null; }

  // Walk the tree and collect any numeric values stored under keys named "id"
  // that are plausible RA artist IDs (4–6 digit integers).
  const candidates: number[] = [];

  function walk(val: unknown, parentKey = ""): void {
    if (val === null || val === undefined) return;
    if (typeof val === "number") {
      if (parentKey === "id" && val > 1000 && val < 9_999_999) candidates.push(val);
      return;
    }
    if (typeof val === "string") {
      if (parentKey === "id" && /^\d{4,7}$/.test(val)) candidates.push(Number(val));
      return;
    }
    if (Array.isArray(val)) { val.forEach(v => walk(v, parentKey)); return; }
    if (typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        walk(v, k);
      }
    }
  }

  walk(nd);

  if (!candidates.length) {
    console.log("  No numeric IDs found in __NEXT_DATA__");
    return null;
  }

  // The artist's own ID is usually the most-repeated value, or the first one
  // encountered under props.pageProps.
  const freq: Record<number, number> = {};
  for (const n of candidates) freq[n] = (freq[n] ?? 0) + 1;

  // Try the direct path first
  const pp = (nd as Record<string, unknown>)?.props as Record<string, unknown>;
  const directId =
    (pp?.pageProps as Record<string, unknown>)?.data?.artist?.id ??
    (pp?.pageProps as Record<string, unknown>)?.artist?.id;

  if (directId && typeof directId === "number") {
    console.log(`  Found RA ID (direct path): ${directId}`);
    return String(directId);
  }

  // Fall back: most frequent ID
  const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  if (best) {
    console.log(`  Found RA ID (most-frequent): ${best[0]}  (seen ${best[1]}×)`);
    return best[0];
  }

  return null;
}

// ─── Step 2: GraphQL pagination ───────────────────────────────────────────────

interface RaGqlEvent {
  id: string;
  startTime: string;
  title: string;
  venue: { name: string; area: { name: string; country: { name: string } } };
  artists: Array<{ name: string }>;
}

// DATERANGE filter value — JSON-stringified because RA wraps it that way
const NOW_GTE = JSON.stringify({ gte: new Date().toISOString() });
const NOW_LTE = JSON.stringify({ lte: new Date().toISOString() });

async function fetchEventsPage(
  raId: string,
  direction: "past" | "upcoming",
  page: number,
): Promise<{ events: RaGqlEvent[]; total: number }> {
  const dateFilter = direction === "past"
    ? { type: "DATERANGE", value: NOW_LTE }
    : { type: "DATERANGE", value: NOW_GTE };

  const artistFilter = { type: "ARTIST", value: raId };

  const body = {
    operationName: "GET_DEFAULT_EVENTS_LISTING",
    variables: {
      indices:      ["EVENT"],
      pageSize:     PAGE_SIZE,
      page,
      aggregations: ["YEAR", "COUNTRY"],
      baseFilters:  [artistFilter, dateFilter],
      filters:      [artistFilter, dateFilter],
      sortField:    direction === "past" ? "EVENTDATE" : "EVENTDATE",
      sortOrder:    direction === "past" ? "DESCENDING" : "ASCENDING",
    },
    // Types confirmed from RA schema error messages:
    //   FilterSortField  → FilterSortFieldType
    //   FilterSortOrder  → FilterSortOrderType
    // Arguments go directly on listing(...), NOT wrapped in filter: {}
    query: `
      query GET_DEFAULT_EVENTS_LISTING(
        $indices: [IndexType!]!
        $aggregations: [ListingAggregationType!]
        $filters: [FilterInput]
        $baseFilters: [FilterInput]
        $pageSize: Int
        $page: Int
        $sortField: FilterSortFieldType
        $sortOrder: FilterSortOrderType
      ) {
        listing(
          indices: $indices
          aggregations: $aggregations
          filters: $filters
          baseFilters: $baseFilters
          pageSize: $pageSize
          page: $page
          sortField: $sortField
          sortOrder: $sortOrder
        ) {
          data {
            ... on Event {
              id
              startTime
              title
              venue { name area { name country { name } } }
              artists { name }
            }
          }
          totalResults
        }
      }
    `,
  };

  const json = (await postGraphql(body)) as Record<string, unknown>;
  const listing = (json?.data as Record<string, unknown>)?.listing as Record<string, unknown>;
  const data     = (listing?.data   as RaGqlEvent[]) ?? [];
  const total    = (listing?.totalResults as number) ?? 0;
  return { events: data, total };
}

async function fetchAllEvents(raId: string): Promise<RaGqlEvent[]> {
  const all: RaGqlEvent[] = [];

  for (const direction of ["past", "upcoming"] as const) {
    console.log(`\n  Fetching ${direction} events…`);
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { events, total } = await fetchEventsPage(raId, direction, page);
      console.log(`    Page ${page}: ${events.length} events  (${all.length + events.length} / ${total} total)`);
      all.push(...events);
      if (events.length < PAGE_SIZE || all.length >= total) break;
      await sleep(RATE_LIMIT_MS);
    }
  }

  return all;
}

// ─── Normalise GQL event → our row shape ─────────────────────────────────────

function normalise(e: RaGqlEvent, targetArtistName: string) {
  const date         = (e.startTime ?? "").slice(0, 10);
  const venueName    = e.venue?.name ?? "";
  const venueCity    = e.venue?.area?.name ?? "";
  const venueCountry = e.venue?.area?.country?.name ?? "";
  const coArtists    = (e.artists ?? [])
    .map(a => a.name)
    .filter(n => n && n.toLowerCase() !== targetArtistName.toLowerCase());

  return {
    date,
    event_name:    e.title ?? "",
    venue_name:    venueName,
    venue_city:    venueCity,
    venue_country: venueCountry,
    gig_type:      inferGigType(e.title ?? "", venueName),
    co_artists:    coArtists,
    source:        "ra",
  };
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

const BATCH = 100;

async function upsertGigs(
  artistId: string,
  artistName: string,
  events: RaGqlEvent[],
): Promise<{ inserted: number; errors: number }> {
  const sb = getSupabase();
  let inserted = 0, errors = 0;

  const rows = events
    .map(e => ({ artist_id: artistId, ...normalise(e, artistName) }))
    .filter(r => r.date && r.venue_name);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await sb
      .from("gigs")
      .upsert(batch, { onConflict: "artist_id,date,venue_name", ignoreDuplicates: false })
      .select("id", { count: "exact", head: true });

    if (error) { console.warn("  Batch error:", error.message); errors += batch.length; }
    else inserted += count ?? batch.length;
  }

  return { inserted, errors };
}

// ─── Process one artist ───────────────────────────────────────────────────────

async function processArtist(slug: string, dryRun: boolean, resetId: boolean) {
  const sb = getSupabase();

  const { data: artist, error } = await sb
    .from("artists")
    .select("id, name, ra_id")
    .eq("slug", slug)
    .single();

  if (error || !artist) { console.error(`Artist not found: ${slug}`); return; }

  const raSlug = toRaSlug(artist.name);
  console.log(`\n▶ ${artist.name}  slug=${raSlug}${dryRun ? "  [DRY RUN]" : ""}`);

  // ── Step 1: resolve numeric ID ─────────────────────────────────────────────
  // A valid RA ID is digits-only (4–7 chars). Reject anything else (e.g. "91935dlining").
  const cachedId = artist.ra_id ?? "";
  const isValidId = /^\d{4,7}$/.test(cachedId);

  if (cachedId && !isValidId) {
    console.warn(`  ⚠ Corrupted ra_id in DB: "${cachedId}" — will re-resolve`);
  }

  let raId = (!resetId && isValidId) ? cachedId : "";

  if (!raId) {
    await sleep(RATE_LIMIT_MS);
    raId = (await resolveRaId(raSlug, artist.name)) ?? "";
    if (!raId) { console.error("  Could not resolve RA ID — skipping"); return; }

    if (!dryRun) {
      await sb.from("artists").update({ ra_id: raId }).eq("id", artist.id);
      console.log(`  Cached ra_id=${raId} in DB`);
    }
  } else {
    console.log(`  Using cached ra_id=${raId}`);
  }

  // ── Step 2: fetch all events via GraphQL ───────────────────────────────────
  await sleep(RATE_LIMIT_MS);
  const events = await fetchAllEvents(raId);
  console.log(`\n  Total events: ${events.length}`);

  if (!events.length) return;

  // Sample
  for (const e of events.slice(0, 5)) {
    const r  = normalise(e, artist.name);
    const co = r.co_artists.length ? `  with: ${r.co_artists.slice(0, 3).join(", ")}` : "";
    console.log(`  ${r.date}  ${r.venue_name.slice(0, 35).padEnd(35)}  ${r.venue_city}, ${r.venue_country}${co}`);
  }
  if (events.length > 5) console.log(`  … and ${events.length - 5} more`);

  if (dryRun) { console.log("\n  [dry-run] skipping DB write"); return; }

  const { inserted, errors } = await upsertGigs(artist.id, artist.name, events);
  console.log(`\n  ✅ ${inserted} inserted/updated, ${errors} errors`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args     = process.argv.slice(2);
  const dryRun   = args.includes("--dry-run");
  const resetId  = args.includes("--reset-id");
  DEBUG          = args.includes("--debug");
  const targets  = args.filter(a => !a.startsWith("--"));

  if (!targets.length) {
    console.error("Usage: scrape-ra-v2.ts [--dry-run] [--debug] [--reset-id] <slug|--all>");
    process.exit(1);
  }

  const sb = getSupabase();

  if (targets[0] === "--all") {
    const { data: artists } = await sb.from("artists").select("slug").order("name");
    for (const a of artists ?? []) {
      await processArtist(a.slug, dryRun, resetId);
      await sleep(RATE_LIMIT_MS);
    }
  } else {
    await processArtist(targets[0], dryRun, resetId);
  }

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
