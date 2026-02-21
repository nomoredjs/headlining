/**
 * Seed the 32 artists into Supabase / PostgreSQL.
 * Run: npx tsx --env-file=.env.local scripts/seed-artists.ts
 *
 * Scores sourced from HEADLINING-CURSOR-HANDOFF.md
 * Row format: [name, origin, genres[], djmag2025, fest, club, soc, str, rel, geo, con, sa]
 */

import { getSupabase } from "./lib/supabase.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function computeOverall(
  festival: number, club: number, social: number, streaming: number,
  releases: number, geographic: number, connectivity: number, sa: number
): number {
  const raw = Math.round(
    festival     * 0.16 +
    club         * 0.14 +
    streaming    * 0.14 +
    geographic   * 0.12 +
    connectivity * 0.10 +
    social       * 0.10 +
    releases     * 0.07 +
    sa           * 0.17
  );

  const sorted = [festival, club, social, streaming, releases, geographic, connectivity, sa]
    .sort((a, b) => b - a);
  const top3avg = (sorted[0] + sorted[1] + sorted[2]) / 3;

  if (top3avg >= 90 && raw < 82) return 82;
  if (top3avg >= 85 && raw < 78) return 78;
  return raw;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────
// [name, origin, genres, djmag2025|null, fest, club, soc, str, rel, geo, con, sa, trajectory]

type ArtistRow = [
  name: string,
  origin: string,
  genres: string[],
  djmag: number | null,
  fest: number, club: number, soc: number, str: number,
  rel: number,  geo: number,  con: number, sa: number,
  trajectory: string,
];

const ARTISTS: ArtistRow[] = [
  ["Carl Cox",            "UK",           ["Techno", "House"],                          25,   92, 96, 78, 62, 88, 95, 90, 98, "LEGACY"],
  ["Charlotte de Witte",  "Belgium",       ["Techno", "Acid"],                           9,   96, 92, 88, 78, 82, 94, 88, 92, "RISING"],
  ["Eric Prydz",          "Sweden",        ["Progressive House", "Techno"],              37,   88, 85, 72, 75, 78, 86, 82, 95, "LEGACY"],
  ["Fisher",              "Australia",     ["House", "Tech House"],                       7,   96, 82, 90, 92, 68, 92, 85, 68, "STEADY"],
  ["Fred again..",        "UK",            ["House", "Electronica", "UK Garage"],        33,   94, 78, 92, 95, 85, 90, 82, 80, "RISING"],
  ["Peggy Gou",           "South Korea",   ["House", "Disco", "Techno"],                12,   92, 88, 94, 82, 72, 92, 85, 86, "STEADY"],
  ["Tale of Us",          "Italy",         ["Melodic Techno", "Indie Dance"],          null,   94, 90, 85, 80, 85, 92, 90, 94, "STEADY"],
  ["Adam Beyer",          "Sweden",        ["Techno"],                                 null,   90, 94, 68, 58, 90, 92, 92, 96, "LEGACY"],
  ["Dom Dolla",           "Australia",     ["House", "Tech House"],                     41,   96, 93, 87, 88, 72, 91, 87, 80, "RISING"],
  ["Amelie Lens",         "Belgium",       ["Techno", "Hard Techno"],                   38,   92, 92, 82, 72, 78, 90, 86, 88, "STEADY"],
  ["John Summit",         "USA",           ["Tech House", "House", "Dance Pop"],        46,   94, 80, 93, 92, 75, 88, 85, 62, "SURGING"],
  ["Keinemusik",          "Germany",       ["House", "Afro House", "Deep House"],       20,   90, 92, 82, 78, 80, 88, 88, 92, "STEADY"],
  ["Jamie Jones",         "UK",            ["Tech House", "House"],                     27,   88, 94, 75, 65, 80, 90, 90, 92, "LEGACY"],
  ["Solomun",             "Germany",       ["Melodic House", "Indie Dance"],            55,   85, 94, 72, 72, 82, 88, 82, 96, "LEGACY"],
  ["Black Coffee",        "South Africa",  ["Afro House", "Deep House"],                17,   88, 90, 80, 78, 82, 88, 85, 92, "STEADY"],
  ["Boris Brejcha",       "Germany",       ["High-Tech Minimal", "Melodic Techno"],     49,   90, 85, 80, 78, 82, 88, 78, 82, "STEADY"],
  ["The Martinez Brothers","USA",          ["House", "Tech House"],                     43,   88, 95, 78, 62, 75, 88, 92, 94, "LEGACY"],
  ["Sara Landry",         "USA",           ["Hard Techno", "Rave"],                     62,   91, 72, 86, 88, 70, 84, 78, 68, "SURGING"],
  ["Michael Bibi",        "UK",            ["Tech House", "Minimal"],                   48,   78, 95, 75, 65, 80, 82, 85, 90, "STEADY"],
  ["Indira Paganotto",    "Spain",         ["Techno", "Rave"],                          36,   90, 82, 78, 68, 72, 86, 80, 76, "STEADY"],
  ["Chris Lake",          "UK",            ["House", "Tech House"],                     95,   85, 88, 78, 82, 78, 82, 85, 82, "RISING"],
  ["Mau P",               "Sweden",        ["Tech House", "Big Room House"],            77,   88, 74, 72, 88, 62, 80, 82, 64, "SURGING"],
  ["Mochakk",             "Brazil",        ["House", "Jackin House", "Disco"],          56,   82, 85, 72, 70, 68, 78, 78, 72, "SURGING"],
  ["Honey Dijon",         "USA",           ["House", "Disco"],                          97,   85, 90, 78, 60, 72, 84, 85, 92, "STEADY"],
  ["PAWSA",               "UK",            ["Tech House", "House"],                     69,   84, 94, 68, 58, 75, 83, 85, 93, "LEGACY"],
  ["VTSS",                "Poland",        ["Hard Techno", "Industrial"],              null,   72, 92, 62, 52, 78, 74, 80, 93, "SURGING"],
  ["Seth Troxler",        "USA",           ["House", "Techno", "Disco"],               null,   85, 92, 72, 55, 75, 88, 92, 94, "LEGACY"],
  ["Reinier Zonneveld",   "Netherlands",   ["Techno", "Acid", "Live"],                  22,   88, 86, 72, 65, 82, 84, 80, 82, "STEADY"],
  ["Deborah De Luca",     "Italy",         ["Techno", "Hard Techno"],                   60,   85, 85, 78, 68, 70, 82, 76, 74, "RISING"],
  ["I Hate Models",       "France",        ["Hard Techno", "Industrial", "Rave"],       79,   78, 90, 60, 55, 80, 78, 78, 92, "STEADY"],
  ["Nico Moreno",         "France",        ["Hard Techno", "Industrial"],               67,   80, 82, 65, 60, 68, 76, 74, 78, "RISING"],
  ["Patrick Topping",     "UK",            ["Tech House", "House"],                    null,   85, 92, 72, 68, 75, 84, 88, 86, "STEADY"],
  ["Bonobo",              "UK",            ["Electronica", "Downtempo", "House"],      null,   82, 78, 72, 80, 88, 85, 72, 88, "LEGACY"],
  ["Dixon",               "Germany",       ["Deep House", "Melodic House"],            null,   84, 92, 62, 55, 75, 85, 85, 96, "LEGACY"],
  ["Ricardo Villalobos",  "Chile/Germany", ["Minimal Techno", "Microhouse"],           null,   70, 95, 45, 35, 80, 78, 82, 98, "LEGACY"],
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const sb = getSupabase();
  let inserted = 0;
  let skipped = 0;

  for (const [
    name, origin, genres, djmag,
    fest, club, soc, str, rel, geo, con, sa, trajectory,
  ] of ARTISTS) {
    const slug = slugify(name);
    const overall = computeOverall(fest, club, soc, str, rel, geo, con, sa);

    // Upsert artist
    const { data: artist, error: artistErr } = await sb
      .from("artists")
      .upsert(
        {
          slug,
          name,
          origin,
          genres,
          djmag_2025_position: djmag,
          is_touring: true,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (artistErr) {
      console.error(`✗ Artist upsert failed for ${name}:`, artistErr.message);
      skipped++;
      continue;
    }

    // Upsert score (use current timestamp bucketed to day to avoid duplicates)
    const scoredAt = new Date().toISOString().split("T")[0] + "T00:00:00Z";
    const { error: scoreErr } = await sb.from("artist_scores").upsert(
      {
        artist_id: artist.id,
        scored_at: scoredAt,
        festival: fest,
        club,
        social: soc,
        streaming: str,
        releases: rel,
        geographic: geo,
        connectivity: con,
        scene_authority: sa,
        overall,
        note: `${trajectory} — seed data from HEADLINING-CURSOR-HANDOFF.md (Feb 2026)`,
      },
      { onConflict: "artist_id,scored_at" }
    );

    if (scoreErr) {
      console.error(`✗ Score upsert failed for ${name}:`, scoreErr.message);
      skipped++;
      continue;
    }

    console.log(`✓ ${name.padEnd(28)} OVR:${overall}  ${trajectory}`);
    inserted++;
  }

  console.log(`\n✅ Done — ${inserted} artists seeded, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
