-- Seed 35 electronic music artists
-- Scores from HEADLINING-CURSOR-HANDOFF.md (Feb 2026)
-- overall is computed by the trg_compute_overall trigger

INSERT INTO artists (slug, name, origin, genres, djmag_2025_position, is_touring) VALUES
  ('carl-cox',               'Carl Cox',               'UK',           ARRAY['Techno','House'],                          25,   TRUE),
  ('charlotte-de-witte',     'Charlotte de Witte',     'Belgium',      ARRAY['Techno','Acid'],                           9,   TRUE),
  ('eric-prydz',             'Eric Prydz',             'Sweden',       ARRAY['Progressive House','Techno'],              37,   TRUE),
  ('fisher',                 'Fisher',                 'Australia',    ARRAY['House','Tech House'],                       7,   TRUE),
  ('fred-again',             'Fred again..',           'UK',           ARRAY['House','Electronica','UK Garage'],         33,   TRUE),
  ('peggy-gou',              'Peggy Gou',              'South Korea',  ARRAY['House','Disco','Techno'],                  12,   TRUE),
  ('tale-of-us',             'Tale of Us',             'Italy',        ARRAY['Melodic Techno','Indie Dance'],          NULL,   TRUE),
  ('adam-beyer',             'Adam Beyer',             'Sweden',       ARRAY['Techno'],                                NULL,   TRUE),
  ('dom-dolla',              'Dom Dolla',              'Australia',    ARRAY['House','Tech House'],                      41,   TRUE),
  ('amelie-lens',            'Amelie Lens',            'Belgium',      ARRAY['Techno','Hard Techno'],                   38,   TRUE),
  ('john-summit',            'John Summit',            'USA',          ARRAY['Tech House','House','Dance Pop'],          46,   TRUE),
  ('keinemusik',             'Keinemusik',             'Germany',      ARRAY['House','Afro House','Deep House'],         20,   TRUE),
  ('jamie-jones',            'Jamie Jones',            'UK',           ARRAY['Tech House','House'],                      27,   TRUE),
  ('solomun',                'Solomun',                'Germany',      ARRAY['Melodic House','Indie Dance'],             55,   TRUE),
  ('black-coffee',           'Black Coffee',           'South Africa', ARRAY['Afro House','Deep House'],                 17,   TRUE),
  ('boris-brejcha',          'Boris Brejcha',          'Germany',      ARRAY['High-Tech Minimal','Melodic Techno'],      49,   TRUE),
  ('the-martinez-brothers',  'The Martinez Brothers',  'USA',          ARRAY['House','Tech House'],                      43,   TRUE),
  ('sara-landry',            'Sara Landry',            'USA',          ARRAY['Hard Techno','Rave'],                      62,   TRUE),
  ('michael-bibi',           'Michael Bibi',           'UK',           ARRAY['Tech House','Minimal'],                   48,   TRUE),
  ('indira-paganotto',       'Indira Paganotto',       'Spain',        ARRAY['Techno','Rave'],                           36,   TRUE),
  ('chris-lake',             'Chris Lake',             'UK',           ARRAY['House','Tech House'],                      95,   TRUE),
  ('mau-p',                  'Mau P',                  'Sweden',       ARRAY['Tech House','Big Room House'],             77,   TRUE),
  ('mochakk',                'Mochakk',                'Brazil',       ARRAY['House','Jackin House','Disco'],            56,   TRUE),
  ('honey-dijon',            'Honey Dijon',            'USA',          ARRAY['House','Disco'],                           97,   TRUE),
  ('pawsa',                  'PAWSA',                  'UK',           ARRAY['Tech House','House'],                      69,   TRUE),
  ('vtss',                   'VTSS',                   'Poland',       ARRAY['Hard Techno','Industrial'],              NULL,   TRUE),
  ('seth-troxler',           'Seth Troxler',           'USA',          ARRAY['House','Techno','Disco'],                NULL,   TRUE),
  ('reinier-zonneveld',      'Reinier Zonneveld',      'Netherlands',  ARRAY['Techno','Acid','Live'],                   22,   TRUE),
  ('deborah-de-luca',        'Deborah De Luca',        'Italy',        ARRAY['Techno','Hard Techno'],                   60,   TRUE),
  ('i-hate-models',          'I Hate Models',          'France',       ARRAY['Hard Techno','Industrial','Rave'],        79,   TRUE),
  ('nico-moreno',            'Nico Moreno',            'France',       ARRAY['Hard Techno','Industrial'],               67,   TRUE),
  ('patrick-topping',        'Patrick Topping',        'UK',           ARRAY['Tech House','House'],                   NULL,   TRUE),
  ('bonobo',                 'Bonobo',                 'UK',           ARRAY['Electronica','Downtempo','House'],       NULL,   TRUE),
  ('dixon',                  'Dixon',                  'Germany',      ARRAY['Deep House','Melodic House'],            NULL,   TRUE),
  ('ricardo-villalobos',     'Ricardo Villalobos',     'Chile/Germany',ARRAY['Minimal Techno','Microhouse'],          NULL,   TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name   = EXCLUDED.name,
  origin = EXCLUDED.origin,
  genres = EXCLUDED.genres,
  djmag_2025_position = EXCLUDED.djmag_2025_position;

-- Now insert scores (trigger computes overall automatically)
INSERT INTO artist_scores (artist_id, scored_at, festival, club, social, streaming, releases, geographic, connectivity, scene_authority, note)
SELECT
  a.id,
  '2026-02-21T00:00:00Z'::TIMESTAMPTZ,
  s.festival, s.club, s.social, s.streaming, s.releases,
  s.geographic, s.connectivity, s.sa,
  s.note
FROM artists a
JOIN (VALUES
  ('carl-cox',              92,96,78,62,88,95,90,98,'LEGACY — seed data Feb 2026'),
  ('charlotte-de-witte',    96,92,88,78,82,94,88,92,'RISING — seed data Feb 2026'),
  ('eric-prydz',            88,85,72,75,78,86,82,95,'LEGACY — seed data Feb 2026'),
  ('fisher',                96,82,90,92,68,92,85,68,'STEADY — seed data Feb 2026'),
  ('fred-again',            94,78,92,95,85,90,82,80,'RISING — seed data Feb 2026'),
  ('peggy-gou',             92,88,94,82,72,92,85,86,'STEADY — seed data Feb 2026'),
  ('tale-of-us',            94,90,85,80,85,92,90,94,'STEADY — seed data Feb 2026'),
  ('adam-beyer',            90,94,68,58,90,92,92,96,'LEGACY — seed data Feb 2026'),
  ('dom-dolla',             96,93,87,88,72,91,87,80,'RISING — seed data Feb 2026'),
  ('amelie-lens',           92,92,82,72,78,90,86,88,'STEADY — seed data Feb 2026'),
  ('john-summit',           94,80,93,92,75,88,85,62,'SURGING — seed data Feb 2026'),
  ('keinemusik',            90,92,82,78,80,88,88,92,'STEADY — seed data Feb 2026'),
  ('jamie-jones',           88,94,75,65,80,90,90,92,'LEGACY — seed data Feb 2026'),
  ('solomun',               85,94,72,72,82,88,82,96,'LEGACY — seed data Feb 2026'),
  ('black-coffee',          88,90,80,78,82,88,85,92,'STEADY — seed data Feb 2026'),
  ('boris-brejcha',         90,85,80,78,82,88,78,82,'STEADY — seed data Feb 2026'),
  ('the-martinez-brothers', 88,95,78,62,75,88,92,94,'LEGACY — seed data Feb 2026'),
  ('sara-landry',           91,72,86,88,70,84,78,68,'SURGING — seed data Feb 2026'),
  ('michael-bibi',          78,95,75,65,80,82,85,90,'STEADY — seed data Feb 2026'),
  ('indira-paganotto',      90,82,78,68,72,86,80,76,'STEADY — seed data Feb 2026'),
  ('chris-lake',            85,88,78,82,78,82,85,82,'RISING — seed data Feb 2026'),
  ('mau-p',                 88,74,72,88,62,80,82,64,'SURGING — seed data Feb 2026'),
  ('mochakk',               82,85,72,70,68,78,78,72,'SURGING — seed data Feb 2026'),
  ('honey-dijon',           85,90,78,60,72,84,85,92,'STEADY — seed data Feb 2026'),
  ('pawsa',                 84,94,68,58,75,83,85,93,'LEGACY — seed data Feb 2026'),
  ('vtss',                  72,92,62,52,78,74,80,93,'SURGING — seed data Feb 2026'),
  ('seth-troxler',          85,92,72,55,75,88,92,94,'LEGACY — seed data Feb 2026'),
  ('reinier-zonneveld',     88,86,72,65,82,84,80,82,'STEADY — seed data Feb 2026'),
  ('deborah-de-luca',       85,85,78,68,70,82,76,74,'RISING — seed data Feb 2026'),
  ('i-hate-models',         78,90,60,55,80,78,78,92,'STEADY — seed data Feb 2026'),
  ('nico-moreno',           80,82,65,60,68,76,74,78,'RISING — seed data Feb 2026'),
  ('patrick-topping',       85,92,72,68,75,84,88,86,'STEADY — seed data Feb 2026'),
  ('bonobo',                82,78,72,80,88,85,72,88,'LEGACY — seed data Feb 2026'),
  ('dixon',                 84,92,62,55,75,85,85,96,'LEGACY — seed data Feb 2026'),
  ('ricardo-villalobos',    70,95,45,35,80,78,82,98,'LEGACY — seed data Feb 2026')
) AS s(slug, festival, club, social, streaming, releases, geographic, connectivity, sa, note)
  ON a.slug = s.slug
ON CONFLICT (artist_id, scored_at) DO UPDATE SET
  festival       = EXCLUDED.festival,
  club           = EXCLUDED.club,
  social         = EXCLUDED.social,
  streaming      = EXCLUDED.streaming,
  releases       = EXCLUDED.releases,
  geographic     = EXCLUDED.geographic,
  connectivity   = EXCLUDED.connectivity,
  scene_authority = EXCLUDED.scene_authority,
  note           = EXCLUDED.note;
