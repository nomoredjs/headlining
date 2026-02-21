/**
 * Releases scraper — discography data for the Releases tab.
 *
 * Sources:
 *  1. Wikipedia discography tables / section
 *  2. Beatport artist tracks page (genre, chart position, label)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-releases.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-releases.ts --all
 */

import * as cheerio from "cheerio";
import { getSupabase } from "./lib/supabase.js";

const RATE_LIMIT_MS = 2500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

// ── Wikipedia discography parser ──────────────────────────────────────────────

interface RawRelease {
  title: string;
  releaseType: "single" | "ep" | "album" | "remix";
  releaseDate: string | null;  // YYYY or YYYY-MM-DD
  label: string | null;
  collaborators: string[];
  ariaChartPosition: number | null;
  beatportPeakPosition: number | null;
  isAwardNominated: boolean;
  awards: string[];
  notable: string | null;
  source: string;
}

function inferReleaseType(title: string, context: string): "single" | "ep" | "album" | "remix" {
  const t = (title + " " + context).toLowerCase();
  if (t.includes("remix"))  return "remix";
  if (t.includes(" ep"))    return "ep";
  if (t.includes("album") || t.includes("lp")) return "album";
  return "single";
}

async function scrapeWikipediaReleases(artistName: string): Promise<RawRelease[]> {
  const releases: RawRelease[] = [];

  // Try main Wikipedia page first
  const wikiSlug = artistName.replace(/ /g, "_");
  const pagesToTry = [
    `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`,
    `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSlug + "_discography")}`,
  ];

  for (const url of pagesToTry) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const $ = cheerio.load(html);
    if ($(".disambigbox").length > 0) continue;

    let foundAny = false;

    // Strategy 1: Look for wikitable sections with year/title columns
    $("table.wikitable").each((_, table) => {
      const $table = $(table);
      const headers = $table.find("tr:first-child th, tr:first-child td")
        .map((_, el) => $(el).text().trim().toLowerCase()).get();

      // Check if this looks like a discography table
      const hasYear  = headers.some(h => h.includes("year") || h.includes("date"));
      const hasTitle = headers.some(h => h.includes("title") || h.includes("single") || h.includes("song"));
      if (!hasYear && !hasTitle) return;

      // Find column indices
      const yearIdx  = headers.findIndex(h => h.includes("year") || h.includes("date"));
      const titleIdx = headers.findIndex(h => h.includes("title") || h.includes("single") || h.includes("song"));
      const labelIdx = headers.findIndex(h => h.includes("label"));
      const chartIdx = headers.findIndex(h => h.includes("ari") || h.includes("aus") || h.includes("chart"));

      $table.find("tr").slice(1).each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;

        const yearText  = yearIdx >= 0  ? $(cells[yearIdx]).text().trim()  : "";
        const titleText = titleIdx >= 0 ? $(cells[titleIdx]).text().replace(/\[\d+\]/g, "").trim() : $(cells[0]).text().trim();
        const labelText = labelIdx >= 0 ? $(cells[labelIdx]).text().replace(/\[\d+\]/g, "").trim() : null;

        let ariaPos: number | null = null;
        if (chartIdx >= 0) {
          const chartVal = parseInt($(cells[chartIdx]).text().trim(), 10);
          if (!isNaN(chartVal)) ariaPos = chartVal;
        }

        if (!titleText || titleText.length > 100) return;

        // Extract year
        const yearMatch = yearText.match(/\d{4}/);
        const releaseDate = yearMatch ? yearMatch[0] : null;

        // Context = previous heading or caption
        const sectionText = $table.prevAll("h2,h3,h4").first().text().toLowerCase();
        const releaseType = inferReleaseType(titleText, sectionText);

        // Check for awards mention in row
        const rowText = $(row).text().toLowerCase();
        const isNominated = rowText.includes("grammy") || rowText.includes("aria award") || rowText.includes("nominated");
        const awards: string[] = [];
        if (rowText.includes("grammy")) awards.push("Grammy");
        if (rowText.includes("aria")) awards.push("ARIA");

        releases.push({
          title: titleText,
          releaseType,
          releaseDate,
          label: labelText,
          collaborators: [],
          ariaChartPosition: ariaPos,
          beatportPeakPosition: null,
          isAwardNominated: isNominated,
          awards,
          notable: null,
          source: "wikipedia",
        });
        foundAny = true;
      });
    });

    // Strategy 2: If no tables, scan for release lists in discography section
    if (!foundAny) {
      let inDiscography = false;
      $("h2, h3, ul li").each((_, el) => {
        const tag = el.tagName?.toLowerCase();
        if (tag === "h2" || tag === "h3") {
          inDiscography = $(el).text().toLowerCase().includes("discograph") ||
                          $(el).text().toLowerCase().includes("single") ||
                          $(el).text().toLowerCase().includes("release");
          return;
        }
        if (!inDiscography) return;

        const text = $(el).text().replace(/\[\d+\]/g, "").trim();
        // Look for lines like: "2023 — "Eat It" (with Green Velvet)"
        const match = text.match(/^(\d{4})\s*[—–-]\s*"?(.+?)"?\s*(?:\((.+?)\))?$/);
        if (match) {
          const collaborators = match[3]
            ? match[3].split(/,|feat\.|with/i).map(s => s.trim()).filter(Boolean)
            : [];
          releases.push({
            title: match[2].trim(),
            releaseType: inferReleaseType(match[2], ""),
            releaseDate: match[1],
            label: null, collaborators,
            ariaChartPosition: null, beatportPeakPosition: null,
            isAwardNominated: false, awards: [], notable: null,
            source: "wikipedia",
          });
          foundAny = true;
        }
      });
    }

    if (foundAny) {
      console.log(`  Wikipedia releases: ${releases.length} found`);
      break;
    }
    await sleep(RATE_LIMIT_MS);
  }

  return releases;
}

