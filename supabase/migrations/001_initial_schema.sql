-- headlin.ing — Initial Schema
-- Run this in Supabase SQL Editor OR against any PostgreSQL instance.
-- Tables are created in dependency order.

-- ─────────────────────────────────────────────────────────────
-- ARTISTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT UNIQUE NOT NULL,
  name                    TEXT NOT NULL,
  real_name               TEXT,
  origin                  TEXT,
  born                    TEXT,
  genres                  TEXT[]        DEFAULT '{}',
  labels                  TEXT[]        DEFAULT '{}',
  instagram               TEXT,
  instagram_followers     INTEGER,
  spotify_monthly_listeners INTEGER,
  spotify_url             TEXT,
  soundcloud_url          TEXT,
  total_streams           BIGINT,
  djmag_2025_position     INTEGER,
  is_touring              BOOLEAN       DEFAULT TRUE,
  bio                     TEXT,
  avatar_url              TEXT,
  -- extra columns for scrapers
  ra_id                   TEXT,
  songkick_id             TEXT,
  wikipedia_slug          TEXT,
  spotify_id              TEXT,
  grammy                  TEXT,
  aria                    TEXT,
  label                   TEXT,
  created_at              TIMESTAMPTZ   DEFAULT now(),
  updated_at              TIMESTAMPTZ   DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- ARTIST SCORES  (8-axis + computed overall)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id      UUID REFERENCES artists(id) ON DELETE CASCADE,
  scored_at      TIMESTAMPTZ DEFAULT now(),

  festival       INTEGER CHECK (festival       BETWEEN 0 AND 100),
  club           INTEGER CHECK (club           BETWEEN 0 AND 100),
  social         INTEGER CHECK (social         BETWEEN 0 AND 100),
  streaming      INTEGER CHECK (streaming      BETWEEN 0 AND 100),
  releases       INTEGER CHECK (releases       BETWEEN 0 AND 100),
  geographic     INTEGER CHECK (geographic     BETWEEN 0 AND 100),
  connectivity   INTEGER CHECK (connectivity   BETWEEN 0 AND 100),
  scene_authority INTEGER CHECK (scene_authority BETWEEN 0 AND 100),

  -- Weighted overall (stored, not generated — lets us apply floor system)
  overall        INTEGER,

  note           TEXT,

  UNIQUE(artist_id, scored_at)
);

-- Trigger: auto-compute overall with floor system on insert/update
CREATE OR REPLACE FUNCTION compute_overall()
RETURNS TRIGGER AS $$
DECLARE
  raw_score   INTEGER;
  sorted      INTEGER[];
  top3_avg    NUMERIC;
  scores      INTEGER[];
BEGIN
  -- Weighted formula
  raw_score := ROUND(
    COALESCE(NEW.festival,       0) * 0.16 +
    COALESCE(NEW.club,           0) * 0.14 +
    COALESCE(NEW.streaming,      0) * 0.14 +
    COALESCE(NEW.geographic,     0) * 0.12 +
    COALESCE(NEW.connectivity,   0) * 0.10 +
    COALESCE(NEW.social,         0) * 0.10 +
    COALESCE(NEW.releases,       0) * 0.07 +
    COALESCE(NEW.scene_authority,0) * 0.17
  );

  -- Floor system: sort 8 axes descending, check top-3 avg
  scores := ARRAY[
    COALESCE(NEW.festival,       0),
    COALESCE(NEW.club,           0),
    COALESCE(NEW.social,         0),
    COALESCE(NEW.streaming,      0),
    COALESCE(NEW.releases,       0),
    COALESCE(NEW.geographic,     0),
    COALESCE(NEW.connectivity,   0),
    COALESCE(NEW.scene_authority,0)
  ];

  SELECT ARRAY_AGG(v ORDER BY v DESC)
    INTO sorted
    FROM UNNEST(scores) AS v;

  top3_avg := (sorted[1] + sorted[2] + sorted[3]) / 3.0;

  IF top3_avg >= 90 AND raw_score < 82 THEN
    NEW.overall := 82;
  ELSIF top3_avg >= 85 AND raw_score < 78 THEN
    NEW.overall := 78;
  ELSE
    NEW.overall := raw_score;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_overall ON artist_scores;
CREATE TRIGGER trg_compute_overall
  BEFORE INSERT OR UPDATE ON artist_scores
  FOR EACH ROW EXECUTE FUNCTION compute_overall();

-- ─────────────────────────────────────────────────────────────
-- VENUES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  city             TEXT,
  country          TEXT,
  lat              DECIMAL(9,6),
  lng              DECIMAL(9,6),
  venue_type       TEXT,
  capacity         INTEGER,
  credibility_score INTEGER,
  notable          TEXT
);

