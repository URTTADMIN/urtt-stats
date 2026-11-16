import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Read-only report of the public tables loaded by src/App.jsx at startup.
// Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the environment
// or in a local .env.local file. No keys are printed or written to disk.

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
    }
  }
}

loadLocalEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.error("Variables manquantes : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY. Ajoute-les à .env.local ou à l'environnement puis relance le script.");
  process.exit(1);
}

const tables = [
  ["teams", "id,name,color,logo,driver_titles,driver_titles_f1,driver_titles_f2,driver_titles_f3,driver_titles_fe,team_titles,team_titles_f1,team_titles_f2,team_titles_f3,team_titles_fe,triple_crowns"],
  ["drivers", "id,name,default_team_id,number,color,avatar,retired,driver_titles,team_titles,triple_crown"],
  ["driver_participations", "driver_id,season_id,category_id,team_id"],
  ["race_library", "id,name,country"],
  ["seasons", "id,name,sort_order"],
  ["season_calendar", "id,race_library_id,round,name,season_id,category_id,start_at"],
  ["calendar_events", "id,title,description,start_at,end_at"],
  ["special_event_editions", "id,event_type,edition_label,name,date,winner_driver_id,pole_driver_id,podium_first_driver_id,podium_second_driver_id,podium_third_driver_id,podium,notes,sort_order"],
  ["off_season_championship_entries", "id,event_type,season_id,driver_id,team_id,qualifying_position,race_position"],
  ["season_titles", "id,season_id,category_id,driver_id,team_id,constructor_driver_ids"],
  ["team_development", "id,team_id,season_id,category_id,round,speed,acceleration,grip,turbo,turbo_enabled,level,driver_one,driver_two"],
  ["site_settings", "key,value"],
  ["race_results", "id,race_id,season_id,category_id,race_name"],
  ["race_result_entries", "id,result_id,driver_id,position,pole,fastest_lap"],
];

const PAGE_SIZE = 1000;
const baseUrl = supabaseUrl.replace(/\/+$/, "");
const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

async function readTable(table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`${baseUrl}/rest/v1/${table}`);
    url.searchParams.set("select", columns);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`${table} [${response.status}]: ${detail}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function jsonMiB(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8") / (1024 * 1024);
}

const report = [];
for (const [table, columns] of tables) {
  try {
    const [allRows, slimRows] = await Promise.all([
      readTable(table, "*"),
      readTable(table, columns),
    ]);
    report.push({
      table,
      rows: allRows.length,
      allMiB: jsonMiB(allRows),
      slimMiB: jsonMiB(slimRows),
    });
  } catch (error) {
    report.push({ table, error: error.message });
  }
}

const successful = report.filter((row) => Number.isFinite(row.allMiB));
const totals = successful.reduce((sum, row) => ({
  allMiB: sum.allMiB + row.allMiB,
  slimMiB: sum.slimMiB + row.slimMiB,
}), { allMiB: 0, slimMiB: 0 });

console.log("Table | Lignes | JSON complet (Mo) | Colonnes retenues (Mo) | Réduction");
console.log("---|---:|---:|---:|---:");
for (const row of report) {
  if (row.error) {
    console.log(`${row.table} | — | ERREUR | — | ${row.error.replaceAll("|", "/")}`);
    continue;
  }
  const reduction = row.allMiB > 0 ? (1 - row.slimMiB / row.allMiB) * 100 : 0;
  console.log(`${row.table} | ${row.rows} | ${row.allMiB.toFixed(3)} | ${row.slimMiB.toFixed(3)} | ${reduction.toFixed(1)} %`);
}
console.log(`TOTAL | ${successful.reduce((sum, row) => sum + row.rows, 0)} | ${totals.allMiB.toFixed(3)} | ${totals.slimMiB.toFixed(3)} | ${totals.allMiB > 0 ? ((1 - totals.slimMiB / totals.allMiB) * 100).toFixed(1) : "0.0"} %`);
