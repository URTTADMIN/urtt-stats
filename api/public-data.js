import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=300";

async function fetchAllRows(supabase, tableName, orderBy = "id") {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

export default async function handler(_request, response) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response.setHeader("Cache-Control", "no-store").status(500).json({ error: "Supabase is not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const results = await Promise.all([
    supabase.from("teams").select("*").order("id", { ascending: true }),
    supabase.from("drivers").select("*").order("id", { ascending: true }),
    supabase.from("driver_participations").select("*").order("id", { ascending: true }),
    supabase.from("race_library").select("*").order("id", { ascending: true }),
    supabase.from("seasons").select("*").order("sort_order", { ascending: true }),
    supabase.from("season_calendar").select("*").order("season_id", { ascending: true }).order("round", { ascending: true }),
    supabase.from("calendar_events").select("*").order("start_at", { ascending: true }),
    supabase.from("special_event_editions").select("*").order("event_type", { ascending: true }).order("sort_order", { ascending: true }),
    supabase.from("off_season_championship_entries").select("*").order("season_id", { ascending: true }).order("event_type", { ascending: true }).order("race_position", { ascending: true }),
    supabase.from("season_titles").select("*").order("season_id", { ascending: true }),
    supabase.from("team_development").select("*").order("season_id", { ascending: true }).order("round", { ascending: true }),
    supabase.from("site_settings").select("*"),
    supabase.from("race_results").select("*").order("id", { ascending: true }),
    fetchAllRows(supabase, "race_result_entries"),
  ]);

  const keys = [
    "teamsData", "driversData", "participationsData", "raceLibraryData", "seasonsData",
    "calendarData", "calendarEventsData", "specialEditionsData", "offSeasonEntriesData",
    "seasonTitlesData", "developmentData", "siteSettingsData", "resultsData", "resultEntriesData",
  ];
  const data = Object.fromEntries(keys.map((key, index) => [key, results[index].data || []]));
  const errors = results
    .map((result, index) => result.error ? { table: keys[index].replace(/Data$/, ""), code: result.error.code, message: result.error.message } : null)
    .filter(Boolean);
  const fatalErrors = errors.filter((error) => error.code !== "42P01");

  if (fatalErrors.length) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({ ...data, errors });
  }

  response.setHeader("Cache-Control", CACHE_CONTROL);
  return response.status(200).json({ ...data, errors });
}
