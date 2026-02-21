# headlin.ing — Cursor Agent Build Handoff

## What This Is

headlin.ing is "Basketball-Reference for electronic music" — a data analytics platform that tracks and scores DJs/artists across multiple dimensions. Think of it as the place that answers questions nobody else can: "which artists consistently play the same festivals?", "show me every artist who played Fabric in 2024 and where else they played", "who had the biggest billing jump this year?"

Domain: **headlin.ing** (secured)
Deploy target: **Vercel**
Prototype file: **headlining-dom-dolla.jsx** (included — this is a working React component with real data for Dom Dolla, comparison mode for 6 artists, interactive world map, and a 32-artist leaderboard. Use it as your reference for design, data structure, and scoring logic.)

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 14+ (App Router)** | Already familiar with it (built typeface.rip on it). SSG for artist pages = fast + SEO. |
| Styling | **Tailwind CSS** | Dark theme. Custom design tokens below. |
| Charts | **Recharts** | Spider/radar charts, area charts, bar charts. Already proven in prototype. |
| Maps | **TopoJSON + custom SVG** | Prototype fetches real country boundaries from `cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` and decodes arcs inline. No D3 dependency needed for basic rendering, but D3-geo could be added for projections. |
| Database | **Supabase (Postgres)** | Free tier to start. Row-level security. Real-time subscriptions for future live features. |
| Auth | **Supabase Auth** | For admin panel / future user accounts. |
| Deploy | **Vercel** | Next.js native. Preview deploys for PRs. |
| Fonts | **JetBrains Mono** (data/mono) + **Space Grotesk** (display/headings) | Both on Google Fonts. |

---

## Design System

### Colors (Dark Theme)
```
bg:           #0A0A0A
surface:      #111111
surfaceHover: #1A1A1A
border:       #222222
borderLight:  #333333
text:         #F5F5F5
textMuted:    #888888
textDim:      #555555
accent:       #FF3D00  (red-orange — primary)
accentSoft:   #FF6B3D
accentGlow:   rgba(255, 61, 0, 0.15)
purple:       #AA00FF  (residencies, STAR tier)
blue:         #448AFF  (PROVEN tier)
green:        #00E676  (BUILDING tier, active/touring status)
yellow:       #FFD600  (ICONIC tier, awards, LEGACY badge, notable callouts)
```

### Typography
- **Headings / display numbers**: Space Grotesk, 800 weight, tight letter-spacing (-0.03em)
- **Data / labels / mono**: JetBrains Mono, various weights
- **Rating numbers**: Space Grotesk, 900 weight

### Rating Tier System (where you ARE)
```
95+ → ICONIC      (gold #FFD600)
90-94 → ELITE     (red #FF3D00)
85-89 → ESTABLISHED (purple #AA00FF)
80-84 → PROVEN    (blue #448AFF)
70-79 → BUILDING  (green #00E676)
<70 → EMERGING    (gray #888888)
```

### Trajectory Badges (where you're GOING)
Displayed alongside the tier. Computed from year-over-year score delta + longevity + scene authority.
```
📈 SURGING   — OVR increased 5+ points in 12 months (Sara Landry, Mau P, Mochakk)
🔥 RISING    — OVR increased 2-4 points in 12 months (Dom Dolla, Charlotte de Witte, Fred again)
➡️ STEADY    — OVR stable ±1 (Fisher, Peggy Gou, Indira Paganotto)
🏛️ LEGACY    — 10+ years active, SA ≥ 85, regardless of OVR (Carl Cox, Villalobos, PAWSA, VTSS, Dixon)
⚡ BREAKOUT  — first year with meaningful festival/chart data (new artists entering the system)
```

**Why this matters:** A "BUILDING 🏛️ LEGACY" (Villalobos at 76 OVR) reads COMPLETELY differently from "BUILDING 📈 SURGING" (hypothetical new artist at 76). Same number, totally different story. Nobody gets disrespected because the trajectory badge provides context the raw score can't.

---