-- ─────────────────────────────────────────────────────────────
-- GIGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gigs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id        UUID REFERENCES artists(id) ON DELETE CASCADE,
  venue_name       TEXT NOT NULL,
  venue_city       TEXT,
  venue_country    TEXT,
  venue_lat        DECIMAL(9,6),
  venue_lng        DECIMAL(9,6),
  date             DATE NOT NULL,
  date_end         DATE,
  event_name       TEXT,
  billing_position TEXT,
  gig_type         TEXT,
  is_sold_out      BOOLEAN DEFAULT FALSE,
  notable          TEXT,
  co_artists       TEXT[]  DEFAULT '{}',
  source           TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gigs_artist_id ON gigs(artist_id);
CREATE INDEX IF NOT EXISTS idx_gigs_date      ON gigs(date);
CREATE INDEX IF NOT EXISTS idx_gigs_gig_type  ON gigs(gig_type);

-- ─────────────────────────────────────────────────────────────
-- RELEASES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS releases (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id                UUID REFERENCES artists(id) ON DELETE CASCADE,
  title                    TEXT NOT NULL,
  release_type             TEXT,
  release_date             DATE,
  label                    TEXT,
  collaborators            TEXT[]  DEFAULT '{}',
  spotify_streams          BIGINT,
  beatport_peak_position   INTEGER,
  beatport_genre           TEXT,
  aria_chart_position      INTEGER,
  is_award_nominated       BOOLEAN DEFAULT FALSE,
  awards                   TEXT[]  DEFAULT '{}',
  notable                  TEXT,
  source                   TEXT,
  created_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_releases_artist_id ON releases(artist_id);

-- ─────────────────────────────────────────────────────────────
-- ARTIST CONNECTIONS  (network graph)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_a        UUID REFERENCES artists(id) ON DELETE CASCADE,
  artist_b        UUID REFERENCES artists(id) ON DELETE CASCADE,
  connection_type TEXT,
  count           INTEGER DEFAULT 1,
  details         JSONB,
  UNIQUE(artist_a, artist_b, connection_type)
);

-- ─────────────────────────────────────────────────────────────
-- LABELS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE,
  owner_artist_id  UUID REFERENCES artists(id),
  label_tier       TEXT,
  credibility_score INTEGER,
  genres           TEXT[]  DEFAULT '{}',
  founded_year     INTEGER,
  discogs_url      TEXT,
  bandcamp_url     TEXT,
  beatport_url     TEXT,
  based_in         TEXT,
  info_url         TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- LABEL ROSTER
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS label_roster (
  label_id      UUID REFERENCES labels(id) ON DELETE CASCADE,
  artist_id     UUID REFERENCES artists(id) ON DELETE CASCADE,
  relationship  TEXT,
  release_count INTEGER DEFAULT 1,
  PRIMARY KEY (label_id, artist_id)
);

-- ─────────────────────────────────────────────────────────────
-- CREWS / COLLECTIVES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE,
  label_id         UUID REFERENCES labels(id),
  crew_type        TEXT,
  description      TEXT,
  credibility_score INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crew_members (
  crew_id     UUID REFERENCES crews(id) ON DELETE CASCADE,
  artist_id   UUID REFERENCES artists(id) ON DELETE CASCADE,
  role        TEXT,
  joined_year INTEGER,
  PRIMARY KEY (crew_id, artist_id)
);

-- ─────────────────────────────────────────────────────────────
-- FESTIVALS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS festivals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  city        TEXT,
  country     TEXT,
  year        INTEGER,
  date_start  DATE,
  date_end    DATE,
  tier        TEXT,
  genres      TEXT[]  DEFAULT '{}',
  capacity    INTEGER
);

-- ─────────────────────────────────────────────────────────────
-- FESTIVAL LINEUPS  (core dataset)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS festival_lineups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id      UUID REFERENCES festivals(id) ON DELETE CASCADE,
  artist_id        UUID REFERENCES artists(id) ON DELETE CASCADE,
  billing_position TEXT,
  stage            TEXT,
  day              DATE,
  set_time         TEXT,
  source           TEXT,
  UNIQUE(festival_id, artist_id)
);

-- ─────────────────────────────────────────────────────────────
-- VENUE CREDIBILITY LOOKUP  (Phase 4 scoring)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_credibility (
  venue_name TEXT PRIMARY KEY,
  score      INTEGER CHECK (score BETWEEN 0 AND 100),
  city       TEXT,
  country    TEXT
);

-- ─────────────────────────────────────────────────────────────
-- FESTIVAL CREDIBILITY LOOKUP  (Phase 4 scoring)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS festival_credibility (
  festival_name TEXT PRIMARY KEY,
  score         INTEGER CHECK (score BETWEEN 0 AND 100),
  country       TEXT
);

