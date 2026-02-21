const fs = require("fs");
const path = require("path");

const content = fs.readFileSync(path.join(__dirname, "..", "seed-labels.csv"), "utf-8");
const lines = content.split("\n");

const INSTITUTIONS = new Set([
  "Drumcode","Afterlife","Defected","Innervisions","Kompakt","Tresor",
  "Warp Records","XL Recordings","Hospital Records","Toolroom",
  "Diynamic","Hot Creations","Cocoon","Hypercolour","Rekids",
  "Mute Records","fabric records",
]);
const RESPECTED = new Set([
  "Solid Grooves","KNTXT","LENSKE","Hekate","Gudu",
  "Cuttin Headz","Hot Trax","Relief Records","Knee Deep In Sound",
  "Crosstown Rebels","Relief","Bedrock Records","Poker Flat",
]);

function slugify(n) {
  return n.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}
function tier(n) {
  return INSTITUTIONS.has(n) ? "institution" : RESPECTED.has(n) ? "respected" : "emerging";
}
function esc(s) {
  return (s || "").replace(/'/g, "''");
}

const rows = [];
for (const line of lines) {
  const cols = line.split(",");
  const name = (cols[1] || "").trim();
  if (!name || name === "Record Label" || name === "Record Labels") continue;
  const owner = (cols[2] || "").trim();
  const genre = (cols[3] || "").trim();
  const based = (cols[4] || "").trim();
  const info  = (cols[5] || "").trim();
  rows.push({ name, owner, genre, based, info });
}

const vals = rows.map((r) => {
  const slug    = esc(slugify(r.name));
  const nm      = esc(r.name);
  const t       = tier(r.name);
  const genres  = r.genre ? `'{${JSON.stringify(r.genre).slice(1,-1)}}'` : "'{}'";
  const based   = r.based ? `'${esc(r.based)}'` : "NULL";
  const info    = r.info  ? `'${esc(r.info)}'`  : "NULL";
  return `  ('${nm}', '${slug}', '${t}', ${genres}, ${based}, ${info})`;
});

const sql =
  "INSERT INTO labels (name, slug, label_tier, genres, based_in, info_url) VALUES\n" +
  vals.join(",\n") +
  "\nON CONFLICT (slug) DO NOTHING;";

fs.writeFileSync(path.join(__dirname, "..", "supabase", "seeds", "002_labels.sql"), sql);
console.log("Generated", rows.length, "labels in supabase/seeds/002_labels.sql");
