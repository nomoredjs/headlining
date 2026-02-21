/**
 * Full data pipeline — runs all scrapers in the correct order.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/pipeline.ts dom-dolla
 *   npx tsx --env-file=.env.local scripts/pipeline.ts --all
 *
 * Order (per CLAUDE.md §2.7):
 *  1. scrape-songkick   (primary gigs)
 *  2. scrape-ra-v2      (secondary gigs + co-artists)
 *  3. backfill-geocode  (lat/lng on any new gigs)
 *  4. scrape-artist-meta (hero section data)
 *  5. scrape-releases   (discography)
 *
 * Each step is run as a child process so errors in one scraper
 * don't abort the rest, and stdout/stderr is streamed live.
 */

import { spawn } from "child_process";
import { getSupabase } from "./lib/supabase.js";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Run a script as a child process, stream output live ──────────────────────

function run(script: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const envFile = ".env.local";
    const child = spawn(
      "npx",
      ["tsx", `--env-file=${envFile}`, `scripts/${script}.ts`, ...args],
      { stdio: "inherit", cwd: process.cwd() }
    );
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", (err) => {
      console.error(`  Failed to start ${script}:`, err.message);
      resolve(1);
    });
  });
}

// ── Deduplication: remove exact duplicates (same artist+date+venue) ───────────

async function deduplicateGigs(): Promise<void> {
  const sb = getSupabase();

  // Find duplicate (artist_id, date, venue_name) groups — keep the one with
  // more data (co_artists, billing_position) by preferring ra+songkick source.
  const { data: dupes, error } = await sb.rpc("deduplicate_gigs" as never);

  if (error) {
    // If the RPC doesn't exist yet, fall back to a simple count
    const { count } = await sb
      .from("gigs")
      .select("id", { count: "exact", head: true });
    console.log(`  Gigs in DB: ${count} (dedup RPC not yet available)`);
    return;
  }

  console.log(`  Dedup: removed ${(dupes as number) ?? 0} exact duplicate gig rows`);
}

// ── Summary stats ─────────────────────────────────────────────────────────────

async function printSummary(slug?: string): Promise<void> {
  const sb = getSupabase();

  let query = sb.from("gigs").select("id", { count: "exact", head: true });
  if (slug) {
    const { data: artist } = await sb.from("artists").select("id").eq("slug", slug).single();
    if (artist) query = query.eq("artist_id", artist.id);
  }

  const { count: gigCount }     = await query;
  const { count: geocodedCount } = await sb
    .from("gigs")
    .select("id", { count: "exact", head: true })
    .not("venue_lat", "is", null);
  const { count: releaseCount } = await sb
    .from("releases")
    .select("id", { count: "exact", head: true });

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Pipeline complete${slug ? ` for ${slug}` : " (--all)"}`);
  console.log(`  Gigs:          ${gigCount ?? "?"}`);
  console.log(`  Geocoded gigs: ${geocodedCount ?? "?"}`);
  console.log(`  Releases:      ${releaseCount ?? "?"}`);
  console.log(`${"─".repeat(50)}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: pipeline.ts <slug>  OR  --all");
    process.exit(1);
  }

  const target = args[0]; // "dom-dolla" or "--all"
  const startTime = Date.now();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  headlin.ing — Data Pipeline`);
  console.log(`  Target: ${target}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log(`${"═".repeat(50)}\n`);

  const steps: Array<{ name: string; script: string }> = [
    { name: "1. Songkick gigs (primary)",           script: "scrape-songkick" },
    { name: "2. RA gigs + co-artists (secondary)",  script: "scrape-ra-v2" },
    { name: "3. Geocode backfill",                  script: "backfill-geocode" },
    { name: "4. Artist metadata (Wikipedia/kworb)", script: "scrape-artist-meta" },
    { name: "5. Releases (Wikipedia/Beatport)",     script: "scrape-releases" },
  ];

  for (const step of steps) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`  STEP ${step.name}`);
    console.log(`${"─".repeat(50)}`);

    const code = await run(step.script, [target]);
    if (code !== 0) {
      console.warn(`  ⚠  ${step.script} exited with code ${code} — continuing`);
    }

    // Short pause between scrapers to be polite to external services
    if (target === "--all") await sleep(3000);
  }

  // Dedup (no-op if RPC not set up)
  console.log(`\n${"─".repeat(50)}`);
  console.log("  6. Deduplication");
  await deduplicateGigs();

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  await printSummary(target === "--all" ? undefined : target);
  console.log(`  Total elapsed: ${elapsed}s`);
}

main().catch(err => { console.error(err); process.exit(1); });
