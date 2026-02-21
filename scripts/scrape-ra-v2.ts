/**
 * Resident Advisor gig scraper — PRIMARY gig source.
 *
 * Uses RA's public GraphQL endpoint (no auth required).
 * RA is the authoritative source for electronic music gigs and
 * has co-artist lineup data that no other source provides.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --all
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --dry-run dom-dolla
 */

import * as cheerio from "cheerio";
import { getSupabase } from "./lib/supabase.js";
import { inferGigType } from "./lib/gig-utils.js";

const RATE_LIMIT_MS = 2000;
const RA_GRAPHQL   = "https://ra.co/graphql";
const PAGE_SIZE    = 100;
const MAX_PAGES    = 50; // 50 × 100 = 5 000 events max

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── RA artist ID resolution ───────────────────────────────────────────────────
// RA embeds all page data in a __NEXT_DATA__ script tag. We parse it to find
// the numeric artist ID, which is required for GraphQL queries.

async function resolveRaId(artistName: string, dbSlug: string): Promise<{ raId: string; raSlug: string } | null> {
  // Build slug candidates from artist name + their DB slug
  const nameDerived = artistName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const candidates = [...new Set([dbSlug, nameDerived, nameDerived.replace(/-/g, "")])]
    .filter(Boolean);

  for (const candidate of candidates) {
    const url = `https://ra.co/dj/${candidate}`;
    console.log(`  Trying RA slug: ${url}`);

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
      });
      if (!res.ok) { console.log(`    HTTP ${res.status}`); continue; }

      const html = await res.text();
      const $ = cheerio.load(html);
      const nextDataRaw = $("#__NEXT_DATA__").html();
      if (!nextDataRaw) { console.log("    No __NEXT_DATA__ found"); continue; }

      // RA's __NEXT_DATA__ structure has changed over time — try multiple paths
      const nd = JSON.parse(nextDataRaw) as Record<string, unknown>;
      const artist =
        (nd?.props as Record<string, unknown>)?.pageProps as Record<string, unknown> | undefined;

      // Try multiple known RA __NEXT_DATA__ shapes
      const id =
        (artist?.artist as Record<string, unknown>)?.id ??
        (artist?.data as Record<string, unknown>)?.id ??
        (artist?.dj as Record<string, unknown>)?.id;

      if (id) {
        console.log(`  Found RA ID: ${id} (slug: ${candidate})`);
        return { raId: String(id), raSlug: candidate };
      }

      // Fallback: scan the full JSON for any "id" near "artist"
      const raw = nextDataRaw;
      const match = raw.match(/"artist"\s*:\s*\{[^}]*"id"\s*:\s*"?(\d+)"?/);
      if (match) {
        console.log(`  Found RA ID via regex: ${match[1]} (slug: ${candidate})`);
        return { raId: match[1], raSlug: candidate };
      }

      console.log(`    __NEXT_DATA__ found but no artist ID`);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message}`);
    }

    await sleep(RATE_LIMIT_MS);
  }

  return null;
}

// ── RA GraphQL event fetch ────────────────────────────────────────────────────

interface RaEvent {
  id: string;
  date: string;       // "2025-07-25" or ISO timestamp
  startTime?: string;
  title: string;
  venue: { name: string; area: { name: string; country: { name: string } } } | null;
  artists: Array<{ name: string }>;
}

// RA has changed their GraphQL schema. We try two known query shapes.
const QUERIES = [
  // Shape A — newer RA schema (listing root query)
  {
    operationName: "GET_DEFAULT_EVENTS_LISTING",
    buildBody: (raId: string, page: number) => ({
      operationName: "GET_DEFAULT_EVENTS_LISTING",
      variables: {
        filters: { artists: { ids: [raId] } },
        pageSize: PAGE_SIZE,
        page,
      },
      query: `
        query GET_DEFAULT_EVENTS_LISTING($filters: FilterQuery, $pageSize: Int, $page: Int) {
          listing(filters: $filters, pageSize: $pageSize, page: $page) {
            totalResults
            data {
              id
              date
              startTime
              title
              venue { name area { name country { name } } }
              artists { name }
            }
          }
        }
      `,
    }),
    extract: (json: Record<string, unknown>) => {
      const l = (json?.data as Record<string, unknown>)?.listing as
        { data: RaEvent[]; totalResults: number } | undefined;
      return l ? { events: l.data, total: l.totalResults } : null;
    },
  },

  // Shape B — older RA schema (artist.eventListings)
  {
    operationName: "GET_ARTIST_EVENTS",
    buildBody: (raId: string, page: number) => ({
      operationName: "GET_ARTIST_EVENTS",
      variables: { id: raId, pageSize: PAGE_SIZE, page },
      query: `
        query GET_ARTIST_EVENTS($id: ID!, $pageSize: Int, $page: Int) {
          artist(id: $id) {
            eventListings(pageSize: $pageSize, page: $page) {
              totalResults
              data {
                id
                startTime
                event {
                  id
                  title
                  date
                  venue { name area { name country { name } } }
                  artists { name }
                }
              }
            }
          }
        }
      `,
    }),
    extract: (json: Record<string, unknown>) => {
      const artist = (json?.data as Record<string, unknown>)?.artist as Record<string, unknown> | undefined;
      const el = artist?.eventListings as { data: Array<{ startTime: string; event: RaEvent }>; totalResults: number } | undefined;
      if (!el?.data?.length) return null;
      const events = el.data
        .filter(d => d.event)
        .map(d => ({ ...d.event, date: d.event.date ?? d.startTime?.slice(0, 10) }));
      return { events, total: el.totalResults };
    },
  },
];

async function fetchRaEvents(raId: string): Promise<RaEvent[]> {
  const allEvents: RaEvent[] = [];

  // Try each query shape — use whichever works first and stick with it
  let workingQueryIdx = -1;

  for (let page = 1; page <= MAX_PAGES; page++) {
    let fetched = false;

    const indicesToTry = workingQueryIdx >= 0 ? [workingQueryIdx] : QUERIES.map((_, i) => i);

    for (const qi of indicesToTry) {
      const q = QUERIES[qi];
      const body = q.buildBody(raId, page);

      let res: Response;
      try {
        res = await fetch(RA_GRAPHQL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
            Referer: "https://ra.co/",
            Origin: "https://ra.co",
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.warn(`  RA GraphQL network error:`, (err as Error).message);
        break;
      }

      if (!res.ok) {
        console.warn(`  RA GraphQL HTTP ${res.status} (query shape ${qi + 1})`);
        continue;
      }

      const json = await res.json() as Record<string, unknown>;

      if ((json.errors as unknown[])?.length) {
        console.warn(`  GraphQL errors (shape ${qi + 1}):`,
          (json.errors as Array<{ message: string }>).map(e => e.message).join(", "));
        continue;
      }

      const result = q.extract(json);
      if (!result || !result.events.length) {
        // Could be valid empty result on page 2+ — fall through
        if (page === 1) {
          console.log(`  Query shape ${qi + 1} returned no events on page 1`);
          continue;
        }
        // No more pages
        console.log(`  Page ${page}: 0 events — done.`);
        return allEvents;
      }

      workingQueryIdx = qi;
      allEvents.push(...result.events);
      console.log(`  Page ${page}: ${result.events.length} events (${allEvents.length}/${result.total} total) [shape ${qi + 1}]`);

      fetched = true;
      if (allEvents.length >= result.total) {
        console.log(`  Fetched all ${allEvents.length} events.`);
        return allEvents;
      }
      break; // move to next page
    }

    if (!fetched) {
      if (page === 1) {
        console.warn("  All query shapes failed on page 1 — no RA data");
        return [];
      }
      break;
    }

    await sleep(RATE_LIMIT_MS);
  }

  return allEvents;
}

// ── Upsert gigs (batched) ─────────────────────────────────────────────────────

const BATCH = 100;

async function upsertRaGigs(
  artistId: string,
  events: RaEvent[],
  artistName: string,
): Promise<{ inserted: number; errors: number }> {
  const sb = getSupabase();
  let inserted = 0;
  let errors   = 0;

  const rows = events
    .filter(ev => ev.venue || ev.title)
    .map(ev => {
      const coArtists = (ev.artists ?? [])
        .map(a => a.name)
        .filter(n => n.toLowerCase() !== artistName.toLowerCase());

      const date = (ev.date ?? ev.startTime ?? "").slice(0, 10);

      return {
        artist_id:     artistId,
        date,
        venue_name:    ev.venue?.name || ev.title,
        venue_city:    ev.venue?.area?.name ?? "",
        venue_country: ev.venue?.area?.country?.name ?? "",
        event_name:    ev.title ?? "",
        gig_type:      inferGigType(ev.title ?? "", ev.venue?.name ?? ""),
        co_artists:    coArtists,
        source:        "ra",
      };
    })
    .filter(r => r.date && r.venue_name);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await sb
      .from("gigs")
      .upsert(batch, { onConflict: "artist_id,date,venue_name", ignoreDuplicates: false })
      .select("id", { count: "exact", head: true });

    if (error) { console.warn(`  Batch error:`, error.message); errors += batch.length; }
    else inserted += count ?? batch.length;
  }

  return { inserted, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processArtist(slug: string, dryRun: boolean) {
  const sb = getSupabase();

  const { data: artist, error } = await sb
    .from("artists")
    .select("id, name, slug, ra_id")
    .eq("slug", slug)
    .single();

  if (error || !artist) { console.error(`Artist not found: ${slug}`); return; }

  console.log(`\n▶ ${artist.name}${dryRun ? " [DRY RUN]" : ""}`);

  let raId = artist.ra_id ?? null;
  let raSlug = slug;

  if (!raId) {
    console.log(`  Resolving RA ID...`);
    const resolved = await resolveRaId(artist.name, slug);
    if (!resolved) { console.error(`  ✗ Could not resolve RA ID`); return; }
    raId = resolved.raId;
    raSlug = resolved.raSlug;
    if (!dryRun) await sb.from("artists").update({ ra_id: raId }).eq("id", artist.id);
  } else {
    console.log(`  Using cached RA ID: ${raId}`);
  }

  const events = await fetchRaEvents(raId);
  console.log(`\n  Total: ${events.length} RA events`);

  if (!events.length) return;

  // Show sample
  const sample = events.slice(0, 3);
  for (const ev of sample) {
    const city = ev.venue?.area?.name ?? "?";
    const country = ev.venue?.area?.country?.name ?? "";
    console.log(`    ${ev.date?.slice(0, 10)}  ${ev.venue?.name ?? ev.title}  — ${city}, ${country}`);
  }
  if (events.length > 3) console.log(`    ... and ${events.length - 3} more`);

  if (dryRun) { console.log("\n  [dry-run] skipping DB write"); return; }

  const { inserted, errors } = await upsertRaGigs(artist.id, events, artist.name);
  console.log(`\n  ✅ ${inserted} inserted/updated, ${errors} errors`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: scrape-ra-v2.ts [--dry-run] <slug|--all>");
    process.exit(1);
  }

  const dryRun  = args.includes("--dry-run");
  const targets = args.filter(a => a !== "--dry-run");
  const sb = getSupabase();

  if (targets[0] === "--all") {
    const { data: artists } = await sb.from("artists").select("slug").order("name");
    for (const a of artists ?? []) {
      await processArtist(a.slug, dryRun);
      await sleep(RATE_LIMIT_MS);
    }
  } else {
    await processArtist(targets[0], dryRun);
  }

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
