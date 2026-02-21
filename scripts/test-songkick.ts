/**
 * Quick test — scrapes Dom Dolla from Songkick and prints results.
 * No DB required. Just: npx tsx scripts/test-songkick.ts
 */
import * as cheerio from "cheerio";
import { inferGigType } from "./lib/gig-utils.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1. Find Dom Dolla's Songkick page
  console.log("Searching Songkick for Dom Dolla...");
  const searchHtml = await fetchHtml("https://www.songkick.com/search?query=Dom+Dolla&type=artists");
  let $ = cheerio.load(searchHtml);

  const link = $("a[href*='/artists/']").first().attr("href");
  console.log("First artist link:", link);

  if (!link) {
    console.error("No artist link found — Songkick may be blocking scraping");

    // Try direct URL
    console.log("\nTrying direct URL approach...");
    const directHtml = await fetchHtml("https://www.songkick.com/artists/8897861-dom-dolla/gigography?page=1");
    $ = cheerio.load(directHtml);
    const title = $("title").text();
    console.log("Page title:", title);
    return;
  }

  // 2. Fetch page 1 of gigography
  const match = link.match(/\/artists\/(\d+)/);
  if (!match) { console.error("Could not parse artist ID"); return; }

  const artistId = match[1];
  console.log(`\nSongkick ID: ${artistId}`);

  await sleep(2000);

  console.log(`\nFetching gigography page 1...`);
  const gigHtml = await fetchHtml(`https://www.songkick.com/artists/${artistId}/gigography?page=1`);
  $ = cheerio.load(gigHtml);

  // 3. Parse gigs — try different selectors
  console.log("\n--- Parsing page structure ---");
  console.log("event-listings items:", $(".event-listings .event-listing").length);
  console.log("ul.event-listing li:", $("ul.event-listing li").length);
  console.log("li.event:", $("li.event").length);
  console.log(".gigography li:", $(".gigography li").length);
  console.log("article.event-listing:", $("article").filter((_, el) => $(el).attr("class")?.includes("event") || false).length);

  // Find any time elements
  const times = $("time[datetime]").map((_, el) => $(el).attr("datetime")).get();
  console.log(`\ntime[datetime] elements: ${times.length}`);
  if (times.length > 0) console.log("Sample dates:", times.slice(0, 5));

  // Find any elements with date-like classes
  const eventCount = $("[class*='event']").length;
  console.log(`\nElements with 'event' class: ${eventCount}`);

  // Try to find the gigography data via JSON-LD or script tags
  const scripts = $("script[type='application/ld+json']");
  console.log(`\nJSON-LD scripts: ${scripts.length}`);
  if (scripts.length > 0) {
    scripts.each((i, el) => {
      try {
        const data = JSON.parse($(el).html() || "");
        console.log(`JSON-LD[${i}] @type:`, data["@type"]);
        if (data["@type"] === "MusicEvent" || Array.isArray(data)) {
          console.log("Sample:", JSON.stringify(data).slice(0, 300));
        }
      } catch {}
    });
  }

  // Look for NEXT_DATA or similar
  const nextData = $("script#__NEXT_DATA__").html();
  if (nextData) {
    console.log("\n__NEXT_DATA__ found, length:", nextData.length);
  }

  // Try to extract visible event rows
  const rows: string[] = [];
  $("li, tr, article").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const hasDate = /20\d{2}/.test(text);
    if (hasDate && text.length > 20 && text.length < 200) {
      rows.push(text.slice(0, 100));
    }
  });
  console.log(`\nLines with year (20xx): ${rows.length}`);
  console.log("Sample rows:");
  rows.slice(0, 10).forEach(r => console.log(" ", r));

  // Show the actual page HTML structure around events
  console.log("\n--- Main content HTML snippet ---");
  const mainContent = $("main, #main-content, .artist-gigography, .gigography").first().html() || "";
  console.log(mainContent.slice(0, 2000));
}

main().catch(err => { console.error(err); process.exit(1); });
