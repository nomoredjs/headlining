/**
 * Resident Advisor gig scraper — PRIMARY source.
 *
 * Scrapes public RA HTML pages directly — no GraphQL, no numeric ID.
 *
 * Pages:
 *   Past events:   https://ra.co/dj/{slug}/past-events?page=N
 *   Upcoming:      https://ra.co/dj/{slug}/tour-dates
 *
 * Slug format: artist name lowercased, all non-alphanumeric stripped.
 *   "Dom Dolla" → "domdolla"
 *   "Carl Cox"  → "carlcox"
 *   "Amelie Lens" → "amelielens"
 *
 * Each page is a Next.js SSR page — event data lives in the
 * __NEXT_DATA__ <script> tag as JSON. Cheerio HTML parsing is the
 * fallback if __NEXT_DATA__ doesn't yield events.
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
const MAX_PAGES     = 100; // 100 pages × ~20 events = 2 000 max

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── RA slug ───────────────────────────────────────────────────────────────────
// RA slugs are the artist name lowercased with everything non-alphanumeric removed.

function toRaSlug(artistName: string): string {
  return artistName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://ra.co/",
      },
    });
    if (!res.ok) {
      console.log(`    HTTP ${res.status} for ${url}`);
      return null;
    }
    return res.text();
  } catch (err) {
    console.log(`    Fetch error: ${(err as Error).message}`);
    return null;
  }
}

// ── Structured event type ─────────────────────────────────────────────────────

interface RaEvent {
  date: string;        // YYYY-MM-DD
  eventName: string;
  venueName: string;
  venueCity: string;
  venueCountry: string;
  coArtists: string[];
}

// ── __NEXT_DATA__ parser ──────────────────────────────────────────────────────
// RA is a Next.js app. All SSR data is embedded in <script id="__NEXT_DATA__">.
// The event array can live at several paths depending on RA's version/page type.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromNextData(raw: string, targetArtistName: string): RaEvent[] {
  let nd: Record<string, unknown>;
  try { nd = JSON.parse(raw); } catch { return []; }

  // Walk the JSON looking for an array of objects that look like RA event listings
  const candidates: unknown[] = [];

  function walk(val: unknown, depth = 0): void {
    if (depth > 10 || !val || typeof val !== "object") return;
    if (Array.isArray(val)) {
      // If this array looks like event listings, save it
      if (val.length > 0 && isLikelyEventArray(val)) candidates.push(val);
      val.forEach(v => walk(v, depth + 1));
    } else {
      Object.values(val as Record<string, unknown>).forEach(v => walk(v, depth + 1));
    }
  }

  walk(nd);

  // Score and pick the best candidate (largest array of event-shaped objects)
  const best = candidates
    .map(c => c as unknown[])
    .sort((a, b) => b.length - a.length)[0];

  if (!best) return [];

  return best.flatMap(item => parseNextDataEvent(item as Record<string, unknown>, targetArtistName));
}

function isLikelyEventArray(arr: unknown[]): boolean {
  // Check if first element has date + venue-like fields
  const first = arr[0] as Record<string, unknown>;
  if (!first || typeof first !== "object") return false;
  const keys = Object.keys(first);
  return (
    keys.some(k => ["date", "startTime", "listingDate", "eventDate"].includes(k)) &&
    keys.some(k => ["venue", "title", "name", "eventName"].includes(k))
  );
}

function parseNextDataEvent(
  item: Record<string, unknown>,
  targetArtistName: string,
): RaEvent[] {
  // Normalise the various shapes RA has used
  const event = (item.event as Record<string, unknown>) ?? item;

  // Date
  const rawDate =
    (event.date as string) ??
    (event.startTime as string) ??
    (event.listingDate as string) ??
    (item.startTime as string) ??
    (item.date as string) ?? "";
  const date = rawDate.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return [];

  // Title / event name
  const eventName =
    (event.title as string) ??
    (event.name as string) ??
    (item.title as string) ?? "";

  // Venue
  const venueObj =
    (event.venue as Record<string, unknown>) ??
    (item.venue as Record<string, unknown>) ?? null;
  const venueName    = (venueObj?.name as string) ?? "";
  const areaObj      = venueObj?.area as Record<string, unknown> | undefined;
  const venueCity    = (areaObj?.name as string) ?? "";
  const venueCountry = ((areaObj?.country as Record<string, unknown>)?.name as string) ?? "";

  // Artists / lineup
  const artistsRaw =
    (event.artists as Array<Record<string, unknown>>) ??
    (event.lineup as Array<Record<string, unknown>>) ??
    (item.artists as Array<Record<string, unknown>>) ?? [];

  const coArtists = artistsRaw
    .map(a => (a.name as string) ?? (a.artistName as string) ?? "")
    .filter(n => n && n.toLowerCase() !== targetArtistName.toLowerCase());

  if (!venueName && !eventName) return [];

  return [{ date, eventName, venueName, venueCity, venueCountry, coArtists }];
}

// ── HTML cheerio fallback ─────────────────────────────────────────────────────
// If __NEXT_DATA__ doesn't yield events, parse the visible DOM.
// RA's CSS class names are auto-generated so we use structural + attribute selectors.

function extractFromHtml(html: string, targetArtistName: string): RaEvent[] {
  const $ = cheerio.load(html);
  const events: RaEvent[] = [];

  // RA renders each event as a linked card — look for links to /events/...
  $("a[href*='/events/']").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (!text) return;

    // Date: <time> element with datetime attribute anywhere inside the card
    const timeEl = $el.find("time[datetime]").first();
    const rawDate = timeEl.attr("datetime") ?? timeEl.attr("data-date") ?? "";
    const date = rawDate.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      // Try parsing visible date text
      const dateText = timeEl.text().trim() || $el.find("[class*='date'], [class*='Date']").first().text().trim();
      const parsed = parseDateText(dateText);
      if (!parsed) return;
    }

    const resolvedDate = date || parseDateText(timeEl.text()) || "";
    if (!resolvedDate) return;

    // Event name: first heading or prominent text element
    const headings = $el.find("h1,h2,h3,h4,strong,[class*='title'],[class*='Title'],[class*='name'],[class*='Name']");
    const eventName = headings.first().text().trim();

    // Venue + location — RA often puts these in separate spans/divs
    const allText = $el.find("*").map((_, e) => $(e).text().trim()).get()
      .filter(t => t.length > 2 && t.length < 60);

    // Heuristic: venue name is typically first medium-length text after event name
    const venueName = allText.find(t =>
      t !== eventName && !t.match(/^\d/) && t.length > 3
    ) ?? "";

    // Location: text containing a comma (City, Country format)
    const locationText = allText.find(t => t.includes(",") && t.length < 50) ?? "";
    const locParts   = locationText.split(",").map(s => s.trim());
    const venueCity    = locParts[0] ?? "";
    const venueCountry = locParts[locParts.length - 1] ?? "";

    // Co-artists: often listed as comma-separated names at the bottom of the card
    const lineupText = $el.find("[class*='lineup'],[class*='Lineup'],[class*='artist'],[class*='Artist']")
      .last().text().trim();
    const coArtists = lineupText
      .split(/[,·•\n]/)
      .map(s => s.trim())
      .filter(n => n && n.toLowerCase() !== targetArtistName.toLowerCase() && n.length < 50);

    if (resolvedDate && (eventName || venueName)) {
      events.push({ date: resolvedDate, eventName, venueName, venueCity, venueCountry, coArtists });
    }
  });

  return events;
}

function parseDateText(text: string): string | null {
  if (!text) return null;
  const d = new Date(text);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ── Fetch and parse one page ──────────────────────────────────────────────────

async function parsePage(url: string, artistName: string): Promise<{ events: RaEvent[]; hasMore: boolean }> {
  const html = await fetchHtml(url);
  if (!html) return { events: [], hasMore: false };

  const $ = cheerio.load(html);
  const nextDataRaw = $("#__NEXT_DATA__").html() ?? "";

  // Try __NEXT_DATA__ first
  let events = extractFromNextData(nextDataRaw, artistName);

  if (events.length === 0) {
    // Fall back to HTML parsing
    events = extractFromHtml(html, artistName);
  }

  // RA paginates — detect if there's a next page
  const hasNextLink =
    $("a[rel='next']").length > 0 ||
    $("[class*='pagination'] a[aria-label*='Next'], [class*='pagination'] a[aria-label*='next']").length > 0;

  // Also treat as "has more" if we got a full-looking page (≥10 events)
  const hasMore = hasNextLink || events.length >= 10;

  return { events, hasMore };
}

// ── Scrape all past-events pages ──────────────────────────────────────────────

async function scrapeAllPages(raSlug: string, artistName: string): Promise<RaEvent[]> {
  const all: RaEvent[] = [];

  // 1. Past events (paginated)
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://ra.co/dj/${raSlug}/past-events?page=${page}`;
    console.log(`  Page ${page}: ${url}`);

    const { events, hasMore } = await parsePage(url, artistName);
    console.log(`  Page ${page}: ${events.length} events (total ${all.length + events.length})`);

    if (events.length === 0) {
      // Print HTML snippet for diagnosis when we expected more events
      if (page === 1) {
        const html = await fetchHtml(url);
        if (html) {
          const snippet = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
          console.log(`  Page 1 HTML preview: ${snippet}`);
        }
      }
      console.log(`  No events on page ${page} — stopping.`);
      break;
    }

    all.push(...events);
    if (!hasMore) { console.log(`  No next page — done.`); break; }

    await sleep(RATE_LIMIT_MS);
  }

  // 2. Upcoming / tour dates (single page, no pagination)
  await sleep(RATE_LIMIT_MS);
  const tourUrl = `https://ra.co/dj/${raSlug}/tour-dates`;
  console.log(`  Upcoming: ${tourUrl}`);
  const { events: upcoming } = await parsePage(tourUrl, artistName);
  console.log(`  Upcoming: ${upcoming.length} events`);
  all.push(...upcoming);

  return all;
}

// ── Upsert to DB ──────────────────────────────────────────────────────────────

const BATCH = 100;

async function upsertGigs(
  artistId: string,
  events: RaEvent[],
): Promise<{ inserted: number; errors: number }> {
  const sb = getSupabase();
  let inserted = 0;
  let errors   = 0;

  const rows = events
    .filter(e => e.date && (e.venueName || e.eventName))
    .map(e => ({
      artist_id:     artistId,
      date:          e.date,
      venue_name:    e.venueName || e.eventName,
      venue_city:    e.venueCity,
      venue_country: e.venueCountry,
      event_name:    e.eventName,
      gig_type:      inferGigType(e.eventName, e.venueName),
      co_artists:    e.coArtists,
      source:        "ra",
    }));

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
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (error || !artist) { console.error(`Artist not found in DB: ${slug}`); return; }

  const raSlug = toRaSlug(artist.name);
  console.log(`\n▶ ${artist.name}  →  ra.co/dj/${raSlug}${dryRun ? "  [DRY RUN]" : ""}`);

  const events = await scrapeAllPages(raSlug, artist.name);
  console.log(`\n  Total: ${events.length} events`);

  if (!events.length) return;

  // Print sample
  for (const e of events.slice(0, 5)) {
    const co = e.coArtists.length ? `  with: ${e.coArtists.slice(0, 3).join(", ")}` : "";
    console.log(`    ${e.date}  ${(e.venueName || e.eventName).slice(0, 35).padEnd(35)}  ${e.venueCity}, ${e.venueCountry}${co}`);
  }
  if (events.length > 5) console.log(`    ... and ${events.length - 5} more`);

  if (dryRun) { console.log("\n  [dry-run] skipping DB write"); return; }

  const { inserted, errors } = await upsertGigs(artist.id, events);
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
