import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const CACHE_CONTROL = "public, s-maxage=600, stale-while-revalidate=600";

async function fetchAllRows(supabase, tableName, orderBy = "id") {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tableName)
      .select("result_id,driver_id,position,pole,fastest_lap")
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
    supabase.from("teams").select("id,name,color,logo,driver_titles,driver_titles_f1,driver_titles_f2,driver_titles_f3,driver_titles_fe,team_titles,team_titles_f1,team_titles_f2,team_titles_f3,team_titles_fe,triple_crowns").order("id", { ascending: true }),
    supabase.from("drivers").select("id,name,default_team_id,number,color,avatar,retired,driver_titles,team_titles,triple_crown").order("id", { ascending: true }),
    supabase.from("driver_participations").select("driver_id,season_id,category_id,team_id").order("driver_id", { ascending: true }),
    supabase.from("race_library").select("id,name,country").order("id", { ascending: true }),
    supabase.from("seasons").select("id,name,sort_order").order("sort_order", { ascending: true }),
    supabase.from("season_calendar").select("id,race_library_id,round,name,season_id,category_id,start_at").order("season_id", { ascending: true }).order("round", { ascending: true }),
    supabase.from("calendar_events").select("id,title,description,start_at,end_at").order("start_at", { ascending: true }),
    supabase.from("special_event_editions").select("id,event_type,edition_label,name,date,winner_driver_id,pole_driver_id,podium_first_driver_id,podium_second_driver_id,podium_third_driver_id,podium,notes,sort_order").order("event_type", { ascending: true }).order("sort_order", { ascending: true }),
    supabase.from("off_season_championship_entries").select("id,event_type,season_id,driver_id,team_id,qualifying_position,race_position").order("season_id", { ascending: true }).order("event_type", { ascending: true }).order("race_position", { ascending: true }),
    supabase.from("season_titles").select("id,season_id,category_id,driver_id,team_id,constructor_driver_ids").order("season_id", { ascending: true }),
    supabase.from("team_development").select("id,team_id,season_id,category_id,round,speed,acceleration,grip,turbo,turbo_enabled,level,driver_one,driver_two").order("season_id", { ascending: true }).order("round", { ascending: true }),
    supabase.from("race_results").select("id,race_id,season_id,category_id,race_name").order("id", { ascending: true }),
    fetchAllRows(supabase, "race_result_entries"),
  ]);

  const keys = [
    "teamsData", "driversData", "participationsData", "raceLibraryData", "seasonsData",
    "calendarData", "calendarEventsData", "specialEditionsData", "offSeasonEntriesData",
    "seasonTitlesData", "developmentData", "resultsData", "resultEntriesData",
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
