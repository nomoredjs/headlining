import { useState, useEffect, useRef } from "react";
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart
} from "recharts";

// ═══════════════════════════════════════════════════
// HEADLIN.ING — Artist Profile Prototype
// Dom Dolla — Real Data Compiled Feb 2026
// ═══════════════════════════════════════════════════

const COLORS = {
  bg: "#0A0A0A",
  surface: "#111111",
  surfaceHover: "#1A1A1A",
  border: "#222222",
  borderLight: "#333333",
  text: "#F5F5F5",
  textMuted: "#888888",
  textDim: "#555555",
  accent: "#FF3D00",
  accentGlow: "rgba(255, 61, 0, 0.15)",
  accentSoft: "#FF6B3D",
  green: "#00E676",
  greenDim: "rgba(0, 230, 118, 0.1)",
  blue: "#448AFF",
  yellow: "#FFD600",
  purple: "#AA00FF",
  cyan: "#00E5FF",
  chart1: "#FF3D00",
  chart2: "#FF6B3D",
};

// ── Real Data ──────────────────────────────────
const ARTIST = {
  name: "Dom Dolla",
  realName: "Dominic Matheson",
  origin: "Melbourne, Australia",
  born: "January 18, 1992",
  age: 34,
  label: "Three Six Zero / Sony",
  genres: ["House", "Tech House", "Deep Groove House"],
  yearsActive: "2013–present",
  instagram: "1M",
  spotify: "6.8M monthly",
  totalStreams: "1.5B+",
  grammy: "1 nomination",
  aria: "4 wins (24 nominations)",
};

const STATS_2025 = {
  totalGigs: 55,
  uniqueVenues: 38,
  festivals: 18,
  clubShows: 20,
  residencies: 1,
  countries: 12,
  continents: 5,
  soldOutShows: 8,
  biggestVenue: "Madison Square Garden (2x sold out)",
  biggestFestival: "Ultra Miami (Headliner)",
};

const CAREER_STATS = {
  totalGigs: "565+",
  yearsTouring: 10,
  topCities: [
    { city: "Las Vegas", count: 57 },
    { city: "Los Angeles", count: 24 },
    { city: "Miami", count: 22 },
    { city: "Melbourne", count: 20 },
    { city: "Sydney", count: 19 },
  ],
};

const spiderData = [
  { stat: "Festival", value: 96, fullMark: 100 },
  { stat: "Club", value: 93, fullMark: 100 },
  { stat: "Social", value: 87, fullMark: 100 },
  { stat: "Streaming", value: 88, fullMark: 100 },
  { stat: "Releases", value: 72, fullMark: 100 },
  { stat: "Geo", value: 91, fullMark: 100 },
  { stat: "Connect.", value: 87, fullMark: 100 },
  { stat: "Scene Auth", value: 80, fullMark: 100 },
];

// Weights: Scene Auth (17%) + Festival (16%) + Club (14%) + Streaming (14%) + Geo (12%) + Connect (10%) + Social (10%) + Releases (7%)
const calcOverall = (d) => Math.round(
  d[0].value * 0.16 + d[1].value * 0.14 + d[3].value * 0.14 +
  d[5].value * 0.12 + d[6].value * 0.10 + d[2].value * 0.10 +
  d[4].value * 0.07 + d[7].value * 0.17
);
const OVERALL_RATING = calcOverall(spiderData);

const getRatingTier = (r) => {
  if (r >= 95) return { label: "ICONIC", color: "#FFD600" };
  if (r >= 90) return { label: "ELITE", color: "#FF3D00" };
  if (r >= 85) return { label: "ESTABLISHED", color: "#AA00FF" };
  if (r >= 80) return { label: "PROVEN", color: "#448AFF" };
  if (r >= 70) return { label: "BUILDING", color: "#00E676" };
  return { label: "EMERGING", color: "#888888" };
};

