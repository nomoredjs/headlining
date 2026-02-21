# CLAUDE.md — headlin.ing MVP Build Instructions

## What You're Building

headlin.ing is "Basketball-Reference for electronic music." Every artist gets a profile page that looks exactly like the prototype in `headlining-dom-dolla.jsx`. The page has: hero section with stats, 6 stat cards, spider chart with compare mode, career trajectory chart, interactive world map, gig history, releases timeline, network graph, and a leaderboard.

**No data is hardcoded in components.** Every variable comes from Supabase, populated by scrapers.

## Reference Files (READ THESE FIRST)
- `headlining-dom-dolla.jsx` — THE design reference. Match this exactly.
- `HEADLINING-CURSOR-HANDOFF.md` — Full product spec, schema, scoring system, 32 seed artists
- `MVP-DATA-BLUEPRINT.md` — Every variable traced to its data source
- `seed-labels.csv` — 500+ labels with owners, genres, locations

## Tech Stack
- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS (dark theme)
- Recharts (spider charts, area charts)
- Supabase (Postgres)
- Vercel (deploy)
- Cheerio (HTML scraping)
- JetBrains Mono + Space Grotesk (Google Fonts)

---

## PHASE 1: Foundation (do this first, in order)

### Step 1.1 — Project Setup
```bash
npx create-next-app@latest headlining --typescript --tailwind --app --src-dir
cd headlining
npm install recharts @supabase/supabase-js cheerio
```

Set up env:
```
NEXT_PUBLIC_SUPABASE_URL=<your supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>
ANTHROPIC_API_KEY=<for AI fallback scraper>
```

### Step 1.2 — Database Schema
Run ALL of these migrations in Supabase SQL Editor. The full schema is in `HEADLINING-CURSOR-HANDOFF.md` section "Core Data Model." Create these tables in this order:

1. `artists` — core artist identity
2. `artist_scores` — 8-axis ratings with computed overall
3. `gigs` — every gig/show/festival appearance
4. `releases` — discography
5. `artist_connections` — network graph
6. `venues` — venue directory with credibility scores
7. `labels` — label directory with credibility scores
8. `label_roster` — which artists are on which labels
9. `crews` — collectives (Solid Grooves, Keinemusik, etc.)
10. `crew_members` — which artists are in which crews

Add these columns if not in the base schema:
```sql
ALTER TABLE artists ADD COLUMN IF NOT EXISTS ra_id TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS songkick_id TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS wikipedia_slug TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS spotify_id TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS grammy TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS aria TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS real_name TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS born TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS total_streams TEXT;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS co_artists TEXT[];
```

Disable RLS on all tables for now (MVP):
```sql
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;
ALTER TABLE artist_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE gigs DISABLE ROW LEVEL SECURITY;
ALTER TABLE releases DISABLE ROW LEVEL SECURITY;
ALTER TABLE venues DISABLE ROW LEVEL SECURITY;
ALTER TABLE labels DISABLE ROW LEVEL SECURITY;
ALTER TABLE label_roster DISABLE ROW LEVEL SECURITY;
ALTER TABLE crews DISABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE artist_connections DISABLE ROW LEVEL SECURITY;
```

### Step 1.3 — Shared Libraries
Create these shared modules FIRST so all scripts and components use the same code:

**`src/lib/supabase.ts`** — Single Supabase client for the app
```typescript
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**`scripts/lib/supabase.ts`** — Supabase client for scripts (reads from process.env directly)
```typescript
import { createClient } from '@supabase/supabase-js';
export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**`scripts/lib/geocode.ts`** — Shared Nominatim geocoder with cache
- Function: `geocodeCity(city: string, country: string): Promise<{lat: number, lng: number} | null>`
- 1 request per second rate limit
- In-memory cache so same city is never geocoded twice in one run

**`scripts/lib/gig-utils.ts`** — Shared gig type inference
- Function: `inferGigType(eventName: string, venueName: string): "festival" | "arena" | "club"`
- Festival keywords: Tomorrowland, Coachella, Ultra, EDC, Dekmantel, Sonar, Movement, Creamfields, CRSSD, ADE, Awakenings, Time Warp, Primavera, Glastonbury, Parklife, Loveland, Sziget, Exit, etc.
- Arena keywords: MSG, Madison Square Garden, O2, Ally Pally, Alexandra Palace, Wembley, Forum, Allstate Arena, Warehouse Project, etc.
- Everything else: "club"

