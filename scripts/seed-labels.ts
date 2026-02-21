/**
 * Seed labels from seed-labels.csv into the labels table.
 * Maps "Owner" column to owner_artist_id where the owner matches an artist in DB.
 * Run: npx tsx --env-file=.env.local scripts/seed-labels.ts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getSupabase } from "./lib/supabase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Known institution-tier labels
const INSTITUTION_LABELS = new Set([
  "Drumcode", "Afterlife", "Defected", "Innervisions", "Kompakt", "Tresor",
  "Warp Records", "XL Recordings", "Hospital Records", "Toolroom",
  "Diynamic", "Hot Creations", "Cocoon", "Hypercolour", "Rekids",
  "Mute Records", "fabric records",
]);

const RESPECTED_LABELS = new Set([
  "Solid Grooves", "KNTXT", "LENSKE", "Hekate", "Gudu",
  "Cuttin Headz", "Hot Trax", "Relief Records", "Knee Deep In Sound",
  "Crosstown Rebels", "Relief", "Bedrock Records", "Poker Flat",
]);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function assignTier(name: string): string {
  if (INSTITUTION_LABELS.has(name)) return "institution";
  if (RESPECTED_LABELS.has(name)) return "respected";
  return "emerging";
}

interface CsvRow {
  name: string;
  owner: string;
  genre: string;
  basedIn: string;
  infoUrl: string;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split("\n");
  const rows: CsvRow[] = [];

  for (const line of lines) {
    const cols = line.split(",");
    // CSV format: ,Label Name,Owner,Genre,Based in,Info URL
    // Skip empty rows, headers, and separator rows
    const name = cols[1]?.trim();
    if (!name || name === "Record Label" || name === "Record Labels" || name.length === 0) continue;

    rows.push({
      name,
      owner: cols[2]?.trim() ?? "",
      genre: cols[3]?.trim() ?? "",
      basedIn: cols[4]?.trim() ?? "",
      infoUrl: cols[5]?.trim() ?? "",
    });
  }

  return rows;
}

async function main() {
  const sb = getSupabase();
  const csvPath = join(__dirname, "..", "seed-labels.csv");
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(content);

  console.log(`Parsed ${rows.length} labels from CSV`);

  // Load all existing artists for owner_artist_id lookup
  const { data: artists } = await sb
    .from("artists")
    .select("id, name, slug");

  const artistByName = new Map<string, string>();
  for (const a of artists ?? []) {
    artistByName.set(a.name.toLowerCase(), a.id);
    artistByName.set(a.slug.toLowerCase(), a.id);
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const slug = slugify(row.name);
    const ownerKey = row.owner.toLowerCase();
    const ownerArtistId = artistByName.get(ownerKey) ?? null;

    const { error } = await sb.from("labels").upsert(
      {
        name: row.name,
        slug,
        owner_artist_id: ownerArtistId,
        label_tier: assignTier(row.name),
        genres: row.genre ? [row.genre] : [],
        based_in: row.basedIn || null,
        info_url: row.infoUrl || null,
      },
      { onConflict: "slug" }
    );

    if (error) {
      console.error(`✗ ${row.name}: ${error.message}`);
      skipped++;
    } else {
      if (ownerArtistId) {
        process.stdout.write(`✓ ${row.name} (owner: ${row.owner})\n`);
      }
      inserted++;
    }
  }

  console.log(`\n✅ Done — ${inserted} labels seeded, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