## Core Data Model (Supabase/Postgres)

### `artists` table
```sql
CREATE TABLE artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- "dom-dolla", "carl-cox"
  name TEXT NOT NULL,
  real_name TEXT,
  origin TEXT,                          -- "Melbourne, Australia"
  born TEXT,
  genres TEXT[],                         -- {"House", "Tech House"}
  labels TEXT[],                         -- {"Three Six Zero", "Sweat It Out"}
  instagram TEXT,
  instagram_followers INTEGER,
  spotify_monthly_listeners INTEGER,
  spotify_url TEXT,
  soundcloud_url TEXT,
  total_streams BIGINT,
  djmag_2025_position INTEGER,
  is_touring BOOLEAN DEFAULT true,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `artist_scores` table (the 8-axis ratings)
```sql
CREATE TABLE artist_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES artists(id),
  scored_at TIMESTAMPTZ DEFAULT now(),   -- versioned so we can track changes over time
  festival INTEGER CHECK (festival BETWEEN 0 AND 100),
  club INTEGER CHECK (club BETWEEN 0 AND 100),
  social INTEGER CHECK (social BETWEEN 0 AND 100),
  streaming INTEGER CHECK (streaming BETWEEN 0 AND 100),
  releases INTEGER CHECK (releases BETWEEN 0 AND 100),
  geographic INTEGER CHECK (geographic BETWEEN 0 AND 100),
  connectivity INTEGER CHECK (connectivity BETWEEN 0 AND 100),
  scene_authority INTEGER CHECK (scene_authority BETWEEN 0 AND 100),
  overall INTEGER GENERATED ALWAYS AS (
    ROUND(festival * 0.16 + club * 0.14 + streaming * 0.14 +
          geographic * 0.12 + connectivity * 0.10 + social * 0.10 +
          releases * 0.07 + scene_authority * 0.17)
  ) STORED,
  note TEXT,                             -- editorial note explaining the scores
  UNIQUE(artist_id, scored_at)
);
```

### `gigs` table
```sql
CREATE TABLE gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES artists(id),
  venue_name TEXT NOT NULL,
  venue_city TEXT,
  venue_country TEXT,
  venue_lat DECIMAL(9,6),
  venue_lng DECIMAL(9,6),
  date DATE NOT NULL,
  date_end DATE,                         -- for residencies/multi-day
  event_name TEXT,                       -- festival name if applicable
  billing_position TEXT,                 -- "Headliner", "Support", "Resident", "B2B"
  gig_type TEXT,                         -- "festival", "club", "arena", "stadium", "residency"
  is_sold_out BOOLEAN DEFAULT false,
  notable TEXT,                          -- "SOLD OUT — 2nd night added due to demand"
  co_artists TEXT[],                     -- {"Green Velvet", "AYYBO"}
  source TEXT,                           -- "ra", "songkick", "manual"
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `releases` table
```sql
CREATE TABLE releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES artists(id),
  title TEXT NOT NULL,
  release_type TEXT,                     -- "single", "ep", "album", "remix"
  release_date DATE,
  label TEXT,
  collaborators TEXT[],
  spotify_streams BIGINT,
  beatport_peak_position INTEGER,
  beatport_genre TEXT,
  aria_chart_position INTEGER,
  is_award_nominated BOOLEAN DEFAULT false,
  awards TEXT[],                          -- {"ARIA Best Dance Release 2023"}
  notable TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `artist_connections` table (for network/connectivity graph)
```sql
CREATE TABLE artist_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_a UUID REFERENCES artists(id),
  artist_b UUID REFERENCES artists(id),
  connection_type TEXT,                   -- "shared_lineup", "b2b", "collab", "same_label", "remix"
  count INTEGER DEFAULT 1,               -- how many times
  details JSONB,                          -- specific events, dates, etc.
  UNIQUE(artist_a, artist_b, connection_type)
);
```

### `venues` table
```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  venue_type TEXT,                        -- "club", "festival_grounds", "arena", "stadium"
  capacity INTEGER,
  credibility_score INTEGER,              -- 0-100, Berghain=98, fabric=96, random club=40
  notable TEXT
);
```

### `festivals` table

### `crews` table
```sql
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                     -- "Solid Grooves", "Keinemusik", "Afterlife"
  slug TEXT UNIQUE,
  label_id UUID,                          -- associated label if applicable
  crew_type TEXT,                         -- "collective", "label_family", "party_brand", "holy_trinity"
  description TEXT,
  credibility_score INTEGER,              -- derived from member avg SA, updated periodically
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `crew_members` table
```sql
CREATE TABLE crew_members (
  crew_id UUID REFERENCES crews(id),
  artist_id UUID REFERENCES artists(id),
  role TEXT,                              -- "founder", "co-founder", "resident", "affiliate", "alumni"
  joined_year INTEGER,
  PRIMARY KEY (crew_id, artist_id)
);
```