**`scripts/lib/city-normalize.ts`** — City name normalization
- "Platja d'en Bossa", "Sant Josep de sa Talaia", "Eivissa" → "Ibiza"
- "Brooklyn", "Manhattan", "Queens" → "New York"
- "Hollywood", "West Hollywood" → "Los Angeles"
- "Shoreditch", "Hackney", "Brixton" → "London"
- "Kreuzberg", "Friedrichshain" → "Berlin"
- "Wynwood", "South Beach" → "Miami"
- Used by map component and stats computation at display time, raw data stays unchanged

### Step 1.4 — Seed 32 Artists
Build `scripts/seed-artists.ts` that inserts all 32 artists from `HEADLINING-CURSOR-HANDOFF.md` into the `artists` and `artist_scores` tables. Include their manually scored 8-axis ratings and trajectory badges.

Run: `npx tsx --env-file=.env.local scripts/seed-artists.ts`

### Step 1.5 — Seed Labels
Build `scripts/seed-labels.ts` that reads `seed-labels.csv` and inserts into the `labels` table. Map the "Owner" column to `owner_artist_id` where the owner matches an artist in our DB. Assign `label_tier` based on known institutions (Drumcode, Afterlife, Defected, Innervisions, Kompakt, Tresor = "institution").

Run: `npx tsx --env-file=.env.local scripts/seed-labels.ts`

---

## PHASE 2: Scrapers (build these scripts)

Each scraper follows the same pattern: accept an artist slug or `--all` flag, fetch public HTML, parse with cheerio, upsert into Supabase.

**CRITICAL RULES FOR ALL SCRAPERS:**
- NO API keys needed (except RA GraphQL which is public, and Anthropic for AI fallback)
- All sources are PUBLIC HTML pages
- Rate limit: minimum 2 seconds between requests
- Send realistic User-Agent headers
- Cache external IDs (songkick_id, ra_id, etc.) on the artists table so you don't re-resolve them
- Use `source` field on every record to track provenance ("songkick", "ra", "wikipedia", etc.)
- Fail gracefully: if one source fails for an artist, continue with others, log the error

### Step 2.1 — Songkick Gig Scraper (PRIMARY gig source)
**File:** `scripts/scrape-songkick.ts`

This is the most important scraper. Songkick has the most complete gig history for commercial artists.

1. Search `https://www.songkick.com/search?query={artist_name}&type=artists` to find the artist
2. Extract songkick numeric ID from search results URL, cache as `artists.songkick_id`
3. Paginate through ALL pages of `https://www.songkick.com/artists/{id}/gigography?page=N`
4. Parse each event: date, venue name, city, country, event name
5. Infer `gig_type` using shared `inferGigType()` from `scripts/lib/gig-utils.ts`
6. Upsert into `gigs` table with `source = 'songkick'`
7. On conflict (artist_id, date, venue_name): skip duplicates

Run: `npx tsx --env-file=.env.local scripts/scrape-songkick.ts dom-dolla` or `--all`

### Step 2.2 — RA Gig Scraper (SECONDARY — gets co-artists)
**File:** `scripts/scrape-ra-v2.ts`

RA is critical because it has **co-artist lineup data** that Songkick doesn't. This feeds the connectivity score and SA PageRank.

1. Resolve RA numeric artist ID: fetch `https://ra.co/dj/{slug}` HTML, extract ID from `__NEXT_DATA__` JSON blob
2. Cache as `artists.ra_id`
3. Query RA GraphQL at `https://ra.co/graphql`:
   ```graphql
   query GET_DEFAULT_EVENTS_LISTING {
     listing(filter: { areas: {}, artist: { id: RA_ID }, dateRange: { lt: "NOW" } }) {
       data { id, listingDate, event { title, venue { name, area { name, country { name } } }, artists { name } } }
       totalResults
     }
   }
   ```
4. Extract co_artists from `event.artists` (everyone on the lineup except the target artist)
5. Upsert into `gigs` table with `source = 'ra'`
6. If gig already exists from Songkick (same date + same city), MERGE the co_artists data rather than duplicating the gig

Run: `npx tsx --env-file=.env.local scripts/scrape-ra-v2.ts dom-dolla` or `--all`

### Step 2.3 — Concert Archives Scraper (TERTIARY — historical backfill)
**File:** `scripts/scrape-concert-archives.ts`

Catches older gigs that Songkick and RA miss.

1. Fetch `https://www.concertarchives.org/bands/{slug}`
2. Try slug variants: "dom-dolla", "domdolla", "dom+dolla"
3. Parse concert list: date, venue, city, country
4. Upsert into `gigs` with `source = 'concert-archives'`

