# headlin.ing — MVP Data Blueprint

## The Goal
Every artist page should look exactly like the Dom Dolla prototype (`headlining-dom-dolla.jsx`). No hardcoded data. Every variable traced to a source, every source traced to a scraper or computation.

---

## EVERY VARIABLE IN THE PROTOTYPE → WHERE IT COMES FROM

### 1. ARTIST IDENTITY (Hero Section)

| Variable | Example (Dom Dolla) | Source | How to Get It |
|----------|-------------------|--------|--------------|
| `name` | "Dom Dolla" | Seed data | Manual — you define who's in the system |
| `realName` | "Dominic Matheson" | Wikipedia | Scrape infobox field "Born" or "Birth name" |
| `origin` | "Melbourne, Australia" | Wikipedia | Scrape infobox field "Origin" |
| `born` | "January 18, 1992" | Wikipedia | Scrape infobox field "Born" |
| `label` | "Three Six Zero / Sony" | Wikipedia | Scrape infobox field "Labels" |
| `genres` | ["House", "Tech House", "Deep Groove House"] | Wikipedia + Beatport | Wikipedia infobox "Genres" field, cross-ref with Beatport artist page genre tags |
| `instagram` | "1M" | Instagram public page | Scrape `<meta>` tags from `instagram.com/{handle}` — follower count is in og:description. Or use a free stats service. |
| `spotify` | "6.8M monthly" | kworb.net | Scrape `kworb.net/spotify/artist/{spotify_id}.html` — lists monthly listeners publicly. No API needed. |
| `totalStreams` | "1.5B+" | kworb.net | Same page has total stream counts per track — sum them. |
| `grammy` | "1 nomination" | Wikipedia | Scrape Awards section — search for "Grammy" mentions |
| `aria` | "4 wins (24 nominations)" | Wikipedia | Scrape Awards section — search for "ARIA" mentions |

**Scraper: `scripts/scrape-artist-meta.ts`**
- Input: artist slug
- Fetches Wikipedia page → parses infobox + awards section
- Fetches kworb.net → parses monthly listeners + streams
- Fetches Instagram meta tags → parses follower count
- Stores all fields on `artists` table
- Run: `npx tsx --env-file=.env.local scripts/scrape-artist-meta.ts --all`

---

### 2. STAT CARDS (Overview Tab — 6 cards)

| Card | Example | Source | Computation |
|------|---------|--------|-------------|
| **2025 Gigs** | 55 | `gigs` table | `COUNT(*) FROM gigs WHERE artist_id = ? AND YEAR(date) = 2025` |
| sublabel "across 12 countries" | | `gigs` table | `COUNT(DISTINCT venue_country) WHERE YEAR = 2025` |
| **Career Gigs** | 565+ | `gigs` table | `COUNT(*) FROM gigs WHERE artist_id = ?` |
| sublabel "since 2015" | | `gigs` table | `MIN(YEAR(date))` |
| **Festivals '25** | 18 | `gigs` table | `COUNT(*) WHERE gig_type = 'festival' AND YEAR = 2025` |
| sublabel "inc. Ultra, Portola, CRSSD" | | `gigs` table | Top 3 `event_name WHERE gig_type = 'festival' AND YEAR = 2025` |
| **Countries '25** | 12 | `gigs` table | `COUNT(DISTINCT venue_country) WHERE YEAR = 2025` |
| sublabel "5 continents" | | `gigs` table | Map countries → continents (simple lookup), count distinct |
| **Sold Out** | 8 | `gigs` table | `COUNT(*) WHERE is_sold_out = true` |
| sublabel "inc. 2x MSG" | | `gigs` table | Find most notable sold-out venue name + count |
| **Ibiza Residency** | 10 wks | `gigs` table | Auto-detect: `GROUP BY venue_name WHERE city ILIKE 'ibiza' HAVING COUNT >= 3` |
| sublabel "Hï Ibiza w/ Patrick Topping" | | `gigs` table | Venue name + most frequent co_artist at that venue |

**ALL stat cards are computed from the `gigs` table. No separate data needed.**

**Where do gigs come from?**

| Source | What it catches | Priority |
|--------|----------------|----------|
| **Songkick HTML** (`songkick.com/artists/{id}/gigography`) | Most complete gig history. Past + upcoming. Structured HTML. | PRIMARY |
| **RA GraphQL** (`ra.co/graphql`) | European clubs, Ibiza, underground events. Has co-artist lineups. | SECONDARY |
| **Concert Archives** (`concertarchives.org/bands/{slug}`) | Historical gigs RA/Songkick miss. Older career data. | TERTIARY |