### `labels` table
```sql
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                     -- "Drumcode", "Solid Grooves", "Innervisions"
  slug TEXT UNIQUE,
  owner_artist_id UUID REFERENCES artists(id),  -- who runs it (NULL if no single owner)
  label_tier TEXT,                        -- "institution", "respected", "emerging", "vanity"
  credibility_score INTEGER,              -- derived from roster avg SA
  genres TEXT[],
  founded_year INTEGER,
  discogs_url TEXT,
  bandcamp_url TEXT,
  beatport_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `label_roster` table
```sql
CREATE TABLE label_roster (
  label_id UUID REFERENCES labels(id),
  artist_id UUID REFERENCES artists(id),
  relationship TEXT,                      -- "owner", "regular", "one-off", "remix"
  release_count INTEGER DEFAULT 1,
  PRIMARY KEY (label_id, artist_id)
);
```

### `festivals` table
```sql
CREATE TABLE festivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  city TEXT,
  country TEXT,
  year INTEGER,
  date_start DATE,
  date_end DATE,
  tier TEXT,                              -- "mega" (Tomorrowland), "major" (CRSSD), "boutique" (Dekmantel)
  genres TEXT[],
  capacity INTEGER
);
```

### `festival_lineups` table (THE core dataset)
```sql
CREATE TABLE festival_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID REFERENCES festivals(id),
  artist_id UUID REFERENCES artists(id),
  billing_position TEXT,                  -- "headliner", "sub-headliner", "mid-card", "undercard", "opener"
  stage TEXT,
  day DATE,
  set_time TEXT,
  source TEXT,
  UNIQUE(festival_id, artist_id)
);
```

---

## Scoring System — The 8 Axes

### Weights (MUST match exactly)
```
Scene Authority:  17%  ← heaviest because it's the hardest to game
Festival:         16%
Club:             14%
Streaming:        14%
Geographic:       12%
Connectivity:     10%
Social:           10%
Releases:          7%
```

### Overall calculation
```js
// Raw weighted score
const raw = Math.round(
  festival * 0.16 +
  club * 0.14 +
  streaming * 0.14 +
  geographic * 0.12 +
  connectivity * 0.10 +
  social * 0.10 +
  releases * 0.07 +
  scene_authority * 0.17
);