-- ─────────────────────────────────────────────────────────────
-- DISABLE RLS for MVP (re-enable per-table for production)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE artists              DISABLE ROW LEVEL SECURITY;
ALTER TABLE artist_scores        DISABLE ROW LEVEL SECURITY;
ALTER TABLE gigs                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE releases             DISABLE ROW LEVEL SECURITY;
ALTER TABLE venues               DISABLE ROW LEVEL SECURITY;
ALTER TABLE labels               DISABLE ROW LEVEL SECURITY;
ALTER TABLE label_roster         DISABLE ROW LEVEL SECURITY;
ALTER TABLE crews                DISABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members         DISABLE ROW LEVEL SECURITY;
ALTER TABLE artist_connections   DISABLE ROW LEVEL SECURITY;
ALTER TABLE festivals            DISABLE ROW LEVEL SECURITY;
ALTER TABLE festival_lineups     DISABLE ROW LEVEL SECURITY;
ALTER TABLE venue_credibility    DISABLE ROW LEVEL SECURITY;
ALTER TABLE festival_credibility DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- SEED: Venue credibility scores
-- ─────────────────────────────────────────────────────────────
INSERT INTO venue_credibility (venue_name, score, city, country) VALUES
  ('Berghain',            98, 'Berlin',    'Germany'),
  ('Panorama Bar',        96, 'Berlin',    'Germany'),
  ('fabric',              96, 'London',    'UK'),
  ('DC10',                95, 'Ibiza',     'Spain'),
  ('Tresor',              93, 'Berlin',    'Germany'),
  ('Robert Johnson',      92, 'Frankfurt', 'Germany'),
  ('De School',           91, 'Amsterdam', 'Netherlands'),
  ('Hï Ibiza',            90, 'Ibiza',     'Spain'),
  ('Amnesia Ibiza',       89, 'Ibiza',     'Spain'),
  ('Printworks',          88, 'London',    'UK'),
  ('Club Space',          87, 'Miami',     'USA'),
  ('Corsica Studios',     86, 'London',    'UK'),
  ('Village Underground', 84, 'London',    'UK'),
  ('Tobacco Dock',        83, 'London',    'UK'),
  ('Fabric 103',          82, 'London',    'UK'),
  ('OHM',                 85, 'Berlin',    'Germany'),
  ('Watergate',           87, 'Berlin',    'Germany'),
  ('Wilde Renate',        83, 'Berlin',    'Germany'),
  ('Pacha Ibiza',         88, 'Ibiza',     'Spain'),
  ('Ushuaïa Ibiza',       86, 'Ibiza',     'Spain'),
  ('Egg London',          80, 'London',    'UK'),
  ('Studio 338',          79, 'London',    'UK'),
  ('Oval Space',          78, 'London',    'UK'),
  ('Avant Gardner',       84, 'New York',  'USA'),
  ('99 Scott',            80, 'New York',  'USA'),
  ('Output Brooklyn',     88, 'New York',  'USA'),
  ('LIV Miami',           60, 'Miami',     'USA'),
  ('E11EVEN Miami',       62, 'Miami',     'USA')
ON CONFLICT (venue_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SEED: Festival credibility scores
-- ─────────────────────────────────────────────────────────────
INSERT INTO festival_credibility (festival_name, score, country) VALUES
  ('Tomorrowland',      95, 'Belgium'),
  ('Dekmantel',         94, 'Netherlands'),
  ('Sónar',             93, 'Spain'),
  ('Movement',          93, 'USA'),
  ('Coachella',         92, 'USA'),
  ('Time Warp',         92, 'Germany'),
  ('ADE',               91, 'Netherlands'),
  ('Circoloco',         91, 'Spain'),
  ('Awakenings',        90, 'Netherlands'),
  ('Junction 2',        90, 'UK'),
  ('Ultra Miami',       88, 'USA'),
  ('EDC Las Vegas',     85, 'USA'),
  ('CRSSD',             87, 'USA'),
  ('Creamfields',       84, 'UK'),
  ('Glastonbury',       92, 'UK'),
  ('Primavera Sound',   91, 'Spain'),
  ('Parklife',          83, 'UK'),
  ('Loveland',          88, 'Netherlands'),
  ('Sziget',            82, 'Hungary'),
  ('Exit Festival',     80, 'Serbia'),
  ('Day Zero',          90, 'Mexico'),
  ('Burning Man',       89, 'USA'),
  ('Boiler Room Festival', 90, 'UK'),
  ('Hideout Festival',  85, 'Croatia'),
  ('Lost & Found',      84, 'Malta'),
  ('Panorama Festival', 82, 'USA'),
  ('Portola',           87, 'USA')
ON CONFLICT (festival_name) DO NOTHING;
