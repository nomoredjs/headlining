/**
 * Artist metadata scraper — hero section data.
 *
 * Sources:
 *  1. Wikipedia — real_name, born, origin, label, genres, grammy, aria
 *  2. kworb.net  — spotify_monthly_listeners, total_streams
 *  3. Instagram  — instagram_followers (from og:description meta tag)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-artist-meta.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/scrape-artist-meta.ts --all
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFollowers(text: string): number | null {
  // "1.2M followers", "856K followers", "1,234,567 followers"
  const m = text.match(/([\d.,]+)\s*([KMB]?)\s*followers/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  const mult = m[2]?.toUpperCase();
  if (mult === "M") return Math.round(num * 1_000_000);
  if (mult === "K") return Math.round(num * 1_000);
  if (mult === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

function parseListeners(text: string): number | null {
  // "6,823,456 monthly listeners"
  const m = text.match(/([\d,]+)\s*monthly\s*listener/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

function parseStreams(text: string): number | null {
  // "1.5B", "245M", "12,345,678"
  const m = text.match(/([\d.,]+)\s*([KMB]?)/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  const mult = m[2]?.toUpperCase();
  if (mult === "B") return Math.round(num * 1_000_000_000);
  if (mult === "M") return Math.round(num * 1_000_000);
  if (mult === "K") return Math.round(num * 1_000);
  return Math.round(num);
}

// ── Wikipedia scraper ─────────────────────────────────────────────────────────

interface WikiMeta {
  realName: string | null;
  born: string | null;
  origin: string | null;
  label: string | null;
  genres: string[];
  grammy: string | null;
  aria: string | null;
  djAwards: string | null;
  wikipediaSlug: string | null;
}

async function scrapeWikipedia(artistName: string): Promise<WikiMeta | null> {
  // Try different slug formats
  const slugCandidates = [
    artistName.replace(/ /g, "_"),
    artistName.replace(/ /g, "_") + "_(DJ)",
    artistName.replace(/ /g, "_") + "_(musician)",
    artistName.replace(/ /g, "_") + "_(artist)",
  ];

  for (const wikiSlug of slugCandidates) {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`;
    const html = await fetchHtml(url);
    if (!html) continue;

    const $ = cheerio.load(html);

    // Check it's actually an article (not a disambiguation page)
    if ($(".disambigbox, #disambigbox").length > 0) continue;
    if ($("title").text().includes("disambiguation")) continue;

    const result: WikiMeta = {
      realName: null, born: null, origin: null, label: null,
      genres: [], grammy: null, aria: null, djAwards: null,
      wikipediaSlug: wikiSlug,
    };

    // Parse the infobox
    $(".infobox tr").each((_, row) => {
      const $row = $(row);
      const header = $row.find("th").text().trim().toLowerCase();
      const value  = $row.find("td").text().replace(/\[\d+\]/g, "").trim();

      if (!value) return;

      if (header.includes("born") || header.includes("birth name")) {
        // Born cell often: "Full Name\n12 January 1990 (age 34)\nMelbourne, Australia"
        if (header.includes("name")) {
          result.realName = value.split("\n")[0].trim();
        } else {
          // Extract date pattern
          const dateMatch = value.match(/\d{1,2}\s+\w+\s+\d{4}/);
          if (dateMatch) result.born = dateMatch[0];
        }
      }
      if (header === "origin") result.origin = value.split("\n")[0].trim();
      if (header === "label" || header === "labels") {
        result.label = value.split("\n").slice(0, 2).join(" / ");
      }
      if (header === "genres" || header === "genre") {
        result.genres = value
          .split(/[\n,·]/)
          .map(s => s.trim())
          .filter(s => s.length > 2 && s.length < 40);
      }
    });

    // Awards section — scan for Grammy / ARIA / DJ Awards mentions
    const bodyText = $("body").text();

    const grammyMatch = bodyText.match(/Grammy[^.]*?(nomination|win|award)[^.]*?\./i) ||
                        bodyText.match(/(\d+)\s+Grammy\s+(nomination|win)/i);
    if (grammyMatch) result.grammy = grammyMatch[0].trim().slice(0, 100);

    const ariaMatch = bodyText.match(/ARIA[^.]*?(Award|Chart)[^.]*?\./i);
    if (ariaMatch) result.aria = ariaMatch[0].trim().slice(0, 100);

    const djAwardsMatch = bodyText.match(/DJ\s+Award[^.]*?\./i);
    if (djAwardsMatch) result.djAwards = djAwardsMatch[0].trim().slice(0, 100);

    console.log(`  Wikipedia: found ${wikiSlug}`);
    return result;
  }

  console.log(`  Wikipedia: no page found for "${artistName}"`);
  return null;
}

// ── kworb.net scraper ─────────────────────────────────────────────────────────

interface KworbData {
  monthlyListeners: number | null;
  totalStreams: number | null;
  spotifyId: string | null;
}

async function scrapeKworb(artistName: string, knownSpotifyId?: string | null): Promise<KworbData> {
  const result: KworbData = { monthlyListeners: null, totalStreams: null, spotifyId: knownSpotifyId ?? null };

  // If we have the Spotify ID, fetch directly
  if (knownSpotifyId) {
    const url = `https://kworb.net/spotify/artist/${knownSpotifyId}.html`;
    const html = await fetchHtml(url);
    if (html) {
      const $ = cheerio.load(html);
      const pageText = $("body").text();

      result.monthlyListeners = parseListeners(pageText);

      // Sum streams from the track table
      let totalStreams = 0;
      $("table tbody tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 3) {
          const streamText = $(cells[2]).text().replace(/,/g, "").trim();
          const streams = parseInt(streamText, 10);
          if (!isNaN(streams)) totalStreams += streams;
        }
      });
      if (totalStreams > 0) result.totalStreams = totalStreams;

      console.log(`  kworb: ${result.monthlyListeners?.toLocaleString()} monthly, ${result.totalStreams?.toLocaleString()} total streams`);
      return result;
    }
  }

  // Try searching kworb's artist list
  const searchName = artistName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const listHtml = await fetchHtml(`https://kworb.net/spotify/listeners.html`);
  if (listHtml) {
    const $ = cheerio.load(listHtml);
    let found = false;
    $("table tbody tr a").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const text = $(el).text().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (text === searchName && href.includes("/artist/")) {
        const idMatch = href.match(/artist\/([a-zA-Z0-9]+)/);
        if (idMatch) {
          result.spotifyId = idMatch[1];
          found = true;
          return false; // break
        }
      }
    });

    if (found && result.spotifyId) {
      // Recurse with the found ID
      await sleep(1000);
      return scrapeKworb(artistName, result.spotifyId);
    }
  }

  console.log(`  kworb: no data for "${artistName}"`);
  return result;
}

// ── Instagram scraper ─────────────────────────────────────────────────────────

async function scrapeInstagram(handle: string): Promise<number | null> {
  if (!handle) return null;
  const url = `https://www.instagram.com/${handle}/`;
  const html = await fetchHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // Try og:description: "1.2M Followers, 892 Following, 3,456 Posts"
  const ogDesc = $("meta[property='og:description']").attr("content") ?? "";
  const fromOg = parseFollowers(ogDesc);
  if (fromOg) {
    console.log(`  Instagram (@${handle}): ${fromOg.toLocaleString()} followers`);
    return fromOg;
  }

  // Try searching page content
  const bodyText = html.slice(0, 5000);
  const fromBody = parseFollowers(bodyText);
  if (fromBody) {
    console.log(`  Instagram (@${handle}): ${fromBody.toLocaleString()} followers`);
    return fromBody;
  }

  console.log(`  Instagram (@${handle}): could not parse followers`);
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processArtist(slug: string) {
  const sb = getSupabase();

  const { data: artist, error } = await sb
    .from("artists")
    .select("id, name, spotify_id, instagram, wikipedia_slug")
    .eq("slug", slug)
    .single();

  if (error || !artist) {
    console.error(`Artist not found: ${slug}`);
    return;
  }

  console.log(`\n▶ ${artist.name}`);

  const updates: Record<string, unknown> = {};

  // 1. Wikipedia
  await sleep(RATE_LIMIT_MS);
  const wiki = await scrapeWikipedia(artist.name);
  if (wiki) {
    if (wiki.realName)      updates.real_name      = wiki.realName;
    if (wiki.born)          updates.born            = wiki.born;
    if (wiki.origin)        updates.origin          = wiki.origin;
    if (wiki.label)         updates.label           = wiki.label;
    if (wiki.genres.length) updates.genres          = wiki.genres;
    if (wiki.grammy)        updates.grammy          = wiki.grammy;
    if (wiki.aria)          updates.aria            = wiki.aria;
    if (wiki.wikipediaSlug) updates.wikipedia_slug  = wiki.wikipediaSlug;
  }

  // 2. kworb.net
  await sleep(RATE_LIMIT_MS);
  const kworb = await scrapeKworb(artist.name, artist.spotify_id);
  if (kworb.monthlyListeners) updates.spotify_monthly_listeners = kworb.monthlyListeners;
  if (kworb.totalStreams)     updates.total_streams              = kworb.totalStreams;
  if (kworb.spotifyId && !artist.spotify_id) updates.spotify_id = kworb.spotifyId;

  // 3. Instagram (only if handle is set)
  if (artist.instagram) {
    await sleep(RATE_LIMIT_MS);
    const followers = await scrapeInstagram(artist.instagram);
    if (followers) updates.instagram_followers = followers;
  }

  if (Object.keys(updates).length === 0) {
    console.log("  No data found");
    return;
  }

  const { error: updateErr } = await sb
    .from("artists")
    .update(updates)
    .eq("id", artist.id);

  if (updateErr) {
    console.error(`  ✗ DB update failed:`, updateErr.message);
  } else {
    console.log(`  ✅ Updated: ${Object.keys(updates).join(", ")}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: scrape-artist-meta.ts <slug>  OR  --all");
    process.exit(1);
  }

  const sb = getSupabase();

  if (args[0] === "--all") {
    const { data: artists } = await sb.from("artists").select("slug").order("name");
    for (const a of artists ?? []) {
      await processArtist(a.slug);
    }
  } else {
    await processArtist(args[0]);
  }

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