Run: `npx tsx --env-file=.env.local scripts/scrape-concert-archives.ts dom-dolla` or `--all`

### Step 2.4 — Artist Metadata Scraper
**File:** `scripts/scrape-artist-meta.ts`

Gets everything for the hero section.

1. **Wikipedia** — fetch `https://en.wikipedia.org/wiki/{Artist_Name}`
   - Parse infobox for: real_name (Birth name), born, origin, genres, labels (current labels)
   - Parse Awards section for: Grammy mentions, ARIA mentions, DJ Awards, Juno mentions
   - Parse discography section link for later use
   - Store `wikipedia_slug` on artists table

2. **kworb.net** — fetch `https://kworb.net/spotify/artist/{spotify_id}.html`
   - Extract monthly listeners count
   - Sum individual track streams for total_streams
   - To find spotify_id: either seed manually for the 32 artists, or search kworb.net artist list
   - Store `spotify_id` on artists table

3. **Instagram** — fetch `https://www.instagram.com/{handle}/`
   - Instagram follower count is sometimes in meta tags or page source
   - If blocked, skip — this is the least reliable scrape
   - Alternative: use a public stats service or just seed manually

4. Update `artists` table with: real_name, born, origin, label, genres, grammy, aria, spotify_monthly_listeners, total_streams, instagram_followers

Run: `npx tsx --env-file=.env.local scripts/scrape-artist-meta.ts dom-dolla` or `--all`

### Step 2.5 — Releases Scraper
**File:** `scripts/scrape-releases.ts`

Gets discography for the Releases tab and Releases axis score.

1. **Wikipedia** — fetch the artist's Wikipedia page
   - Find the Discography section or linked discography article
   - Parse tables for: title, year, type (single/EP/album), featured artists, chart positions, certifications
   - Look for awards mentions per release

2. **Beatport** (optional enhancement) — fetch `https://www.beatport.com/artist/{slug}/tracks`
   - Genre tags per track
   - Label per release
   - Chart position if available

3. Upsert into `releases` table with `source = 'wikipedia'` or `'beatport'`

Run: `npx tsx --env-file=.env.local scripts/scrape-releases.ts dom-dolla` or `--all`

### Step 2.6 — Geocode Backfill
**File:** `scripts/backfill-geocode.ts`

After all gig scrapers run, geocode any gigs missing lat/lng.

1. Query: `SELECT DISTINCT venue_city, venue_country FROM gigs WHERE venue_lat IS NULL`
2. For each unique city, call Nominatim geocoder (shared `geocodeCity()`)
3. Update all matching gigs with the lat/lng
4. Rate limit: 1 request per second (Nominatim requirement)

Run: `npx tsx --env-file=.env.local scripts/backfill-geocode.ts`

### Step 2.7 — Unified Pipeline
**File:** `scripts/pipeline.ts`

Runs everything in the right order for one artist or all artists:

```
1. scrape-songkick (primary gigs)
2. scrape-ra-v2 (secondary gigs + co-artists)  
3. scrape-concert-archives (historical backfill)
4. Deduplicate gigs (same artist + same date + same city = same gig, merge metadata)
5. backfill-geocode (fill missing lat/lng)
6. scrape-artist-meta (hero section data)
7. scrape-releases (discography)
8. Log summary: X gigs total, Y new, Z geocoded, etc.
```

Run: `npx tsx --env-file=.env.local scripts/pipeline.ts dom-dolla` or `--all`

---

## PHASE 3: Frontend (build these pages)

Match the design in `headlining-dom-dolla.jsx` EXACTLY. Dark theme, JetBrains Mono + Space Grotesk, color tokens from `HEADLINING-CURSOR-HANDOFF.md`.

### Step 3.1 — Layout & Fonts
**File:** `src/app/layout.tsx`