**Scraper: `scripts/scrape-songkick.ts`** (already built, working)
**Scraper: `scripts/scrape-ra-v2.ts`** (already built, working)
**Scraper: `scripts/scrape-concert-archives.ts`** (to build — Prompt 2 in pipeline doc)

---

### 3. SPIDER CHART (8 axes)

Each axis is scored 0-100. Here's exactly how each one computes:

#### Festival Score (weight: 16%)
| Input | Source | Computation |
|-------|--------|-------------|
| Festival gig count | `gigs` table | `COUNT(*) WHERE gig_type = 'festival'` |
| Festival credibility | Festival lookup table | Each festival gets a tier score (Tomorrowland=95, Dekmantel=93, Coachella=92, random fest=50). Average the credibility of festivals played. |
| Billing position at festivals | `gigs.billing_position` | % of festival gigs where billing = 'headliner' |
| Year-over-year festival growth | `gigs` table | Compare festival count this year vs last year |

**Data needed:** gigs table (already have) + festival credibility lookup table (build once, ~100 festivals)

#### Club Score (weight: 14%)
| Input | Source | Computation |
|-------|--------|-------------|
| Club gig count | `gigs` table | `COUNT(*) WHERE gig_type = 'club'` |
| Venue credibility | Venue lookup table | Each venue gets a score (Berghain=98, fabric=96, DC10=95, Hï Ibiza=90, generic club=40). Average. |
| Residency detection | `gigs` table | 3+ gigs at same venue in same year = residency bonus |
| Club diversity | `gigs` table | `COUNT(DISTINCT venue_name) WHERE gig_type = 'club'` |

**Data needed:** gigs table + venue credibility lookup table (build once, ~200 venues)

#### Social Score (weight: 10%)
| Input | Source | Computation |
|-------|--------|-------------|
| Instagram followers | Instagram meta tags | Scrape from public page |
| Spotify monthly listeners | kworb.net | Scrape public page |
| YouTube/Boiler Room presence | YouTube search | Count of official set videos + total views |

**Benchmarks for scoring:**
- 95+: 3M+ IG, 15M+ Spotify (Calvin Harris, Skrillex)
- 85-89: 800K+ IG, 5M+ Spotify (Dom Dolla, Fisher)
- 70-79: 100K+ IG, 500K+ Spotify
- <60: <50K IG, <200K Spotify

**Scraper: `scripts/scrape-artist-meta.ts`** (same one that gets hero data)

#### Streaming Score (weight: 14%)
| Input | Source | Computation |
|-------|--------|-------------|
| Spotify monthly listeners | kworb.net | Raw number, scaled to 0-100 curve |
| Total streams | kworb.net | Sum of all track streams |
| Listener-to-follower ratio | kworb.net | High ratio = playlist-driven (less sticky). Low ratio = dedicated fanbase. |

**Same scraper as Social — `scrape-artist-meta.ts`**

#### Releases Score (weight: 7%)
| Input | Source | Computation |
|-------|--------|-------------|
| Total releases | Wikipedia discography / Beatport | Count singles, EPs, albums |
| Release frequency | Wikipedia | Releases per year (last 3 years) |
| Chart positions | Wikipedia / Beatport | Count of charting releases |
| Label diversity | Wikipedia / Beatport | How many different labels released on |

**Scraper: `scripts/scrape-releases.ts`** (fetches Wikipedia discography table + Beatport tracks page)

#### Geographic Spread Score (weight: 12%)
| Input | Source | Computation |
|-------|--------|-------------|
| Unique countries | `gigs` table | `COUNT(DISTINCT venue_country)` |
| Unique continents | `gigs` table | Map countries → continents, count |
| Geographic entropy | `gigs` table | Shannon entropy of country distribution — evenly spread > concentrated |
| Non-home-region presence | `gigs` table | % of gigs outside home continent |

**ALL from gigs table. No extra scraping needed.**

#### Connectivity Score (weight: 10%)
| Input | Source | Computation |
|-------|--------|-------------|
| Unique co-artists | `gigs.co_artists` | `COUNT(DISTINCT unnest(co_artists))` — from RA scraper |
| Featured collaborators | `releases` table | Count of featured_artists on releases |
| B2B count | `gigs` table | Count gigs where event_name contains "B2B" |
| Co-artist quality | `gigs.co_artists` + `artists` table | Average overall score of co-artists who are also in our DB |

**From gigs table (co_artists field from RA scraper) + releases table**

