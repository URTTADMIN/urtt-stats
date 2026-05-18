import { createClient } from "@supabase/supabase-js";

function normalizeSeasonId(seasonId) {
  return String(seasonId ?? "").trim();
}

function normalizeCategoryId(categoryId) {
  return String(categoryId ?? "F1").trim().toUpperCase() || "F1";
}

function seasonName(id) {
  return normalizeSeasonId(id).replace("S", "Saison ");
}

function formatCalendarDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

export default async function handler(_request, response) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response.status(500).send("Supabase is not configured");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("season_calendar")
    .select("id, name, round, season_id, category_id, start_at")
    .not("start_at", "is", null)
    .order("start_at", { ascending: true });

  if (error) {
    console.error("Erreur calendrier ICS:", error);
    return response.status(500).send("Unable to load calendar");
  }

  const events = (data || [])
    .map((race) => {
      const start = new Date(race.start_at);
      if (Number.isNaN(start.getTime())) return null;

      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const categoryId = normalizeCategoryId(race.category_id);
      const title = `URTT ${categoryId} - ${race.name}`;
      const details = `${seasonName(race.season_id)} - Course #${race.round}`;

      return [
        "BEGIN:VEVENT",
        `UID:urtt-race-${race.id}@urtt-stats`,
        `DTSTAMP:${formatCalendarDate(new Date())}`,
        `DTSTART:${formatCalendarDate(start)}`,
        `DTEND:${formatCalendarDate(end)}`,
        `SUMMARY:${escapeCalendarText(title)}`,
        `DESCRIPTION:${escapeCalendarText(details)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .filter(Boolean);

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//URTT Stats//Race Calendar Feed//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Calendrier URTT",
    "X-WR-CALDESC:Courses planifiees URTT",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  response.setHeader("Content-Type", "text/calendar; charset=utf-8");
  response.setHeader("Content-Disposition", "inline; filename=\"urtt-calendar.ics\"");
  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  return response.status(200).send(calendar);
}
