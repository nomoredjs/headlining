/**
 * Songkick gig scraper — PRIMARY gig source.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-songkick.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-songkick.ts --all
 *
 * Fetches all pages of an artist's gigography from songkick.com,
 * parses each event, and upserts into the gigs table.
 */

import * as cheerio from "cheerio";
import { getSupabase } from "./lib/supabase.js";
import { inferGigType } from "./lib/gig-utils.js";

const RATE_LIMIT_MS = 2000;   // 2 s between requests
const EVENTS_PER_PAGE = 50;   // Songkick shows up to 50 events per page
const MAX_PAGES = 200;         // safety cap (200 × 50 = 10 000 gigs)
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ── Search for Songkick artist ID ─────────────────────────────────────────────

async function findSongkickId(
  artistName: string
): Promise<{ id: string; slug: string } | null> {
  const q = encodeURIComponent(artistName);
  const url = `https://www.songkick.com/search?query=${q}&type=artists`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Artist results appear as links like /artists/12345-dom-dolla
  const link = $("a[href*='/artists/']").first().attr("href");
  if (!link) return null;

  const match = link.match(/\/artists\/(\d+)-(.+)/);
  if (!match) return null;

  return { id: match[1], slug: match[2] };
}

// ── Parse a single gigography page ───────────────────────────────────────────

interface RawGig {
  date: string;         // YYYY-MM-DD
  eventName: string;
  venueName: string;
  venueCity: string;
  venueCountry: string;
  billingPosition: string | null;
  isSoldOut: boolean;
}

function parseGigPage(html: string): RawGig[] {
  const $ = cheerio.load(html);
  const gigs: RawGig[] = [];

  // Songkick gigography uses .event-listings .event-listing items
  $(".event-listings .event-listing, ul.event-listing li.event").each((_, el) => {
    const $el = $(el);

    // Date — try multiple selectors
    const dateStr =
      $el.find("time").attr("datetime") ||
      $el.find(".date").text().trim() ||
      $el.find("[datetime]").attr("datetime") || "";

    // Parse date — can be "2024-03-15" or human readable
    let date = "";
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      date = dateStr.slice(0, 10);
    } else {
      // Skip if we can't parse the date
      return;
    }

    // Prefer the linked event/festival name over the artist headliner text.
    // Songkick: summary has <strong>Artist</strong> at <a>Event/Venue</a>
    const summaryLink = $el.find(".summary a").first().text().trim();
    const summaryText = $el.find(".summary, .event-name, h3, .lineup-card__name").text().trim();
    const eventName   = summaryLink || summaryText;
    const venueName   = $el.find(".venue-name, .location .name, .venue").first().text().trim();

    // Location is typically "City, Country"
    const locationText = $el.find(".location, .venue-location").text().trim();
    const parts = locationText.split(",").map((s) => s.trim());
    const venueCity    = parts[0] || "";
    const venueCountry = parts[parts.length - 1] || "";

    const billingText = $el.find(".billing").text().trim().toLowerCase();
    let billingPosition: string | null = null;
    if (billingText.includes("headliner") || billingText.includes("headline")) {
      billingPosition = "Headliner";
    } else if (billingText.includes("support")) {
      billingPosition = "Support";
    } else if (billingText.includes("b2b")) {
      billingPosition = "B2B";
    }

    const isSoldOut = $el.find(".sold-out, .status-sold-out").length > 0;

    if (date && (venueName || eventName)) {
      gigs.push({ date, eventName, venueName, venueCity, venueCountry, billingPosition, isSoldOut });
    }
  });

  return gigs;
}

// ── Paginate through all gigography pages ─────────────────────────────────────

