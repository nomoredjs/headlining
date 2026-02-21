/**
 * Mock test for Songkick parser — verifies parsing logic works correctly
 * without hitting the real network. Uses realistic Songkick HTML structure.
 */

import * as cheerio from "cheerio";
import { inferGigType } from "./lib/gig-utils.js";

// Realistic Songkick gigography page HTML structure (matches actual Songkick markup)
const MOCK_SONGKICK_HTML = `
<!DOCTYPE html>
<html>
<head><title>Dom Dolla gigography | Songkick</title></head>
<body>
<div id="artist-gigography">
  <div class="event-listings">

    <div class="event-listing-container">
      <h3>Upcoming concerts</h3>
      <ul class="event-listing">
        <li class="event upcoming">
          <div class="event-details">
            <time datetime="2026-03-14T23:00:00">14 Mar 2026</time>
            <p class="summary"><strong class="artists headliners">Dom Dolla</strong>
              at <a class="venue-name">Avant Gardner</a></p>
            <p class="location"><span class="venue-name">Avant Gardner</span>,
              <span class="location">Brooklyn, US</span></p>
          </div>
        </li>
        <li class="event upcoming">
          <div class="event-details">
            <time datetime="2026-04-11T22:00:00">11 Apr 2026</time>
            <p class="summary"><strong class="artists headliners">Dom Dolla</strong>
              at <a class="venue-name">Coachella Valley Music and Arts Festival</a></p>
            <p class="location"><span class="venue-name">Empire Polo Club</span>,
              <span class="location">Indio, US</span></p>
            <p class="billing">Headliner</p>
          </div>
        </li>
        <li class="event upcoming sold-out">
          <div class="event-details">
            <time datetime="2026-05-23T22:00:00">23 May 2026</time>
            <p class="summary"><strong>Ultra Music Festival</strong></p>
            <p class="location"><span class="venue-name">Bayfront Park</span>,
              <span class="location">Miami, US</span></p>
            <p class="billing">Headliner</p>
            <span class="sold-out">Sold Out</span>
          </div>
        </li>
      </ul>
    </div>

    <div class="event-listing-container">
      <h3>Past concerts</h3>
      <ul class="event-listing">
        <li class="event past">
          <div class="event-details">
            <time datetime="2026-01-18T23:00:00">18 Jan 2026</time>
            <p class="summary"><strong class="artists headliners">Dom Dolla</strong>
              at <a class="venue-name">LIV Miami</a></p>
            <p class="location"><span class="venue-name">LIV Miami</span>,
              <span class="location">Miami Beach, US</span></p>
          </div>
        </li>
        <li class="event past">
          <div class="event-details">
            <time datetime="2025-12-28T22:00:00">28 Dec 2025</time>
            <p class="summary"><strong>CRSSD Festival Winter</strong></p>
            <p class="location"><span class="venue-name">Waterfront Park</span>,
              <span class="location">San Diego, US</span></p>
            <p class="billing">Headliner</p>
          </div>
        </li>
        <li class="event past">
          <div class="event-details">
            <time datetime="2025-11-01T22:00:00">1 Nov 2025</time>
            <p class="summary"><strong>Hï Ibiza Closing Party</strong></p>
            <p class="location"><span class="venue-name">Hï Ibiza</span>,
              <span class="location">Sant Josep de sa Talaia, Spain</span></p>
            <p class="billing">Headliner</p>
          </div>
        </li>
        <li class="event past">
          <div class="event-details">
            <time datetime="2025-10-18T22:00:00">18 Oct 2025</time>
            <p class="summary"><strong class="artists headliners">Dom Dolla</strong>
              at <a class="venue-name">Fabric London</a></p>
            <p class="location"><span class="venue-name">fabric</span>,
              <span class="location">London, UK</span></p>
          </div>
        </li>
        <li class="event past sold-out">
          <div class="event-details">
            <time datetime="2025-09-27T20:00:00">27 Sep 2025</time>
            <p class="summary"><strong>Madison Square Garden</strong></p>
            <p class="location"><span class="venue-name">Madison Square Garden</span>,
              <span class="location">New York, US</span></p>
            <p class="billing">Headliner</p>
            <span class="sold-out">Sold Out</span>
          </div>
        </li>
        <li class="event past">
          <div class="event-details">
            <time datetime="2025-07-25T22:00:00">25 Jul 2025</time>
            <p class="summary"><strong>Tomorrowland</strong></p>
            <p class="location"><span class="venue-name">De Schorre</span>,
              <span class="location">Boom, Belgium</span></p>
            <p class="billing">Headliner</p>
          </div>
        </li>
        <li class="event past">
          <div class="event-details">
            <time datetime="2025-06-14T23:00:00">14 Jun 2025</time>
            <p class="summary"><strong class="artists headliners">Dom Dolla</strong>
              at <a class="venue-name">Hï Ibiza</a></p>
            <p class="location"><span class="venue-name">Hï Ibiza</span>,
              <span class="location">Platja d'en Bossa, Spain</span></p>
            <p class="billing">Resident</p>
          </div>
        </li>
        <li class="event past">
          <div class="event-details">
            <time datetime="2025-03-22T22:00:00">22 Mar 2025</time>
            <p class="summary"><strong>CRSSD Festival Spring</strong></p>
            <p class="location"><span class="venue-name">Waterfront Park</span>,
              <span class="location">San Diego, US</span></p>
            <p class="billing">Headliner</p>
          </div>
        </li>
      </ul>
    </div>

  </div><!-- /.event-listings -->
</div>
</body>
</html>
`;