// Trajectory badges — computed from delta + longevity + scene authority
// In production these would be derived from historical score snapshots
const getTrajectory = (name, sa, overall) => {
  const TRAJECTORIES = {
    "Carl Cox":        { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Ricardo Villalobos": { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Solomun":         { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Dixon":           { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Adam Beyer":      { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Seth Troxler":    { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Jamie Jones":     { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "The Martinez Brothers": { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Eric Prydz":      { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Black Coffee":    { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Honey Dijon":     { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "VTSS":            { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "PAWSA":           { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Bonobo":          { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Chris Lake":      { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "I Hate Models":   { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Patrick Topping": { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Boris Brejcha":   { badge: "LEGACY", icon: "🏛️", color: "#FFD600" },
    "Sara Landry":     { badge: "SURGING", icon: "📈", color: "#00E5FF" },
    "Mau P":           { badge: "SURGING", icon: "📈", color: "#00E5FF" },
    "Dom Dolla":       { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Charlotte de Witte": { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Fred again..":    { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Amelie Lens":     { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Reinier Zonneveld": { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Michael Bibi":    { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Deborah De Luca": { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Mochakk":         { badge: "SURGING", icon: "📈", color: "#00E5FF" },
    "Nico Moreno":     { badge: "SURGING", icon: "📈", color: "#00E5FF" },
    "Indira Paganotto": { badge: "STEADY", icon: "➡️", color: "#888888" },
    "John Summit":     { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Keinemusik":      { badge: "RISING", icon: "🔥", color: "#FF6B3D" },
    "Fisher":          { badge: "STEADY", icon: "➡️", color: "#888888" },
    "Peggy Gou":       { badge: "STEADY", icon: "➡️", color: "#888888" },
    "Tale of Us":      { badge: "STEADY", icon: "➡️", color: "#888888" },
  };
  if (TRAJECTORIES[name]) return TRAJECTORIES[name];
  // Default logic: high SA + low overall = LEGACY, else STEADY
  if (sa >= 85 && overall < 85) return { badge: "LEGACY", icon: "🏛️", color: "#FFD600" };
  return { badge: "STEADY", icon: "➡️", color: "#888888" };
};

const ratingTier = getRatingTier(OVERALL_RATING);

// ── Comparison Artists ──────────────────────────
const COMPARE_ARTISTS = {
  "Michael Bibi": {
    overall: 82, genres: ["Tech House", "Minimal", "House"], origin: "London, UK",
    ig: "500K", spotify: "2M monthly",
    data: [
      { stat: "Festival", value: 78, fullMark: 100 }, { stat: "Club", value: 95, fullMark: 100 },
      { stat: "Social", value: 75, fullMark: 100 }, { stat: "Streaming", value: 65, fullMark: 100 },
      { stat: "Releases", value: 80, fullMark: 100 }, { stat: "Geo", value: 82, fullMark: 100 },
      { stat: "Connect.", value: 85, fullMark: 100 }, { stat: "Scene Auth", value: 90, fullMark: 100 },
    ],
    sceneNote: "Solid Grooves founder. Fabric, DC10, Amnesia regular. Club DJ's club DJ — scene authority elite.",
    color: "#448AFF",
  },
  "VTSS": {
    overall: 78, genres: ["Hard Techno", "Industrial", "Rave"], origin: "Warsaw, Poland",
    ig: "180K", spotify: "800K monthly",
    data: [
      { stat: "Festival", value: 72, fullMark: 100 }, { stat: "Club", value: 92, fullMark: 100 },
      { stat: "Social", value: 62, fullMark: 100 }, { stat: "Streaming", value: 52, fullMark: 100 },
      { stat: "Releases", value: 78, fullMark: 100 }, { stat: "Geo", value: 74, fullMark: 100 },
      { stat: "Connect.", value: 80, fullMark: 100 }, { stat: "Scene Auth", value: 93, fullMark: 100 },
    ],
    sceneNote: "Berghain regular. BITE label. Highest scene authority in this group — the underground's underground.",
    color: "#AA00FF",
  },
  "Sara Landry": {
    overall: 83, genres: ["Hard Techno", "Rave", "Industrial"], origin: "Boston, US",
    ig: "650K", spotify: "3.5M monthly",
    data: [
      { stat: "Festival", value: 91, fullMark: 100 }, { stat: "Club", value: 72, fullMark: 100 },
      { stat: "Social", value: 86, fullMark: 100 }, { stat: "Streaming", value: 88, fullMark: 100 },
      { stat: "Releases", value: 70, fullMark: 100 }, { stat: "Geo", value: 84, fullMark: 100 },
      { stat: "Connect.", value: 78, fullMark: 100 }, { stat: "Scene Auth", value: 68, fullMark: 100 },
    ],
    sceneNote: "Biggest name in hard techno right now. Tomorrowland mainstage, Ultra, EDC. 3.5M Spotify for hard techno is unheard of. Her 2024 = Dom's 2022. Face of the wave.",
    color: "#FF6B3D",
  },
  "Mau P": {
    overall: 80, genres: ["Tech House", "Big Room House"], origin: "Stockholm, Sweden",
    ig: "350K", spotify: "5M monthly",
    data: [
      { stat: "Festival", value: 88, fullMark: 100 }, { stat: "Club", value: 74, fullMark: 100 },
      { stat: "Social", value: 72, fullMark: 100 }, { stat: "Streaming", value: 88, fullMark: 100 },
      { stat: "Releases", value: 62, fullMark: 100 }, { stat: "Geo", value: 80, fullMark: 100 },
      { stat: "Connect.", value: 82, fullMark: 100 }, { stat: "Scene Auth", value: 64, fullMark: 100 },
    ],
    sceneNote: "Drugs From Amsterdam was a crossover monster. Filling massive rooms. Club Space w/ Dom, every major festival circuit. On the Dom 2021 trajectory.",
    color: "#00E5FF",
  },
  "John Summit": {
    overall: 87, genres: ["Tech House", "House", "Dance Pop"], origin: "Chicago, US",
    ig: "1.5M", spotify: "8M monthly",
    data: [
      { stat: "Festival", value: 94, fullMark: 100 }, { stat: "Club", value: 80, fullMark: 100 },
      { stat: "Social", value: 93, fullMark: 100 }, { stat: "Streaming", value: 92, fullMark: 100 },
      { stat: "Releases", value: 75, fullMark: 100 }, { stat: "Geo", value: 88, fullMark: 100 },
      { stat: "Connect.", value: 85, fullMark: 100 }, { stat: "Scene Auth", value: 62, fullMark: 100 },
    ],
    sceneNote: "Commercial house juggernaut. Experts Only brand. 1.5M IG, 8M Spotify monthly. Sells out everything he touches. Scene auth debated — underground doesn't fully cosign but the numbers are undeniable.",
    color: "#FFD600",
  },
  "Solomun": {
    overall: 85, genres: ["Melodic House", "Deep House", "Indie Dance"], origin: "Hamburg, Germany",
    ig: "800K", spotify: "3M monthly",
    data: [
      { stat: "Festival", value: 85, fullMark: 100 }, { stat: "Club", value: 94, fullMark: 100 },
      { stat: "Social", value: 72, fullMark: 100 }, { stat: "Streaming", value: 72, fullMark: 100 },
      { stat: "Releases", value: 82, fullMark: 100 }, { stat: "Geo", value: 88, fullMark: 100 },
      { stat: "Connect.", value: 82, fullMark: 100 }, { stat: "Scene Auth", value: 96, fullMark: 100 },
    ],
    sceneNote: "Elder statesman. Pacha Ibiza residency 10+ years. Diynamic label boss. Boiler Room Tulum = most watched DJ set ever. B2B w/ Dom at Wool Store Melbourne 2024. Untouchable scene authority.",
    color: "#E0E0E0",
  },
};

// ── LEADERBOARD — 30+ artists scored across 8 axes ──────────
// Sources: DJ Mag 2025, Spotify, Beatport, festival lineups, RA, scene knowledge
// Fest=Festival, Clb=Club, Soc=Social, Str=Streaming, Rel=Releases, Geo=Geographic, Con=Connectivity, SA=Scene Authority
const LEADERBOARD = [
  { name: "Carl Cox", origin: "UK", genres: ["Techno", "House"], djmag: 25, fest: 92, clb: 96, soc: 78, str: 62, rel: 88, geo: 95, con: 90, sa: 98, note: "The king. 30+ year career. Space Ibiza legend. Global ambassador of techno." },
  { name: "Charlotte de Witte", origin: "Belgium", genres: ["Techno", "Acid"], djmag: 9, fest: 96, clb: 92, soc: 88, str: 78, rel: 82, geo: 94, con: 88, sa: 92, note: "KNTXT label. Tomorrowland mainstage closer. World's #1 Techno DJ (DJ Mag). Formula 1 collab." },
  { name: "Eric Prydz", origin: "Sweden", genres: ["Progressive House", "Techno"], djmag: 37, fest: 88, clb: 85, soc: 72, str: 75, rel: 78, geo: 86, con: 82, sa: 95, note: "HOLO shows. Cirez D alias. Pryda label. One of the most technically respected DJs alive." },
  { name: "Fisher", origin: "Australia", genres: ["House", "Tech House"], djmag: 7, fest: 96, clb: 82, soc: 90, str: 92, rel: 68, geo: 92, con: 85, sa: 68, note: "Losing It changed everything. 8M Spotify. World's #1 House DJ (DJ Mag). Massive commercial crossover." },
  { name: "Fred again..", origin: "UK", genres: ["House", "Electronica", "UK Garage"], djmag: 33, fest: 94, clb: 78, soc: 92, str: 95, rel: 85, geo: 90, con: 82, sa: 80, note: "Boiler Room viral. 12M Spotify. Genre-defying. USB tour was cultural moment. Brian Eno mentee." },
  { name: "Peggy Gou", origin: "South Korea", genres: ["House", "Disco", "Techno"], djmag: 12, fest: 92, clb: 88, soc: 94, str: 82, rel: 72, geo: 92, con: 85, sa: 86, note: "Gudu Records. Fashion icon. 1.7M IG. Berghain to Coachella. (I Go) was massive crossover." },
  { name: "Tale of Us", origin: "Italy", genres: ["Melodic Techno", "Indie Dance"], djmag: null, fest: 94, clb: 90, soc: 85, str: 80, rel: 85, geo: 92, con: 90, sa: 94, note: "Afterlife label is an empire. Anyma solo project. Ibiza residency. Shaped melodic techno as a genre." },
  { name: "Adam Beyer", origin: "Sweden", genres: ["Techno"], djmag: null, fest: 90, clb: 94, soc: 68, str: 58, rel: 90, geo: 92, con: 92, sa: 96, note: "Drumcode label boss. Defined Swedish techno. DC10 regular. Scene institution for 25+ years." },
  { name: "Dom Dolla", origin: "Australia", genres: ["House", "Tech House"], djmag: 41, fest: 96, clb: 93, soc: 87, str: 88, rel: 72, geo: 91, con: 87, sa: 80, note: "2x MSG sold out. Hï Ibiza residency. Allianz Stadium. F1 soundtrack. On the cusp of ELITE." },
  { name: "Amelie Lens", origin: "Belgium", genres: ["Techno", "Hard Techno"], djmag: 38, fest: 92, clb: 92, soc: 82, str: 72, rel: 78, geo: 90, con: 86, sa: 88, note: "LENSKE label. Sphere opener for Anyma. Relentless touring schedule. Belgium techno royalty." },
  { name: "John Summit", origin: "US", genres: ["Tech House", "House"], djmag: 46, fest: 94, clb: 80, soc: 93, str: 92, rel: 75, geo: 88, con: 85, sa: 62, note: "Experts Only. 1.5M IG. 8M Spotify. Sells out everything. Scene auth debated but numbers undeniable." },
  { name: "Keinemusik", origin: "Germany", genres: ["House", "Afro House", "Deep House"], djmag: 20, fest: 90, clb: 92, soc: 82, str: 78, rel: 80, geo: 88, con: 88, sa: 92, note: "&ME, Rampa, Adam Port. Biggest jump on DJ Mag (+15). Hï Ibiza. Genre-defining collective." },
  { name: "Jamie Jones", origin: "UK", genres: ["Tech House", "House"], djmag: 27, fest: 88, clb: 94, soc: 75, str: 65, rel: 80, geo: 90, con: 90, sa: 92, note: "Paradise brand. Hot Creations label. DC10 residency for 10+ years. Ibiza institution." },
  { name: "Solomun", origin: "Germany", genres: ["Melodic House", "Indie Dance"], djmag: 55, fest: 85, clb: 94, soc: 72, str: 72, rel: 82, geo: 88, con: 82, sa: 96, note: "Pacha 10+ years. Diynamic. Boiler Room Tulum. Highest climber DJ Mag 2025 (+33). Legend." },
  { name: "Black Coffee", origin: "South Africa", genres: ["Afro House", "Deep House"], djmag: 17, fest: 88, clb: 90, soc: 80, str: 78, rel: 82, geo: 88, con: 85, sa: 92, note: "Grammy winner. Hï Ibiza residency. Brought Afro House to global mainstream. Soulection vibes." },
  { name: "Boris Brejcha", origin: "Germany", genres: ["High-Tech Minimal", "Melodic Techno"], djmag: 49, fest: 90, clb: 85, soc: 80, str: 78, rel: 82, geo: 88, con: 78, sa: 82, note: "Joker mask. Fckng Serious label. Massive arena shows. Created his own subgenre." },
  { name: "The Martinez Brothers", origin: "US", genres: ["House", "Tech House"], djmag: 43, fest: 88, clb: 95, soc: 78, str: 62, rel: 75, geo: 88, con: 92, sa: 94, note: "NYC legends. DC10 residency. Cuttin' Headz label. Started DJing as teenagers. Scene royalty." },
  { name: "Sara Landry", origin: "US", genres: ["Hard Techno", "Rave"], djmag: 62, fest: 91, clb: 72, soc: 86, str: 88, rel: 70, geo: 84, con: 78, sa: 68, note: "World's #1 Hard DJ (DJ Mag). Hekate Records. 3.5M Spotify for hard techno is unheard of." },
  { name: "Michael Bibi", origin: "UK", genres: ["Tech House", "Minimal"], djmag: 48, fest: 78, clb: 95, soc: 75, str: 65, rel: 80, geo: 82, con: 85, sa: 90, note: "Solid Grooves. Highest new entry DJ Mag 2025. Cancer survivor. Fabric, DC10. The comeback story." },
  { name: "Indira Paganotto", origin: "Spain", genres: ["Techno", "Rave"], djmag: 36, fest: 90, clb: 82, soc: 78, str: 68, rel: 72, geo: 86, con: 80, sa: 76, note: "Rave is king. Charlotte de Witte's KNTXT affiliate. Tomorrowland regular. Spanish techno torchbearer." },
  { name: "Chris Lake", origin: "UK", genres: ["House", "Tech House"], djmag: 95, fest: 85, clb: 88, soc: 78, str: 82, rel: 78, geo: 82, con: 85, sa: 82, note: "Black Book Records. 6M Spotify. Fisher collab partner. Turning Tables. 20+ year career renaissance." },
  { name: "Mau P", origin: "Sweden", genres: ["Tech House", "Big Room House"], djmag: 77, fest: 88, clb: 74, soc: 72, str: 88, rel: 62, geo: 80, con: 82, sa: 64, note: "Drugs From Amsterdam monster hit. 5M Spotify. Seth Troxler B2B at Time Warp. Rising fast." },
  { name: "Mochakk", origin: "Brazil", genres: ["House", "Jackin House", "Disco"], djmag: 56, fest: 82, clb: 85, soc: 72, str: 70, rel: 68, geo: 78, con: 78, sa: 72, note: "New entry DJ Mag. Brazil's rising house export. Funky, raw, analog-heavy sound." },
  { name: "Honey Dijon", origin: "US", genres: ["House", "Disco"], djmag: 97, fest: 85, clb: 90, soc: 78, str: 60, rel: 72, geo: 84, con: 85, sa: 92, note: "Fashion world crossover. Fabric, Panorama Bar, Glastonbury. Classic Chicago house pedigree. Cultural icon." },
  { name: "PAWSA", origin: "UK", genres: ["Tech House", "House"], djmag: 69, fest: 84, clb: 94, soc: 68, str: 58, rel: 75, geo: 83, con: 85, sa: 93, note: "Solid Grooves family. USB is immaculate. IDs for days. Fabric, DC10, Circoloco regular. Sold out shows. Underground god — numbers don't tell the story." },
  { name: "Mau P", _skip: true },
  { name: "VTSS", origin: "Poland", genres: ["Hard Techno", "Industrial"], djmag: null, fest: 72, clb: 92, soc: 62, str: 52, rel: 78, geo: 74, con: 80, sa: 93, note: "Berghain regular. BITE label. Highest scene authority per capita. The underground's underground." },
  { name: "Seth Troxler", origin: "US", genres: ["House", "Techno", "Disco"], djmag: null, fest: 85, clb: 92, soc: 72, str: 55, rel: 75, geo: 88, con: 92, sa: 94, note: "Ibiza veteran. DC10. RA top 5 multiple years. Wine label. Time Warp B2B with Mau P 2025. Cultural figure." },
  { name: "Reinier Zonneveld", origin: "Netherlands", genres: ["Techno", "Acid", "Live"], djmag: 22, fest: 88, clb: 86, soc: 72, str: 65, rel: 82, geo: 84, con: 80, sa: 82, note: "Live hardware sets. Filth on Acid label. DJ Mag up 4 places. Acid techno specialist." },
  { name: "Deborah De Luca", origin: "Italy", genres: ["Techno", "Hard Techno"], djmag: 60, fest: 85, clb: 85, soc: 78, str: 68, rel: 70, geo: 82, con: 76, sa: 74, note: "Italian techno queen. DJ Mag up 21 places. Massive in Europe and South America." },
  { name: "I Hate Models", origin: "France", genres: ["Hard Techno", "Industrial", "Rave"], djmag: 79, fest: 78, clb: 90, soc: 60, str: 55, rel: 80, geo: 78, con: 78, sa: 92, note: "New DJ Mag entry. Music icon of French hard techno. Perc Trax, Voam. VTSS orbit. Underground hero." },
  { name: "Nico Moreno", origin: "France", genres: ["Hard Techno", "Industrial"], djmag: 67, fest: 80, clb: 82, soc: 65, str: 60, rel: 68, geo: 76, con: 74, sa: 78, note: "New DJ Mag entry. Leading the French hard techno explosion. Raw energy." },
  { name: "Patrick Topping", origin: "UK", genres: ["Tech House", "House"], djmag: null, fest: 85, clb: 92, soc: 72, str: 68, rel: 75, geo: 84, con: 88, sa: 86, note: "Trick label. Hï Ibiza co-resident with Dom. Hot Creations alumni. Consistent top-tier." },
  { name: "Bonobo", origin: "UK", genres: ["Electronica", "Downtempo", "House"], djmag: null, fest: 82, clb: 78, soc: 72, str: 80, rel: 88, geo: 85, con: 72, sa: 88, note: "Ninja Tune. Outlier/Migration/Fragments trilogy. Live band shows. Cercle set iconic. Producer's producer." },
  { name: "Dixon", origin: "Germany", genres: ["Deep House", "Melodic House"], djmag: null, fest: 84, clb: 92, soc: 62, str: 55, rel: 75, geo: 85, con: 85, sa: 96, note: "Innervisions label. RA #1 DJ four consecutive years. Berghain/Panorama Bar. Sonar, Dekmantel, Time Warp. Gold standard tastemaker." },
  { name: "Ricardo Villalobos", origin: "Chile/Germany", genres: ["Minimal Techno", "Microhouse"], djmag: null, fest: 70, clb: 95, soc: 45, str: 35, rel: 80, geo: 78, con: 82, sa: 98, note: "The purist's GOAT. Berghain. 8+ hour sets. Zero social media presence. Highest possible scene authority alongside Cox." },
].filter(a => !a._skip);

// Calculate overall for each leaderboard artist
const LEADERBOARD_SCORED = LEADERBOARD.map(a => {
  const raw = Math.round(
    a.fest * 0.16 + a.clb * 0.14 + a.str * 0.14 +
    a.geo * 0.12 + a.con * 0.10 + a.soc * 0.10 +
    a.rel * 0.07 + a.sa * 0.17
  );
  // Floor system: elite specialists shouldn't get tanked by weak commercial metrics
  // If your top 3 axes average 90+, you can't drop below 82 (PROVEN)
  // If your top 3 axes average 85+, you can't drop below 78 (BUILDING)
  const allScores = [a.fest, a.clb, a.soc, a.str, a.rel, a.geo, a.con, a.sa];
  const sorted = [...allScores].sort((x, y) => y - x);
  const top3avg = Math.round((sorted[0] + sorted[1] + sorted[2]) / 3);
  let ovr = raw;
  if (top3avg >= 90 && raw < 82) ovr = 82;
  else if (top3avg >= 85 && raw < 78) ovr = 78;
  const tier = getRatingTier(ovr);
  const trajectory = getTrajectory(a.name, a.sa, ovr);
  return { ...a, overall: ovr, rawOverall: raw, top3avg, tierData: tier, trajectory };
}).sort((a, b) => b.overall - a.overall);

const billingData = [
  { year: "2015", billing: 15, gigs: 12 },
  { year: "2016", billing: 20, gigs: 18 },
  { year: "2017", billing: 30, gigs: 25 },
  { year: "2018", billing: 45, gigs: 35 },
  { year: "2019", billing: 60, gigs: 55 },
  { year: "2020", billing: 50, gigs: 15 },
  { year: "2021", billing: 62, gigs: 40 },
  { year: "2022", billing: 75, gigs: 74 },
  { year: "2023", billing: 88, gigs: 93 },
  { year: "2024", billing: 94, gigs: 97 },
  { year: "2025", billing: 97, gigs: 55 },
];

const coArtists = [
  { name: "MK", count: 12, context: "Rhyme Dust collab, shared lineups" },
  { name: "Sonny Fodera", count: 11, context: "Co-headline NA tour, Moving Blind" },
  { name: "Patrick Topping", count: 9, context: "Hï Ibiza 2025 co-resident" },
  { name: "Green Velvet", count: 8, context: "MSG support, shared lineups" },
  { name: "Chris Stussy", count: 7, context: "Wildlands, shared lineups" },
  { name: "Vintage Culture", count: 7, context: "Ultra, CRSSD lineups" },
  { name: "Mau P", count: 6, context: "Club Space, festival circuits" },
  { name: "Hot Since 82", count: 6, context: "Club Space, Ibiza overlap" },
  { name: "Solomun", count: 5, context: "B2B Wool Store Melbourne 2024" },
  { name: "KETTAMA", count: 5, context: "Wildlands, CRSSD lineups" },
];

const releases = [
  { year: 2025, title: "No Room For A Saint", feat: "w/ Nathan Nicholson", note: "F1 Movie Soundtrack" },
  { year: 2025, title: "Forever", feat: "w/ Kid Cudi", note: "Billboard Hot Dance Top 10" },
  { year: 2025, title: "Dreamin'", feat: "ft. Daya", note: "ARIA Club #1" },
  { year: 2024, title: "CAVE", feat: "w/ Tove Lo", note: "" },
  { year: 2024, title: "girl$", feat: "", note: "ARIA Club #1" },
  { year: 2024, title: "Saving Up", feat: "", note: "" },
  { year: 2023, title: "Eat Your Man", feat: "w/ Nelly Furtado", note: "Juno Nominee" },
  { year: 2023, title: "Rhyme Dust", feat: "w/ MK", note: "ARIA Winner, massive crossover" },
  { year: 2022, title: "Miracle Maker", feat: "ft. Clementine Douglas", note: "Global breakout" },
  { year: 2021, title: "Pump the Brakes", feat: "", note: "" },
  { year: 2020, title: "Moving Blind", feat: "w/ Sonny Fodera", note: "" },
  { year: 2019, title: "San Frandisco", feat: "", note: "ARIA Winner 2020" },
  { year: 2018, title: "Take It", feat: "", note: "Breakout hit, ARIA Nominee" },
];

const gigs2025 = [
  { date: "Jan 1", venue: "Wildlands", city: "Brisbane", country: "AU", type: "festival", billing: "headliner" },
  { date: "Jan 3", venue: "Wildlands", city: "Perth", country: "AU", type: "festival", billing: "headliner" },
  { date: "Feb 7", venue: "City Hall", city: "San Jose", country: "US", type: "club", billing: "headliner" },
  { date: "Feb 14", venue: "Ultra Festival", city: "Buenos Aires", country: "AR", type: "festival", billing: "headliner" },
  { date: "Feb 14", venue: "Ame Laroc Festival", city: "Valinhos", country: "BR", type: "festival", billing: "headliner" },
  { date: "Mar 7", venue: "Madison Square Garden", city: "New York", country: "US", type: "arena", billing: "headliner" },
  { date: "Mar 8", venue: "Madison Square Garden", city: "New York", country: "US", type: "arena", billing: "headliner" },
  { date: "Mar 8", venue: "Brooklyn Storehouse", city: "New York", country: "US", type: "club", billing: "headliner" },
  { date: "Mar 14", venue: "LIV Las Vegas", city: "Las Vegas", country: "US", type: "club", billing: "headliner" },
  { date: "Mar 14", venue: "CRSSD Festival", city: "San Diego", country: "US", type: "festival", billing: "headliner" },
  { date: "Mar 28", venue: "Ultra Miami", city: "Miami", country: "US", type: "festival", billing: "headliner" },
  { date: "Jul 2", venue: "Hï Ibiza (Residency Start)", city: "Ibiza", country: "ES", type: "club", billing: "resident" },
  { date: "Jul 20", venue: "Brunch Electronik", city: "Barcelona", country: "ES", type: "festival", billing: "headliner" },
  { date: "Sep 20", venue: "LIV Beach", city: "Las Vegas", country: "US", type: "club", billing: "headliner" },
  { date: "Sep 21", venue: "Portola Music Festival", city: "San Francisco", country: "US", type: "festival", billing: "headliner" },
  { date: "Oct 3", venue: "Alexandra Palace", city: "London", country: "GB", type: "venue", billing: "headliner" },
  { date: "Oct 10", venue: "Depot Mayfield", city: "Manchester", country: "GB", type: "venue", billing: "headliner" },
  { date: "Oct 11", venue: "Kaufleuten Club", city: "Zürich", country: "CH", type: "club", billing: "headliner" },
  { date: "Oct 18", venue: "Mana Wynwood / Club Space", city: "Miami", country: "US", type: "club", billing: "headliner" },
  { date: "Oct 31", venue: "Germania Insurance Amphitheater", city: "Austin", country: "US", type: "venue", billing: "headliner" },
  { date: "Nov 1", venue: "Dos Equis Pavilion", city: "Dallas", country: "US", type: "venue", billing: "headliner" },
  { date: "Nov 9", venue: "Tinker Field", city: "Orlando", country: "US", type: "venue", billing: "headliner" },
  { date: "Nov 22", venue: "TBA (w/ ODESZA, Duke Dumont)", city: "Phoenix", country: "US", type: "festival", billing: "headliner" },
  { date: "Dec 20", venue: "Allianz Stadium", city: "Sydney", country: "AU", type: "stadium", billing: "headliner" },
  { date: "Dec 31", venue: "Beyond The Valley", city: "Geelong", country: "AU", type: "festival", billing: "headliner" },
];

const gigs2026 = [
  { date: "Feb 27", venue: "Electric Avenue Festival", city: "Christchurch", country: "NZ", type: "festival", billing: "headliner" },
  { date: "Mar 14", venue: "LIV Las Vegas", city: "Las Vegas", country: "US", type: "club", billing: "headliner" },
  { date: "Mar 14", venue: "CRSSD Festival", city: "San Diego", country: "US", type: "festival", billing: "headliner" },
  { date: "Apr 3", venue: "DGTL", city: "Amsterdam", country: "NL", type: "festival", billing: "headliner" },
  { date: "Apr 17", venue: "Breakaway Music Festival", city: "Tampa", country: "US", type: "festival", billing: "headliner" },
  { date: "May 23", venue: "Movement Music Festival", city: "Detroit", country: "US", type: "festival", billing: "headliner" },
  { date: "Jun 6", venue: "We Love Green", city: "Paris", country: "FR", type: "festival", billing: "headliner" },
  { date: "Jul 4", venue: "FVDED In The Park", city: "Surrey", country: "CA", type: "festival", billing: "headliner" },
  { date: "Aug 8", venue: "Badlands Music Festival", city: "Calgary", country: "CA", type: "festival", billing: "headliner" },
  { date: "Aug 14", venue: "Slottsfjell", city: "Tønsberg", country: "NO", type: "festival", billing: "headliner" },
  { date: "Aug 20", venue: "Sziget Festival", city: "Budapest", country: "HU", type: "festival", billing: "TBA" },
];

// ── Map data with venue details for tooltips ──
const gigLocations = [
  { lat: -27.47, lng: 153.02, city: "Brisbane", country: "AU", count: 1, venues: [
    { name: "Wildlands Festival", date: "Jan 1, 2025", billing: "Headliner", notable: "NYD festival opener" }
  ]},
  { lat: -31.95, lng: 115.86, city: "Perth", country: "AU", count: 1, venues: [
    { name: "Wildlands Festival", date: "Jan 3, 2025", billing: "Headliner" }
  ]},
  { lat: 37.33, lng: -121.89, city: "San Jose", country: "US", count: 1, venues: [
    { name: "City Hall", date: "Feb 7, 2025", billing: "Headliner", notable: "Club show" }
  ]},
  { lat: -34.60, lng: -58.38, city: "Buenos Aires", country: "AR", count: 1, venues: [
    { name: "Ultra Festival", date: "Feb 14, 2025", billing: "Headliner" }
  ]},
  { lat: -22.97, lng: -46.99, city: "Valinhos", country: "BR", count: 1, venues: [
    { name: "Ame Laroc Festival", date: "Feb 14, 2025", billing: "Headliner" }
  ]},
  { lat: 40.75, lng: -73.99, city: "New York", country: "US", count: 3, venues: [
    { name: "Madison Square Garden", date: "Mar 7, 2025", billing: "Headliner", notable: "SOLD OUT — w/ Green Velvet, AYYBO" },
    { name: "Madison Square Garden", date: "Mar 8, 2025", billing: "Headliner", notable: "SOLD OUT — 2nd night added due to demand" },
    { name: "Brooklyn Storehouse", date: "Mar 8, 2025", billing: "Headliner", notable: "Good Fortune afterparty, SOLD OUT" },
  ]},
  { lat: 36.17, lng: -115.14, city: "Las Vegas", country: "US", count: 4, venues: [
    { name: "LIV Las Vegas", date: "Mar 14, 2025", billing: "Headliner" },
    { name: "LIV Beach", date: "Sep 20, 2025", billing: "Headliner" },
    { name: "LIV Nightclub", date: "Oct 17, 2025", billing: "Headliner" },
    { name: "LIV Beach", date: "Nov 20, 2025", billing: "Headliner", notable: "LIV regular — 57 career plays in Vegas" },
  ]},
  { lat: 32.72, lng: -117.16, city: "San Diego", country: "US", count: 2, venues: [
    { name: "CRSSD Festival", date: "Mar 14, 2025", billing: "Headliner" },
    { name: "CRSSD Festival", date: "Mar 14, 2026", billing: "Headliner", notable: "2nd consecutive year" },
  ]},
  { lat: 25.76, lng: -80.19, city: "Miami", country: "US", count: 2, venues: [
    { name: "Ultra Miami", date: "Mar 28, 2025", billing: "Headliner", notable: "Mainstage headline set" },
    { name: "Club Space / Mana Wynwood", date: "Oct 18, 2025", billing: "Headliner", notable: "w/ Mau P, Hot Since 82, FCUKERS" },
  ]},
  { lat: 38.97, lng: 1.43, city: "Ibiza", country: "ES", count: 10, venues: [
    { name: "Hï Ibiza", date: "Jul 2 – Sep 3, 2025", billing: "Resident", notable: "10-WEEK RESIDENCY — w/ Patrick Topping, Nic Fanciulli, Layton Giordani" },
  ]},
  { lat: 41.39, lng: 2.17, city: "Barcelona", country: "ES", count: 1, venues: [
    { name: "Brunch Electronik", date: "Jul 20, 2025", billing: "Headliner", notable: "w/ salute, 2ManyDJs" },
  ]},
  { lat: 37.78, lng: -122.41, city: "San Francisco", country: "US", count: 1, venues: [
    { name: "Portola Music Festival", date: "Sep 21, 2025", billing: "Headliner" },
  ]},
  { lat: 51.52, lng: -0.08, city: "London", country: "GB", count: 1, venues: [
    { name: "Alexandra Palace", date: "Oct 3, 2025", billing: "Headliner", notable: "Only UK headline show of 2025" },
  ]},
  { lat: 53.48, lng: -2.24, city: "Manchester", country: "GB", count: 1, venues: [
    { name: "Depot Mayfield", date: "Oct 10, 2025", billing: "Headliner", notable: "Only non-London UK show" },
  ]},
  { lat: 47.37, lng: 8.54, city: "Zürich", country: "CH", count: 1, venues: [
    { name: "Kaufleuten Club", date: "Oct 11, 2025", billing: "Headliner" },
  ]},
  { lat: 30.27, lng: -97.74, city: "Austin", country: "US", count: 1, venues: [
    { name: "Germania Insurance Amphitheater", date: "Oct 31, 2025", billing: "Headliner", notable: "Halloween show" },
  ]},
  { lat: 32.78, lng: -96.80, city: "Dallas", country: "US", count: 1, venues: [
    { name: "Dos Equis Pavilion", date: "Nov 1, 2025", billing: "Headliner" },
  ]},
  { lat: 28.54, lng: -81.38, city: "Orlando", country: "US", count: 1, venues: [
    { name: "Tinker Field", date: "Nov 9, 2025", billing: "Headliner" },
  ]},
  { lat: 33.45, lng: -112.07, city: "Phoenix", country: "US", count: 1, venues: [
    { name: "Steele Indian School Park", date: "Nov 22, 2025", billing: "Headliner", notable: "w/ ODESZA, Duke Dumont, Jungle" },
  ]},
  { lat: -33.87, lng: 151.21, city: "Sydney", country: "AU", count: 1, venues: [
    { name: "Allianz Stadium", date: "Dec 20, 2025", billing: "Headliner", notable: "FIRST EVER STADIUM SHOW — largest headline event of career" },
  ]},
  { lat: -38.15, lng: 144.36, city: "Geelong", country: "AU", count: 1, venues: [
    { name: "Beyond The Valley", date: "Dec 31, 2025", billing: "Headliner" },
  ]},
  { lat: -43.53, lng: 172.64, city: "Christchurch", country: "NZ", count: 1, venues: [
    { name: "Electric Avenue Festival", date: "Feb 27, 2026", billing: "Headliner" },
  ]},
  { lat: 52.37, lng: 4.90, city: "Amsterdam", country: "NL", count: 1, venues: [
    { name: "DGTL", date: "Apr 3, 2026", billing: "Headliner" },
  ]},
  { lat: 27.95, lng: -82.46, city: "Tampa", country: "US", count: 1, venues: [
    { name: "Breakaway Music Festival", date: "Apr 17, 2026", billing: "Headliner", notable: "w/ Chris Lorenzo, Champaign Drip" },
  ]},
  { lat: 42.33, lng: -83.05, city: "Detroit", country: "US", count: 1, venues: [
    { name: "Movement Music Festival", date: "May 23, 2026", billing: "Headliner", notable: "Iconic techno festival" },
  ]},
  { lat: 48.86, lng: 2.35, city: "Paris", country: "FR", count: 1, venues: [
    { name: "We Love Green", date: "Jun 6, 2026", billing: "Headliner" },
  ]},
  { lat: 49.19, lng: -122.85, city: "Surrey", country: "CA", count: 1, venues: [
    { name: "FVDED In The Park", date: "Jul 4, 2026", billing: "Headliner" },
  ]},
  { lat: 51.05, lng: -114.07, city: "Calgary", country: "CA", count: 1, venues: [
    { name: "Badlands Music Festival", date: "Aug 8, 2026", billing: "Headliner" },
  ]},
  { lat: 59.27, lng: 10.41, city: "Tønsberg", country: "NO", count: 1, venues: [
    { name: "Slottsfjell", date: "Aug 14, 2026", billing: "Headliner" },
  ]},
  { lat: 47.50, lng: 19.04, city: "Budapest", country: "HU", count: 1, venues: [
    { name: "Sziget Festival", date: "Aug 20, 2026", billing: "TBA" },
  ]},
];

// ── Components ─────────────────────────────────

function AnimatedNumber({ value, suffix = "", prefix = "", delay = 0 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = typeof value === "string" ? parseInt(value) || 0 : value;
    if (num === 0) { setDisplay(value); return; }
    const timer = setTimeout(() => {
      let start = 0;
      const step = Math.max(1, Math.floor(num / 30));
      const interval = setInterval(() => {
        start += step;
        if (start >= num) { setDisplay(num); clearInterval(interval); }
        else setDisplay(start);
      }, 25);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return <span>{prefix}{typeof value === "string" ? value : display}{suffix}</span>;
}

function StatCard({ label, value, sublabel, accent = false }) {
  return (
    <div style={{
      background: accent ? COLORS.accentGlow : COLORS.surface,
      border: `1px solid ${accent ? COLORS.accent : COLORS.border}`,
      borderRadius: 8,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ? COLORS.accent : COLORS.text, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
        {value}
      </div>
      {sublabel && <div style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{sublabel}</div>}
    </div>
  );
}

function GigDot({ gig, x, y, size = 6 }) {
  const colors = {
    festival: COLORS.accent,
    club: COLORS.blue,
    arena: COLORS.yellow,
    stadium: COLORS.yellow,
    venue: COLORS.green,
    resident: COLORS.purple,
  };
  const color = colors[gig.type] || COLORS.accent;
  return (
    <div style={{
      position: "absolute",
      left: x - size/2,
      top: y - size/2,
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 ${size * 2}px ${color}`,
      opacity: 0.9,
      cursor: "pointer",
    }} title={`${gig.city} — ${gig.venue}`} />
  );
}

function WorldMap() {
  const width = 800;
  const height = 400;
  const [paths, setPaths] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  
  const project = (lat, lng) => {
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  // Convert GeoJSON coordinates to SVG path
  const coordsToPath = (coords) => {
    return coords.map((ring) => {
      const points = ring.map(([lng, lat]) => {
        const [x, y] = project(lat, lng);
        return `${x},${y}`;
      });
      return `M${points.join('L')}Z`;
    }).join(' ');
  };

  useEffect(() => {
    // Load simplified world GeoJSON (110m resolution — lightweight)
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(topology => {
        // TopoJSON → GeoJSON conversion (inline, no library needed)
        const geometries = topology.objects.countries.geometries;
        const arcs = topology.arcs;
        const transform = topology.transform;
        
        // Decode arcs
        const decodedArcs = arcs.map(arc => {
          let x = 0, y = 0;
          return arc.map(([dx, dy]) => {
            x += dx;
            y += dy;
            return [
              x * transform.scale[0] + transform.translate[0],
              y * transform.scale[1] + transform.translate[1]
            ];
          });
        });

        // Convert arc indices to coordinates
        const arcToCoords = (arcIdx) => {
          if (arcIdx >= 0) return decodedArcs[arcIdx].slice();
          return decodedArcs[~arcIdx].slice().reverse();
        };

        const svgPaths = [];
        geometries.forEach(geom => {
          let rings = [];
          if (geom.type === 'Polygon') {
            rings = geom.arcs.map(ring => ring.flatMap(arcToCoords));
          } else if (geom.type === 'MultiPolygon') {
            geom.arcs.forEach(polygon => {
              polygon.forEach(ring => {
                rings.push(ring.flatMap(arcToCoords));
              });
            });
          }
          rings.forEach(ring => {
            const d = ring.map(([lng, lat], i) => {
              const [x, y] = project(lat, lng);
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join('') + 'Z';
            svgPaths.push(d);
          });
        });
        setPaths(svgPaths);
      })
      .catch(() => {
        // Fallback: no outlines if fetch fails
        setPaths([]);
      });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "2/1", background: COLORS.surface, borderRadius: 12, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0 }}>
        {/* Grid lines */}
        {[-60, -30, 0, 30, 60].map(lat => {
          const [, y] = project(lat, 0);
          return <line key={`lat${lat}`} x1={0} y1={y} x2={width} y2={y} stroke={COLORS.border} strokeWidth={0.3} strokeDasharray="2,4" />;
        })}
        {[-120, -60, 0, 60, 120].map(lng => {
          const [x] = project(0, lng);
          return <line key={`lng${lng}`} x1={x} y1={0} x2={x} y2={height} stroke={COLORS.border} strokeWidth={0.3} strokeDasharray="2,4" />;
        })}
        
        {/* Country outlines from GeoJSON */}
        {paths.map((d, i) => (
          <path key={i} d={d} fill={`${COLORS.textMuted}08`} stroke={COLORS.textDim} strokeWidth={0.4} strokeOpacity={0.5} />
        ))}

        {/* Gig dots */}
        {gigLocations.map((loc, i) => {
          const [x, y] = project(loc.lat, loc.lng);
          const r = Math.max(3, Math.min(loc.count * 1.5, 12));
          const isIbiza = loc.city === "Ibiza";
          const isVegas = loc.city === "Las Vegas";
          const dotColor = isIbiza ? COLORS.purple : isVegas ? COLORS.yellow : COLORS.accent;
          const isHovered = tooltip && tooltip.city === loc.city;
          return (
            <g key={i}
              onMouseEnter={(e) => {
                const svgRect = e.currentTarget.closest('svg').getBoundingClientRect();
                const pctX = x / width;
                const pctY = y / height;
                setTooltip({
                  ...loc,
                  screenX: pctX * svgRect.width,
                  screenY: pctY * svgRect.height,
                  anchorRight: pctX > 0.6,
                  anchorBottom: pctY > 0.6,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Pulse ring on hover */}
              {isHovered && (
                <circle cx={x} cy={y} r={r + 10} fill="none" stroke={dotColor} strokeWidth={1} opacity={0.4}>
                  <animate attributeName="r" from={r + 6} to={r + 18} dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="1s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={x} cy={y} r={r + 4} fill={dotColor} opacity={isHovered ? 0.3 : 0.15} />
              <circle cx={x} cy={y} r={isHovered ? r + 2 : r} fill={dotColor} opacity={isHovered ? 1 : 0.8} style={{ transition: "r 0.2s" }} />
              {(loc.count > 2 || isIbiza) && (
                <text x={x} y={y - r - 6} fill={isHovered ? COLORS.text : COLORS.textMuted} fontSize={isHovered ? 9 : 8} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight={isHovered ? 700 : 400}>
                  {loc.city} ({loc.count})
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip overlay */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.anchorRight ? "auto" : tooltip.screenX + 16,
          right: tooltip.anchorRight ? `calc(100% - ${tooltip.screenX}px + 16px)` : "auto",
          top: tooltip.anchorBottom ? "auto" : tooltip.screenY,
          bottom: tooltip.anchorBottom ? `calc(100% - ${tooltip.screenY}px)` : "auto",
          background: "rgba(10, 10, 10, 0.95)",
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: 10,
          padding: "14px 16px",
          minWidth: 260,
          maxWidth: 320,
          zIndex: 50,
          backdropFilter: "blur(12px)",
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${COLORS.border}`,
          pointerEvents: "none",
          animation: "fadeInUp 0.15s ease-out",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, fontFamily: "'Space Grotesk', sans-serif" }}>
                {tooltip.city}
              </div>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim }}>
                {tooltip.country}
              </div>
            </div>
            <div style={{
              fontSize: 18, fontWeight: 900, color: COLORS.accent,
              fontFamily: "'Space Grotesk', sans-serif",
              background: COLORS.accentGlow,
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {tooltip.count}x
            </div>
          </div>

          {/* Venue list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tooltip.venues.map((v, vi) => (
              <div key={vi} style={{
                padding: "8px 10px",
                background: COLORS.surface,
                borderRadius: 6,
                borderLeft: `3px solid ${v.notable ? COLORS.accent : COLORS.border}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2 }}>
                  {v.name}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  <span style={{ color: COLORS.textMuted }}>{v.date}</span>
                  <span style={{
                    color: v.billing === "Headliner" ? COLORS.accent : v.billing === "Resident" ? COLORS.purple : COLORS.textMuted,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: 8,
                    letterSpacing: "0.08em",
                  }}>{v.billing}</span>
                </div>
                {v.notable && (
                  <div style={{
                    fontSize: 10, color: COLORS.accentSoft, fontFamily: "'JetBrains Mono', monospace",
                    marginTop: 4, lineHeight: 1.3,
                  }}>
                    {v.notable}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 16, background: "rgba(10,10,10,0.85)", padding: "6px 12px", borderRadius: 6, backdropFilter: "blur(4px)" }}>
        {[
          { color: COLORS.accent, label: "Festival / Venue" },
          { color: COLORS.purple, label: "Residency" },
          { color: COLORS.yellow, label: "Major (Arena/LV)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoArtistBar({ artist, maxCount }) {
  const pct = (artist.count / maxCount) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <div style={{ width: 120, fontSize: 13, fontWeight: 600, color: COLORS.text, fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        {artist.name}
      </div>
      <div style={{ flex: 1, height: 20, background: COLORS.surface, borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentSoft})`,
          borderRadius: 4,
          transition: "width 1s ease-out",
        }} />
        <div style={{
          position: "absolute", top: 0, left: 8, height: "100%", display: "flex", alignItems: "center",
          fontSize: 10, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700
        }}>
          {artist.count} shared lineups
        </div>
      </div>
      <div style={{ width: 200, fontSize: 10, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
        {artist.context}
      </div>
    </div>
  );
}

// ── Tab System ─────────────────────────────────
const TABS = ["Overview", "Gigs", "Releases", "Network", "Leaderboard"];

// ── Main App ───────────────────────────────────
export default function HeadliningProfile() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [gigFilter, setGigFilter] = useState("all");
  const [compareArtist, setCompareArtist] = useState(null);

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.text,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.borderLight}; border-radius: 3px; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideIn { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      {/* ── Header / Nav ── */}
      <header style={{
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(12px)",
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.accent, letterSpacing: "-0.02em" }}>headlin</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.02em" }}>.ing</span>
          <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", marginLeft: 8, padding: "2px 6px", border: `1px solid ${COLORS.border}`, borderRadius: 4 }}>PROTOTYPE v0.1</span>
        </div>
        <div style={{ display: "flex", gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
          <span style={{ color: COLORS.textDim }}>search artists</span>
          <span style={{ color: COLORS.borderLight }}>|</span>
          <span style={{ color: COLORS.textDim }}>compare</span>
          <span style={{ color: COLORS.borderLight }}>|</span>
          <span style={{ color: COLORS.textDim }}>leaderboards</span>
        </div>
      </header>

      {/* ── Artist Hero ── */}
      <section style={{
        padding: "32px 24px 24px",
        borderBottom: `1px solid ${COLORS.border}`,
        animation: "fadeInUp 0.6s ease-out",
      }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Avatar placeholder */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 120,
              height: 120,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.accent}22, ${COLORS.purple}22)`,
              border: `2px solid ${COLORS.accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
              color: COLORS.accent,
            }}>
              DD
            </div>
            {/* Overall Rating Badge */}
            <div style={{
              position: "absolute",
              top: -14,
              right: -14,
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: COLORS.bg,
              border: `3px solid ${ratingTier.color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 20px ${ratingTier.color}44, 0 0 40px ${ratingTier.color}22`,
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: ratingTier.color, lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{OVERALL_RATING}</span>
              <span style={{ fontSize: 6, fontWeight: 700, color: ratingTier.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>{ratingTier.label}</span>
            </div>
          </div>
          
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {ARTIST.name}
              </h1>
              <span style={{
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                color: COLORS.green,
                background: COLORS.greenDim,
                padding: "3px 8px",
                borderRadius: 4,
                fontWeight: 600,
                animation: "pulse 2s infinite",
              }}>● TOURING</span>
              <span style={{
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#FF6B3D",
                background: "rgba(255, 107, 61, 0.12)",
                padding: "3px 8px",
                borderRadius: 4,
                fontWeight: 600,
              }}>🔥 RISING</span>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>
              {ARTIST.realName} · {ARTIST.origin} · b. {ARTIST.born}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {ARTIST.genres.map(g => (
                <span key={g} style={{
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`,
                  padding: "3px 10px",
                  borderRadius: 20,
                }}>
                  {g}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim }}>
              <span>IG <span style={{ color: COLORS.text, fontWeight: 600 }}>{ARTIST.instagram}</span></span>
              <span>Spotify <span style={{ color: COLORS.text, fontWeight: 600 }}>{ARTIST.spotify}</span></span>
              <span>Streams <span style={{ color: COLORS.text, fontWeight: 600 }}>{ARTIST.totalStreams}</span></span>
              <span>ARIA <span style={{ color: COLORS.yellow, fontWeight: 600 }}>{ARTIST.aria}</span></span>
              <span>Grammy <span style={{ color: COLORS.yellow, fontWeight: 600 }}>{ARTIST.grammy}</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <nav style={{
        padding: "0 24px",
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex",
        gap: 0,
        position: "sticky",
        top: 49,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(12px)",
        zIndex: 99,
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "14px 20px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? COLORS.accent : COLORS.textMuted,
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? `2px solid ${COLORS.accent}` : "2px solid transparent",
              cursor: "pointer",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              transition: "all 0.2s",
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        
        {activeTab === "Overview" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
            {/* Key Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
              <StatCard label="2025 Gigs" value={STATS_2025.totalGigs} sublabel="across 12 countries" accent />
              <StatCard label="Career Gigs" value="565+" sublabel="since 2015" />
              <StatCard label="Festivals '25" value={STATS_2025.festivals} sublabel="inc. Ultra, Portola, CRSSD" />
              <StatCard label="Countries '25" value={STATS_2025.countries} sublabel="5 continents" />
              <StatCard label="Sold Out" value={STATS_2025.soldOutShows} sublabel="inc. 2x MSG" />
              <StatCard label="Ibiza Residency" value="10 wks" sublabel="Hï Ibiza w/ Patrick Topping" />
            </div>

            {/* Spider Chart + Billing Trajectory */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
              {/* Spider with Compare */}
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Artist DNA {compareArtist && `vs ${compareArtist}`}
                  </h3>
                  {/* Compare selector */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {compareArtist && (
                      <button onClick={() => setCompareArtist(null)} style={{
                        padding: "3px 8px", fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                        background: COLORS.bg, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`,
                        borderRadius: 4, cursor: "pointer",
                      }}>CLEAR</button>
                    )}
                    <select
                      value={compareArtist || ""}
                      onChange={(e) => setCompareArtist(e.target.value || null)}
                      style={{
                        padding: "3px 8px", fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                        background: COLORS.bg, color: COLORS.accent, border: `1px solid ${COLORS.accent}`,
                        borderRadius: 4, cursor: "pointer", outline: "none",
                      }}
                    >
                      <option value="">+ COMPARE</option>
                      {Object.keys(COMPARE_ARTISTS).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Merge data for overlapping radar */}
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={compareArtist ? spiderData.map((s, i) => ({
                    ...s,
                    compare: COMPARE_ARTISTS[compareArtist].data[i].value,
                  })) : spiderData}>
                    <PolarGrid stroke={COLORS.border} />
                    <PolarAngleAxis dataKey="stat" tick={{ fill: COLORS.textMuted, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} />
                    <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                    <Radar name="Dom Dolla" dataKey="value" stroke={COLORS.accent} fill={COLORS.accent} fillOpacity={0.12} strokeWidth={2} dot={{ r: 3, fill: COLORS.accent }} />
                    {compareArtist && (
                      <Radar name={compareArtist} dataKey="compare" stroke={COMPARE_ARTISTS[compareArtist].color} fill={COMPARE_ARTISTS[compareArtist].color} fillOpacity={0.08} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: COMPARE_ARTISTS[compareArtist].color }} />
                    )}
                  </RadarChart>
                </ResponsiveContainer>

                {/* Compare info or default description */}
                {compareArtist ? (
                  <div style={{ marginTop: 8 }}>
                    {/* Legend */}
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 16, height: 2, background: COLORS.accent }} />
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.accent, fontWeight: 700 }}>Dom Dolla</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: COLORS.accent }}>{OVERALL_RATING}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 16, height: 2, background: COMPARE_ARTISTS[compareArtist].color, opacity: 0.8 }} />
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COMPARE_ARTISTS[compareArtist].color, fontWeight: 700 }}>{compareArtist}</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: COMPARE_ARTISTS[compareArtist].color }}>{COMPARE_ARTISTS[compareArtist].overall}</span>
                      </div>
                    </div>
                    {/* Compare artist note */}
                    <div style={{
                      padding: "8px 12px", background: `${COMPARE_ARTISTS[compareArtist].color}10`,
                      borderLeft: `3px solid ${COMPARE_ARTISTS[compareArtist].color}`,
                      borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                      color: COLORS.textMuted, lineHeight: 1.4,
                    }}>
                      <span style={{ color: COMPARE_ARTISTS[compareArtist].color, fontWeight: 700 }}>{compareArtist}</span> — {COMPARE_ARTISTS[compareArtist].origin} — {COMPARE_ARTISTS[compareArtist].genres.join(", ")}
                      <br/><span style={{ color: COLORS.textDim }}>{COMPARE_ARTISTS[compareArtist].sceneNote}</span>
                    </div>
                    {/* Side by side stat bars */}
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                      {spiderData.map((s, i) => {
                        const cv = COMPARE_ARTISTS[compareArtist].data[i].value;
                        const diff = s.value - cv;
                        return (
                          <div key={s.stat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 65, fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim, textAlign: "right" }}>{s.stat}</span>
                            <div style={{ flex: 1, height: 8, background: COLORS.bg, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                              <div style={{ position: "absolute", width: `${s.value}%`, height: "50%", top: 0, background: COLORS.accent, borderRadius: "4px 4px 0 0", opacity: 0.8 }} />
                              <div style={{ position: "absolute", width: `${cv}%`, height: "50%", bottom: 0, background: COMPARE_ARTISTS[compareArtist].color, borderRadius: "0 0 4px 4px", opacity: 0.8 }} />
                            </div>
                            <span style={{ width: 20, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: COLORS.accent, fontWeight: 700, textAlign: "right" }}>{s.value}</span>
                            <span style={{ width: 20, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: COMPARE_ARTISTS[compareArtist].color, fontWeight: 700, textAlign: "right" }}>{cv}</span>
                            <span style={{
                              width: 28, fontSize: 8, fontFamily: "'JetBrains Mono', monospace", textAlign: "right",
                              color: diff > 0 ? COLORS.green : diff < 0 ? "#FF5252" : COLORS.textDim,
                              fontWeight: 700,
                            }}>{diff > 0 ? `+${diff}` : diff}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", marginTop: 8 }}>
                      Festival monster with massive streaming crossover. Hï Ibiza residency, LIV regular, Club Space — elite club presence.
                    </div>
                    {/* Rating Breakdown */}
                    <div style={{ marginTop: 16, padding: "12px 0", borderTop: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: "50%",
                          border: `2px solid ${ratingTier.color}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 0 12px ${ratingTier.color}33`,
                        }}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: ratingTier.color, fontFamily: "'Space Grotesk', sans-serif" }}>{OVERALL_RATING}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: ratingTier.color }}>{ratingTier.label}</div>
                          <div style={{ fontSize: 8, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>OVERALL RATING</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {spiderData.map(s => (
                          <div key={s.stat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 70, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim, textAlign: "right" }}>{s.stat}</span>
                            <div style={{ flex: 1, height: 6, background: COLORS.bg, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                width: `${s.value}%`, height: "100%", borderRadius: 3,
                                background: s.value >= 90 ? COLORS.accent : s.value >= 80 ? COLORS.accentSoft : COLORS.borderLight,
                              }} />
                            </div>
                            <span style={{ width: 24, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: s.value >= 90 ? COLORS.accent : COLORS.textMuted, fontWeight: 700 }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Billing Trajectory */}
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                  Career Trajectory
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={billingData}>
                    <defs>
                      <linearGradient id="billingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tick={{ fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                    <YAxis tick={{ fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} domain={[0, 100]} label={{ value: "Billing Score", angle: -90, position: "insideLeft", style: { fill: COLORS.textDim, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" } }} />
                    <Tooltip
                      contentStyle={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                      labelStyle={{ color: COLORS.text }}
                      itemStyle={{ color: COLORS.accent }}
                    />
                    <Area type="monotone" dataKey="billing" stroke={COLORS.accent} fill="url(#billingGrad)" strokeWidth={2} dot={{ r: 3, fill: COLORS.accent }} name="Billing Score" />
                    <Line type="monotone" dataKey="gigs" stroke={COLORS.blue} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Gig Count" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", marginTop: 8 }}>
                  Billing score (0-100) based on avg lineup position. COVID dip in 2020, then exponential rise to near-permanent headliner status.
                </div>
              </div>
            </div>

            {/* Global Map */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                2025–2026 Global Footprint
              </h3>
              <WorldMap />
            </div>

            {/* Top Cities */}
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 32 }}>
              <h3 style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                Most Played Cities (Career)
              </h3>
              <div style={{ display: "flex", gap: 12 }}>
                {CAREER_STATS.topCities.map((c, i) => (
                  <div key={c.city} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: i === 0 ? COLORS.accent : COLORS.text }}>{c.count}x</div>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted }}>{c.city}</div>
                    <div style={{ marginTop: 8, height: 4, background: COLORS.bg, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${(c.count / 57) * 100}%`, height: "100%", background: i === 0 ? COLORS.accent : COLORS.borderLight, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Gigs" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["all", "2025", "2026"].map(f => (
                <button key={f} onClick={() => setGigFilter(f)} style={{
                  padding: "6px 16px",
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: gigFilter === f ? COLORS.accent : "transparent",
                  color: gigFilter === f ? COLORS.bg : COLORS.textMuted,
                  border: `1px solid ${gigFilter === f ? COLORS.accent : COLORS.border}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}>
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>

            {(gigFilter === "all" || gigFilter === "2025") && (
              <>
                <h3 style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: COLORS.accent, marginBottom: 12, fontWeight: 700 }}>2025 ({gigs2025.length} shows)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 24 }}>
                  {gigs2025.map((gig, i) => {
                    const typeColors = { festival: COLORS.accent, club: COLORS.blue, arena: COLORS.yellow, stadium: COLORS.yellow, venue: COLORS.green };
                    const isPast = true; // simplified: all 2025 is past since we're in Feb 2026
                    return (
                      <div key={i} style={{
                        display: "grid",
                        gridTemplateColumns: "80px 1fr 160px 100px 80px",
                        alignItems: "center",
                        padding: "10px 16px",
                        background: i % 2 === 0 ? COLORS.surface : "transparent",
                        borderRadius: 6,
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        opacity: isPast ? 0.7 : 1,
                        animation: `slideIn 0.3s ease-out ${i * 0.02}s both`,
                      }}>
                        <span style={{ color: COLORS.textDim }}>{gig.date}</span>
                        <span style={{ color: COLORS.text, fontWeight: 600 }}>{gig.venue}</span>
                        <span style={{ color: COLORS.textMuted }}>{gig.city}, {gig.country}</span>
                        <span style={{
                          color: typeColors[gig.type] || COLORS.textMuted,
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}>{gig.type}</span>
                        <span style={{
                          color: gig.billing === "headliner" ? COLORS.accent : gig.billing === "resident" ? COLORS.purple : COLORS.textMuted,
                          fontSize: 9,
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}>{gig.billing}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {(gigFilter === "all" || gigFilter === "2026") && (
              <>
                <h3 style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: COLORS.green, marginBottom: 12, fontWeight: 700 }}>2026 Announced ({gigs2026.length} shows)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {gigs2026.map((gig, i) => {
                    const typeColors = { festival: COLORS.accent, club: COLORS.blue };
                    return (
                      <div key={i} style={{
                        display: "grid",
                        gridTemplateColumns: "80px 1fr 160px 100px 80px",
                        alignItems: "center",
                        padding: "10px 16px",
                        background: i % 2 === 0 ? COLORS.surface : "transparent",
                        borderRadius: 6,
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        animation: `slideIn 0.3s ease-out ${i * 0.02}s both`,
                      }}>
                        <span style={{ color: COLORS.green }}>{gig.date}</span>
                        <span style={{ color: COLORS.text, fontWeight: 600 }}>{gig.venue}</span>
                        <span style={{ color: COLORS.textMuted }}>{gig.city}, {gig.country}</span>
                        <span style={{ color: typeColors[gig.type] || COLORS.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{gig.type}</span>
                        <span style={{ color: COLORS.accent, fontSize: 9, textTransform: "uppercase", fontWeight: 700 }}>{gig.billing}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "Releases" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
            <h3 style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
              Discography Timeline
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {releases.map((r, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 200px 1fr",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: i % 2 === 0 ? COLORS.surface : "transparent",
                  borderRadius: 6,
                  borderLeft: r.year >= 2025 ? `3px solid ${COLORS.accent}` : `3px solid ${COLORS.border}`,
                  animation: `slideIn 0.3s ease-out ${i * 0.05}s both`,
                }}>
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: r.year >= 2025 ? COLORS.accent : COLORS.textDim, fontWeight: 700 }}>{r.year}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>"{r.title}"</span>
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted }}>{r.feat}</span>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: r.note.includes("ARIA") || r.note.includes("Grammy") || r.note.includes("Billboard") ? COLORS.yellow : COLORS.textDim }}>
                    {r.note}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: 16, background: COLORS.surface, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted }}>
                <span style={{ color: COLORS.text, fontWeight: 700 }}>47</span> total singles · <span style={{ color: COLORS.text, fontWeight: 700 }}>11x</span> ARIA Club Chart #1 · <span style={{ color: COLORS.text, fontWeight: 700 }}>3x</span> ARIA Winner · <span style={{ color: COLORS.text, fontWeight: 700 }}>1x</span> Grammy Nom · <span style={{ color: COLORS.text, fontWeight: 700 }}>1x</span> Juno Nom · Label: {ARTIST.label}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Network" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
            <h3 style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
              Top Co-Artists (Shared Lineups & Collabs)
            </h3>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
              {coArtists.map((a, i) => (
                <CoArtistBar key={a.name} artist={a} maxCount={coArtists[0].count} />
              ))}
            </div>

            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
                Notable B2Bs & Collabs
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { who: "Solomun", what: "B2B at The Wool Store Melbourne", when: "2024" },
                  { who: "Sonny Fodera", what: "Co-headline NA Tour + Moving Blind", when: "2020–2022" },
                  { who: "MK", what: "Rhyme Dust collab — massive crossover hit", when: "2023" },
                  { who: "Nelly Furtado", what: "Eat Your Man — Juno nominated", when: "2023" },
                  { who: "Kid Cudi", what: "Forever — Billboard Hot Dance Top 10", when: "2025" },
                  { who: "Tove Lo", what: "CAVE — dark club anthem", when: "2024" },
                  { who: "Patrick Topping", what: "Hï Ibiza 2025 co-resident (10 wks)", when: "2025" },
                  { who: "Green Velvet", what: "MSG support act, shared lineups", when: "2025" },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: 16,
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    animation: `slideIn 0.3s ease-out ${i * 0.05}s both`,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{item.who}</div>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, marginBottom: 2 }}>{item.what}</div>
                    <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim }}>{item.when}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Leaderboard Tab ── */}
        {activeTab === "Leaderboard" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 }}>
                  Global Artist Rankings
                </h2>
                <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim }}>
                  {LEADERBOARD_SCORED.length} artists · scored across 8 axes · weighted overall · DJ Mag 2025 + Spotify + RA + scene data
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: "ICONIC", color: "#FFD600" },
                  { label: "ELITE", color: "#FF3D00" },
                  { label: "ESTABLISHED", color: "#AA00FF" },
                  { label: "PROVEN", color: "#448AFF" },
                  { label: "BUILDING", color: "#00E676" },
                  { label: "EMERGING", color: "#888888" },
                ].map(t => (
                  <span key={t.label} style={{
                    fontSize: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                    color: t.color, border: `1px solid ${t.color}33`, padding: "2px 8px",
                    borderRadius: 4, letterSpacing: "0.08em",
                  }}>{t.label}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: "🏛️ LEGACY", color: "#FFD600" },
                  { label: "📈 SURGING", color: "#00E5FF" },
                  { label: "🔥 RISING", color: "#FF6B3D" },
                  { label: "➡️ STEADY", color: "#888888" },
                  { label: "⚡ BREAKOUT", color: "#AA00FF" },
                ].map(t => (
                  <span key={t.label} style={{
                    fontSize: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                    color: t.color, background: `${t.color}12`, padding: "2px 8px",
                    borderRadius: 4, letterSpacing: "0.05em",
                  }}>{t.label}</span>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{
              padding: "12px 16px", marginBottom: 20,
              background: `${COLORS.yellow}08`,
              border: `1px solid ${COLORS.yellow}22`,
              borderRadius: 8,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, lineHeight: 1.6 }}>
                <span style={{ color: COLORS.yellow, fontWeight: 700 }}>A higher overall rating does not mean a better DJ.</span>{" "}
                These scores measure <span style={{ color: COLORS.text }}>presence, reach, and cultural impact</span> across
                multiple axes — not skill, taste, or artistry. An artist with a 78 OVR operating in an underground niche may be
                more influential within their scene than a 90 OVR with mainstream crossover.
                Scene Authority attempts to capture peer respect and underground credibility, but no number can fully
                represent what makes an artist matter. This is a starting point for conversation, not the final word.
                <span style={{ color: COLORS.textDim }}> If you disagree with a score — good. That's the point.</span>
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "36px 1fr 52px 52px 52px 52px 52px 52px 52px 52px 52px",
              gap: 4, padding: "8px 12px",
              fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim,
              textTransform: "uppercase", letterSpacing: "0.1em",
              borderBottom: `1px solid ${COLORS.border}`,
              position: "sticky", top: 97, background: COLORS.bg, zIndex: 10,
            }}>
              <span style={{ textAlign: "center" }}>#</span>
              <span>Artist</span>
              <span style={{ textAlign: "center", color: COLORS.accent, fontWeight: 700 }}>OVR</span>
              <span style={{ textAlign: "center" }}>Fest</span>
              <span style={{ textAlign: "center" }}>Club</span>
              <span style={{ textAlign: "center" }}>Soc</span>
              <span style={{ textAlign: "center" }}>Strm</span>
              <span style={{ textAlign: "center" }}>Geo</span>
              <span style={{ textAlign: "center" }}>Con</span>
              <span style={{ textAlign: "center" }}>Auth</span>
              <span style={{ textAlign: "center" }}>DJM</span>
            </div>

            {/* Artist rows */}
            {LEADERBOARD_SCORED.map((a, i) => {
              const isDom = a.name === "Dom Dolla";
              const t = a.tierData;
              const tr = a.trajectory;
              return (
                <div key={a.name} style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 52px 52px 52px 52px 52px 52px 52px 52px 52px",
                  gap: 4, padding: "10px 12px",
                  background: isDom ? `${COLORS.accent}08` : i % 2 === 0 ? COLORS.surface : "transparent",
                  borderBottom: `1px solid ${COLORS.border}`,
                  borderLeft: isDom ? `3px solid ${COLORS.accent}` : "3px solid transparent",
                  alignItems: "center",
                  animation: `fadeInUp ${0.1 + i * 0.02}s ease-out`,
                  transition: "background 0.2s",
                  cursor: "default",
                }}>
                  {/* Rank */}
                  <span style={{
                    fontSize: 14, fontWeight: 900, color: i < 3 ? t.color : COLORS.textDim,
                    fontFamily: "'Space Grotesk', sans-serif", textAlign: "center",
                  }}>{i + 1}</span>

                  {/* Artist info */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isDom ? COLORS.accent : COLORS.text, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {a.name}
                      </span>
                      <span style={{
                        fontSize: 7, fontWeight: 700, color: t.color,
                        border: `1px solid ${t.color}44`,
                        padding: "1px 5px", borderRadius: 3,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.08em",
                      }}>{t.label}</span>
                      <span style={{
                        fontSize: 7, fontWeight: 600, color: tr.color,
                        background: `${tr.color}15`,
                        padding: "1px 5px", borderRadius: 3,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.05em",
                      }}>{tr.icon} {tr.badge}</span>
                    </div>
                    <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.origin} · {a.genres.join(", ")}
                    </div>
                  </div>

                  {/* Overall */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{
                      fontSize: 16, fontWeight: 900, color: t.color,
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}>{a.overall}</span>
                  </div>

                  {/* Individual stats */}
                  {[a.fest, a.clb, a.soc, a.str, a.geo, a.con, a.sa].map((val, vi) => (
                    <div key={vi} style={{ textAlign: "center", position: "relative" }}>
                      <div style={{
                        position: "absolute", bottom: 0, left: "15%", width: "70%",
                        height: `${val * 0.6}%`, background: val >= 92 ? `${COLORS.accent}30` : val >= 85 ? `${COLORS.accentSoft}20` : `${COLORS.border}30`,
                        borderRadius: "2px 2px 0 0",
                      }} />
                      <span style={{
                        position: "relative",
                        fontSize: 11, fontWeight: 600,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: val >= 92 ? COLORS.accent : val >= 85 ? COLORS.accentSoft : COLORS.textMuted,
                      }}>{val}</span>
                    </div>
                  ))}

                  {/* DJ Mag position */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{
                      fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                      color: a.djmag ? (a.djmag <= 10 ? COLORS.yellow : a.djmag <= 30 ? COLORS.text : COLORS.textMuted) : COLORS.textDim,
                      fontWeight: a.djmag && a.djmag <= 10 ? 700 : 400,
                    }}>
                      {a.djmag ? `#${a.djmag}` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Methodology note */}
            <div style={{
              marginTop: 24, padding: 16, background: COLORS.surface,
              border: `1px solid ${COLORS.border}`, borderRadius: 8,
            }}>
              <h4 style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Methodology
              </h4>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim, lineHeight: 1.6 }}>
                Overall rating weighted: Scene Authority (17%) + Festival (16%) + Club (14%) + Streaming (14%) + Geographic (12%) + Connectivity (10%) + Social (10%) + Releases (7%).
                <br/>Sources: DJ Mag Top 100 2025, Spotify, Beatport charts, Resident Advisor event data, 1001Tracklists, festival lineup archives, label affiliations, Boiler Room appearances.
                <br/>Scene Authority factors: label network quality, B2B partner caliber, venue credibility (Berghain/fabric/DC10 weight), tastemaker recognition, peer cosigns, longevity.
                <br/>DJ Mag column shows 2025 ranking where applicable. Artists without DJ Mag ranking (—) may have higher scene authority scores, reflecting underground presence the poll doesn't capture.
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${COLORS.border}`,
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        color: COLORS.textDim,
      }}>
        <span>headlin.ing © 2026 — data compiled from RA, Songkick, Spotify, ARIA, Billboard</span>
        <span>artist profile prototype — not affiliated with Dom Dolla or management</span>
      </footer>
    </div>
  );
}