#### Scene Authority (weight: 17% — HIGHEST)
| Input | Weight | Source | Computation |
|-------|--------|--------|-------------|
| Lineup adjacency PageRank | 30% | `gigs.co_artists` | Who you're booked alongside. Higher SA co-artists = more SA for you. Iterative PageRank computation. |
| Label network score | 25% | `labels` + `label_roster` tables | Credibility of labels you've released on + credibility of other artists on those labels. Owning a label = bonus. |
| B2B partner quality | 20% | `gigs` table | Average SA of artists you've done B2Bs with |
| Editorial signals | 10% | Manual / scrape | Boiler Room appearance, RA feature, Essential Mix, DJ Mag ranking |
| Longevity factor | 10% | `gigs` table | Years since first gig in DB. 15+ years = max. |
| Venue credibility average | 5% | `gigs` + venue lookup | Weighted average of venue scores |

**IMPORTANT: SA is the only axis that's partially recursive (PageRank). For MVP, seed initial SA scores manually for the 32 artists, then compute automatically once the graph has enough data (100+ artists with co-artist data).**

---

### 4. CAREER TRAJECTORY CHART

| Variable | Source | Computation |
|----------|--------|-------------|
| `billing_score` per year | `gigs` table | `(headliner_gigs / total_gigs) * 100` for each year |
| `gig_count` per year | `gigs` table | `COUNT(*) GROUP BY YEAR(date)` |
| COVID dip (2020) | `gigs` table | Naturally appears — fewer gigs that year |

**Entirely from gigs table. No extra data needed.**

---

### 5. GLOBAL MAP

| Variable | Source | Computation |
|----------|--------|-------------|
| `lat`, `lng` per city | Nominatim geocoder | Geocode each unique city once, cache on gigs table |
| `count` per city | `gigs` table | `COUNT(*) GROUP BY venue_city` (after normalization) |
| Dot color (orange/purple/yellow) | `gigs` table | Purple = residency detected (3+ gigs same venue), Yellow = arena/stadium, Orange = everything else |
| Hover tooltip: venue list | `gigs` table | All gigs at that city with venue_name, date, billing_position, notable |

**All from gigs table + geocoder. Already working.**

---

### 6. MOST PLAYED CITIES

| Variable | Source | Computation |
|----------|--------|-------------|
| Top 5 cities + counts | `gigs` table | `SELECT venue_city, COUNT(*) GROUP BY venue_city ORDER BY count DESC LIMIT 5` |

**All from gigs table.**

---

### 7. GIGS TAB

| Variable | Source |
|----------|--------|
| Full gig list (date, venue, city, country, type, billing) | `gigs` table |
| Year filter (2025, 2026, etc.) | `gigs.date` |
| Future vs past styling | Compare `gigs.date` to today |

**All from gigs table.**

---

### 8. RELEASES TAB