- Import JetBrains Mono + Space Grotesk from Google Fonts
- Dark background (#0A0A0A)
- Global nav header: `headlin` (orange) `.ing` (white) + search + compare + leaderboards links
- Sticky header with blur backdrop

### Step 3.2 — Leaderboard (Homepage)
**File:** `src/app/page.tsx`

Fetch all artists + their latest scores from Supabase. Display as a ranked table.

Each row shows: rank, artist name, origin, tier badge, trajectory badge, overall score, mini stat bars for all 8 axes, DJ Mag position, editorial note.

Include the disclaimer banner at top (yellow): "A higher overall rating does not mean a better DJ..."

Sort by overall score descending. Highlight rows on hover. Click row → navigate to `/artist/{slug}`.

Reference: lines 228-268 and 1386-1598 of prototype.

### Step 3.3 — Artist Profile Page
**File:** `src/app/artist/[slug]/page.tsx` (server component, fetches data)
**File:** `src/app/artist/[slug]/ArtistProfile.tsx` (client component, renders UI)

This is the core of the product. It has 5 tabs: Overview, Gigs, Releases, Network, Leaderboard.

**Data fetching (server component):**
```typescript
// Fetch from Supabase:
// 1. Artist identity + scores
// 2. All gigs for this artist
// 3. All releases for this artist
// 4. Leaderboard data (all artists + scores for the leaderboard tab + compare mode)
```

#### Overview Tab
1. **6 Stat Cards** — ALL computed from gigs table queries (see MVP-DATA-BLUEPRINT.md section 2)
   - Current year gigs (accent), career gigs, festivals this year, countries this year, sold out, residency detection
   - Each card has a sublabel computed from the data

2. **Spider/Radar Chart** with Compare Mode
   - 8 axes from artist_scores table
   - Dropdown to select compare artist — overlays second radar with different color
   - When comparing: show side-by-side stat bars with +/- differential
   - When not comparing: show rating breakdown bars (overall score circle + 8 horizontal bars)
   - Reference: lines 1016-1153 of prototype

3. **Career Trajectory Chart**
   - AreaChart with billing score (orange gradient) + LineChart with gig count (blue dashed)
   - Billing score per year = (headliner gigs / total gigs) * 100
   - Gig count per year = COUNT(*)
   - Both computed from gigs table grouped by year
   - Reference: lines 1155-1182 of prototype

4. **Global Footprint Map**
   - Fetch TopoJSON from `cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`
   - Decode arcs inline (no D3 dependency needed — copy approach from prototype lines 547-781)
   - Plot dots at each city, sized by gig count
   - Dot colors: purple = residency (3+ gigs same venue), yellow = arena/stadium, orange = default
   - Hover tooltip: city name, country, count badge, venue list with dates and billing
   - Apply city normalization before grouping
   - Reference: lines 547-781 of prototype

5. **Most Played Cities**
   - Top 5 cities by gig count with progress bars
   - Query: `SELECT venue_city, COUNT(*) GROUP BY venue_city ORDER BY count DESC LIMIT 5`
   - Apply city normalization
   - Reference: lines 1193-1209 of prototype

#### Gigs Tab
- Year filter buttons (ALL, 2025, 2026, etc. — dynamic based on what years have data)
- Group by year with section headers: "2025 (55 shows)" in orange, "2026 Announced (7 shows)" in green
- Grid: date | venue | city, country | type badge (color-coded) | billing badge (color-coded)
- Past gigs at 70% opacity, future dates in green
- Reference: lines 1213-1305 of prototype

#### Releases Tab
- Discography timeline from releases table
- Grid: year | "title" | featured artists | notes/awards
- Recent years get accent left border, older get gray
- Awards/chart positions in yellow
- Summary bar at bottom: total releases, chart #1s, award count, label names
- Reference: lines 1308-1339 of prototype

#### Network Tab
- Top co-artists: frequency bars from co_artists array in gigs table
  - Query: unnest co_artists, count per artist, order desc limit 10
- Notable B2Bs & Collabs: auto-detect from releases (featured_artists) + gigs (B2B in event name)
  - Display as 2-column card grid
- Residency partners: co-artists at venues where artist has 3+ gigs
- Reference: lines 1342-1383 of prototype

#### Leaderboard Tab (embedded)
- Same as homepage leaderboard but with current artist's row highlighted
- Reference: lines 1386-1598 of prototype

### Step 3.4 — Artist Hero Section
The top of every artist profile page. Reference: lines 866-961 of prototype.

- Avatar placeholder (initials with gradient)
- Overall rating badge (positioned over avatar, circular with tier color border)
- Artist name + TOURING badge (if `is_touring`) + trajectory badge
- Bio line: `{real_name} · {origin} · b. {born}`
- Genre tags as pills
- Stats line: `IG {instagram_followers}` · `Spotify {spotify_monthly_listeners} monthly` · `Streams {total_streams}` · awards
- **ONLY show stats that have data** — hide any null field, never show "0 followers"

---

## PHASE 4: Score Computation

### Step 4.1 — Lookup Tables
Create and seed these two tables for score computation:

**`venue_credibility`** — ~200 venues with scores 0-100
```sql
CREATE TABLE venue_credibility (
  venue_name TEXT PRIMARY KEY,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  city TEXT,
  country TEXT
);
```
Seed with known venues: Berghain 98, fabric 96, DC10 95, Panorama Bar 94, Hï Ibiza 90, Club Space 87, LIV 60, etc. Default for unknown venues: 50.

**`festival_credibility`** — ~100 festivals with scores 0-100
```sql
CREATE TABLE festival_credibility (
  festival_name TEXT PRIMARY KEY,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  country TEXT
);
```
Seed: Tomorrowland 95, Dekmantel 94, Sonar 93, Movement 93, Coachella 92, Time Warp 92, Ultra 88, EDC 85, etc. Default for unknown: 60.

### Step 4.2 — Auto Score Computation
**File:** `scripts/compute-scores.ts`

For each artist, compute all 8 axis scores from their data:

**Festival** = f(festival_gig_count, avg_festival_credibility, headliner_pct_at_festivals, yoy_festival_growth)
**Club** = f(club_gig_count, avg_venue_credibility, residency_bonus, club_diversity)
**Social** = f(instagram_followers, spotify_monthly_listeners) — scaled to benchmarks in MVP-DATA-BLUEPRINT.md
**Streaming** = f(spotify_monthly_listeners, total_streams, listener_to_follower_ratio)
**Releases** = f(total_releases, releases_per_year_recent, chart_positions_count, label_diversity)
**Geographic** = f(unique_countries, unique_continents, geographic_entropy, non_home_region_pct)
**Connectivity** = f(unique_co_artists, collab_count, b2b_count, co_artist_quality_avg)
**Scene Authority** = MANUAL for now (from seed data). Future: PageRank from co-artist graph + label network + venue credibility avg + longevity.

Apply the floor system: if top 3 axes average ≥ 90, overall can't drop below 82.

Upsert into `artist_scores` table with `scored_at = now()`. Keep historical scores for trajectory computation.

Run: `npx tsx --env-file=.env.local scripts/compute-scores.ts --all`

---

## PHASE 5: Automation & Polish

### Step 5.1 — Weekly Cron
**File:** `src/app/api/cron/refresh-data/route.ts`

```typescript
// Vercel cron: runs every Monday at 3am UTC
// vercel.json: { "crons": [{ "path": "/api/cron/refresh-data", "schedule": "0 3 * * 1" }] }
// 1. Run pipeline for all artists
// 2. Recompute scores
// 3. Log results
```

### Step 5.2 — Deploy
```bash
vercel --prod
# Add env vars in Vercel dashboard
# Point headlin.ing DNS A record to Vercel
```

### Step 5.3 — Polish
- Search functionality (filter leaderboard by name, genre, tier)
- Compare page at `/compare` (side-by-side spider charts)
- SEO: meta tags, og:image generation for social sharing
- Error states: loading skeletons, empty states for artists with no data
- Mobile responsive (the prototype is desktop-first, make it work on mobile)

---

## EXECUTION ORDER SUMMARY

```
1. Setup project + database + shared libs          (1 hour)
2. Seed 32 artists + labels                         (30 min)
3. Build Songkick scraper + test on Dom Dolla       (2 hours)
4. Build RA scraper + test                          (2 hours)
5. Build artist-meta scraper + test                 (2 hours)
6. Build releases scraper + test                    (2 hours)
7. Build pipeline + geocode backfill                (1 hour)
8. Run pipeline for all 32 artists                  (wait ~1 hour for scraping)
9. Build leaderboard homepage                       (3 hours)
10. Build artist profile page (all 5 tabs)          (6 hours)
11. Build score computation script                   (2 hours)
12. Seed venue + festival credibility tables         (1 hour manual)
13. Deploy to Vercel                                 (30 min)
14. Polish + mobile + search                         (4 hours)
```

**Total: ~27 hours of build time → working MVP**

---

## WHAT SUCCESS LOOKS LIKE

When done, you should be able to:

1. Visit `headlin.ing` → see 32 artists ranked with scores, tiers, trajectory badges
2. Click any artist → full profile with real scraped data
3. Run `npx tsx --env-file=.env.local scripts/pipeline.ts --all` → all data refreshes
4. Add a new artist to the DB → run pipeline → they appear on the leaderboard with auto-computed scores
5. Every stat card, chart, map dot, and score is derived from data — zero hardcoded artist info in components
