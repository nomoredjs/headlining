/**
 * Concert Archives scraper — historical gig backfill.
 * concertarchives.org is server-side rendered plain HTML with no
 * geolocation filtering — reliable source for career gig history.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-concert-archives.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-concert-archives.ts --all
 *   npx tsx --env-file=.env.local scripts/scrape-concert-archives.ts --dry-run dom-dolla
 */

import * as cheerio from "cheerio";
import { getSupabase } from "./lib/supabase.js";
import { inferGigType } from "./lib/gig-utils.js";

const RATE_LIMIT_MS = 2500;
const MAX_PAGES     = 100;
const BATCH         = 100;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      console.log(`    HTTP ${res.status}`);
      return null;
    }
    return res.text();
  } catch (err) {
    console.log(`    Fetch error: ${(err as Error).message}`);
    return null;
  }
}

// ── Build slug candidates ─────────────────────────────────────────────────────

function slugCandidates(artistName: string, dbSlug: string): string[] {
  const base = artistName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const hyphen  = base.replace(/\s+/g, "-");
  const nospace = base.replace(/\s+/g, "");
  const plus    = base.replace(/\s+/g, "+");
  return [...new Set([dbSlug, hyphen, nospace, plus])];
}

// ── Find the band page URL ────────────────────────────────────────────────────

async function findBandUrl(artistName: string, dbSlug: string): Promise<string | null> {
  // Try direct slug URLs first
  for (const slug of slugCandidates(artistName, dbSlug)) {
    const url = `https://www.concertarchives.org/bands/${slug}`;
    const html = await fetchHtml(url);
    if (!html) continue;

    // Confirm it's an actual band page (not a 404 / redirect to search)
    const $ = cheerio.load(html);
    const title = $("title").text();
    const hasTable = $("table.setlists, .concert-listing, #concerts").length > 0
      || $("table").length > 0;

    if (hasTable && !title.toLowerCase().includes("search")) {
      console.log(`  Found Concert Archives: /bands/${slug}`);
      return url;
    }
    await sleep(RATE_LIMIT_MS);
  }

  // Fall back to site search
  const q = encodeURIComponent(artistName);
  const searchUrl = `https://www.concertarchives.org/bands?search%5Bsearch%5D=${q}`;
  const html = await fetchHtml(searchUrl);
  if (!html) return null;

  const $ = cheerio.load(html);
  const firstResult = $("a[href*='/bands/']").first().attr("href");
  if (firstResult && !firstResult.includes("?")) {
    const fullUrl = `https://www.concertarchives.org${firstResult}`;
    console.log(`  Found via search: ${fullUrl}`);
    return fullUrl;
  }

  return null;
}

// ── Parse concert rows from a band page ───────────────────────────────────────

interface CaGig {
  date: string;        // YYYY-MM-DD
  eventName: string;
  venueName: string;
  venueCity: string;
  venueCountry: string;
}

function parseConcertPage(html: string): CaGig[] {
  const $ = cheerio.load(html);
  const gigs: CaGig[] = [];

  // Concert Archives lists concerts in a table or as list items
  // Typical row: Date | Concert/Event | Venue | City, Country
  $("table tr, .concert-row, li.concert").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td");

    // Try structured table cells first
    if (cells.length >= 2) {
      const dateText  = $(cells[0]).text().trim();
      const nameText  = $(cells[1]).text().replace(/\[\d+\]/g, "").trim();
      const venueText = cells.length >= 3 ? $(cells[2]).text().trim() : "";
      const locText   = cells.length >= 4 ? $(cells[3]).text().trim() : "";

      const date = parseDate(dateText);
      if (!date) return;

      // Location: "City, Country" or "City, State, Country"
      const locParts = locText.split(",").map(s => s.trim());
      const venueCity    = locParts[0] || "";
      const venueCountry = locParts[locParts.length - 1] || "";

      if (date && (nameText || venueText)) {
        gigs.push({
          date,
          eventName: nameText,
          venueName: venueText || nameText,
          venueCity,
          venueCountry,
        });
      }
      return;
    }

    // Fallback: single-cell rows with inline text
    const text = $row.text().trim();
    const dateMatch = text.match(/\b(\w+ \d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/);
    if (dateMatch) {
      const date = parseDate(dateMatch[1]);
      if (date) gigs.push({ date, eventName: text.slice(0, 80), venueName: "", venueCity: "", venueCountry: "" });
    }
  });

  return gigs;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;

  // Already ISO: "2024-03-15"
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // "March 15, 2024" or "Mar 15 2024"
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

// ── Paginate all pages ────────────────────────────────────────────────────────

async function scrapeAllPages(bandUrl: string): Promise<CaGig[]> {
  const all: CaGig[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? bandUrl : `${bandUrl}?page=${page}`;
    console.log(`  Page ${page}: fetching…`);

    const html = await fetchHtml(url);
    if (!html) break;

    const gigs = parseConcertPage(html);
    console.log(`  Page ${page}: ${gigs.length} concerts (total ${all.length + gigs.length})`);

    if (gigs.length === 0) {
      console.log(`  Page ${page} returned 0 concerts — done.`);
      break;
    }

    all.push(...gigs);

    // Check for a "next page" link to avoid over-fetching
    const $ = cheerio.load(html);
    const hasNext =
      $("a[rel='next']").length > 0 ||
      $(`.pagination a[href*="page=${page + 1}"]`).length > 0 ||
      $("a.next_page, .next a").length > 0;

    if (!hasNext && gigs.length < 20) {
      // Fewer than 20 results and no explicit next link = last page
      break;
    }

    await sleep(RATE_LIMIT_MS);
  }

  return all;
}

// ── Upsert ────────────────────────────────────────────────────────────────────

async function upsertGigs(artistId: string, gigs: CaGig[]): Promise<{ inserted: number; errors: number }> {
  const sb = getSupabase();
  let inserted = 0;
  let errors   = 0;

  const rows = gigs.map(g => ({
    artist_id:     artistId,
    date:          g.date,
    venue_name:    g.venueName || g.eventName,
    venue_city:    g.venueCity,
    venue_country: g.venueCountry,
    event_name:    g.eventName,
    gig_type:      inferGigType(g.eventName, g.venueName),
    source:        "concert-archives",
  }));

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await sb
      .from("gigs")
      .upsert(batch, { onConflict: "artist_id,date,venue_name", ignoreDuplicates: true })
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
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (error || !artist) { console.error(`Artist not found: ${slug}`); return; }

  console.log(`\n▶ ${artist.name}${dryRun ? " [DRY RUN]" : ""}`);

  const bandUrl = await findBandUrl(artist.name, slug);
  if (!bandUrl) { console.log(`  ✗ No Concert Archives page found`); return; }

  const gigs = await scrapeAllPages(bandUrl);
  console.log(`\n  Total: ${gigs.length} concerts`);

  if (!gigs.length) return;

  const sample = gigs.slice(0, 3);
  for (const g of sample) {
    console.log(`    ${g.date}  ${g.venueName || g.eventName}  — ${g.venueCity}, ${g.venueCountry}`);
  }
  if (gigs.length > 3) console.log(`    ... and ${gigs.length - 3} more`);

  if (dryRun) { console.log("\n  [dry-run] skipping DB write"); return; }

  const { inserted, errors } = await upsertGigs(artist.id, gigs);
  console.log(`\n  ✅ ${inserted} inserted, ${errors} errors`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: scrape-concert-archives.ts [--dry-run] <slug|--all>");
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