// FLOOR SYSTEM — elite specialists can't get tanked by weak commercial metrics
// Sort all 8 axis scores descending, take top 3 average
// If top 3 avg >= 90 → floor at 82 (PROVEN minimum)
// If top 3 avg >= 85 → floor at 78 (BUILDING minimum)
const sorted = [all 8 scores].sort(desc);
const top3avg = avg(sorted[0], sorted[1], sorted[2]);
let overall = raw;
if (top3avg >= 90 && raw < 82) overall = 82;
else if (top3avg >= 85 && raw < 78) overall = 78;
```

**Why the floor exists:** Without it, Ricardo Villalobos (Club 95, SA 98, Releases 80, top 3 avg = 91) would score 74 because Streaming 35 and Social 45 tank his weighted average. That's broken — nobody in the scene would put Villalobos below Patrick Topping. The floor ensures that if you're genuinely elite in your top dimensions, weak commercial metrics can't pull you below PROVEN. The raw score is still stored for transparency.

### Axis Definitions

**Festival (16%)** — How dominant is this artist on festival lineups?
- Number of festival appearances per year
- Billing position (headliner vs mid-card vs undercard)
- Festival tier (Tomorrowland mainstage > local fest)
- Billing trajectory (moving up or down year over year)
- Benchmarks: 95+ = perma-headliner at mega fests (Carl Cox, Charlotte de Witte). 85 = regular at major fests. 70 = appearing but not headlining.

**Club (14%)** — How strong is their club circuit presence?
- Club gig frequency
- Venue credibility (Berghain, fabric, DC10, Panorama Bar = high weight. Generic clubs = low)
- Residencies (Hï Ibiza, Pacha = massive boost)
- Club-specific reputation
- Benchmarks: 95 = Berghain regular + Ibiza residency (Martinez Brothers, Michael Bibi). 80 = solid club circuit. 65 = mostly festivals.

**Social (10%)** — Social media presence RELATIVE TO ELECTRONIC MUSIC, not all of music.
- Instagram followers (scaled to scene: 1M+ is elite for house/techno)
- Engagement rate (matters more than raw count)
- Cross-platform presence (TikTok virality, YouTube)
- Cultural penetration outside the scene
- Benchmarks: 93+ = 1.5M+ IG, cultural icon (Peggy Gou, John Summit). 82 = 500K-1M, strong presence. 65 = 100K-300K, scene-known. 45 = minimal/no social (Villalobos).

**Streaming (14%)** — Spotify, Beatport, SoundCloud metrics.
- Spotify monthly listeners (scaled to genre: 3.5M for hard techno is insane, 3.5M for pop-house is mid)
- Beatport chart performance
- SoundCloud plays for genres where that matters more
- Total streams
- Benchmarks: 92+ = 8M+ Spotify (Fisher, Summit, Fred again). 85 = 4-8M. 72 = 1-4M. 52 = under 1M (normal for underground).

**Releases (7%)** — Output quality and quantity.
- Release frequency
- Label quality/prestige
- Chart performance
- Award nominations/wins
- Critical reception
- Catalog depth
- Benchmarks: 88+ = prolific with awards (Carl Cox, Adam Beyer). 78 = consistent output on good labels. 62 = limited catalog or early career.

**Geographic Spread (12%)** — How globally distributed is their career?
- Number of countries played
- Continental diversity (just US+Europe vs truly global)
- Emerging market presence
- Benchmarks: 95 = plays every continent regularly (Carl Cox). 88 = strong US+Europe+Ibiza+Australia. 78 = mostly one continent. 65 = regional.

**Connectivity (10%)** — How embedded are they in the scene network?
- Number of distinct artists they share lineups with
- B2B partner quality
- Label roster connections
- Festival lineup overlap frequency
- Benchmarks: 92 = connected to everyone (Martinez Brothers, Adam Beyer). 85 = wide network. 78 = solid but less central. 65 = more isolated.

**Scene Authority (17%)** — The "does the underground respect you" metric. HEAVIEST WEIGHT. Computed from a relationship graph, not raw numbers.

**SA Formula (target for automated scoring):**
```
SA = (lineup_adjacency_pagerank * 0.30) +   ← WHO you're booked alongside
     (label_network_score * 0.25) +          ← WHERE you release + WHO else is there
     (b2b_partner_avg_sa * 0.20) +           ← WHO endorses you directly
     (editorial_signals * 0.10) +            ← Boiler Room, RA, Essential Mix
     (longevity_factor * 0.10) +             ← years active * consistency
     (venue_credibility * 0.05)              ← WHERE you play (lowest weight)