// ── Beatport scraper ──────────────────────────────────────────────────────────

async function scrapeBeatport(artistName: string): Promise<RawRelease[]> {
  const releases: RawRelease[] = [];

  const slug = artistName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  // Beatport's artist page + tracks tab
  const urls = [
    `https://www.beatport.com/artist/${slug}/tracks`,
    `https://www.beatport.com/artist/${slug}/1/tracks`,
  ];

  for (const url of urls) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const $ = cheerio.load(html);

    // Try __NEXT_DATA__ for structured track data
    const nextDataJson = $("#__NEXT_DATA__").html();
    if (nextDataJson) {
      try {
        const nextData = JSON.parse(nextDataJson) as {
          props?: { pageProps?: { tracks?: Array<{
            name: string;
            releaseDate?: string;
            label?: { name: string };
            genres?: Array<{ name: string }>;
            chartPositions?: Array<{ position: number }>;
          }> } };
        };
        const tracks = nextData?.props?.pageProps?.tracks ?? [];
        for (const track of tracks) {
          releases.push({
            title: track.name,
            releaseType: "single",
            releaseDate: track.releaseDate?.slice(0, 10) ?? null,
            label: track.label?.name ?? null,
            collaborators: [],
            ariaChartPosition: null,
            beatportPeakPosition: track.chartPositions?.[0]?.position ?? null,
            isAwardNominated: false,
            awards: [],
            notable: track.genres?.map(g => g.name).join(", ") || null,
            source: "beatport",
          });
        }
        if (releases.length > 0) {
          console.log(`  Beatport: ${releases.length} tracks`);
          return releases;
        }
      } catch {
        // Fall through to HTML parsing
      }
    }

    // HTML fallback: parse track list
    $(".track-list-row, .BeatportTrack, [class*='TrackMeta']").each((_, el) => {
      const title = $(el).find(".track-title, [class*='title']").first().text().trim();
      const label = $(el).find(".track-label, [class*='label']").first().text().trim();
      const date  = $(el).find("[class*='date'], time").first().text().trim();
      if (title) {
        releases.push({
          title, releaseType: "single",
          releaseDate: date || null,
          label: label || null,
          collaborators: [], ariaChartPosition: null,
          beatportPeakPosition: null,
          isAwardNominated: false, awards: [],
          notable: null, source: "beatport",
        });
      }
    });

    if (releases.length > 0) {
      console.log(`  Beatport HTML: ${releases.length} tracks`);
      return releases;
    }
  }

  console.log(`  Beatport: no tracks for "${artistName}"`);
  return [];
}

// ── Upsert releases ───────────────────────────────────────────────────────────

async function upsertReleases(
  artistId: string,
  releases: RawRelease[],
): Promise<{ inserted: number; errors: number }> {
  const sb = getSupabase();
  let inserted = 0;
  let errors = 0;

  // Deduplicate by title (case-insensitive) — prefer wikipedia over beatport
  const seen = new Map<string, RawRelease>();
  for (const r of releases) {
    const key = r.title.toLowerCase();
    if (!seen.has(key) || r.source === "wikipedia") {
      seen.set(key, r);
    }
  }

  const rows = [...seen.values()].map(r => ({
    artist_id: artistId,
    title: r.title,
    release_type: r.releaseType,
    release_date: r.releaseDate,
    label: r.label,
    collaborators: r.collaborators,
    aria_chart_position: r.ariaChartPosition,
    beatport_peak_position: r.beatportPeakPosition,
    is_award_nominated: r.isAwardNominated,
    awards: r.awards,
    notable: r.notable,
    source: r.source,
  }));

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb
      .from("releases")
      .upsert(batch, { onConflict: "artist_id,title", ignoreDuplicates: true });
    if (error) { console.warn("  Batch error:", error.message); errors += batch.length; }
    else inserted += batch.length;
  }

  return { inserted, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processArtist(slug: string) {
  const sb = getSupabase();

  const { data: artist, error } = await sb
    .from("artists")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (error || !artist) { console.error(`Artist not found: ${slug}`); return; }

  console.log(`\n▶ ${artist.name}`);

  const wikiReleases = await scrapeWikipediaReleases(artist.name);
  await sleep(RATE_LIMIT_MS);
  const beatportReleases = await scrapeBeatport(artist.name);

  const allReleases = [...wikiReleases, ...beatportReleases];
  if (!allReleases.length) { console.log("  No releases found"); return; }

  const { inserted, errors } = await upsertReleases(artist.id, allReleases);
  console.log(`  ✅ ${inserted} releases inserted, ${errors} errors`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) { console.error("Usage: scrape-releases.ts <slug>  OR  --all"); process.exit(1); }

  const sb = getSupabase();

  if (args[0] === "--all") {
    const { data: artists } = await sb.from("artists").select("slug").order("name");
    for (const a of artists ?? []) {
      await processArtist(a.slug);
      await sleep(RATE_LIMIT_MS);
    }
  } else {
    await processArtist(args[0]);
  }

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