| Variable | Source |
|----------|--------|
| Release list (title, year, type, featured artists, notes) | `releases` table |
| Chart positions, awards | Wikipedia Awards section |
| Summary stats (total singles, chart #1s, award count) | Computed from `releases` table |

**Scraper: `scripts/scrape-releases.ts`**

---

### 9. NETWORK TAB

| Variable | Source | Computation |
|----------|--------|-------------|
| Top co-artists + shared lineup count | `gigs.co_artists` | Unnest co_artists array, count frequency per artist |
| Co-artist context (e.g. "Hï Ibiza resident partner") | `gigs` table | Find where co-appearances happen (venue, festival) |
| Notable B2Bs & Collabs | `releases.featured_artists` + `gigs` | Auto-detect: featured on releases = collab, B2B in event name = B2B |
| Residency partners | `gigs` table | Co-artists at same venue 3+ times |

**From gigs table (co_artists) + releases table. No extra scraping.**

---

### 10. LEADERBOARD

| Variable | Source |
|----------|--------|
| All 8 axis scores | Computed from above data |
| Overall rating | Weighted formula of 8 axes + floor system |
| Tier label | Computed from overall (ICONIC/ELITE/ESTABLISHED/PROVEN/BUILDING/EMERGING) |
| Trajectory badge | Computed from score history (compare this month vs 12 months ago) |
| DJ Mag ranking | Manual seed or scrape DJ Mag results page annually |

---

## THE BUILD PLAN (in order)

### Phase 1: Get gig data flowing (you're mostly here)
```
STATUS: Songkick scraper ✅ working
STATUS: RA scraper ✅ working  
TODO: Concert Archives scraper (backfill old data)
TODO: Deduplication across sources
TODO: Geocode backfill for missing lat/lng
TODO: City normalization (Ibiza clustering)
```
**After Phase 1:** stat cards, career trajectory, global map, gigs tab, most played cities, and geographic spread score all compute from real data.

### Phase 2: Get artist metadata flowing
```
TODO: scrape-artist-meta.ts enhancements
  - Wikipedia infobox: realName, born, origin, label, genres
  - Wikipedia awards: Grammy, ARIA, DJ Awards mentions
  - kworb.net: Spotify monthly listeners, total streams
  - Instagram: follower count from meta tags
```
**After Phase 2:** hero section fully populated, social score and streaming score computable.

### Phase 3: Get release data flowing
```
TODO: scrape-releases.ts
  - Wikipedia discography tables
  - Beatport artist tracks page (genre tags, chart positions)
  - Cross-reference with label data from seed-labels.csv
```
**After Phase 3:** releases tab populated, releases score computable.

### Phase 4: Compute all 8 axis scores automatically
```
TODO: scripts/compute-scores.ts
  - Festival score from gig data + festival credibility lookup
  - Club score from gig data + venue credibility lookup
  - Social score from Instagram + Spotify metadata
  - Streaming score from kworb data
  - Releases score from releases table
  - Geo score from gig country distribution
  - Connectivity score from co-artists + releases collabs
  - Scene Authority: start with manual seeds, add PageRank later
  
TODO: Build lookup tables
  - festival_credibility: ~100 festivals with tier scores
  - venue_credibility: ~200 venues with tier scores
```
**After Phase 4:** spider chart, overall rating, tier, leaderboard all auto-compute. No manual scoring except initial SA seeds.

### Phase 5: Automate everything
```
TODO: scripts/pipeline.ts (run all scrapers in sequence)
TODO: Vercel cron job (weekly refresh)
TODO: Score history snapshots (for trajectory badges)
TODO: SA PageRank computation (once you have 100+ artists with co-artist data)
```
**After Phase 5:** the system runs itself. Add a new artist → pipeline scrapes their data → scores auto-compute → they appear on the leaderboard.

---

## LOOKUP TABLES TO BUILD ONCE

### Festival Credibility (top ~50, expand over time)
```
Tomorrowland: 95
Berghain Garten: 95
Dekmantel: 94
Sonar: 93
Movement: 93
Coachella: 92
Time Warp: 92
ADE: 91
Circoloco: 91
Awakenings: 90
Fabric presents: 90
Ultra: 88
EDC: 85
Creamfields: 84
...etc
```

### Venue Credibility (top ~100, expand over time)
```
Berghain: 98
Panorama Bar: 96
fabric: 96
DC10: 95
Tresor: 93
Robert Johnson: 92
De School: 91
Hï Ibiza: 90
Amnesia: 89
Printworks: 88
Club Space: 87
LIV Miami: 60
Generic nightclub: 40
...etc
```

These are one-time data entry tasks. ~2 hours of work. Store in Supabase as `festival_credibility` and `venue_credibility` tables.

---

## SCRAPER SUMMARY

| Script | What it gets | Sources | Feeds |
|--------|-------------|---------|-------|
| `scrape-songkick.ts` ✅ | Gigs (date, venue, city, country) | Songkick HTML | stat cards, trajectory, map, gigs tab, geo score, festival score, club score |
| `scrape-ra-v2.ts` ✅ | Gigs + co-artists + lineups | RA GraphQL | All gig stuff + connectivity score + SA PageRank |
| `scrape-concert-archives.ts` | Historical gigs | Concert Archives HTML | Backfill older career data |
| `scrape-artist-meta.ts` | Name, born, origin, label, genres, Spotify, IG, awards | Wikipedia + kworb + Instagram | Hero section, social score, streaming score |
| `scrape-releases.ts` | Discography, chart positions, labels, collabs | Wikipedia + Beatport HTML | Releases tab, releases score, label network for SA |
| `compute-scores.ts` | All 8 axis scores | All of the above | Spider chart, overall rating, leaderboard |
| `pipeline.ts` | Runs everything in order | All scrapers | The whole system |

---

## THE SIMPLE VERSION

If you want to explain this to someone in 30 seconds:

1. **Songkick + RA tell us WHERE they played** → gig count, festivals, venues, countries, co-artists, map, trajectory
2. **Wikipedia tells us WHO they are** → real name, born, origin, labels, genres, awards, discography  
3. **kworb.net tells us HOW BIG they are** → Spotify monthly listeners, total streams
4. **Instagram tells us HOW VISIBLE they are** → follower count
5. **We COMPUTE everything else** → all 8 scores, overall rating, tier, trajectory, leaderboard position

Five data sources. Five scrapers. Everything else is math.