async function scrapeAllGigs(songkickId: string): Promise<RawGig[]> {
  const allGigs: RawGig[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://www.songkick.com/artists/${songkickId}/gigography?page=${page}`;
    console.log(`  Page ${page}: ${url}`);

    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.warn(`  Page ${page} HTTP error — stopping:`, (err as Error).message);
      break;
    }

    const gigs = parseGigPage(html);
    allGigs.push(...gigs);
    console.log(`    → ${gigs.length} gigs (${allGigs.length} total so far)`);

    // Determine whether there's a next page.
    // Songkick shows a rel=next link when more pages exist.
    // Fall back to: if we got a full page (≥ EVENTS_PER_PAGE), keep going.
    const $ = cheerio.load(html);
    const hasNextLink =
      $("a[rel='next']").length > 0 ||
      $(".pagination a").filter((_, el) => {
        const href = $(el).attr("href") ?? "";
        return href.includes(`page=${page + 1}`);
      }).length > 0;

    const likelyMorePages = gigs.length >= EVENTS_PER_PAGE;

    if (!hasNextLink && !likelyMorePages) {
      console.log(`  No next page detected — done.`);
      break;
    }

    await sleep(RATE_LIMIT_MS);
  }

  return allGigs;
}

// ── Upsert gigs into Supabase (batched for speed) ────────────────────────────

const BATCH_SIZE = 100;

async function upsertGigs(
  artistId: string,
  gigs: RawGig[]
): Promise<{ inserted: number; errors: number }> {
  const sb = getSupabase();
  let inserted = 0;
  let errors = 0;

  const rows = gigs.map((g) => ({
    artist_id: artistId,
    date: g.date,
    venue_name: g.venueName || g.eventName,
    venue_city: g.venueCity,
    venue_country: g.venueCountry,
    event_name: g.eventName,
    billing_position: g.billingPosition,
    gig_type: inferGigType(g.eventName, g.venueName),
    is_sold_out: g.isSoldOut,
    source: "songkick",
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await sb
      .from("gigs")
      .upsert(batch, { onConflict: "artist_id,date,venue_name", ignoreDuplicates: true })
      .select("id", { count: "exact", head: true });

    if (error) {
      console.warn(`  Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += count ?? batch.length;
    }
  }

  return { inserted, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processSingleArtist(slug: string) {
  const sb = getSupabase();

  // Look up artist
  const { data: artist, error } = await sb
    .from("artists")
    .select("id, name, songkick_id")
    .eq("slug", slug)
    .single();

  if (error || !artist) {
    console.error(`Artist not found in DB: ${slug}`);
    return;
  }

  console.log(`\n▶ ${artist.name}`);

  // Resolve Songkick ID (cached on artists.songkick_id)
  let songkickInfo: { id: string; slug: string } | null = null;

  if (artist.songkick_id) {
    console.log(`  Using cached Songkick ID: ${artist.songkick_id}`);
    songkickInfo = { id: artist.songkick_id, slug: "" };
  } else {
    console.log(`  Searching Songkick for "${artist.name}"...`);
    await sleep(RATE_LIMIT_MS);
    songkickInfo = await findSongkickId(artist.name);

    if (!songkickInfo) {
      console.error(`  ✗ Could not find Songkick page for ${artist.name}`);
      return;
    }
    console.log(`  Found: ID ${songkickInfo.id} (slug: ${songkickInfo.slug})`);

    // Cache the ID
    await sb.from("artists").update({ songkick_id: songkickInfo.id }).eq("id", artist.id);
  }

  // Scrape all gig pages
  const gigs = await scrapeAllGigs(songkickInfo.id);
  console.log(`  Scraped ${gigs.length} raw gigs`);

  if (gigs.length === 0) {
    console.log("  No gigs found — check the Songkick ID or page structure");
    return;
  }

  // Print sample
  console.log("\n  Sample gigs:");
  for (const g of gigs.slice(0, 5)) {
    const type = inferGigType(g.eventName, g.venueName);
    console.log(`    ${g.date}  [${type.padEnd(8)}]  ${g.venueName || g.eventName}  — ${g.venueCity}, ${g.venueCountry}`);
  }
  console.log(`    ... and ${Math.max(0, gigs.length - 5)} more`);

  // Upsert
  const { inserted, errors } = await upsertGigs(artist.id, gigs);
  console.log(`\n  ✅ ${inserted} inserted, ${errors} errors`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: scrape-songkick.ts <slug>  OR  --all");
    process.exit(1);
  }

  if (args[0] === "--all") {
    const sb = getSupabase();
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
