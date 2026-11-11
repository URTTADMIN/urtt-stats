import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400";
const CACHE_TAG = "race-results";

async function fetchAllEntries(supabase) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("race_result_entries")
      .select("result_id,driver_id,position,pole,fastest_lap")
      .order("id", { ascending: true })
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
  const [resultsResult, entriesResult] = await Promise.all([
    supabase.from("race_results").select("id,race_id,season_id,category_id,race_name").order("id", { ascending: true }),
    fetchAllEntries(supabase),
  ]);

  const resultsData = resultsResult.data || [];
  const resultEntriesData = entriesResult.data || [];
  const errors = [
    resultsResult.error ? { table: "results", code: resultsResult.error.code, message: resultsResult.error.message } : null,
    entriesResult.error ? { table: "resultEntries", code: entriesResult.error.code, message: entriesResult.error.message } : null,
  ].filter(Boolean);
  const fatalErrors = errors.filter((error) => error.code !== "42P01");

  if (fatalErrors.length) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({ resultsData, resultEntriesData, errors });
  }

  response.setHeader("Cache-Control", CACHE_CONTROL);
  response.setHeader("Vercel-Cache-Tag", CACHE_TAG);
  return response.status(200).json({ resultsData, resultEntriesData, errors });
}