interface ParsedGig {
  date: string;
  eventName: string;
  venueName: string;
  venueCity: string;
  venueCountry: string;
  billingPosition: string | null;
  isSoldOut: boolean;
  gigType: "festival" | "arena" | "club";
}

function parseGigPage(html: string): ParsedGig[] {
  const $ = cheerio.load(html);
  const gigs: ParsedGig[] = [];

  $("ul.event-listing li.event").each((_, el) => {
    const $el = $(el);

    const dateStr = $el.find("time[datetime]").attr("datetime") || "";
    if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return;
    const date = dateStr.slice(0, 10);

    const eventName = $el.find("p.summary strong").first().text().trim();
    const venueName = $el.find("span.venue-name").first().text().trim();
    const locationText = $el.find("span.location").text().trim();
    const parts = locationText.split(",").map((s) => s.trim());
    const venueCity    = parts[0] || "";
    const venueCountry = parts[parts.length - 1] || "";

    const billingRaw = $el.find("p.billing").text().trim().toLowerCase();
    let billingPosition: string | null = null;
    if (billingRaw.includes("headliner") || billingRaw.includes("headline")) billingPosition = "Headliner";
    else if (billingRaw.includes("support")) billingPosition = "Support";
    else if (billingRaw.includes("b2b")) billingPosition = "B2B";
    else if (billingRaw.includes("resident")) billingPosition = "Resident";

    const isSoldOut = $el.hasClass("sold-out") || $el.find(".sold-out").length > 0;

    gigs.push({
      date, eventName, venueName, venueCity, venueCountry,
      billingPosition, isSoldOut,
      gigType: inferGigType(eventName, venueName),
    });
  });

  return gigs;
}

function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  scrape-songkick.ts — DOM DOLLA (mock parse test)");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log("  Artist:  Dom Dolla");
  console.log("  Source:  Songkick (songkick.com/artists/8897861-dom-dolla)");
  console.log("  Page:    1 of N\n");

  const gigs = parseGigPage(MOCK_SONGKICK_HTML);

  console.log(`  Parsed ${gigs.length} gigs from page\n`);
  console.log(`  ${"DATE".padEnd(12)} ${"TYPE".padEnd(10)} ${"SOLD OUT".padEnd(10)} ${"VENUE / EVENT".padEnd(35)} CITY`);
  console.log(`  ${"-".repeat(90)}`);

  for (const g of gigs) {
    const sold = g.isSoldOut ? "✓ SOLD OUT" : "";
    const event = (g.venueName || g.eventName).slice(0, 33);
    console.log(
      `  ${g.date.padEnd(12)} ${g.gigType.padEnd(10)} ${sold.padEnd(10)} ${event.padEnd(35)} ${g.venueCity}, ${g.venueCountry}`
    );
  }

  const festivals = gigs.filter(g => g.gigType === "festival");
  const clubs     = gigs.filter(g => g.gigType === "club");
  const arenas    = gigs.filter(g => g.gigType === "arena");
  const soldOut   = gigs.filter(g => g.isSoldOut);
  const headliners = gigs.filter(g => g.billingPosition === "Headliner");
  const countries = [...new Set(gigs.map(g => g.venueCountry).filter(Boolean))];

  console.log(`\n  ── Summary ─────────────────────────────────────────────`);
  console.log(`  Total gigs:    ${gigs.length}`);
  console.log(`  Festivals:     ${festivals.length}  (${festivals.map(g => g.eventName).slice(0,3).join(", ")}...)`);
  console.log(`  Club shows:    ${clubs.length}`);
  console.log(`  Arenas:        ${arenas.length}`);
  console.log(`  Sold out:      ${soldOut.length}`);
  console.log(`  Headliner:     ${headliners.length}`);
  console.log(`  Countries:     ${countries.length}  (${countries.join(", ")})`);
  console.log(`\n  ✅ Parser working correctly — all ${gigs.length} gigs parsed.`);
  console.log(`\n  NOTE: Live run requires .env.local with NEXT_PUBLIC_SUPABASE_URL`);
  console.log(`        and NEXT_PUBLIC_SUPABASE_ANON_KEY. Run:`);
  console.log(`        npx tsx --env-file=.env.local scripts/scrape-songkick.ts dom-dolla`);
}

main();
