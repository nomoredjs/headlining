/**
 * Resident Advisor gig scraper — SECONDARY source.
 * Adds co-artist lineup data that Songkick doesn't have.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts --all
 *
 * Strategy:
 *  1. Resolve RA numeric artist ID from __NEXT_DATA__ on ra.co/dj/{slug}
 *  2. Query RA GraphQL (public, no auth) for all past events
 *  3. Upsert gigs; if same artist+date+city already exists from Songkick,
 *     UPDATE co_artists only — don't create a duplicate row.
 */

import * as cheerio from "cheerio";
import { getSupabase } from "./lib/supabase.js";
import { inferGigType } from "./lib/gig-utils.js";

const RATE_LIMIT_MS = 2000;
const RA_GRAPHQL    = "https://ra.co/graphql";
const RA_PAGE_SIZE  = 100; // events per GraphQL page

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── RA artist ID resolution ───────────────────────────────────────────────────

async function resolveRaId(artistName: string): Promise<string | null> {
  // Build slug candidates
  const slug = artistName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const candidates = [slug, slug.replace(/-/g, "")];

  for (const candidate of candidates) {
    const url = `https://ra.co/dj/${candidate}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
      });
      if (!res.ok) continue;

      const html = await res.text();

      // RA embeds all data in __NEXT_DATA__ script tag
      const $ = cheerio.load(html);
      const nextDataJson = $("#__NEXT_DATA__").html();
      if (!nextDataJson) continue;

      const nextData = JSON.parse(nextDataJson) as {
        props?: { pageProps?: { artist?: { id?: string } } };
      };
      const id = nextData?.props?.pageProps?.artist?.id;
      if (id) return String(id);
    } catch {
      // try next candidate
    }
    await sleep(RATE_LIMIT_MS);
  }

  return null;
}

// ── RA GraphQL event fetch ────────────────────────────────────────────────────

interface RaEvent {
  id: string;
  listingDate: string;           // "2025-07-25T22:00:00.000Z"
  event: {
    title: string;
    venue: {
      name: string;
      area: { name: string; country: { name: string } };
    } | null;
    artists: Array<{ name: string }>;
  } | null;
}

async function fetchRaEvents(raId: string): Promise<RaEvent[]> {
  const allEvents: RaEvent[] = [];
  let offset = 0;

  while (true) {
    const body = {
      operationName: "GET_DEFAULT_EVENTS_LISTING",
      variables: {
        filter: {
          artist: { id: raId },
          // Fetch historical gigs (lt = less than NOW means past events)
          listingDate: { lt: new Date().toISOString() },
        },
        pageSize: RA_PAGE_SIZE,
        page: Math.floor(offset / RA_PAGE_SIZE) + 1,
      },
      query: `
        query GET_DEFAULT_EVENTS_LISTING($filter: FilterInputDtoInput, $pageSize: Int, $page: Int) {
          listing(filter: $filter, pageSize: $pageSize, page: $page) {
            data {
              id
              listingDate
              event {
                title
                venue {
                  name
                  area {
                    name
                    country { name }
                  }
                }
                artists { name }
              }
            }
            totalResults
          }
        }
      `,
    };

    const res = await fetch(RA_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        Referer: "https://ra.co/",
        Origin: "https://ra.co",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`  RA GraphQL HTTP ${res.status}`);
      break;
    }

    const json = (await res.json()) as {
      data?: { listing?: { data: RaEvent[]; totalResults: number } };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      console.warn("  RA GraphQL errors:", json.errors.map(e => e.message).join(", "));
      break;
    }

    const listing = json.data?.listing;
    if (!listing?.data?.length) break;

    allEvents.push(...listing.data);
    console.log(`  RA page ${Math.floor(offset / RA_PAGE_SIZE) + 1}: ${listing.data.length} events (${allEvents.length}/${listing.totalResults} total)`);

    if (allEvents.length >= listing.totalResults) break;
    offset += RA_PAGE_SIZE;
    await sleep(RATE_LIMIT_MS);
  }

  return allEvents;
}

// ── Upsert gigs, merge co_artists onto existing Songkick rows ─────────────────

async function upsertRaGigs(
  artistId: string,
  events: RaEvent[],
  artistName: string,
): Promise<{ upserted: number; merged: number; errors: number }> {
  const sb = getSupabase();
  let upserted = 0;
  let merged   = 0;
  let errors   = 0;

  for (const ev of events) {
    if (!ev.event) continue;

    const date = ev.listingDate.slice(0, 10);
    const venue = ev.event.venue;
    const venueName   = venue?.name ?? "";
    const venueCity   = venue?.area?.name ?? "";
    const venueCountry = venue?.area?.country?.name ?? "";
    const eventName   = ev.event.title ?? "";
    const gigType     = inferGigType(eventName, venueName);

    // Co-artists = everyone on the lineup except our target artist
    const coArtists = ev.event.artists
      .map(a => a.name)
      .filter(n => n.toLowerCase() !== artistName.toLowerCase());

    // Check if a gig already exists from Songkick for this artist+date+city
    const { data: existing } = await sb
      .from("gigs")
      .select("id, co_artists")
      .eq("artist_id", artistId)
      .eq("date", date)
      .ilike("venue_city", `%${venueCity.slice(0, 8)}%`)
      .maybeSingle();

    if (existing) {
      // Merge co_artists — union of existing + new
      const merged_list = [...new Set([...(existing.co_artists ?? []), ...coArtists])];
      const { error } = await sb
        .from("gigs")
        .update({ co_artists: merged_list, source: "songkick+ra" })
        .eq("id", existing.id);
      if (error) errors++;
      else merged++;
    } else {
      // Insert new gig from RA
      const { error } = await sb.from("gigs").upsert(
        {
          artist_id: artistId,
          date,
          venue_name: venueName || eventName,
          venue_city: venueCity,
          venue_country: venueCountry,
          event_name: eventName,
          gig_type: gigType,
          co_artists: coArtists,
          source: "ra",
        },
        { onConflict: "artist_id,date,venue_name", ignoreDuplicates: false }
      );
      if (error) errors++;
      else upserted++;
    }
  }

  return { upserted, merged, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processSingleArtist(slug: string) {
  const sb = getSupabase();

  const { data: artist, error } = await sb
    .from("artists")
    .select("id, name, ra_id")
    .eq("slug", slug)
    .single();

  if (error || !artist) {
    console.error(`Artist not found in DB: ${slug}`);
    return;
  }

  console.log(`\n▶ ${artist.name}`);

  let raId = artist.ra_id ?? null;

  if (!raId) {
    console.log(`  Resolving RA ID for "${artist.name}"...`);
    raId = await resolveRaId(artist.name);
    if (!raId) {
      console.error(`  ✗ Could not resolve RA ID — skipping`);
      return;
    }
    console.log(`  Found RA ID: ${raId}`);
    await sb.from("artists").update({ ra_id: raId }).eq("id", artist.id);
  } else {
    console.log(`  Using cached RA ID: ${raId}`);
  }

  const events = await fetchRaEvents(raId);
  console.log(`  Total RA events: ${events.length}`);

  if (!events.length) return;

  const { upserted, merged, errors } = await upsertRaGigs(artist.id, events, artist.name);
  console.log(`  ✅ ${upserted} new gigs, ${merged} co_artist merges, ${errors} errors`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: scrape-ra-v2.ts <slug>  OR  --all");
    process.exit(1);
  }

  const sb = getSupabase();

  if (args[0] === "--all") {
    const { data: artists } = await sb.from("artists").select("slug").order("name");
    for (const a of artists ?? []) {
      await processSingleArtist(a.slug);
      await sleep(RATE_LIMIT_MS);
    }
  } else {
    await processSingleArtist(args[0]);
  }

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