```

**SA Sub-Factor: Lineup Adjacency PageRank (30%)**
The single most important signal. If you're consistently booked on lineups alongside high-SA artists at high-credibility festivals, your SA rises. If you're only booked alongside low-SA commercial acts, it doesn't. This is Google's original PageRank algorithm applied to festival billing — your authority is a function of who "links to" you by appearing on the same lineup. The data exists in `festival_lineups`, it just needs to be computed recursively.

**SA Sub-Factor: Label Network Score (25%)**
Three components:
1. **Releasing on established labels** — each label has a credibility score derived from the aggregate SA of its roster. Releasing on Drumcode (Adam Beyer SA 96, Amelie Lens SA 88) carries more weight than a no-name imprint.
2. **Owning a label** — separate and important signal. Running a label = tastemaker status. The credibility of YOUR label depends on who you sign.
   - Institution-level: Drumcode (Adam Beyer), Afterlife (Tale of Us), Diynamic (Solomun), Innervisions (Dixon)
   - Respected imprint: Solid Grooves (Bibi), Hot Creations (Jamie Jones), KNTXT (Charlotte de Witte), Gudu (Peggy Gou), LENSKE (Amelie Lens), Hekate (Sara Landry)
   - Vanity label: self-release vehicle with minimal roster = less SA impact
3. **Label co-roster graph** — who else releases on the same labels you do. If you share a label with high-SA artists, yours goes up. PageRank logic.

**SA Sub-Factor: B2B Partner Score (20%)**
The most direct endorsement possible. If Solomun (SA 96) agrees to B2B with you, that's a cosign. The average SA of your B2B partners IS a direct input. Measurable from lineup/event data.

**SA Sub-Factor: Editorial Signals (10%)**
Binary boosts: Boiler Room appearance (+), RA feature (+), BBC Essential Mix (+), Cercle set (+), Pete Tong endorsement (+). These are editorial cosigns from trusted tastemakers.

**SA Sub-Factor: Longevity (10%)**
Years active * consistency. Protects veterans. Someone respected for 15 years gets more SA than someone who blew up 18 months ago with similar metrics.

**SA Sub-Factor: Venue Credibility (5%)**
Lowest weight because it's less important than the relationship graph, but still a signal. Weighted average of venue credibility scores for an artist's gig history. Berghain (98), fabric (96), DC10 (95), Panorama Bar (94) carry more SA per show than generic clubs.

**CRITICAL: Crew / Collective Bonuses**
The system MUST recognize interconnected artist groups (holy trinities, collectives). When 3+ artists are always booked together, release on each other's labels, and do regular B2Bs — that's a crew. Each member's SA gets a multiplier from the average SA of other crew members.

Key crews to model:
- **Solid Grooves**: Michael Bibi + PAWSA + Cruze + Nic Fanciulli + Layla Benitez
- **Keinemusik**: &ME + Rampa + Adam Port (collective identity IS the brand)
- **Cuttin' Headz**: The Martinez Brothers + circle
- **Afterlife orbit**: Tale of Us / Anyma + Coeus + Agents of Time
- **Paradise crew**: Jamie Jones + Hot Creations roster
- **KNTXT**: Charlotte de Witte + Indira Paganotto + affiliated artists

This is why PAWSA has elite SA (93) despite low festival/streaming numbers — his crew connections (Bibi SA 90, Cruze ~85, the whole Solid Grooves ecosystem) amplify him through the graph.

---

## Important Disclaimer (MUST appear on leaderboard page)

> **A higher overall rating does not mean a better DJ.** These scores measure presence, reach, and cultural impact across multiple axes — not skill, taste, or artistry. An artist with a 78 OVR operating in an underground niche may be more influential within their scene than a 90 OVR with mainstream crossover. Scene Authority attempts to capture peer respect and underground credibility, but no number can fully represent what makes an artist matter. This is a starting point for conversation, not the final word. If you disagree with a score — good. That's the point.

---

## Seed Data — 32 Artists (from DJ Mag 2025 + scene knowledge)

Copy this directly. All scores are researched and calibrated.

```js
const ARTISTS = [
  // name, origin, genres, djmag2025, fest, club, soc, str, rel, geo, con, sa
  ["Carl Cox", "UK", ["Techno","House"], 25, 92, 96, 78, 62, 88, 95, 90, 98],
  ["Charlotte de Witte", "Belgium", ["Techno","Acid"], 9, 96, 92, 88, 78, 82, 94, 88, 92],
  ["Eric Prydz", "Sweden", ["Progressive House","Techno"], 37, 88, 85, 72, 75, 78, 86, 82, 95],
  ["Fisher", "Australia", ["House","Tech House"], 7, 96, 82, 90, 92, 68, 92, 85, 68],
  ["Fred again..", "UK", ["House","Electronica","UK Garage"], 33, 94, 78, 92, 95, 85, 90, 82, 80],
  ["Peggy Gou", "South Korea", ["House","Disco","Techno"], 12, 92, 88, 94, 82, 72, 92, 85, 86],
  ["Tale of Us", "Italy", ["Melodic Techno","Indie Dance"], null, 94, 90, 85, 80, 85, 92, 90, 94],
  ["Adam Beyer", "Sweden", ["Techno"], null, 90, 94, 68, 58, 90, 92, 92, 96],
  ["Dom Dolla", "Australia", ["House","Tech House"], 41, 96, 93, 87, 88, 72, 91, 87, 80],
  ["Amelie Lens", "Belgium", ["Techno","Hard Techno"], 38, 92, 92, 82, 72, 78, 90, 86, 88],
  ["John Summit", "US", ["Tech House","House","Dance Pop"], 46, 94, 80, 93, 92, 75, 88, 85, 62],
  ["Keinemusik", "Germany", ["House","Afro House","Deep House"], 20, 90, 92, 82, 78, 80, 88, 88, 92],
  ["Jamie Jones", "UK", ["Tech House","House"], 27, 88, 94, 75, 65, 80, 90, 90, 92],
  ["Solomun", "Germany", ["Melodic House","Indie Dance"], 55, 85, 94, 72, 72, 82, 88, 82, 96],
  ["Black Coffee", "South Africa", ["Afro House","Deep House"], 17, 88, 90, 80, 78, 82, 88, 85, 92],
  ["Boris Brejcha", "Germany", ["High-Tech Minimal","Melodic Techno"], 49, 90, 85, 80, 78, 82, 88, 78, 82],
  ["The Martinez Brothers", "US", ["House","Tech House"], 43, 88, 95, 78, 62, 75, 88, 92, 94],
  ["Sara Landry", "US", ["Hard Techno","Rave"], 62, 91, 72, 86, 88, 70, 84, 78, 68],
  ["Michael Bibi", "UK", ["Tech House","Minimal"], 48, 78, 95, 75, 65, 80, 82, 85, 90],
  ["Indira Paganotto", "Spain", ["Techno","Rave"], 36, 90, 82, 78, 68, 72, 86, 80, 76],
  ["Chris Lake", "UK", ["House","Tech House"], 95, 85, 88, 78, 82, 78, 82, 85, 82],
  ["Mau P", "Sweden", ["Tech House","Big Room House"], 77, 88, 74, 72, 88, 62, 80, 82, 64],
  ["Mochakk", "Brazil", ["House","Jackin House","Disco"], 56, 82, 85, 72, 70, 68, 78, 78, 72],
  ["Honey Dijon", "US", ["House","Disco"], 97, 85, 90, 78, 60, 72, 84, 85, 92],
  ["PAWSA", "UK", ["Tech House","House"], 69, 84, 94, 68, 58, 75, 83, 85, 93],
  ["VTSS", "Poland", ["Hard Techno","Industrial"], null, 72, 92, 62, 52, 78, 74, 80, 93],
  ["Seth Troxler", "US", ["House","Techno","Disco"], null, 85, 92, 72, 55, 75, 88, 92, 94],
  ["Reinier Zonneveld", "Netherlands", ["Techno","Acid","Live"], 22, 88, 86, 72, 65, 82, 84, 80, 82],
  ["Deborah De Luca", "Italy", ["Techno","Hard Techno"], 60, 85, 85, 78, 68, 70, 82, 76, 74],
  ["I Hate Models", "France", ["Hard Techno","Industrial","Rave"], 79, 78, 90, 60, 55, 80, 78, 78, 92],
  ["Nico Moreno", "France", ["Hard Techno","Industrial"], 67, 80, 82, 65, 60, 68, 76, 74, 78],
  ["Patrick Topping", "UK", ["Tech House","House"], null, 85, 92, 72, 68, 75, 84, 88, 86],
  ["Bonobo", "UK", ["Electronica","Downtempo","House"], null, 82, 78, 72, 80, 88, 85, 72, 88],
  ["Dixon", "Germany", ["Deep House","Melodic House"], null, 84, 92, 62, 55, 75, 85, 85, 96],
  ["Ricardo Villalobos", "Chile/Germany", ["Minimal Techno","Microhouse"], null, 70, 95, 45, 35, 80, 78, 82, 98],
];
```

---

## Pages to Build (Priority Order)

### Phase 1 — MVP Launch

**1. `/` — Homepage / Leaderboard**
- Full ranked table of all artists sorted by overall
- Columns: Rank, Artist (name + origin + genres), OVR, Fest, Club, Soc, Str, Geo, Con, Auth, DJ Mag position
- Each stat cell has a subtle bar chart behind the number (height proportional to score)
- Disclaimer banner at top
- Click artist name → goes to their profile page
- Tier badges next to each name (color-coded)
- Mobile responsive: collapse to key columns (Rank, Name, OVR, top 3 stats)

**2. `/artist/[slug]` — Artist Profile**
- Hero section: avatar placeholder (initials), name, real name, origin, genres, social stats, touring status badge, overall rating badge
- Tab navigation: Overview, Gigs, Releases, Network
- **Overview tab**: stat cards, spider/radar chart (8 axes), career trajectory area chart, world map with interactive tooltips, top cities bar chart
- **Gigs tab**: chronological list filterable by year, color-coded by type, shows billing position
- **Releases tab**: discography timeline, chart positions, award callouts
- **Network tab**: top co-artists with shared lineup frequency, notable B2B cards
- **Compare mode**: dropdown on spider chart to overlay another artist. Shows both radar shapes, side-by-side stat bars with +/- differentials, artist info card

**3. `/compare` — Head-to-Head Comparison (standalone page)**
- Pick two artists from dropdowns
- Side-by-side spider charts overlaid
- Stat-by-stat breakdown with differentials
- "Who wins" per category
- Shareable URL: `/compare/dom-dolla/solomun`

### Phase 2 — Growth Features

**4. `/festivals` — Festival Explorer**
- Browse festivals by year, region, genre
- Each festival page shows full lineup with artists linked to profiles
- Historical lineups: see how billing positions changed year over year
- "Who played this festival AND that festival?" cross-reference tool

**5. `/venues` — Venue Database**
- Venue pages showing all artists who've played there
- Credibility score per venue
- Geographic clustering

**6. `/awards` — Seasonal Awards / Leaderboards**
- Biggest billing jump
- Most B2Bs
- Most countries played
- "Iron DJ" (most gigs)
- Breakout artist
- Scene MVP per genre

### Phase 3 — Advanced

**7. `/trends` — Buzz & Trends Dashboard**
- Real-time social velocity (Twitter mentions, YouTube set views, Shazam data)
- Unreleased ID tracker (from 1001Tracklists)
- Rising artists (biggest score changes month-over-month)
- Genre health metrics

**8. Admin Panel (`/admin`)**
- CRUD for artists, gigs, scores, festivals
- Data import tools
- Score override with editorial notes

---

## Build Steps for Cursor Agent

### Step 1: Project Setup
```bash
npx create-next-app@latest headlining --typescript --tailwind --app --src-dir
cd headlining
npm install recharts @supabase/supabase-js
```

### Step 2: Tailwind Config
Add the custom color tokens from the Design System section to `tailwind.config.ts`. Set up dark mode as default. Add JetBrains Mono and Space Grotesk via Google Fonts in `layout.tsx`.

### Step 3: Supabase Setup
- Create Supabase project
- Run the SQL from the Data Model section to create tables
- Set up environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Seed the database with the 32 artists from the seed data

### Step 4: Build the Leaderboard Page (`/`)
Use the prototype's Leaderboard tab as the reference. This is the landing page. Server-side render from Supabase for SEO.

### Step 5: Build Artist Profile Page (`/artist/[slug]`)
Use the prototype's full artist profile (Dom Dolla) as reference. All 4 tabs. The world map with interactive tooltips. The spider chart with compare mode.

### Step 6: Build Compare Page (`/compare`)
Dedicated comparison tool. Two artist selector → overlaid spider charts + stat breakdown.

### Step 7: Deploy to Vercel
```bash
vercel --prod
```
Point headlin.ing domain to Vercel.

---

## Data Pipeline (Future — not needed for MVP)

For MVP, manually enter data through Supabase dashboard or admin panel. Automate later:

| Source | Data | Method | Priority |
|--------|------|--------|----------|
| Spotify API | Monthly listeners, followers, top tracks, related artists | Official API (free) | HIGH |
| Festival websites | Lineup data, billing positions | Scrape + manual | HIGH |
| Beatport | Chart positions, genre tags, label affiliations | Partner API or scrape | MEDIUM |
| Resident Advisor | Events, lineups, venues, artist pages | Scrape (structured HTML) | MEDIUM |
| 1001Tracklists | Track IDs, set tracklists, unreleased IDs | Scrape | MEDIUM |
| Songkick | Tour dates, venue data, concert history | API (if still available) | MEDIUM |
| 19hz.info | Underground/local events (SF, LA, NYC focus) | Scrape | MEDIUM |
| YouTube/Boiler Room | Set view counts | YouTube Data API | LOW |
| SoundCloud | Play counts, reposts (peer respect signal) | API | LOW |
| Bandcamp | Label affiliations, sales data | Scrape | LOW |
| Twitter/X | Mentions, buzz, peer cosigns | X API (paid) | LOW |

---

## Key Design Principles

1. **Dense data, not sparse content.** Every pixel should communicate something. Basketball-Reference, not a marketing site.
2. **Dark theme always.** This is for nightlife people. The aesthetic should feel like a club lighting console, not a SaaS dashboard.
3. **Monospace for data, display font for impact.** JetBrains Mono makes numbers feel authoritative. Space Grotesk makes names feel important.
4. **Debate is the feature.** The scores SHOULD be controversial. "How is X only an 82??" is the engagement loop.
5. **Underground gets credit.** Scene Authority being the heaviest weight (17%) is a deliberate design decision. This isn't DJ Mag — the system should surface artists that popularity contests miss.
6. **The spider chart shape IS the story.** You should be able to understand an artist's archetype in 2 seconds from their radar chart shape without reading a single word.

---

## Reference: Artist Archetypes (emerge naturally from scoring)

- **Underground God** — Villalobos, Dixon, VTSS. SA through the roof, social/streaming low. Knife-shaped spider chart.
- **Commercial Juggernaut** — Summit, Fisher, Fred again. Social/streaming/festival all 90+, SA in 60s. Fat everywhere except underground credibility.
- **Balanced Elite** — Dom Dolla, Charlotte de Witte, Peggy Gou. No glaring weakness. Roundest spider charts.
- **Scene Institution** — Carl Cox, Adam Beyer, Jamie Jones, Martinez Brothers. Decades of work = high SA AND high festival. The aspirational shape.
- **Breakout Rocket** — Sara Landry, Mau P, Mochakk. Festival/streaming spiking, SA still catching up. Visibly "young" shape.

---

## Files Included

- `headlining-dom-dolla.jsx` — Full working React prototype. This is your design bible. Every component, interaction, color, and data structure is in here. Drop it into a Next.js page to see it render.
