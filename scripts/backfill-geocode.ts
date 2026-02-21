/**
 * Geocode backfill — fills venue_lat/venue_lng on gigs missing coordinates.
 *
 * Uses Nominatim (OpenStreetMap). Rate limit: 1 req/sec.
 * Geocodes each unique (city, country) pair once, then batch-updates all gigs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-geocode.ts
 *   npx tsx --env-file=.env.local scripts/backfill-geocode.ts dom-dolla
 */

import { getSupabase } from "./lib/supabase.js";
import { geocodeCity } from "./lib/geocode.js";

async function main() {
  const sb = getSupabase();
  const args = process.argv.slice(2);

  // Build the base query for gigs missing coordinates
  let query = sb
    .from("gigs")
    .select("id, venue_city, venue_country")
    .is("venue_lat", null)
    .not("venue_city", "is", null);

  // Optionally scope to one artist
  if (args[0] && args[0] !== "--all") {
    const { data: artist } = await sb
      .from("artists")
      .select("id")
      .eq("slug", args[0])
      .single();
    if (artist) query = query.eq("artist_id", artist.id);
  }

  const { data: gigs, error } = await query;
  if (error) { console.error("DB error:", error.message); process.exit(1); }
  if (!gigs?.length) { console.log("No gigs need geocoding."); return; }

  // Collect unique city+country pairs
  const pairs = new Map<string, { city: string; country: string }>();
  for (const g of gigs) {
    if (g.venue_city) {
      const key = `${g.venue_city}||${g.venue_country ?? ""}`;
      pairs.set(key, { city: g.venue_city, country: g.venue_country ?? "" });
    }
  }

  console.log(`Geocoding ${pairs.size} unique city/country pairs (1 req/sec)…\n`);

  const coordCache = new Map<string, { lat: number; lng: number } | null>();
  let geocoded = 0;
  let failed   = 0;

  for (const [key, { city, country }] of pairs) {
    const result = await geocodeCity(city, country);
    coordCache.set(key, result);
    if (result) {
      geocoded++;
      console.log(`  ✓ ${city}, ${country} → (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)})`);
    } else {
      failed++;
      console.log(`  ✗ ${city}, ${country} — not found`);
    }
  }

  console.log(`\nGeocoded ${geocoded}/${pairs.size} cities. Updating gigs…`);

  // Batch-update gigs by city
  let updated = 0;
  for (const [key, coords] of coordCache) {
    if (!coords) continue;
    const { city, country } = pairs.get(key)!;

    const { count } = await sb
      .from("gigs")
      .update({ venue_lat: coords.lat, venue_lng: coords.lng })
      .is("venue_lat", null)
      .eq("venue_city", city)
      .eq("venue_country", country)
      .select("id", { count: "exact", head: true });

    updated += count ?? 0;
  }

  console.log(`\n✅ Updated ${updated} gig rows with coordinates.`);
  console.log(`   ${failed} cities could not be geocoded.`);
}

main().catch(err => { console.error(err); process.exit(1); });
