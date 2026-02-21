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
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --debug dom-dolla          ← dumps raw GQL response
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --reset-id dom-dolla       ← clears bad cached ID
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --ra-id=91935 dom-dolla    ← bypass ID resolution
 */

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
      "User-Agent":                UA,
      "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language":           "en-US,en;q=0.9",
      "Accept-Encoding":           "gzip, deflate, br",
      "Cache-Control":             "max-age=0",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest":            "document",
      "Sec-Fetch-Mode":            "navigate",
      "Sec-Fetch-Site":            "none",
      "Sec-Fetch-User":            "?1",
      "Sec-CH-UA":                 '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-CH-UA-Mobile":          "?0",
      "Sec-CH-UA-Platform":        '"macOS"',
      "Connection":                "keep-alive",
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

// ─── Step 1: resolve numeric RA ID ────────────────────────────────────────────
//
// Strategy A (primary): RA GraphQL — query artist profile by urlName (slug).
//   RA's GraphQL endpoint already works (we use it for events). This avoids
//   the HTTP 403 that RA's bot-protection returns on HTML page fetches.
//
// Strategy B (fallback): HTML __NEXT_DATA__ scrape of https://ra.co/dj/{slug}
//   Kept as fallback in case the GraphQL schema changes.

async function resolveRaIdViaGraphql(slug: string): Promise<string | null> {
  // RA's schema uses "urlName" as the artist lookup argument (not "slug").
  // We also try the bare "slug" variant in case it works.
  const queries = [
    {
      label: "urlName",
      body: {
        operationName: "GET_ARTIST_PROFILE",
        variables: { urlName: slug },
        query: `
          query GET_ARTIST_PROFILE($urlName: String!) {
            artist(urlName: $urlName) {
              id
              name
              urlName
            }
          }
        `,
      },
    },
    {
      label: "slug",
      body: {
        operationName: "GET_ARTIST_PROFILE",
        variables: { slug },
        query: `
          query GET_ARTIST_PROFILE($slug: String!) {
            artist(slug: $slug) {
              id
              name
              urlName
            }
          }
        `,
      },
    },
  ];

  for (const { label, body } of queries) {
    console.log(`  Trying GraphQL artist lookup (${label}="${slug}")`);
    try {
      const json = (await postGraphql(body)) as Record<string, unknown>;
      if (DEBUG) console.log("  GraphQL response:", JSON.stringify(json, null, 2).slice(0, 600));

      // Surface any GraphQL-level errors so we can debug
      const errs = (json as Record<string, unknown>).errors as Array<{message: string}> | undefined;
      if (errs?.length) console.log(`  GraphQL errors: ${errs.map(e => e.message).join("; ")}`);

      const artist = (json?.data as Record<string, unknown>)?.artist as Record<string, unknown> | null;
      const id = artist?.id;
      if (typeof id === "number" || (typeof id === "string" && /^\d+$/.test(String(id)))) {
        console.log(`  Found RA ID via GraphQL (${label}): ${id}  (name=${artist?.name})`);
        return String(id);
      }
    } catch (err) {
      console.log(`  GraphQL lookup (${label}) failed: ${(err as Error).message}`);
    }
    await sleep(500);
  }
  return null;
}

async function resolveRaIdViaHtml(slug: string): Promise<string | null> {
  const url  = `https://ra.co/dj/${slug}`;
  console.log(`  Trying HTML scrape: ${url}`);
  const html = await fetchHtml(url);
  if (!html) return null;

  const scriptMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const raw = scriptMatch?.[1] ?? "";
  if (!raw) { console.log("  __NEXT_DATA__ not found"); return null; }

  // Apollo cache key  "Artist:91935"
  const apollo = raw.match(/"Artist:(\d{4,7})"/);
  if (apollo) {
    console.log(`  Found RA ID via Apollo cache key "Artist:${apollo[1]}"`);
    return apollo[1];
  }

  // __typename / id pair (order-independent)
  const pair =
    raw.match(/"__typename"\s*:\s*"Artist"[^}]{0,300}"id"\s*:\s*"(\d{4,7})"/) ??
    raw.match(/"id"\s*:\s*"(\d{4,7})"[^}]{0,300}"__typename"\s*:\s*"Artist"/);
  if (pair) {
    console.log(`  Found RA ID via __typename+id pair: ${pair[1]}`);
    return pair[1];
  }

  // pageProps.data.artist.id (SSR props direct path)
  try {
    const nd  = JSON.parse(raw) as Record<string, unknown>;
    const pp  = (nd?.props as Record<string, unknown>)?.pageProps as Record<string, unknown>;
    const id  =
      (pp?.data  as Record<string, unknown>)?.artist?.id ??
      (pp?.artist as Record<string, unknown>)?.id;
    if (typeof id === "number") {
      console.log(`  Found RA ID via pageProps.data.artist.id: ${id}`);
      return String(id);
    }
  } catch { /* ignore */ }

  console.log("  Could not extract RA ID from __NEXT_DATA__");
  if (DEBUG) console.log("  Raw snippet (first 800 chars):\n", raw.slice(0, 800));
  return null;
}

async function resolveRaId(slug: string): Promise<string | null> {
  // Strategy A: GraphQL (avoids bot-protection 403 on HTML pages)
  const gqlId = await resolveRaIdViaGraphql(slug);
  if (gqlId) return gqlId;

  // Strategy B: HTML scrape fallback
  await sleep(RATE_LIMIT_MS);
  return resolveRaIdViaHtml(slug);
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

async function processArtist(slug: string, dryRun: boolean, resetId: boolean, manualRaId?: string) {
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

  // --ra-id=XXXXX flag takes highest priority
  let raId = manualRaId ?? ((!resetId && isValidId) ? cachedId : "");

  if (manualRaId) {
    console.log(`  Using manually supplied ra_id=${raId}`);
  } else if (!raId) {
    await sleep(RATE_LIMIT_MS);
    raId = (await resolveRaId(raSlug)) ?? "";
    if (!raId) { console.error("  Could not resolve RA ID — skipping"); return; }
  } else {
    console.log(`  Using cached ra_id=${raId}`);
  }

  if (raId && !dryRun && raId !== cachedId) {
    await sb.from("artists").update({ ra_id: raId }).eq("id", artist.id);
    console.log(`  Cached ra_id=${raId} in DB`);
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
  const raIdArg  = args.find(a => a.startsWith("--ra-id="))?.split("=")[1];
  const targets  = args.filter(a => !a.startsWith("--"));

  if (!targets.length) {
    console.error("Usage: scrape-ra-v2.ts [--dry-run] [--debug] [--reset-id] [--ra-id=XXXXX] <slug|--all>");
    console.error("  --ra-id=XXXXX  bypass ID resolution and use this numeric RA artist ID");
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
    await processArtist(targets[0], dryRun, resetId, raIdArg);
  }

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
