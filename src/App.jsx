import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const POINTS_SYSTEM = [30, 25, 22, 20, 18, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const F2_SEASONS_3_AND_4_POINTS_SYSTEM = [20, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const DEFAULT_SEASON_OPTIONS = Array.from({ length: 16 }, (_, index) => ({ id: `S${index + 1}`, name: `Saison ${index + 1}`, sortOrder: index + 1 }));
let runtimeSeasonOptions = DEFAULT_SEASON_OPTIONS;
const CATEGORY_OPTIONS = [
  { id: "F1", name: "F1", color: "#7c3aed" },
  { id: "F2", name: "F2", color: "#dc2626" },
  { id: "F3", name: "F3", color: "#f97316" },
  { id: "FE", name: "FE", color: "#16a34a" },
];

function getSeasonOptions() {
  return runtimeSeasonOptions;
}

function setRuntimeSeasonOptions(options) {
  runtimeSeasonOptions = options?.length ? options : DEFAULT_SEASON_OPTIONS;
}

function normalizeSeasonOptions(seasons = []) {
  const mapped = seasons.map((season) => ({
    id: normalizeSeasonId(season.id),
    name: season.name || season.id,
    sortOrder: Number(season.sort_order ?? season.sortOrder ?? getSeasonNumber(season.id)) || 0,
  })).filter((season) => season.id);
  const merged = new Map(DEFAULT_SEASON_OPTIONS.map((season) => [season.id, season]));
  mapped.forEach((season) => merged.set(season.id, season));
  return Array.from(merged.values()).sort((a, b) => (a.sortOrder || getSeasonNumber(a.id)) - (b.sortOrder || getSeasonNumber(b.id)));
}

function getNextSeasonOption(seasons = getSeasonOptions()) {
  const nextNumber = Math.max(...seasons.map((season) => getSeasonNumber(season.id)), 0) + 1;
  return { id: `S${nextNumber}`, name: `Saison ${nextNumber}`, sortOrder: nextNumber };
}

async function fetchAllSupabaseRows(tableName, orderBy = "id") {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order(orderBy, { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

const emptyDriver = { name: "", teamId: "", number: 1, color: "#dc2626", avatar: "", retired: false, driverTitles: 0, teamTitles: 0, participations: {}, teamHistory: {}, tripleCrown: { monaco: false, indy500: false, lemans: false } };
const emptyTeam = { name: "", color: "#dc2626", logo: "", driverTitles: 0, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesFE: 0, teamTitles: 0, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesFE: 0, tripleCrowns: 0 };
const emptyRace = { name: "", country: "" };
const emptyCalendarRace = { seasonId: "S16", raceId: "" };
const emptyCalendarEvent = { title: "", description: "", startAt: "", endAt: "" };

const demoTeams = [
  { id: 101, name: "Apex Racing", color: "#dc2626", logo: "", driverTitles: 1, driverTitlesF1: 1, driverTitlesF2: 1, driverTitlesFE: 0, teamTitles: 3, teamTitlesF1: 3, teamTitlesF2: 0, teamTitlesFE: 0, tripleCrowns: 0 },
  { id: 102, name: "Nova Motorsport", color: "#2563eb", logo: "", driverTitles: 1, driverTitlesF1: 1, driverTitlesF2: 0, driverTitlesFE: 0, teamTitles: 1, teamTitlesF1: 1, teamTitlesF2: 0, teamTitlesFE: 0, tripleCrowns: 1 },
  { id: 103, name: "Velocity Academy", color: "#ef4444", logo: "", driverTitles: 0, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesFE: 0, teamTitles: 1, teamTitlesF1: 0, teamTitlesF2: 1, teamTitlesFE: 0, tripleCrowns: 0 },
  { id: 104, name: "Thunder Junior", color: "#f97316", logo: "", driverTitles: 1, driverTitlesF1: 0, driverTitlesF2: 1, driverTitlesFE: 0, teamTitles: 0, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesFE: 0, tripleCrowns: 0 },
  { id: 105, name: "E-Volt Racing", color: "#16a34a", logo: "", driverTitles: 1, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesFE: 1, teamTitles: 2, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesFE: 2, tripleCrowns: 0 },
  { id: 106, name: "Spark Formula", color: "#22c55e", logo: "", driverTitles: 0, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesFE: 0, teamTitles: 1, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesFE: 1, tripleCrowns: 0 },
];

const demoDrivers = [
  { id: 201, name: "AREKU", teamId: 101, number: 7, color: "#dc2626", avatar: "", driverTitles: 2, teamTitles: 3, participations: { S1: ["F2"], S2: ["F1"], S3: ["FE"], S4: ["F2", "FE"], S16: ["F1"] }, teamHistory: { S1: 101, S2: 101, S3: 102, S4: 101, S16: 101 }, tripleCrown: { monaco: true, indy500: true, lemans: false } },
  { id: 202, name: "KOLTAN", teamId: 102, number: 12, color: "#2563eb", avatar: "", driverTitles: 1, teamTitles: 1, participations: { S1: ["F2"], S2: ["F1", "FE"], S3: ["FE"], S4: ["F2"], S16: ["F1"] }, teamHistory: { S1: 102, S2: 101, S3: 102, S4: 102, S16: 102 }, tripleCrown: { monaco: true, indy500: false, lemans: true } },
  { id: 203, name: "MILO", teamId: 103, number: 18, color: "#ef4444", avatar: "", driverTitles: 0, teamTitles: 1, participations: { S1: ["F2"], S2: ["F2"], S4: ["F2"] }, teamHistory: { S1: 103, S2: 103, S4: 104 }, tripleCrown: { monaco: false, indy500: false, lemans: false } },
  { id: 204, name: "SENNA", teamId: 104, number: 21, color: "#f97316", avatar: "", driverTitles: 1, teamTitles: 0, participations: { S1: ["F2"], S4: ["F2"] }, teamHistory: { S1: 104, S4: 103 }, tripleCrown: { monaco: true, indy500: false, lemans: false } },
  { id: 205, name: "ECHO", teamId: 105, number: 99, color: "#16a34a", avatar: "", driverTitles: 1, teamTitles: 2, participations: { S2: ["FE"], S3: ["FE"], S4: ["FE"] }, teamHistory: { S2: 105, S3: 105, S4: 106 }, tripleCrown: { monaco: false, indy500: false, lemans: true } },
  { id: 206, name: "VOLT", teamId: 106, number: 5, color: "#22c55e", avatar: "", driverTitles: 0, teamTitles: 1, participations: { S2: ["FE"], S3: ["FE"], S4: ["FE"] }, teamHistory: { S2: 106, S3: 106, S4: 105 }, tripleCrown: { monaco: false, indy500: true, lemans: false } },
];

const demoRaceLibrary = [
  { id: 301, name: "GP de Monaco" },
  { id: 302, name: "GP de Spa" },
  { id: 303, name: "GP de Monza" },
  { id: 304, name: "GP de Suzuka" },
  { id: 305, name: "GP de Silverstone" },
  { id: 306, name: "GP d'Abu Dhabi" },
];

function createEmptySeasonMap() {
  return getSeasonOptions().reduce((acc, season) => {
    acc[season.id] = [];
    return acc;
  }, {});
}

function createDemoSeasonMap() {
  const map = createEmptySeasonMap();
  map.S1 = [
    { id: 401, libraryRaceId: 301, round: 1, name: "GP de Monaco", seasonId: "S1" },
    { id: 402, libraryRaceId: 302, round: 2, name: "GP de Spa", seasonId: "S1" },
  ];
  map.S2 = [
    { id: 403, libraryRaceId: 303, round: 1, name: "GP de Monza", seasonId: "S2" },
    { id: 404, libraryRaceId: 304, round: 2, name: "GP de Suzuka", seasonId: "S2" },
  ];
  map.S3 = [
    { id: 405, libraryRaceId: 301, round: 1, name: "GP de Monaco", seasonId: "S3" },
    { id: 406, libraryRaceId: 305, round: 2, name: "GP de Silverstone", seasonId: "S3" },
  ];
  map.S4 = [
    { id: 407, libraryRaceId: 302, round: 1, name: "GP de Spa", seasonId: "S4" },
    { id: 408, libraryRaceId: 306, round: 2, name: "GP d'Abu Dhabi", seasonId: "S4" },
  ];
  map.S16 = [
    { id: 409, libraryRaceId: 301, round: 1, name: "GP de Monaco", seasonId: "S16" },
    { id: 410, libraryRaceId: 303, round: 2, name: "GP de Monza", seasonId: "S16" },
    { id: 411, libraryRaceId: 306, round: 3, name: "GP d'Abu Dhabi", seasonId: "S16" },
  ];
  return map;
}

const demoRaceResults = [
  { raceId: 401, seasonId: "S1", categoryId: "F2", raceName: "GP de Monaco", entries: [{ driverId: 201, position: 1, pole: true, fastestLap: false }, { driverId: 202, position: 2, pole: false, fastestLap: true }] },
  { raceId: 402, seasonId: "S1", categoryId: "F2", raceName: "GP de Spa", entries: [{ driverId: 202, position: 1, pole: true, fastestLap: true }, { driverId: 201, position: 2, pole: false, fastestLap: false }, { driverId: 203, position: 3, pole: false, fastestLap: false }, { driverId: 204, position: 4, pole: false, fastestLap: false }] },
  { raceId: 403, seasonId: "S2", categoryId: "F1", raceName: "GP de Monza", entries: [{ driverId: 201, position: 1, pole: false, fastestLap: true }, { driverId: 202, position: 2, pole: true, fastestLap: false }] },
  { raceId: 404, seasonId: "S2", categoryId: "FE", raceName: "GP de Suzuka", entries: [{ driverId: 201, position: 2, pole: true, fastestLap: false }, { driverId: 202, position: 1, pole: false, fastestLap: true }, { driverId: 205, position: 3, pole: false, fastestLap: false }, { driverId: 206, position: 4, pole: false, fastestLap: false }, { driverId: 203, position: 5, pole: false, fastestLap: false }] },
  { raceId: 405, seasonId: "S3", categoryId: "FE", raceName: "GP de Monaco", entries: [{ driverId: 202, position: 1, pole: true, fastestLap: false }, { driverId: 201, position: 2, pole: false, fastestLap: true }] },
  { raceId: 406, seasonId: "S3", categoryId: "FE", raceName: "GP de Silverstone", entries: [{ driverId: 201, position: 1, pole: true, fastestLap: true }, { driverId: 202, position: 2, pole: false, fastestLap: false }, { driverId: 205, position: 3, pole: false, fastestLap: false }, { driverId: 206, position: 4, pole: false, fastestLap: false }] },
  { raceId: 407, seasonId: "S4", categoryId: "F2", raceName: "GP de Spa", entries: [{ driverId: 201, position: 1, pole: false, fastestLap: false }, { driverId: 202, position: 2, pole: true, fastestLap: true }] },
  { raceId: 408, seasonId: "S4", categoryId: "F2", raceName: "GP d'Abu Dhabi", entries: [{ driverId: 202, position: 1, pole: false, fastestLap: true }, { driverId: 201, position: 2, pole: true, fastestLap: false }, { driverId: 203, position: 3, pole: false, fastestLap: false }, { driverId: 204, position: 4, pole: false, fastestLap: false }, { driverId: 205, position: 5, pole: false, fastestLap: false }, { driverId: 206, position: 6, pole: false, fastestLap: false }] },
  { raceId: 409, seasonId: "S16", categoryId: "F1", raceName: "GP de Monaco", entries: [{ driverId: 201, position: 1, pole: true, fastestLap: true }, { driverId: 202, position: 2, pole: false, fastestLap: false }] },
  { raceId: 410, seasonId: "S16", categoryId: "F1", raceName: "GP de Monza", entries: [{ driverId: 202, position: 1, pole: true, fastestLap: false }, { driverId: 201, position: 2, pole: false, fastestLap: true }] },
  { raceId: 411, seasonId: "S16", categoryId: "F1", raceName: "GP d'Abu Dhabi", entries: [{ driverId: 201, position: 1, pole: false, fastestLap: false }, { driverId: 202, position: 2, pole: true, fastestLap: true }] },
];

function usesSpecialF2Points(categoryId, seasonId) {
  return categoryId === "F2" && ["S3", "S4"].includes(seasonId);
}
function getPointsSystem(categoryId, seasonId) {
  return usesSpecialF2Points(categoryId, seasonId) ? F2_SEASONS_3_AND_4_POINTS_SYSTEM : POINTS_SYSTEM;
}
function getPointsForPosition(position, categoryId, seasonId) {
  return getPointsSystem(categoryId, seasonId)[position - 1] || 0;
}
function normalizeSeasonId(seasonId) {
  return String(seasonId ?? "").trim();
}
function normalizeCategoryId(categoryId) {
  return String(categoryId ?? "F1").trim().toUpperCase() || "F1";
}
function toDateTimeInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}
function toStoredDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function formatRaceDate(value) {
  if (!value) return "Date non definie";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non definie";
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}
function formatCalendarDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function escapeCalendarText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}
function getRaceCalendarEvent(race) {
  const start = new Date(race.startAt);
  const storedEnd = race.endAt ? new Date(race.endAt) : null;
  const end = storedEnd && !Number.isNaN(storedEnd.getTime()) ? storedEnd : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const title = race.kind === "event" ? `URTT - ${race.title}` : `URTT ${race.categoryId} - ${race.name}`;
  const details = race.kind === "event" ? (race.description || "Evenement URTT") : `${seasonName(race.seasonId)} - Course #${race.round}`;
  const dates = `${formatCalendarDate(start)}/${formatCalendarDate(end)}`;
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//URTT Stats//Race Calendar//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:urtt-race-${race.id}@urtt-stats`,
    `DTSTAMP:${formatCalendarDate(new Date())}`,
    `DTSTART:${formatCalendarDate(start)}`,
    `DTEND:${formatCalendarDate(end)}`,
    `SUMMARY:${escapeCalendarText(title)}`,
    `DESCRIPTION:${escapeCalendarText(details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return {
    googleUrl,
    icsUrl: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`,
    fileName: `urtt-${String(race.categoryId || "event").toLowerCase()}-${String(race.name || race.title || "evenement").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`,
  };
}
function getCalendarFeedLinks() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const feedUrl = `${origin}/api/calendar.ics`;
  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");
  return {
    googleUrl: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`,
    appleUrl: webcalUrl,
    downloadUrl: feedUrl,
  };
}
function getSeasonNumber(seasonId) {
  return Number(normalizeSeasonId(seasonId).replace("S", "")) || 0;
}
function isSeasonIncluded(targetSeasonId, selectedSeasonId) {
  return getSeasonNumber(targetSeasonId) <= getSeasonNumber(selectedSeasonId);
}
function getCategoryColor(categoryId) {
  return CATEGORY_OPTIONS.find((category) => category.id === normalizeCategoryId(categoryId))?.color || "#3f3f46";
}
function seasonName(id) {
  return getSeasonOptions().find((season) => season.id === normalizeSeasonId(id))?.name || id;
}
function shortRaceName(name) {
  return String(name).replace("GP de ", "").replace("GP d'", "");
}
function normalizeResultText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function cleanQuickResultLine(value) {
  return String(value || "")
    .trim()
    .replace(/^#?\d+\s*[-.)]?\s*/i, "")
    .replace(/^p\d+\s*[-.)]?\s*/i, "")
    .trim();
}
function idsEqual(left, right) {
  return String(left ?? "") === String(right ?? "");
}
function driverName(drivers, driverId) {
  return drivers.find((driver) => idsEqual(driver.id, driverId))?.name || "—";
}
function mapTeamFromDb(team) {
  return {
    id: team.id,
    name: team.name,
    color: team.color || "#dc2626",
    logo: team.logo || "",
    driverTitles: team.driver_titles_f1 ?? team.driver_titles ?? 0,
    driverTitlesF1: team.driver_titles_f1 ?? team.driver_titles ?? 0,
    driverTitlesF2: team.driver_titles_f2 || 0,
    driverTitlesFE: team.driver_titles_fe || 0,
    teamTitles: team.team_titles_f1 ?? team.team_titles ?? 0,
    teamTitlesF1: team.team_titles_f1 ?? team.team_titles ?? 0,
    teamTitlesF2: team.team_titles_f2 || 0,
    teamTitlesFE: team.team_titles_fe || 0,
    tripleCrowns: team.triple_crowns || 0,
  };
}
function mapTeamToDb(teamForm) {
  return {
    name: teamForm.name,
    color: teamForm.color || "#dc2626",
    logo: teamForm.logo || "",
    driver_titles: Number(teamForm.driverTitlesF1) || 0,
    driver_titles_f1: Number(teamForm.driverTitlesF1) || 0,
    driver_titles_f2: Number(teamForm.driverTitlesF2) || 0,
    driver_titles_fe: Number(teamForm.driverTitlesFE) || 0,
    team_titles: Number(teamForm.teamTitlesF1) || 0,
    team_titles_f1: Number(teamForm.teamTitlesF1) || 0,
    team_titles_f2: Number(teamForm.teamTitlesF2) || 0,
    team_titles_fe: Number(teamForm.teamTitlesFE) || 0,
    triple_crowns: Number(teamForm.tripleCrowns) || 0,
  };
}
function mapDriverFromDb(driver, participations = []) {
  const participationMap = {};
  const teamHistory = {};

  participations
    .filter((item) => idsEqual(item.driver_id, driver.id))
    .forEach((item) => {
      const seasonId = normalizeSeasonId(item.season_id);
      const categoryId = normalizeCategoryId(item.category_id);
      if (!participationMap[seasonId]) participationMap[seasonId] = [];
      if (!participationMap[seasonId].includes(categoryId)) participationMap[seasonId].push(categoryId);
      if (item.team_id) teamHistory[seasonId] = item.team_id;
    });

  return {
    id: driver.id,
    name: driver.name,
    teamId: driver.default_team_id || "",
    number: driver.number || 0,
    color: driver.color || "#dc2626",
    avatar: driver.avatar || "",
    retired: Boolean(driver.retired),
    driverTitles: driver.driver_titles || 0,
    teamTitles: driver.team_titles || 0,
    participations: participationMap,
    teamHistory,
    tripleCrown: driver.triple_crown || { monaco: false, indy500: false, lemans: false },
  };
}
function mapDriverToDb(driverForm) {
  return {
    name: driverForm.name,
    default_team_id: getLatestDriverTeamId(driverForm) || null,
    number: Number(driverForm.number) || 0,
    color: driverForm.color || "#dc2626",
    avatar: driverForm.avatar || "",
    retired: Boolean(driverForm.retired),
    driver_titles: Number(driverForm.driverTitles) || 0,
    team_titles: Number(driverForm.teamTitles) || 0,
    triple_crown: driverForm.tripleCrown || {},
  };
}
function mapRaceLibraryFromDb(race) {
  return { id: race.id, name: race.name, country: race.country || "" };
}
function sortRacesByName(races) {
  return [...races].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" }));
}
function mapCalendarRaceFromDb(race) {
  return {
    id: race.id,
    libraryRaceId: race.race_library_id,
    round: race.round,
    name: race.name,
    seasonId: normalizeSeasonId(race.season_id),
    categoryId: normalizeCategoryId(race.category_id),
    startAt: race.start_at || "",
  };
}
function mapCalendarEventFromDb(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description || "",
    startAt: event.start_at || "",
    endAt: event.end_at || "",
  };
}
function getCalendarFeedEstimate(hits, days) {
  const limit = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentHits = hits.filter((hit) => new Date(hit.created_at).getTime() >= limit);
  return new Set(recentHits.map((hit) => hit.visitor_hash).filter(Boolean)).size;
}
function mapRaceResultFromDb(result, entries = []) {
  return {
    id: result.id,
    raceId: result.race_id,
    seasonId: normalizeSeasonId(result.season_id),
    categoryId: normalizeCategoryId(result.category_id),
    raceName: result.race_name,
    entries: entries
      .filter((entry) => idsEqual(entry.result_id, result.id))
      .map((entry) => ({
        id: entry.id,
        driverId: entry.driver_id,
        position: entry.position,
        pole: Boolean(entry.pole),
        fastestLap: Boolean(entry.fastest_lap),
      })),
  };
}
function createSeasonMapFromCalendar(calendarRaces, selectedCategoryId = "F1") {
  const map = createEmptySeasonMap();
  const activeCategoryId = normalizeCategoryId(selectedCategoryId);
  calendarRaces
    .filter((race) => normalizeCategoryId(race.categoryId) === activeCategoryId)
    .forEach((race) => {
      if (!map[race.seasonId]) map[race.seasonId] = [];
      map[race.seasonId].push(race);
    });
  Object.keys(map).forEach((seasonId) => {
    map[seasonId] = map[seasonId].sort((a, b) => Number(a.round) - Number(b.round));
  });
  return map;
}
function driverParticipationsToDb(driverId, driverForm) {
  return Object.entries(driverForm.participations || {}).flatMap(([seasonId, categories]) =>
    categories.map((categoryId) => ({
      driver_id: driverId,
      season_id: seasonId,
      category_id: categoryId,
      team_id: driverForm.teamHistory?.[seasonId] || driverForm.teamId || null,
    }))
  );
}
function countByName(names) {
  return names.reduce((acc, name) => ({ ...acc, [name]: (acc[name] || 0) + 1 }), {});
}
function getDriverSeasonCategories(driver, seasonId) {
  return driver?.participations?.[normalizeSeasonId(seasonId)] || [];
}
function getLatestDriverTeamId(driver) {
  const teamHistory = driver?.teamHistory || {};
  const latestSeasonWithTeam = Object.entries(teamHistory)
    .filter(([, teamId]) => teamId)
    .sort((a, b) => getSeasonNumber(b[0]) - getSeasonNumber(a[0]))[0];
  return latestSeasonWithTeam?.[1] || driver?.teamId || "";
}
function toggleParticipation(form, seasonId, categoryId) {
  const current = form.participations?.[seasonId] || [];
  const next = current.includes(categoryId) ? current.filter((item) => item !== categoryId) : [...current, categoryId];
  return { ...form, participations: { ...(form.participations || {}), [seasonId]: next } };
}
function getTeamNameById(teams, teamId) {
  return teams.find((team) => idsEqual(team.id, teamId))?.name || "Sans écurie";
}
function getDriverSeasonTeam(driver, seasonId, teams) {
  const teamId = driver?.teamHistory?.[seasonId] || driver?.teamId;
  return teams.find((team) => idsEqual(team.id, teamId)) || null;
}
function updateDriverSeasonTeam(form, seasonId, teamId) {
  return { ...form, teamHistory: { ...(form.teamHistory || {}), [seasonId]: teamId ? Number(teamId) : "" } };
}
function getCategoryStatField(base, categoryId) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const suffix = ["F1", "F2", "F3", "FE"].includes(normalizedCategoryId) ? normalizedCategoryId : "F1";
  return `${base}${suffix}`;
}
function buildRecordMap(rows, keys) {
  return keys.reduce((acc, key) => {
    acc[key] = Math.max(0, ...rows.map((row) => Number(row[key]) || 0));
    return acc;
  }, {});
}
function isRecordValue(records, key, value) {
  const numericValue = Number(value) || 0;
  return numericValue > 0 && numericValue === records[key];
}
function RecordValue({ value, record }) {
  return <span style={record ? styles.recordValue : undefined}>{value}</span>;
}
function getDriverSeasonBreakdown(driver, raceResults, teams = [], selectedCategoryId = "") {
  const activeCategoryId = selectedCategoryId ? normalizeCategoryId(selectedCategoryId) : "";
  return getSeasonOptions().map((season) => {
    const seasonCategories = getDriverSeasonCategories(driver, season.id);
    const categories = activeCategoryId ? seasonCategories.filter((category) => normalizeCategoryId(category) === activeCategoryId) : seasonCategories;
    const seasonResults = raceResults.filter((result) => normalizeSeasonId(result.seasonId) === season.id && (!activeCategoryId || normalizeCategoryId(result.categoryId) === activeCategoryId));
    let points = 0;
    let wins = 0;
    let podiums = 0;
    let poles = 0;
    let fastestLaps = 0;
    seasonResults.forEach((result) => {
      const entry = result.entries.find((item) => idsEqual(item.driverId, driver.id));
      if (!entry) return;
      points += getPointsForPosition(Number(entry.position), result.categoryId, result.seasonId);
      wins += Number(entry.position) === 1 ? 1 : 0;
      podiums += Number(entry.position) <= 3 ? 1 : 0;
      poles += entry.pole ? 1 : 0;
      fastestLaps += entry.fastestLap ? 1 : 0;
    });
    const standings = Array.from(seasonResults.reduce((map, result) => {
      result.entries.forEach((entry) => {
        const current = map.get(entry.driverId) || 0;
        map.set(entry.driverId, current + getPointsForPosition(Number(entry.position), result.categoryId, result.seasonId));
      });
      return map;
    }, new Map()).entries()).sort((a, b) => b[1] - a[1]);
    const positionIndex = standings.findIndex(([driverId]) => idsEqual(driverId, driver.id));
    return { seasonId: season.id, position: positionIndex >= 0 ? positionIndex + 1 : null, team: getDriverSeasonTeam(driver, season.id, teams), teamName: getTeamNameById(teams, driver?.teamHistory?.[season.id] || driver?.teamId), categories, points, wins, podiums, poles, fastestLaps };
  }).filter((row) => row.categories.length || row.points || row.wins || row.podiums || row.poles || row.fastestLaps);
}
function getTeamSeasonBreakdown(team, drivers, raceResults) {
  return getSeasonOptions().map((season) => {
    const teamDrivers = drivers.filter((driver) => idsEqual(driver.teamHistory?.[season.id] || driver.teamId, team.id));
    const categories = Array.from(new Set(teamDrivers.flatMap((driver) => getDriverSeasonCategories(driver, season.id))));
    let points = 0;
    let wins = 0;
    let podiums = 0;
    let poles = 0;
    let fastestLaps = 0;
    raceResults.filter((result) => normalizeSeasonId(result.seasonId) === season.id).forEach((result) => {
      result.entries.forEach((entry) => {
        const driver = teamDrivers.find((item) => idsEqual(item.id, entry.driverId));
        if (!driver) return;
        points += getPointsForPosition(Number(entry.position), result.categoryId, result.seasonId);
        wins += Number(entry.position) === 1 ? 1 : 0;
        podiums += Number(entry.position) <= 3 ? 1 : 0;
        poles += entry.pole ? 1 : 0;
        fastestLaps += entry.fastestLap ? 1 : 0;
      });
    });
    return { seasonId: season.id, categories, points, wins, podiums, poles, fastestLaps };
  }).filter((row) => row.categories.length || row.points || row.wins || row.podiums || row.poles || row.fastestLaps);
}

function runTests() {
  console.assert(getPointsForPosition(1, "F1", "S1") === 30, "P1 doit rapporter 30 points");
  console.assert(getPointsForPosition(2, "F1", "S1") === 25, "P2 doit rapporter 25 points");
  console.assert(getPointsForPosition(8, "F1", "S1") === 12, "P8 doit rapporter 12 points");
  console.assert(getPointsForPosition(9, "F1", "S1") === 11, "P9 doit rapporter 11 points");
  console.assert(getPointsForPosition(19, "F1", "S1") === 1, "P19 doit rapporter 1 point");
  console.assert(getPointsForPosition(20, "F1", "S1") === 0, "P20 ne doit rapporter aucun point");
  console.assert(getPointsForPosition(1, "F2", "S3") === 20, "P1 F2 S3 doit rapporter 20 points");
  console.assert(getPointsForPosition(4, "F2", "S4") === 16, "P4 F2 S4 doit rapporter 16 points");
  console.assert(getPointsForPosition(20, "F2", "S4") === 0, "P20 F2 S4 ne doit rapporter aucun point");
  console.assert(getPointsForPosition(1, "F2", "S5") === 30, "F2 S5 doit garder le barème standard");
  console.assert(isSeasonIncluded("S1", "S4") === true, "S1 doit être incluse dans S4");
  console.assert(isSeasonIncluded("S5", "S4") === false, "S5 ne doit pas être incluse dans S4");
  console.assert(CATEGORY_OPTIONS.length === 4, "Il doit y avoir F1, F2, F3 et FE");
  console.assert(demoRaceLibrary.length > 0, "La bibliotheque de demo doit contenir des GP");
  console.assert(createDemoSeasonMap().S16.length === 3, "La saison de demo S16 doit contenir 3 GP");
  console.assert(toggleParticipation(emptyDriver, "S1", "F1").participations.S1.includes("F1"), "La participation F1 S1 doit pouvoir être ajoutée");
  console.assert(demoDrivers.some((driver) => driver.participations.S2?.includes("FE")), "Il doit y avoir au moins un pilote FE de démo");
  console.assert(demoDrivers.some((driver) => driver.participations.S1?.includes("F2")), "Il doit y avoir au moins un pilote F2 de démo");
  console.assert(getLatestDriverTeamId({ teamId: 101, teamHistory: { S1: 101, S4: 104, S3: 103 } }) === 104, "L'écurie par défaut doit suivre la saison la plus récente");
  const tiedStandings = [
    { name: "Pilote P3", points: 100, resultCounts: { 3: 1 } },
    { name: "Pilote P1", points: 100, resultCounts: { 1: 1 } },
  ].sort(sortSeasonStandings);
  console.assert(tiedStandings[0].name === "Pilote P1", "Une egalite de points doit etre departagee par la meilleure position");
  const f1Stats = computeStats({ drivers: demoDrivers, teams: demoTeams, raceResults: demoRaceResults, selectedCategoryId: "F1" });
  const feStats = computeStats({ drivers: demoDrivers, teams: demoTeams, raceResults: demoRaceResults, selectedCategoryId: "FE" });
  const f2Stats = computeStats({ drivers: demoDrivers, teams: demoTeams, raceResults: demoRaceResults, selectedCategoryId: "F2" });
  console.assert(f1Stats.driverStatsBySeason.S2.length !== feStats.driverStatsBySeason.S2.length, "Les catégories doivent afficher des stats différentes");
  console.assert(f2Stats.driverStatsBySeason.S4.find((driver) => driver.id === 203)?.teamName === "Thunder Junior", "Le classement pilote doit utiliser l'écurie de la saison");
  console.assert(f2Stats.teamStatsBySeason.S4.some((team) => team.id === 104 && team.points > 0), "Le classement écurie doit utiliser les pilotes de la saison");
}
if (import.meta.env.DEV) runTests();

export default function URTTAdminPanel() {
  useEffect(() => {
    const favicon = document.querySelector("link[rel='icon']") || document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = "/favicon.png";
    document.head.appendChild(favicon);

    const style = document.createElement("style");
    style.innerHTML = `
      html, body, #root {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background: #09090b;
      }
      * { box-sizing: border-box; }
      button, select, input { font: inherit; }
      .urtt-card, .urtt-stat-card { min-width: 0; }
      @media (max-width: 760px) {
        .urtt-public-header {
          padding: 24px 14px 12px !important;
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 14px !important;
        }
        .urtt-public-title {
          font-size: 32px !important;
          line-height: 1.08 !important;
        }
        .urtt-public-subtitle {
          font-size: 15px !important;
        }
        .urtt-public-nav {
          padding: 0 14px 12px !important;
          overflow-x: auto !important;
          flex-wrap: nowrap !important;
          -webkit-overflow-scrolling: touch;
        }
        .urtt-public-nav > * {
          flex: 0 0 auto !important;
        }
        .urtt-public-main {
          padding: 14px 14px 32px !important;
          gap: 14px !important;
        }
        .urtt-admin-page {
          display: block !important;
        }
        .urtt-admin-sidebar {
          position: sticky !important;
          top: 0 !important;
          z-index: 20 !important;
          border-right: 0 !important;
          border-bottom: 1px solid #27272a !important;
          padding: 12px 14px !important;
        }
        .urtt-admin-logo {
          margin-bottom: 12px !important;
        }
        .urtt-admin-nav {
          display: flex !important;
          gap: 8px !important;
          overflow-x: auto !important;
          padding-bottom: 4px !important;
          -webkit-overflow-scrolling: touch;
        }
        .urtt-admin-nav-button {
          flex: 0 0 auto !important;
          padding: 10px 12px !important;
          border-radius: 12px !important;
        }
        .urtt-admin-main {
          padding: 18px 14px 32px !important;
        }
        .urtt-admin-header {
          display: grid !important;
          align-items: start !important;
          gap: 14px !important;
          margin-bottom: 18px !important;
        }
        .urtt-admin-actions {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          width: 100% !important;
        }
        .urtt-admin-actions button {
          width: 100% !important;
          padding: 12px 10px !important;
        }
        .urtt-card {
          padding: 16px !important;
          border-radius: 18px !important;
        }
        .urtt-public-main [style*="minmax(0px, 1.2fr)"],
        .urtt-admin-main [style*="minmax(0px, 1.2fr)"],
        .urtt-admin-main [style*="minmax(310px"] {
          grid-template-columns: 1fr !important;
        }
        .urtt-stat-card {
          padding: 16px !important;
          border-radius: 18px !important;
        }
        th, td {
          padding: 10px !important;
        }
      }
      @media (max-width: 420px) {
        .urtt-admin-actions {
          grid-template-columns: 1fr !important;
        }
        .urtt-public-title {
          font-size: 28px !important;
        }
      }
      @media (min-width: 761px) {
        .urtt-public-main .urtt-standings-table {
          min-width: 100% !important;
          table-layout: fixed;
        }
        .urtt-public-main .urtt-standings-table th,
        .urtt-public-main .urtt-standings-table td {
          padding: 10px 8px !important;
          white-space: normal;
          overflow-wrap: normal;
          word-break: normal;
        }
        .urtt-public-main .urtt-standings-table th:first-child,
        .urtt-public-main .urtt-standings-table td:first-child {
          width: 44px;
        }
        .urtt-public-main .urtt-driver-standings th:nth-child(2),
        .urtt-public-main .urtt-driver-standings td:nth-child(2),
        .urtt-public-main .urtt-team-standings th:nth-child(2),
        .urtt-public-main .urtt-team-standings td:nth-child(2) {
          width: 190px;
        }
        .urtt-public-main .urtt-driver-standings th:nth-child(3),
        .urtt-public-main .urtt-driver-standings td:nth-child(3) {
          width: 128px;
        }
        .urtt-public-main .urtt-standings-table .urtt-identity {
          min-width: 0;
        }
        .urtt-public-main .urtt-standings-table .urtt-identity-name,
        .urtt-public-main .urtt-standings-table .urtt-team-name {
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .urtt-public-main .urtt-card {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  const [view, setView] = useState("front");
  const [publicPage, setPublicPage] = useState("home");
  const [adminPage, setAdminPage] = useState("dashboard");
  const [selectedCategoryId, setSelectedCategoryId] = useState("F1");
  const [selectedSeasonId, setSelectedSeasonId] = useState("S16");
  const [seasonOptions, setSeasonOptions] = useState(DEFAULT_SEASON_OPTIONS);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [adminUser, setAdminUser] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingRace, setIsSavingRace] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [raceLibrary, setRaceLibrary] = useState([]);
  const [allCalendarRaces, setAllCalendarRaces] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarFeedHits, setCalendarFeedHits] = useState([]);
  const [raceResults, setRaceResults] = useState([]);
  const [liveRaceDrafts, setLiveRaceDrafts] = useState({});
  const [driverForm, setDriverForm] = useState(emptyDriver);
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [raceForm, setRaceForm] = useState(emptyRace);
  const [calendarRaceForm, setCalendarRaceForm] = useState(emptyCalendarRace);
  const [calendarEventForm, setCalendarEventForm] = useState(emptyCalendarEvent);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [popup, setPopup] = useState(null);
  const [search, setSearch] = useState("");
  const [adminGlobalSearch, setAdminGlobalSearch] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [supabaseErrors, setSupabaseErrors] = useState([]);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [titleDriverId, setTitleDriverId] = useState("");
  const [titleTeamId, setTitleTeamId] = useState("");
  setRuntimeSeasonOptions(seasonOptions);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAdminUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadInitialDataFromSupabase() {
      setIsLoadingData(true);
      setSupabaseErrors([]);
      const [
        { data: teamsData, error: teamsError },
        { data: driversData, error: driversError },
        { data: participationsData, error: participationsError },
        { data: raceLibraryData, error: raceLibraryError },
        { data: seasonsData, error: seasonsError },
        { data: calendarData, error: calendarError },
        { data: calendarEventsData, error: calendarEventsError },
        { data: calendarFeedHitsData, error: calendarFeedHitsError },
        { data: resultsData, error: resultsError },
        { data: resultEntriesData, error: resultEntriesError },
      ] = await Promise.all([
        supabase.from("teams").select("*").order("id", { ascending: true }),
        supabase.from("drivers").select("*").order("id", { ascending: true }),
        supabase.from("driver_participations").select("*").order("id", { ascending: true }),
        supabase.from("race_library").select("*").order("id", { ascending: true }),
        supabase.from("seasons").select("*").order("sort_order", { ascending: true }),
        supabase.from("season_calendar").select("*").order("season_id", { ascending: true }).order("round", { ascending: true }),
        supabase.from("calendar_events").select("*").order("start_at", { ascending: true }),
        supabase.from("calendar_feed_hits").select("visitor_hash, user_agent, created_at").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).order("created_at", { ascending: false }),
        supabase.from("race_results").select("*").order("id", { ascending: true }),
        fetchAllSupabaseRows("race_result_entries"),
      ]);

      const loadErrors = [
        teamsError && `teams: ${teamsError.message}`,
        driversError && `drivers: ${driversError.message}`,
        participationsError && `driver_participations: ${participationsError.message}`,
        raceLibraryError && `race_library: ${raceLibraryError.message}`,
        seasonsError && seasonsError.code !== "42P01" && `seasons: ${seasonsError.message}`,
        calendarError && `season_calendar: ${calendarError.message}`,
        calendarEventsError && calendarEventsError.code !== "42P01" && `calendar_events: ${calendarEventsError.message}`,
        calendarFeedHitsError && calendarFeedHitsError.code !== "42P01" && `calendar_feed_hits: ${calendarFeedHitsError.message}`,
        resultsError && `race_results: ${resultsError.message}`,
        resultEntriesError && `race_result_entries: ${resultEntriesError.message}`,
      ].filter(Boolean);

      if (loadErrors.length) {
        console.error("Erreurs chargement Supabase:", loadErrors);
        setSupabaseErrors(loadErrors);
      }

      setTeams((teamsData || []).map(mapTeamFromDb));
      setDrivers((driversData || []).map((driver) => mapDriverFromDb(driver, participationsData || [])));
      setSeasonOptions(normalizeSeasonOptions(seasonsData || []));
      setRaceLibrary(sortRacesByName((raceLibraryData || []).map(mapRaceLibraryFromDb)));
      const mappedCalendar = (calendarData || []).map(mapCalendarRaceFromDb);
      setAllCalendarRaces(mappedCalendar);
      setCalendarEvents((calendarEventsData || []).map(mapCalendarEventFromDb));
      setCalendarFeedHits(calendarFeedHitsData || []);
      setRaceResults((resultsData || []).map((result) => mapRaceResultFromDb(result, resultEntriesData || [])));
      setLastSyncAt(new Date());
      setIsLoadingData(false);
    }

    loadInitialDataFromSupabase().catch((error) => {
      console.error("Erreur globale Supabase:", error);
      setSupabaseErrors([error.message || "Erreur inconnue pendant le chargement Supabase"]);
      setIsLoadingData(false);
    });
  }, []);

  const racesBySelectedCategory = useMemo(() => createSeasonMapFromCalendar(allCalendarRaces, selectedCategoryId), [allCalendarRaces, selectedCategoryId]);
  const currentSeasonRaces = racesBySelectedCategory[selectedSeasonId] || [];
  const computed = useMemo(() => computeStats({ drivers, teams, raceResults, selectedCategoryId }), [drivers, teams, raceResults, selectedCategoryId]);
  const seasonOnlyDrivers = computed.driverStatsBySeason[selectedSeasonId] || [];
  const seasonOnlyTeams = computed.teamStatsBySeason[selectedSeasonId] || [];
  const cumulativeDrivers = computed.cumulativeDriverStatsBySeason[selectedSeasonId] || [];
  const cumulativeTeams = computed.cumulativeTeamStatsBySeason[selectedSeasonId] || [];

  const filteredDrivers = drivers.filter((driver) => {
    const team = teams.find((item) => item.id === driver.teamId);
    return `${driver.name} ${team?.name || ""}`.toLowerCase().includes(search.toLowerCase());
  });

  async function saveDriver() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return;
    }

    if (!driverForm.name.trim()) {
      setPopup({ type: "error", title: "Pilote incomplet", message: "Ajoute au moins un nom de pilote." });
      return;
    }

    setIsSaving(true);

    const payload = mapDriverToDb(driverForm);
    const request = editingDriverId
      ? supabase.from("drivers").update(payload).eq("id", editingDriverId).select().single()
      : supabase.from("drivers").insert(payload).select().single();

    const { data, error } = await request;

    if (error) {
      setIsSaving(false);
      console.error("Erreur sauvegarde pilote:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible d’enregistrer le pilote." });
      return;
    }

    const driverId = data.id;
    const participationRows = driverParticipationsToDb(driverId, driverForm);

    const { error: deleteParticipationError } = await supabase
      .from("driver_participations")
      .delete()
      .eq("driver_id", driverId);

    if (deleteParticipationError) {
      setIsSaving(false);
      console.error("Erreur reset participations:", deleteParticipationError);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de mettre à jour les participations." });
      return;
    }

    if (participationRows.length > 0) {
      const { error: participationError } = await supabase
        .from("driver_participations")
        .insert(participationRows);

      if (participationError) {
        setIsSaving(false);
        console.error("Erreur participations:", participationError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible d’enregistrer les catégories du pilote." });
        return;
      }
    }

    setIsSaving(false);

    const cleanDriver = mapDriverFromDb(data, participationRows.map((row, index) => ({ id: index, ...row })));

    setDrivers((current) => editingDriverId ? current.map((driver) => driver.id === editingDriverId ? cleanDriver : driver) : [...current, cleanDriver]);
    setDriverForm(emptyDriver);
    setEditingDriverId(null);
    setPopup({ type: "success", title: editingDriverId ? "Pilote modifié" : "Pilote créé", message: `${cleanDriver.name} a bien été enregistré dans Supabase.` });
  }

  async function deleteDriver(driverId) {
    const { error } = await supabase
      .from("drivers")
      .delete()
      .eq("id", driverId);

    if (error) {
      console.error("Erreur suppression pilote:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer le pilote." });
      return;
    }

    setDrivers((current) => current.filter((driver) => driver.id !== driverId));
    setRaceResults((current) => current.map((race) => ({ ...race, entries: race.entries.filter((entry) => entry.driverId !== driverId) })));
  }

  async function saveTeam() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return;
    }

    if (!teamForm.name.trim()) {
      setPopup({ type: "error", title: "Écurie incomplète", message: "Ajoute au moins un nom d’écurie." });
      return;
    }

    setIsSaving(true);

    const payload = mapTeamToDb(teamForm);
    const request = editingTeamId
      ? supabase.from("teams").update(payload).eq("id", editingTeamId).select().single()
      : supabase.from("teams").insert(payload).select().single();

    const { data, error } = await request;
    setIsSaving(false);

    if (error) {
      console.error("Erreur sauvegarde équipe:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible d’enregistrer l’écurie." });
      return;
    }

    const cleanTeam = mapTeamFromDb(data);

    setTeams((current) => editingTeamId ? current.map((team) => team.id === editingTeamId ? cleanTeam : team) : [...current, cleanTeam]);
    setTeamForm(emptyTeam);
    setEditingTeamId(null);
    setPopup({ type: "success", title: editingTeamId ? "Écurie modifiée" : "Écurie créée", message: `${cleanTeam.name} a bien été enregistrée dans Supabase.` });
  }

  async function deleteTeam(teamId) {
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", teamId);

    if (error) {
      console.error("Erreur suppression équipe:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer l’écurie." });
      return;
    }

    setTeams((current) => current.filter((team) => team.id !== teamId));
    setDrivers((current) => current.map((driver) => driver.teamId === teamId ? { ...driver, teamId: "" } : driver));
  }

  async function saveRace() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return;
    }

    if (!raceForm.name.trim()) {
      setPopup({ type: "error", title: "GP incomplet", message: "Ajoute un nom de Grand Prix." });
      return;
    }

    setIsSavingRace(true);

    const { data, error } = await supabase
      .from("race_library")
      .insert({ name: raceForm.name, country: raceForm.country.trim() })
      .select()
      .single();

    setIsSavingRace(false);

    if (error) {
      console.error("Erreur création GP:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de créer le GP." });
      return;
    }

    const race = mapRaceLibraryFromDb(data);
    setRaceLibrary((current) => sortRacesByName([...current, race]));
    setRaceForm(emptyRace);
    setPopup({ type: "success", title: "Circuit créé", message: `${race.name} a été ajouté à Supabase.` });
  }

  async function updateRaceCountry(raceId, country) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return false;
    }

    const { data, error } = await supabase
      .from("race_library")
      .update({ country: country.trim() })
      .eq("id", raceId)
      .select()
      .single();

    if (error) {
      console.error("Erreur pays GP:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de modifier le pays. Vérifie que la colonne country existe dans race_library." });
      return false;
    }

    const race = mapRaceLibraryFromDb(data);
    setRaceLibrary((current) => sortRacesByName(current.map((item) => idsEqual(item.id, race.id) ? race : item)));
    return true;
  }

  async function addRaceToSeason() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return;
    }

    if (!calendarRaceForm.raceId) {
      setPopup({ type: "error", title: "Aucun GP", message: "Choisis un GP à ajouter au calendrier." });
      return;
    }

    const raceData = raceLibrary.find((race) => String(race.id) === String(calendarRaceForm.raceId));
    if (!raceData) return;

    const seasonId = calendarRaceForm.seasonId || selectedSeasonId;
    const payload = {
      race_library_id: raceData.id,
      round: (racesBySelectedCategory[seasonId] || []).length + 1,
      name: raceData.name,
      season_id: seasonId,
      category_id: selectedCategoryId,
    };

    setIsSavingRace(true);

    const { data, error } = await supabase
      .from("season_calendar")
      .insert(payload)
      .select()
      .single();

    setIsSavingRace(false);

    if (error) {
      console.error("Erreur calendrier:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible d’ajouter le GP au calendrier." });
      return;
    }

    const race = mapCalendarRaceFromDb(data);
    setAllCalendarRaces((current) => [...current, race]);
    setSelectedSeasonId(seasonId);
    setSelectedRaceId(String(race.id));
    setPopup({ type: "success", title: "Calendrier mis à jour", message: `${race.name} a été ajouté à ${seasonName(seasonId)}.` });
  }

  async function deleteRace(seasonId, raceId) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return;
    }

    const { error } = await supabase
      .from("season_calendar")
      .delete()
      .eq("id", raceId);

    if (error) {
      console.error("Erreur suppression GP calendrier:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer ce GP du calendrier." });
      return;
    }

    setAllCalendarRaces((current) => current.filter((race) => race.id !== raceId));
    setRaceResults((current) => current.filter((result) => result.raceId !== raceId));
    if (String(selectedRaceId) === String(raceId)) setSelectedRaceId("");
  }

  async function deleteRaceFromLibrary(raceId) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les donnees." });
      return;
    }

    const race = raceLibrary.find((item) => idsEqual(item.id, raceId));
    if (!race) return;

    const linkedCalendarRaces = allCalendarRaces.filter((item) => idsEqual(item.libraryRaceId, raceId));
    const message = linkedCalendarRaces.length
      ? `${race.name} est present ${linkedCalendarRaces.length} fois au calendrier. Le supprimer retirera aussi ces courses et leurs resultats.`
      : `Supprimer ${race.name} de la bibliotheque ?`;

    if (!window.confirm(message)) return;

    setIsSavingRace(true);

    const linkedCalendarIds = linkedCalendarRaces.map((item) => item.id);
    let linkedResultIds = [];

    if (linkedCalendarIds.length) {
      const { data: linkedResultRows, error: linkedResultsError } = await supabase
        .from("race_results")
        .select("id")
        .in("race_id", linkedCalendarIds);

      if (linkedResultsError) {
        setIsSavingRace(false);
        console.error("Erreur lecture resultats GP:", linkedResultsError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de lire les resultats de ce GP." });
        return;
      }

      linkedResultIds = (linkedResultRows || []).map((result) => result.id);
    }

    if (linkedResultIds.length) {
      const { error: entriesError } = await supabase
        .from("race_result_entries")
        .delete()
        .in("result_id", linkedResultIds);

      if (entriesError) {
        setIsSavingRace(false);
        console.error("Erreur suppression entrees GP:", entriesError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer les entrees de resultats de ce GP." });
        return;
      }
    }

    if (linkedCalendarIds.length) {
      const { error: resultsError } = await supabase
        .from("race_results")
        .delete()
        .in("race_id", linkedCalendarIds);

      if (resultsError) {
        setIsSavingRace(false);
        console.error("Erreur suppression resultats GP:", resultsError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer les resultats de ce GP." });
        return;
      }

      const { error: calendarError } = await supabase
        .from("season_calendar")
        .delete()
        .eq("race_library_id", raceId);

      if (calendarError) {
        setIsSavingRace(false);
        console.error("Erreur suppression calendrier GP:", calendarError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer ce GP du calendrier." });
        return;
      }
    }

    const { error } = await supabase
      .from("race_library")
      .delete()
      .eq("id", raceId);

    setIsSavingRace(false);

    if (error) {
      console.error("Erreur suppression bibliotheque GP:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer ce GP de la bibliotheque." });
      return;
    }

    setRaceLibrary((current) => current.filter((item) => !idsEqual(item.id, raceId)));
    setAllCalendarRaces((current) => current.filter((item) => !idsEqual(item.libraryRaceId, raceId)));
    setRaceResults((current) => current.filter((result) => !linkedCalendarIds.some((calendarId) => idsEqual(calendarId, result.raceId))));
    if (linkedCalendarIds.some((calendarId) => idsEqual(calendarId, selectedRaceId))) setSelectedRaceId("");
    setPopup({ type: "success", title: "GP supprime", message: `${race.name} a ete retire de la bibliotheque.` });
  }

  async function moveRace(raceId, direction) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier le calendrier." });
      return;
    }

    const categoryRaces = [...(racesBySelectedCategory[selectedSeasonId] || [])].sort((a, b) => Number(a.round) - Number(b.round));
    const currentIndex = categoryRaces.findIndex((race) => String(race.id) === String(raceId));
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= categoryRaces.length) return;

    const reorderedRaces = [...categoryRaces];
    [reorderedRaces[currentIndex], reorderedRaces[nextIndex]] = [reorderedRaces[nextIndex], reorderedRaces[currentIndex]];
    const updatedRaces = reorderedRaces.map((race, index) => ({ ...race, round: index + 1 }));

    setIsSavingRace(true);

    const updates = updatedRaces.map((race) => (
      supabase
        .from("season_calendar")
        .update({ round: race.round })
        .eq("id", race.id)
    ));
    const results = await Promise.all(updates);
    const updateError = results.find((result) => result.error)?.error;

    setIsSavingRace(false);

    if (updateError) {
      console.error("Erreur ordre calendrier:", updateError);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de modifier l'ordre des courses." });
      return;
    }

    setAllCalendarRaces((current) => current.map((race) => updatedRaces.find((updatedRace) => updatedRace.id === race.id) || race));
  }

  async function updateRaceStartAt(raceId, startAt) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return false;
    }

    setIsSavingRace(true);

    const { data, error } = await supabase
      .from("season_calendar")
      .update({ start_at: toStoredDateTime(startAt) })
      .eq("id", raceId)
      .select()
      .single();

    setIsSavingRace(false);

    if (error) {
      console.error("Erreur date course:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de modifier la date. Verifie que la colonne start_at existe dans season_calendar." });
      return false;
    }

    const updatedRace = mapCalendarRaceFromDb(data);
    setAllCalendarRaces((current) => current.map((race) => idsEqual(race.id, raceId) ? updatedRace : race));
    return true;
  }

  async function saveCalendarEvent() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les donnees." });
      return;
    }

    if (!calendarEventForm.title.trim() || !calendarEventForm.startAt) {
      setPopup({ type: "error", title: "Evenement incomplet", message: "Ajoute un titre et une date de debut." });
      return;
    }

    setIsSavingEvent(true);

    const payload = {
      title: calendarEventForm.title.trim(),
      description: calendarEventForm.description.trim(),
      start_at: toStoredDateTime(calendarEventForm.startAt),
      end_at: toStoredDateTime(calendarEventForm.endAt),
    };

    const { data, error } = await supabase
      .from("calendar_events")
      .insert(payload)
      .select()
      .single();

    setIsSavingEvent(false);

    if (error) {
      console.error("Erreur evenement calendrier:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de creer l'evenement. Verifie que la table calendar_events existe." });
      return;
    }

    const event = mapCalendarEventFromDb(data);
    setCalendarEvents((current) => [...current, event].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
    setCalendarEventForm(emptyCalendarEvent);
    setPopup({ type: "success", title: "Evenement ajoute", message: `${event.title} a ete ajoute au calendrier abonne.` });
  }

  async function deleteCalendarEvent(eventId) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les donnees." });
      return;
    }

    setIsSavingEvent(true);

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", eventId);

    setIsSavingEvent(false);

    if (error) {
      console.error("Erreur suppression evenement:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer cet evenement." });
      return;
    }

    setCalendarEvents((current) => current.filter((event) => !idsEqual(event.id, eventId)));
  }

  function getResultEntry(driverId) {
    const draft = liveRaceDrafts[selectedRaceId] || [];
    const draftEntry = draft.find((entry) => idsEqual(entry.driverId, driverId));
    if (draftEntry) return draftEntry;

    const raceResult = raceResults.find((result) => String(result.raceId) === String(selectedRaceId));
    return raceResult?.entries.find((entry) => idsEqual(entry.driverId, driverId)) || { driverId, position: 1, pole: false, fastestLap: false };
  }

  function updateResultEntry(driverId, key, value) {
    if (!selectedRaceId) return;
    setLiveRaceDrafts((current) => {
      const currentDraft = current[selectedRaceId] || [];
      const hasEntry = currentDraft.some((entry) => idsEqual(entry.driverId, driverId));
      const nextDraft = hasEntry
        ? currentDraft.map((entry) => idsEqual(entry.driverId, driverId) ? { ...entry, [key]: value } : entry)
        : [...currentDraft, { driverId, position: 1, pole: false, fastestLap: false, [key]: value }];
      return { ...current, [selectedRaceId]: nextDraft };
    });
  }

  async function awardManualTitles() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les titres." });
      return;
    }

    const championDriver = drivers.find((driver) => String(driver.id) === String(titleDriverId));
    const championTeam = teams.find((team) => String(team.id) === String(titleTeamId));

    if (!championDriver || !championTeam) {
      setPopup({ type: "error", title: "Titres incomplets", message: "Choisis un pilote champion et une ecurie championne." });
      return;
    }

    const nextDriverTitles = (Number(championDriver.driverTitles) || 0) + 1;
    const nextDriverTeamTitles = (Number(championDriver.teamTitles) || 0) + 1;
    const nextTeamTitles = (Number(championTeam.teamTitles) || 0) + 1;

    setIsSaving(true);

    const [{ error: driverError }, { error: teamError }] = await Promise.all([
      supabase
        .from("drivers")
        .update({ driver_titles: nextDriverTitles, team_titles: nextDriverTeamTitles })
        .eq("id", championDriver.id),
      supabase
        .from("teams")
        .update({ team_titles: nextTeamTitles })
        .eq("id", championTeam.id),
    ]);

    setIsSaving(false);

    if (driverError || teamError) {
      console.error("Erreur attribution titres:", driverError || teamError);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible d'ajouter les titres." });
      return;
    }

    setDrivers((current) => current.map((driver) => (
      driver.id === championDriver.id
        ? { ...driver, driverTitles: nextDriverTitles, teamTitles: nextDriverTeamTitles }
        : driver
    )));
    setTeams((current) => current.map((team) => (
      team.id === championTeam.id ? { ...team, teamTitles: nextTeamTitles } : team
    )));
    setTitleDriverId("");
    setTitleTeamId("");
    setPopup({ type: "success", title: "Titres ajoutes", message: `${championDriver.name} et ${championTeam.name} ont ete mis a jour.` });
  }

  async function validateRaceResults() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return;
    }

    if (!selectedRaceId) {
      setPopup({ type: "error", title: "Aucun GP sélectionné", message: "Crée ou sélectionne un Grand Prix avant de valider les résultats." });
      return;
    }

    const selectedRace = currentSeasonRaces.find((race) => String(race.id) === String(selectedRaceId));
    if (!selectedRace) {
      setPopup({ type: "error", title: "Course introuvable", message: "Selectionne une course du calendrier actif avant de valider les resultats." });
      return;
    }

    const resultSeasonId = selectedRace.seasonId || selectedSeasonId;
    const resultCategoryId = selectedRace.categoryId || selectedCategoryId;
    const eligibleDrivers = drivers.filter((driver) => (driver.participations?.[resultSeasonId] || []).includes(resultCategoryId));
    const entries = eligibleDrivers.map((driver, index) => ({
      driverId: driver.id,
      position: getResultEntry(driver.id).position || index + 1,
      pole: Boolean(getResultEntry(driver.id).pole),
      fastestLap: Boolean(getResultEntry(driver.id).fastestLap),
    }));

    setIsSavingResult(true);

    const existingResult = raceResults.find((result) => String(result.raceId) === String(selectedRaceId));
    let resultId = existingResult?.id;

    if (existingResult?.id) {
      const { error: updateError } = await supabase
        .from("race_results")
        .update({ season_id: resultSeasonId, category_id: resultCategoryId, race_name: selectedRace.name || "GP" })
        .eq("id", existingResult.id);

      if (updateError) {
        setIsSavingResult(false);
        console.error("Erreur update result:", updateError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de modifier le résultat." });
        return;
      }

      const { error: deleteEntriesError } = await supabase
        .from("race_result_entries")
        .delete()
        .eq("result_id", existingResult.id);

      if (deleteEntriesError) {
        setIsSavingResult(false);
        console.error("Erreur reset entries:", deleteEntriesError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de remplacer les entrées du résultat." });
        return;
      }
    } else {
      const { data: resultData, error: insertResultError } = await supabase
        .from("race_results")
        .insert({ race_id: selectedRace.id, season_id: resultSeasonId, category_id: resultCategoryId, race_name: selectedRace.name || "GP" })
        .select()
        .single();

      if (insertResultError) {
        setIsSavingResult(false);
        console.error("Erreur insert result:", insertResultError);
        setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible d’enregistrer le résultat." });
        return;
      }

      resultId = resultData.id;
    }

    const entryRows = entries.map((entry) => ({
      result_id: resultId,
      driver_id: entry.driverId,
      position: Number(entry.position),
      pole: Boolean(entry.pole),
      fastest_lap: Boolean(entry.fastestLap),
    }));

    const { data: insertedEntries, error: insertEntriesError } = await supabase
      .from("race_result_entries")
      .insert(entryRows)
      .select();

    setIsSavingResult(false);

    if (insertEntriesError) {
      console.error("Erreur entries:", insertEntriesError);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible d’enregistrer les positions." });
      return;
    }

    const payload = {
      id: resultId,
      raceId: selectedRace.id,
      seasonId: resultSeasonId,
      raceName: selectedRace.name || "GP",
      categoryId: resultCategoryId,
      entries: (insertedEntries || []).map((entry) => ({
        id: entry.id,
        driverId: entry.driver_id,
        position: entry.position,
        pole: Boolean(entry.pole),
        fastestLap: Boolean(entry.fastest_lap),
      })),
    };

    setRaceResults((current) => current.some((result) => String(result.raceId) === String(selectedRaceId)) ? current.map((result) => String(result.raceId) === String(selectedRaceId) ? payload : result) : [...current, payload]);
    setLiveRaceDrafts((current) => ({ ...current, [selectedRaceId]: [] }));
    setPopup({ type: "success", title: "Course validée", message: `${selectedRace?.name || "La course"} a bien été enregistrée dans Supabase.` });
  }

  async function addSeason() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les saisons." });
      return;
    }

    const nextSeason = getNextSeasonOption(seasonOptions);
    setIsSaving(true);

    const { error } = await supabase
      .from("seasons")
      .insert({ id: nextSeason.id, name: nextSeason.name, sort_order: nextSeason.sortOrder });

    setIsSaving(false);

    if (error) {
      console.error("Erreur creation saison:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de creer la saison. Verifie que la table seasons existe." });
      return;
    }

    const nextOptions = normalizeSeasonOptions([...seasonOptions, nextSeason]);
    setSeasonOptions(nextOptions);
    setSelectedSeasonId(nextSeason.id);
    setCalendarRaceForm((current) => ({ ...current, seasonId: nextSeason.id }));
    setPopup({ type: "success", title: "Saison ajoutee", message: `${nextSeason.name} est disponible dans les menus.` });
  }

  const allRaces = allCalendarRaces.filter((race) => normalizeCategoryId(race.categoryId) === normalizeCategoryId(selectedCategoryId));

  return (
    <>
      {view === "front" && (
        <PublicSite
          teams={teams}
          selectedCategoryId={selectedCategoryId}
          setSelectedCategoryId={setSelectedCategoryId}
          selectedSeasonId={selectedSeasonId}
          setSelectedSeasonId={setSelectedSeasonId}
          publicPage={publicPage}
          setPublicPage={setPublicPage}
          seasonOnlyDrivers={seasonOnlyDrivers}
          seasonOnlyTeams={seasonOnlyTeams}
          cumulativeDrivers={cumulativeDrivers}
          cumulativeTeams={cumulativeTeams}
          races={currentSeasonRaces}
          countdownRaces={allCalendarRaces}
          calendarEvents={calendarEvents}
          raceLibrary={raceLibrary}
          allRaces={allRaces}
          raceResults={raceResults}
          allDrivers={drivers}
          onOpenAdmin={() => { setView("login"); setLoginError(""); }}
        />
      )}
      {view === "login" && <LoginScreen email={adminEmail} setEmail={setAdminEmail} password={adminPassword} setPassword={setAdminPassword} loginError={loginError} onLogin={async (event) => { event.preventDefault(); const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword }); if (error) { setLoginError("Email ou mot de passe incorrect."); return; } setAdminUser(data.user); setAdminPassword(""); setLoginError(""); setView("admin"); }} onBack={() => setView("front")} />} 
      {view === "admin" && (
        <AdminLayout
          active={adminPage}
          setActive={setAdminPage}
          adminUser={adminUser}
          onPublic={() => setView("front")}
          onLogout={async () => {
            await supabase.auth.signOut();
            setAdminUser(null);
            setView("front");
            setAdminPage("dashboard");
          }}
        >
          {adminPage === "dashboard" && <Dashboard drivers={computed.globalDriverStats} teams={computed.globalTeamStats} races={currentSeasonRaces} selectedCategoryId={selectedCategoryId} selectedSeasonId={selectedSeasonId} />}
          {adminPage === "supabase" && <SupabasePanel isLoading={isLoadingData} lastSyncAt={lastSyncAt} errors={supabaseErrors} teams={teams} drivers={drivers} raceLibrary={raceLibrary} allCalendarRaces={allCalendarRaces} calendarFeedHits={calendarFeedHits} raceResults={raceResults} selectedCategoryId={selectedCategoryId} selectedSeasonId={selectedSeasonId} />}
          {adminPage === "search" && <AdminSearch search={adminGlobalSearch} setSearch={setAdminGlobalSearch} drivers={drivers} teams={teams} onEditDriver={(driver) => { setEditingDriverId(driver.id); setDriverForm({ ...driver, teamHistory: driver.teamHistory || {}, participations: driver.participations || {} }); setAdminPage("drivers"); }} onEditTeam={(team) => { setEditingTeamId(team.id); setTeamForm(team); setAdminPage("teams"); }} />}
          {adminPage === "titles" && (
  <TitlesPanel
    drivers={drivers}
    teams={teams}
    titleDriverId={titleDriverId}
    setTitleDriverId={setTitleDriverId}
    titleTeamId={titleTeamId}
    setTitleTeamId={setTitleTeamId}
    onAward={awardManualTitles}
    isSaving={isSaving}
  />
)}
          {adminPage === "drivers" && <AdminDrivers drivers={filteredDrivers} teams={teams} selectedSeasonId={selectedSeasonId} form={driverForm} setForm={setDriverForm} editingId={editingDriverId} isSaving={isSaving} onSave={saveDriver} onEdit={(driver) => { setEditingDriverId(driver.id); setDriverForm({ ...driver, teamHistory: driver.teamHistory || {}, participations: driver.participations || {} }); }} onDelete={deleteDriver} onCancel={() => { setDriverForm(emptyDriver); setEditingDriverId(null); }} search={search} setSearch={setSearch} />}
          {adminPage === "teams" && <AdminTeams teams={teams} form={teamForm} setForm={setTeamForm} editingId={editingTeamId} isSaving={isSaving} onSave={saveTeam} onEdit={(team) => { setEditingTeamId(team.id); setTeamForm(team); }} onDelete={deleteTeam} onCancel={() => { setTeamForm(emptyTeam); setEditingTeamId(null); }} />}
          {adminPage === "races" && <AdminRaces raceForm={raceForm} setRaceForm={setRaceForm} raceLibrary={raceLibrary} allCalendarRaces={allCalendarRaces} calendarRaceForm={calendarRaceForm} setCalendarRaceForm={setCalendarRaceForm} racesBySeason={racesBySelectedCategory} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} selectedSeasonId={selectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} onSave={saveRace} onAddToSeason={addRaceToSeason} onDelete={deleteRace} onDeleteLibraryRace={deleteRaceFromLibrary} onUpdateLibraryRaceCountry={updateRaceCountry} onMoveRace={moveRace} onUpdateStartAt={updateRaceStartAt} isSavingRace={isSavingRace} />}
          {adminPage === "planning" && <PlanningPanel races={allCalendarRaces} calendarEvents={calendarEvents} eventForm={calendarEventForm} setEventForm={setCalendarEventForm} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} selectedSeasonId={selectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} onUpdateStartAt={updateRaceStartAt} onSaveEvent={saveCalendarEvent} onDeleteEvent={deleteCalendarEvent} isSavingEvent={isSavingEvent} />}
          {adminPage === "results" && <ResultsManager drivers={drivers.filter((driver) => (driver.participations?.[selectedSeasonId] || []).some((category) => normalizeCategoryId(category) === normalizeCategoryId(selectedCategoryId)))} teams={teams} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} races={currentSeasonRaces} selectedSeasonId={selectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} selectedRaceId={selectedRaceId} setSelectedRaceId={setSelectedRaceId} getResultEntry={getResultEntry} updateResultEntry={updateResultEntry} onValidate={validateRaceResults} isSavingResult={isSavingResult} />}
          {adminPage === "settings" && <SettingsPanel seasons={seasonOptions} onAddSeason={addSeason} isSaving={isSaving} />}
          
        </AdminLayout>
      )}
      {popup && <Popup popup={popup} onClose={() => setPopup(null)} />}
    </>
  );
}

function computeStats({ drivers, teams, raceResults, selectedCategoryId }) {
  const activeCategoryId = normalizeCategoryId(selectedCategoryId);
  const latestSeasonId = getSeasonOptions().at(-1)?.id || "S16";
  const driverTitleField = getCategoryStatField("driverTitles", activeCategoryId);
  const teamTitleField = getCategoryStatField("teamTitles", activeCategoryId);
  const blankDriverStats = (driver, seasonId) => {
    const seasonTeamId = driver.teamHistory?.[seasonId] || driver.teamId;
    return {
      ...driver,
      teamId: seasonTeamId,
      teamName: teams.find((team) => idsEqual(team.id, seasonTeamId))?.name || "Sans écurie",
      driverTitles: Number(driver.driverTitles) || 0,
      teamTitles: Number(driver.teamTitles) || 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      fastestLaps: 0,
      points: 0,
      resultCounts: {},
    };
  };
  const blankTeamStats = (team) => ({
  ...team,
  driverTitles: Number(team[driverTitleField] ?? (activeCategoryId === "F1" ? team.driverTitles : 0)) || 0,
  driverTitlesF1: Number(team.driverTitlesF1) || 0,
  driverTitlesF2: Number(team.driverTitlesF2) || 0,
  driverTitlesF3: Number(team.driverTitlesF3) || 0,
  driverTitlesFE: Number(team.driverTitlesFE) || 0,
  teamTitles: Number(team[teamTitleField] ?? (activeCategoryId === "F1" ? team.teamTitles : 0)) || 0,
  teamTitlesF1: Number(team.teamTitlesF1 ?? team.teamTitles) || 0,
  teamTitlesF2: Number(team.teamTitlesF2) || 0,
  teamTitlesF3: Number(team.teamTitlesF3) || 0,
  teamTitlesFE: Number(team.teamTitlesFE) || 0,
  wins: 0,
  podiums: 0,
  poles: 0,
  fastestLaps: 0,
  points: 0,
  resultCounts: {},
});
  const driverStatsBySeason = {};
  const teamStatsBySeason = {};
  getSeasonOptions().forEach((season) => {
    const driverMap = new Map(drivers.map((driver) => [String(driver.id), blankDriverStats(driver, season.id)]));
    const teamMap = new Map(teams.map((team) => [String(team.id), blankTeamStats(team)]));
    const seasonCategoryResults = raceResults.filter((result) => normalizeSeasonId(result.seasonId) === season.id && normalizeCategoryId(result.categoryId) === activeCategoryId);
    seasonCategoryResults.forEach((raceResult) => {
      raceResult.entries.forEach((entry) => {
        const driver = driverMap.get(String(entry.driverId));
        if (!driver) return;
        const team = teamMap.get(String(driver.teamId));
        const position = Number(entry.position);
        const points = getPointsForPosition(position, raceResult.categoryId || activeCategoryId, raceResult.seasonId || season.id);
        const win = position === 1 ? 1 : 0;
        const podium = position <= 3 ? 1 : 0;
        const pole = entry.pole ? 1 : 0;
        const fastest = entry.fastestLap ? 1 : 0;
        driver.points += points;
        driver.wins += win;
        driver.podiums += podium;
        driver.poles += pole;
        driver.fastestLaps += fastest;
        if (Number.isFinite(position) && position > 0) {
          driver.resultCounts[position] = (driver.resultCounts[position] || 0) + 1;
        }
        if (team) {
          team.points += points;
          team.wins += win;
          team.podiums += podium;
          team.poles += pole;
          team.fastestLaps += fastest;
          if (Number.isFinite(position) && position > 0) {
            team.resultCounts[position] = (team.resultCounts[position] || 0) + 1;
          }
        }
      });
    });
    const seasonDriverStats = Array.from(driverMap.values()).filter((driver) => driver.points > 0 || (driver.participations?.[season.id] || []).some((category) => normalizeCategoryId(category) === activeCategoryId)).sort(sortSeasonStandings);
    const seasonTeamStats = Array.from(teamMap.values()).filter((team) => {
      const relatedDrivers = drivers.filter((driver) => idsEqual(driver.teamHistory?.[season.id] || driver.teamId, team.id));
      return team.points > 0 || relatedDrivers.some((driver) => (driver.participations?.[season.id] || []).some((category) => normalizeCategoryId(category) === activeCategoryId));
    }).sort(sortSeasonStandings);

    driverStatsBySeason[season.id] = seasonDriverStats;
    teamStatsBySeason[season.id] = seasonTeamStats;
  });
  return {
    driverStatsBySeason,
    teamStatsBySeason,
    cumulativeDriverStatsBySeason: buildCumulativeStats(driverStatsBySeason),
    cumulativeTeamStatsBySeason: buildCumulativeStats(teamStatsBySeason),
    globalDriverStats: buildCumulativeStats(driverStatsBySeason)[latestSeasonId] || [],
    globalTeamStats: buildCumulativeStats(teamStatsBySeason)[latestSeasonId] || [],
  };
}

function compareResultCounts(a, b) {
  const aCounts = a.resultCounts || {};
  const bCounts = b.resultCounts || {};
  for (let position = 1; position <= 99; position += 1) {
    const diff = (Number(bCounts[position]) || 0) - (Number(aCounts[position]) || 0);
    if (diff) return diff;
  }
  return 0;
}

function sortSeasonStandings(a, b) {
  return (
    (Number(b.points) || 0) - (Number(a.points) || 0) ||
    compareResultCounts(a, b) ||
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function sortByTitlesAndResults(a, b) {
  return (
    (Number(b.driverTitles) || 0) - (Number(a.driverTitles) || 0) ||
    (Number(b.teamTitles) || 0) - (Number(a.teamTitles) || 0) ||
    (Number(b.teamTitlesF2) || 0) - (Number(a.teamTitlesF2) || 0) ||
    (Number(b.teamTitlesFE) || 0) - (Number(a.teamTitlesFE) || 0) ||
    (Number(b.wins) || 0) - (Number(a.wins) || 0) ||
    (Number(b.podiums) || 0) - (Number(a.podiums) || 0) ||
    (Number(b.poles) || 0) - (Number(a.poles) || 0) ||
    (Number(b.fastestLaps) || 0) - (Number(a.fastestLaps) || 0) ||
    (Number(b.points) || 0) - (Number(a.points) || 0) ||
    compareResultCounts(a, b)
  );
}

function mergeResultCounts(currentCounts = {}, nextCounts = {}) {
  const merged = { ...currentCounts };
  Object.entries(nextCounts).forEach(([position, count]) => {
    merged[position] = (Number(merged[position]) || 0) + (Number(count) || 0);
  });
  return merged;
}

function buildCumulativeStats(statsBySeason) {
  const cumulative = {};
  getSeasonOptions().forEach((selectedSeason) => {
    const map = new Map();
    getSeasonOptions().forEach((season) => {
      if (!isSeasonIncluded(season.id, selectedSeason.id)) return;
      (statsBySeason[season.id] || []).forEach((item) => {
        const current = map.get(item.id) || { ...item, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, points: 0, resultCounts: {} };
        map.set(item.id, {
          ...current,
          ...item,
          wins: current.wins + item.wins,
          podiums: current.podiums + item.podiums,
          poles: current.poles + item.poles,
          fastestLaps: current.fastestLaps + item.fastestLaps,
          points: current.points + item.points,
          resultCounts: mergeResultCounts(current.resultCounts, item.resultCounts),
        });
      });
    });
    cumulative[selectedSeason.id] = Array.from(map.values()).sort(sortByTitlesAndResults);
  });
  return cumulative;
}

const COUNTRY_POSITIONS = {
  allemagne: { x: 50, y: 36 },
  arabiesaoudite: { x: 58, y: 50 },
  australie: { x: 78, y: 73 },
  autriche: { x: 51, y: 39 },
  azerbaidjan: { x: 58, y: 42 },
  bahrein: { x: 59, y: 48 },
  belgique: { x: 48, y: 35 },
  bresil: { x: 35, y: 66 },
  canada: { x: 22, y: 25 },
  chine: { x: 70, y: 47 },
  emiratsarabesunis: { x: 61, y: 50 },
  espagne: { x: 47, y: 43 },
  etatsunis: { x: 20, y: 42 },
  france: { x: 48, y: 39 },
  hongrie: { x: 52, y: 39 },
  italie: { x: 51, y: 43 },
  japon: { x: 82, y: 43 },
  mexique: { x: 20, y: 51 },
  monaco: { x: 50, y: 42 },
  paysbas: { x: 49, y: 34 },
  portugal: { x: 45, y: 43 },
  qatar: { x: 60, y: 49 },
  royaumeuni: { x: 46, y: 33 },
  singapour: { x: 70, y: 61 },
};

function getCountryKey(country) {
  return normalizeResultText(country);
}

function getCountryPosition(country, index = 0) {
  const known = COUNTRY_POSITIONS[getCountryKey(country)];
  if (known) return known;
  return { x: 18 + (index * 13) % 64, y: 28 + (index * 17) % 42 };
}

function getRaceCountry(race, raceLibrary) {
  return raceLibrary.find((item) => idsEqual(item.id, race.libraryRaceId))?.country || race.country || "Pays non renseigné";
}

function PublicSite({ selectedCategoryId, setSelectedCategoryId, selectedSeasonId, setSelectedSeasonId, publicPage, setPublicPage, seasonOnlyDrivers, seasonOnlyTeams, cumulativeDrivers, cumulativeTeams, races, countdownRaces = [], calendarEvents = [], raceLibrary = [], allRaces, raceResults, allDrivers, teams = [], onOpenAdmin }) {
  const [selectedGp, setSelectedGp] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const categoryColor = getCategoryColor(selectedCategoryId);
  
  const leaderDriver = seasonOnlyDrivers[0]?.name || "—";
  const leaderTeam = seasonOnlyTeams[0]?.name || "—";
  return (
    <div className="urtt-public-page" style={styles.publicPage}>
      <header className="urtt-public-header" style={styles.publicHeader}>
        <div>
          <p style={{ ...styles.kicker, color: categoryColor }}>URTT DATABASE · {selectedCategoryId}</p>
          <h1 className="urtt-public-title" style={styles.publicTitle}>Statistiques URTT AREKU_F1</h1>
          <p className="urtt-public-subtitle" style={styles.publicSubtitle}>Site public pour consulter les stats par saison, les pilotes, les écuries et les résultats.</p>
        </div>
        <button onClick={onOpenAdmin} style={{ ...styles.primaryButton, background: categoryColor }}>Admin</button>
      </header>
      <nav className="urtt-public-nav" style={styles.publicNav}>
        <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={{ ...styles.categorySelect, background: categoryColor, borderColor: categoryColor }}>{CATEGORY_OPTIONS.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} style={styles.seasonSelect}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select>
        {["home", "drivers", "teams", "seasons", "world"].map((key) => {
          const labels = { home: "Accueil", drivers: "Stats pilotes", teams: "Stats écuries", seasons: "Saison", world: "Carte" };
          return <button key={key} onClick={() => setPublicPage(key)} style={{ ...styles.publicNavButton, ...(publicPage === key ? { ...styles.publicNavActive, background: categoryColor, borderColor: categoryColor } : {}) }}>{labels[key]}</button>;
        })}
      </nav>
      <main className="urtt-public-main" style={styles.publicMain}>
        {publicPage === "home" && <HomePage selectedCategoryId={selectedCategoryId} selectedSeasonId={selectedSeasonId} leaderDriver={leaderDriver} leaderTeam={leaderTeam} races={races} countdownRaces={countdownRaces} calendarEvents={calendarEvents} seasonOnlyDrivers={seasonOnlyDrivers} seasonOnlyTeams={seasonOnlyTeams} raceResults={raceResults} allDrivers={allDrivers} teams={teams} />}
        {publicPage === "drivers" && <><Card title={`Stats pilotes cumulées S1 → ${seasonName(selectedSeasonId)}`} icon="👥"><DriverTable drivers={cumulativeDrivers} detailed showExtendedStats teams={teams} selectedSeasonId={selectedSeasonId} onDriverClick={(driver) => setSelectedDriver(allDrivers.find((item) => item.id === driver.id) || driver)} /></Card>{selectedDriver && <DriverDetails driver={selectedDriver} raceResults={raceResults} teams={teams} selectedCategoryId={selectedCategoryId} onClose={() => setSelectedDriver(null)} />}</>}
        {publicPage === "teams" && <><Card title={`Stats écuries cumulées S1 → ${seasonName(selectedSeasonId)}`} icon="🏎️"><TeamTable teams={cumulativeTeams} detailed showExtendedStats selectedCategoryId={selectedCategoryId} onTeamClick={(team) => setSelectedTeam(teams.find((item) => item.id === team.id) || team)} /></Card>{selectedTeam && <TeamDetails team={selectedTeam} drivers={allDrivers} raceResults={raceResults} onClose={() => setSelectedTeam(null)} />}</>}
        {publicPage === "seasons" && <><Card title={`Résultats — ${seasonName(selectedSeasonId)}`} icon="🏁"><PublicSeasonResults races={races} raceResults={raceResults} drivers={allDrivers} selectedSeasonId={selectedSeasonId} onOpenGp={setSelectedGp} /></Card>{selectedGp && <GpDetails gp={selectedGp} allRaces={allRaces} raceResults={raceResults} drivers={allDrivers} onClose={() => setSelectedGp(null)} />}</>}
        {publicPage === "world" && <WorldCircuitsPage races={races} raceLibrary={raceLibrary} selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} />}
      </main>
      <FeedbackWidget />
    </div>
  );
}

function WorldCircuitsPage({ races, raceLibrary, selectedSeasonId, selectedCategoryId }) {
  const countries = Object.values(races.reduce((acc, race) => {
    const country = getRaceCountry(race, raceLibrary);
    const key = getCountryKey(country);
    if (!acc[key]) acc[key] = { country, races: [] };
    acc[key].races.push(race);
    return acc;
  }, {})).sort((a, b) => a.country.localeCompare(b.country, "fr"));
  const [selectedCountry, setSelectedCountry] = useState(countries[0]?.country || "");
  const activeCountry = countries.find((item) => item.country === selectedCountry) || countries[0];

  return (
    <div style={styles.worldPage}>
      <div style={styles.worldHero}>
        <h2 style={styles.worldTitle}>{seasonName(selectedSeasonId)} — Circuits du monde</h2>
        <p style={styles.worldSubtitle}>Clique sur un pays pour voir les circuits disponibles en {selectedCategoryId}.</p>
      </div>
      <div style={styles.worldLayout}>
        <div style={styles.worldMap}>
          <iframe
            title="Carte du monde"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-180%2C-58%2C180%2C82&layer=mapnik"
            style={styles.worldMapFrame}
          />
          <div style={styles.worldMapShade} />
          {countries.map((item, index) => {
            const position = getCountryPosition(item.country, index);
            const active = activeCountry?.country === item.country;
            return (
              <button key={item.country} type="button" onClick={() => setSelectedCountry(item.country)} style={{ ...styles.countryPin, left: `${position.x}%`, top: `${position.y}%`, ...(active ? styles.countryPinActive : {}) }}>
                <span>{item.country}</span>
                <strong>{item.races.length}</strong>
              </button>
            );
          })}
          {countries.length === 0 && <div style={styles.worldEmpty}>Aucun pays renseigné pour cette saison.</div>}
        </div>
        <Card title={activeCountry ? activeCountry.country : "Pays"} icon="🌍">
          <div style={styles.stack}>
            {activeCountry?.races.map((race) => (
              <div key={race.id} style={styles.itemBox}>
                <div>
                  <strong>{race.round}. {race.name}</strong>
                  <p style={styles.mutedSmall}>{selectedCategoryId} · {seasonName(race.seasonId)} · {formatRaceDate(race.startAt)}</p>
                </div>
                <span style={{ ...styles.categoryBadge, background: getCategoryColor(selectedCategoryId) }}>{selectedCategoryId}</span>
              </div>
            ))}
            {!activeCountry && <Empty text="Aucun circuit à afficher." />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HomePage({ selectedCategoryId, selectedSeasonId, leaderDriver, leaderTeam, races, countdownRaces = [], calendarEvents = [], seasonOnlyDrivers, seasonOnlyTeams, raceResults, allDrivers, teams }) {
  return (
    <>
      <div style={styles.statsGrid}>
        <Stat label="Catégorie" value={selectedCategoryId} />
        <Stat label="Saison" value={seasonName(selectedSeasonId)} />
        <Stat label="Leader pilote" value={leaderDriver} />
        <Stat label="Leader écurie" value={leaderTeam} />
        <Stat label="GP" value={races.length} />
      </div>
      <RaceCountdown races={countdownRaces} events={calendarEvents} />
      <div style={styles.section}>
        <Card title={`Classement pilotes — ${seasonName(selectedSeasonId)}`} icon="🏆"><DriverTable drivers={seasonOnlyDrivers} raceDetails races={races} raceResults={raceResults} teams={teams} selectedSeasonId={selectedSeasonId} /></Card>
        <Card title={`Classement écuries — ${seasonName(selectedSeasonId)}`} icon="🏎️"><TeamTable teams={seasonOnlyTeams} raceDetails races={races} raceResults={raceResults} drivers={allDrivers} selectedCategoryId={selectedCategoryId} /></Card>
      </div>
    </>
  );
}

function AdminLayout({ active, setActive, adminUser, onPublic, onLogout, children }) {
  const items = [["dashboard", "🏠", "Dashboard"], ["supabase", "🗄️", "Supabase"], ["search", "🔎", "Recherche"],["titles", "👑", "Titres"], ["drivers", "👥", "Pilotes"], ["teams", "🏎️", "Écuries"], ["races", "🏁", "Courses"], ["planning", "⏱️", "Planning"], ["results", "🏆", "Résultats"], ["settings", "⚙️", "Réglages"]];
  return (
    <div className="urtt-admin-page" style={styles.page}>
      <aside className="urtt-admin-sidebar" style={styles.sidebar}>
        <div className="urtt-admin-logo" style={styles.logoRow}>
          <div style={styles.logo}>UR</div>
          <div><h1 style={styles.logoTitle}>URTT Admin</h1><p style={styles.logoSubtitle}>Panel privé</p></div>
        </div>
        <nav className="urtt-admin-nav" style={styles.nav}>
          {items.map(([key, icon, label]) => <button className="urtt-admin-nav-button" key={key} onClick={() => setActive(key)} style={{ ...styles.navButton, ...(active === key ? styles.navButtonActive : {}) }}><span>{icon}</span><span>{label}</span></button>)}
        </nav>
      </aside>
      <main className="urtt-admin-main" style={styles.main}>
        <header className="urtt-admin-header" style={styles.header}>
          <div><p style={styles.kicker}>PANEL ADMIN</p><h2 style={styles.title}>Gestion URTT</h2>{adminUser?.email && <p style={styles.mutedSmall}>Connecté : {adminUser.email}</p>}</div>
          <div className="urtt-admin-actions" style={styles.headerActions}><button onClick={onPublic} style={styles.secondaryButton}>Voir le public</button><button onClick={onLogout} style={styles.primaryButton}>Déconnexion</button></div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Dashboard({ drivers, teams, races, selectedCategoryId, selectedSeasonId }) {
  return <div style={styles.section}><div style={styles.statsGrid}><Stat label="Catégorie" value={selectedCategoryId} /><Stat label="Saison" value={seasonName(selectedSeasonId)} /><Stat label="Pilotes" value={drivers.length} /><Stat label="Écuries" value={teams.length} /><Stat label="GP" value={races.length} /></div><div style={styles.twoColumns}><Card title="Top pilotes global" icon="🏆"><DriverTable drivers={drivers} teams={[]} /></Card><Card title="Top écuries global" icon="🏎️"><TeamTable teams={teams} /></Card></div></div>;
}

function SupabasePanel({ isLoading, lastSyncAt, errors, teams, drivers, raceLibrary, allCalendarRaces, calendarFeedHits = [], raceResults, selectedCategoryId, selectedSeasonId }) {
  const visibleCalendar = allCalendarRaces.filter((race) => normalizeCategoryId(race.categoryId) === normalizeCategoryId(selectedCategoryId) && normalizeSeasonId(race.seasonId) === normalizeSeasonId(selectedSeasonId));
  const visibleResults = raceResults.filter((result) => normalizeCategoryId(result.categoryId) === normalizeCategoryId(selectedCategoryId) && normalizeSeasonId(result.seasonId) === normalizeSeasonId(selectedSeasonId));
  const visibleEntriesCount = visibleResults.reduce((sum, result) => sum + result.entries.length, 0);
  const estimated7Days = getCalendarFeedEstimate(calendarFeedHits, 7);
  const estimated30Days = getCalendarFeedEstimate(calendarFeedHits, 30);

  return <div style={styles.section}><Card title="État Supabase" icon="🗄️"><div style={styles.statsGrid}><Stat label="Connexion" value={isLoading ? "Chargement..." : errors.length ? "Erreur" : "OK"} /><Stat label="Dernière synchro" value={lastSyncAt ? lastSyncAt.toLocaleTimeString("fr-FR") : "—"} /><Stat label="Catégorie active" value={selectedCategoryId} /><Stat label="Saison active" value={seasonName(selectedSeasonId)} /></div>{errors.length > 0 && <div style={styles.errorBox}>{errors.map((error) => <p key={error} style={styles.errorText}>{error}</p>)}</div>}</Card><div style={styles.statsGrid}><Stat label="Écuries Supabase" value={teams.length} /><Stat label="Pilotes Supabase" value={drivers.length} /><Stat label="GP bibliothèque" value={raceLibrary.length} /><Stat label="Calendrier affiché" value={visibleCalendar.length} /><Stat label="Résultats affichés" value={visibleResults.length} /><Stat label="Entrées résultats" value={visibleEntriesCount} /><Stat label="Abonnés estimés 7j" value={estimated7Days} /><Stat label="Abonnés estimés 30j" value={estimated30Days} /></div><div style={styles.twoColumns}><Card title="Derniers pilotes chargés" icon="👥"><div style={styles.stack}>{drivers.slice(0, 8).map((driver) => <div key={driver.id} style={styles.itemBox}><DriverIdentity driver={driver} /><span style={styles.mutedSmall}>ID {driver.id}</span></div>)}{drivers.length === 0 && <Empty text="Aucun pilote chargé depuis Supabase." />}</div></Card><Card title="Derniers GP chargés" icon="🏁"><div style={styles.stack}>{raceLibrary.slice(0, 8).map((race) => <div key={race.id} style={styles.itemBox}><strong>{race.name}</strong><span style={styles.mutedSmall}>ID {race.id}</span></div>)}{raceLibrary.length === 0 && <Empty text="Aucun GP chargé depuis Supabase." />}</div></Card></div></div>;
}

function AdminSearch({ search, setSearch, drivers, teams, onEditDriver, onEditTeam }) {
  const query = search.trim().toLowerCase();
  const matchedDrivers = drivers.filter((driver) => {
    const team = teams.find((item) => item.id === driver.teamId);
    return `${driver.name} ${driver.number} ${team?.name || ""}`.toLowerCase().includes(query);
  });
  const matchedTeams = teams.filter((team) => `${team.name}`.toLowerCase().includes(query));

  return <div style={styles.section}><Card title="Recherche admin" icon="🔎"><div style={styles.searchBox}>🔎 <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un pilote, numéro ou une écurie..." style={styles.searchInput} /></div><p style={styles.mutedSmall}>Tape un nom ou un numéro pour retrouver rapidement une fiche à modifier.</p></Card><div style={styles.twoColumns}><Card title={`Pilotes trouvés (${matchedDrivers.length})`} icon="👥"><div style={styles.stack}>{matchedDrivers.map((driver) => <div key={driver.id} style={styles.itemBox}><DriverIdentity driver={driver} /><button onClick={() => onEditDriver(driver)} style={styles.editButton}>Modifier</button></div>)}{matchedDrivers.length === 0 && <Empty text="Aucun pilote trouvé." />}</div></Card><Card title={`Écuries trouvées (${matchedTeams.length})`} icon="🏎️"><div style={styles.stack}>{matchedTeams.map((team) => <div key={team.id} style={styles.itemBox}><TeamIdentity team={team} /><button onClick={() => onEditTeam(team)} style={styles.editButton}>Modifier</button></div>)}{matchedTeams.length === 0 && <Empty text="Aucune écurie trouvée." />}</div></Card></div></div>;
}

function AdminDrivers({ drivers, teams, selectedSeasonId, form, setForm, editingId, isSaving, onSave, onEdit, onDelete, onCancel, search, setSearch }) {
  return <div style={styles.twoColumnsSmallLeft}><Card title={editingId ? "Modifier un pilote" : "Créer un pilote"} icon="➕"><DriverForm form={form} setForm={setForm} teams={teams} selectedSeasonId={selectedSeasonId} onSave={onSave} onCancel={onCancel} editingId={editingId} isSaving={isSaving} /></Card><Card title="Pilotes" icon="👥"><div style={styles.searchBox}>🔎 <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." style={styles.searchInput} /></div><div style={styles.cardGrid}>{drivers.map((driver) => <DriverAdminCard key={driver.id} driver={driver} team={teams.find((team) => team.id === driver.teamId)} onEdit={onEdit} onDelete={onDelete} />)}</div>{drivers.length === 0 && <Empty text="Aucun pilote pour le moment." />}</Card></div>;
}

function PlanningPanel({ races, calendarEvents = [], eventForm, setEventForm, selectedCategoryId, setSelectedCategoryId, selectedSeasonId, setSelectedSeasonId, onUpdateStartAt, onSaveEvent, onDeleteEvent, isSavingEvent }) {
  const [now] = useState(() => Date.now());
  const categoryId = normalizeCategoryId(selectedCategoryId);
  const seasonId = normalizeSeasonId(selectedSeasonId);
  const filteredRaces = races
    .filter((race) => normalizeCategoryId(race.categoryId) === categoryId && normalizeSeasonId(race.seasonId) === seasonId)
    .sort((a, b) => Number(a.round) - Number(b.round));
  const upcomingRaces = races
    .filter((race) => race.startAt && new Date(race.startAt).getTime() > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 8);
  const upcomingEvents = calendarEvents
    .filter((event) => event.startAt && new Date(event.startAt).getTime() > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 8);

  return (
    <div style={styles.section}>
      <Card title="Planning des prochaines courses" icon="⏱️">
        <div style={styles.resultsInfo}>
          <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={styles.resultsSelect}>{CATEGORY_OPTIONS.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label style={styles.label}><span style={styles.labelText}>Saison</span><select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} style={styles.resultsSelect}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        </div>
        <div style={styles.stack}>{filteredRaces.map((race) => <div key={race.id} style={styles.itemBox}><div><strong>{race.round}. {race.name}</strong><p style={styles.mutedSmall}>{race.categoryId} · {seasonName(race.seasonId)} · {formatRaceDate(race.startAt)}</p></div><RaceDateInput race={race} onSave={onUpdateStartAt} /></div>)}{filteredRaces.length === 0 && <Empty text="Aucune course dans cette saison." />}</div>
      </Card>

      <div style={styles.twoColumns}>
        <Card title="Événement hors calendrier" icon="➕">
          <div style={styles.stack}>
            <Input label="Titre" value={eventForm.title} onChange={(value) => setEventForm({ ...eventForm, title: value })} />
            <label style={styles.label}><span style={styles.labelText}>Description</span><textarea value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} rows={4} style={styles.textarea} /></label>
            <Input label="Début" type="datetime-local" value={eventForm.startAt} onChange={(value) => setEventForm({ ...eventForm, startAt: value })} />
            <Input label="Fin optionnelle" type="datetime-local" value={eventForm.endAt} onChange={(value) => setEventForm({ ...eventForm, endAt: value })} />
            <button type="button" onClick={onSaveEvent} disabled={isSavingEvent} style={styles.fullButton}>{isSavingEvent ? "Sauvegarde..." : "Ajouter au calendrier abonné"}</button>
          </div>
        </Card>

        <Card title="Événements à venir" icon="📌">
          <div style={styles.stack}>
            {upcomingEvents.map((event) => (
              <div key={event.id} style={styles.itemBox}>
                <div>
                  <strong>{event.title}</strong>
                  <p style={styles.mutedSmall}>{formatRaceDate(event.startAt)}{event.endAt ? ` · Fin ${formatRaceDate(event.endAt)}` : ""}</p>
                  {event.description && <p style={styles.mutedSmall}>{event.description}</p>}
                </div>
                <button type="button" onClick={() => onDeleteEvent(event.id)} disabled={isSavingEvent} style={styles.dangerButton}>Supprimer</button>
              </div>
            ))}
            {upcomingEvents.length === 0 && <Empty text="Aucun événement hors calendrier programmé." />}
          </div>
        </Card>
      </div>

      <Card title="Aperçu public" icon="📅">
        <div style={styles.stack}>{upcomingRaces.map((race) => <div key={race.id} style={styles.itemBox}><div><strong>{race.name}</strong><p style={styles.mutedSmall}>{race.categoryId} · {seasonName(race.seasonId)} · Course #{race.round}</p></div><span style={styles.badgeGreen}>{formatRaceDate(race.startAt)}</span></div>)}{upcomingRaces.length === 0 && <Empty text="Aucune course future programmée." />}</div>
      </Card>
    </div>
  );
}

function DriverForm({ form, setForm, teams, selectedSeasonId, onSave, onCancel, editingId, isSaving }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  const updateCrown = (key, value) => setForm({ ...form, tripleCrown: { ...form.tripleCrown, [key]: value } });

  async function uploadDriverLogo(file) {
    if (!file) return;

    const fileExtension = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension}`;
    const filePath = `drivers/${fileName}`;

    const { error } = await supabase.storage
      .from("team-logos")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error("Erreur upload logo pilote:", error);
      alert("Impossible d’importer le logo pilote. Vérifie le bucket team-logos et les policies Storage.");
      return;
    }

    const { data } = supabase.storage
      .from("team-logos")
      .getPublicUrl(filePath);

    update("avatar", data.publicUrl);
  }

  return <div style={styles.stack}><Input label="Nom du pilote" value={form.name} onChange={(value) => update("name", value)} /><Input label="Numéro" type="number" value={form.number} onChange={(value) => update("number", value)} /><ColorInput label="Couleur" value={form.color} onChange={(value) => update("color", value)} /><Input label="Logo pilote URL" value={form.avatar} onChange={(value) => update("avatar", value)} /><label style={styles.label}><span style={styles.labelText}>Importer un logo pilote</span><input type="file" accept="image/*" onChange={(event) => uploadDriverLogo(event.target.files?.[0])} style={styles.fileInput} /></label>{form.avatar && <div style={styles.logoPreviewBox}><DriverIdentity driver={form} /></div>}<label style={styles.checkboxPill}><input type="checkbox" checked={Boolean(form.retired)} onChange={(event) => update("retired", event.target.checked)} /> Pilote retraité</label><div style={styles.formGrid}><Input label="Titres pilote" type="number" value={form.driverTitles} onChange={(value) => update("driverTitles", value)} /><Input label="Titres écurie" type="number" value={form.teamTitles} onChange={(value) => update("teamTitles", value)} /></div><div style={styles.teamPreview}><span style={styles.labelText}>Triple Couronne</span><label><input type="checkbox" checked={form.tripleCrown.monaco} onChange={(event) => updateCrown("monaco", event.target.checked)} /> Titre F1</label><label><input type="checkbox" checked={form.tripleCrown.indy500} onChange={(event) => updateCrown("indy500", event.target.checked)} /> Indy 300</label><label><input type="checkbox" checked={form.tripleCrown.lemans} onChange={(event) => updateCrown("lemans", event.target.checked)} /> 2,4H du Mans</label></div><ParticipationEditor form={form} setForm={setForm} teams={teams} selectedSeasonId={selectedSeasonId} /><button onClick={onSave} disabled={isSaving} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : editingId ? "Enregistrer" : "Créer le pilote"}</button>{editingId && <button onClick={onCancel} style={styles.secondaryButton}>Annuler</button>}</div>;
}

function AdminTeams({ teams, form, setForm, editingId, isSaving, onSave, onEdit, onDelete, onCancel }) {
  return <div style={styles.twoColumnsSmallLeft}><Card title={editingId ? "Modifier une écurie" : "Créer une écurie"} icon="➕"><TeamForm form={form} setForm={setForm} onSave={onSave} onCancel={onCancel} editingId={editingId} isSaving={isSaving} /></Card><Card title="Écuries" icon="🏎️"><div style={styles.cardGrid}>{teams.map((team) => <TeamAdminCard key={team.id} team={team} onEdit={onEdit} onDelete={onDelete} />)}</div>{teams.length === 0 && <Empty text="Aucune écurie pour le moment." />}</Card></div>;
}

function TeamForm({ form, setForm, onSave, onCancel, editingId, isSaving }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  const updateDriverTitleF1 = (value) => setForm({ ...form, driverTitles: value, driverTitlesF1: value });
  const updateTeamTitleF1 = (value) => setForm({ ...form, teamTitles: value, teamTitlesF1: value });

  async function uploadTeamLogo(file) {
    if (!file) return;

    const fileExtension = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension}`;
    const filePath = `logos/${fileName}`;

    const { error } = await supabase.storage
      .from("team-logos")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error("Erreur upload logo:", error);
      alert("Impossible d’importer le logo. Vérifie le bucket team-logos et les policies Storage.");
      return;
    }

    const { data } = supabase.storage
      .from("team-logos")
      .getPublicUrl(filePath);

    update("logo", data.publicUrl);
  }
  return <div style={styles.stack}><Input label="Nom de l’écurie" value={form.name} onChange={(value) => update("name", value)} /><ColorInput label="Couleur" value={form.color} onChange={(value) => update("color", value)} /><Input label="Logo URL" value={form.logo} onChange={(value) => update("logo", value)} /><label style={styles.label}><span style={styles.labelText}>Importer un logo</span><input type="file" accept="image/*" onChange={(event) => uploadTeamLogo(event.target.files?.[0])} style={styles.fileInput} /></label>{form.logo && <div style={styles.logoPreviewBox}><TeamIdentity team={form} /></div>}<div style={styles.formGrid}><Input label="Titre pilote F1" type="number" value={form.driverTitlesF1 ?? form.driverTitles ?? 0} onChange={updateDriverTitleF1} /><Input label="Titre pilote F2" type="number" value={form.driverTitlesF2 ?? 0} onChange={(value) => update("driverTitlesF2", value)} /><Input label="Titre pilote FE" type="number" value={form.driverTitlesFE ?? 0} onChange={(value) => update("driverTitlesFE", value)} /><Input label="Titre constructeur F1" type="number" value={form.teamTitlesF1 ?? form.teamTitles ?? 0} onChange={updateTeamTitleF1} /><Input label="Titre constructeur F2" type="number" value={form.teamTitlesF2 ?? 0} onChange={(value) => update("teamTitlesF2", value)} /><Input label="Titre constructeur FE" type="number" value={form.teamTitlesFE ?? 0} onChange={(value) => update("teamTitlesFE", value)} /><Input label="Triple couronnes" type="number" value={form.tripleCrowns} onChange={(value) => update("tripleCrowns", value)} /></div><button onClick={onSave} disabled={isSaving} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : editingId ? "Enregistrer" : "Créer l’écurie"}</button>{editingId && <button onClick={onCancel} style={styles.secondaryButton}>Annuler</button>}</div>;
}

function AdminRaces({ raceForm, setRaceForm, raceLibrary, allCalendarRaces = [], calendarRaceForm, setCalendarRaceForm, racesBySeason, selectedCategoryId, setSelectedCategoryId, selectedSeasonId, setSelectedSeasonId, onSave, onAddToSeason, onDelete, onDeleteLibraryRace, onUpdateLibraryRaceCountry, onMoveRace, onUpdateStartAt, isSavingRace }) {
  const [librarySearch, setLibrarySearch] = useState("");
  const [calendarSearch, setCalendarSearch] = useState("");
  const races = racesBySeason[selectedSeasonId] || [];
  const sortedRaceLibrary = sortRacesByName(raceLibrary);
  const participationCounts = allCalendarRaces.reduce((counts, race) => {
    const key = String(race.libraryRaceId || "");
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const libraryQuery = librarySearch.trim().toLowerCase();
  const calendarQuery = calendarSearch.trim().toLowerCase();
  const filteredRaces = calendarQuery ? races.filter((race) => String(race.name || "").toLowerCase().includes(calendarQuery)) : races;
  const filteredLibrary = libraryQuery ? sortedRaceLibrary.filter((race) => String(race.name || "").toLowerCase().includes(libraryQuery)) : sortedRaceLibrary;

  return (
    <div style={styles.twoColumnsSmallLeft}>
      <Card title="Bibliothèque des GP" icon="🏁">
        <div style={styles.stack}>
          <Input label="Nom du Grand Prix" value={raceForm.name} onChange={(value) => setRaceForm({ ...raceForm, name: value })} />
          <Input label="Pays" value={raceForm.country} onChange={(value) => setRaceForm({ ...raceForm, country: value })} />
          <button onClick={onSave} disabled={isSavingRace} style={styles.fullButton}>{isSavingRace ? "Sauvegarde..." : "Créer le GP"}</button>
          <div style={styles.searchBox}>🔎 <input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Rechercher un circuit..." style={styles.searchInput} /></div>
          <div style={styles.stack}>
            {filteredLibrary.map((race) => (
              <RaceLibraryItem key={race.id} race={race} participations={participationCounts[String(race.id)] || 0} onSaveCountry={onUpdateLibraryRaceCountry} onDelete={onDeleteLibraryRace} isSavingRace={isSavingRace} />
            ))}
            {filteredLibrary.length === 0 && <Empty text={libraryQuery ? "Aucun GP trouvé dans la bibliothèque." : "Aucun GP dans la bibliothèque."} />}
          </div>
        </div>
      </Card>

      <Card title="Calendrier par catégorie" icon="📅">
        <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={styles.input}>{CATEGORY_OPTIONS.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label style={styles.label}><span style={styles.labelText}>Saison</span><select value={selectedSeasonId} onChange={(event) => { setSelectedSeasonId(event.target.value); setCalendarRaceForm({ ...calendarRaceForm, seasonId: event.target.value }); }} style={styles.input}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        <label style={styles.label}><span style={styles.labelText}>Ajouter un GP au calendrier</span><select value={calendarRaceForm.raceId} onChange={(event) => setCalendarRaceForm({ ...calendarRaceForm, raceId: event.target.value, seasonId: selectedSeasonId })} style={styles.input}><option value="">Choisir un GP</option>{sortedRaceLibrary.map((race) => <option key={race.id} value={race.id}>{race.name}</option>)}</select></label>
        <button onClick={onAddToSeason} disabled={isSavingRace} style={styles.fullButton}>{isSavingRace ? "Sauvegarde..." : "Ajouter au calendrier"}</button>
        <div style={styles.searchBox}>🔎 <input value={calendarSearch} onChange={(event) => setCalendarSearch(event.target.value)} placeholder="Rechercher dans le calendrier..." style={styles.searchInput} /></div>
        <RaceTable races={filteredRaces} onDelete={(raceId) => onDelete(selectedSeasonId, raceId)} onMoveRace={calendarQuery ? null : onMoveRace} onUpdateStartAt={onUpdateStartAt} isSavingRace={isSavingRace} />
      </Card>
    </div>
  );
}

function RaceLibraryItem({ race, participations, onSaveCountry, onDelete, isSavingRace }) {
  const [country, setCountry] = useState(race.country || "");
  const [status, setStatus] = useState("");

  async function saveCountry() {
    setStatus("");
    const saved = await onSaveCountry(race.id, country);
    if (saved) setStatus("Pays enregistré");
  }

  return (
    <div style={styles.itemBox}>
      <div style={styles.raceLibraryInfo}>
        <strong>{race.name}</strong>
        <p style={styles.mutedSmall}>Participations : {participations}</p>
        {status && <p style={styles.mutedSmall}>{status}</p>}
      </div>
      <div style={styles.countryEditRow}>
        <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Pays" style={styles.compactInput} />
        <button type="button" onClick={saveCountry} disabled={isSavingRace} style={styles.editButton}>Pays</button>
        <button type="button" onClick={() => onDelete(race.id)} disabled={isSavingRace} style={styles.dangerButton}>Supprimer</button>
      </div>
    </div>
  );
}

function ResultsManager({ drivers, teams, selectedCategoryId, setSelectedCategoryId, races, selectedSeasonId, setSelectedSeasonId, selectedRaceId, setSelectedRaceId, getResultEntry, updateResultEntry, onValidate, isSavingResult }) {
  const [quickResults, setQuickResults] = useState("");
  const [quickStatus, setQuickStatus] = useState("");
  const [poleDriverId, setPoleDriverId] = useState("");
  const [fastestDriverId, setFastestDriverId] = useState("");
  const [positionOrder, setPositionOrder] = useState([]);
  const pointsLabel = usesSpecialF2Points(selectedCategoryId, selectedSeasonId)
    ? "Barème F2 S3/S4 : 20 · 18 · 17 · 16, puis -1 jusqu’à P19. P20 ne marque pas."
    : "Barème : 30 · 25 · 22 · 20 · 18 · 16 · 14 · 12 · puis -1 jusqu’à P19. Aucun point bonus pour le meilleur tour.";

  function findDriverFromLine(line) {
    const normalizedLine = normalizeResultText(cleanQuickResultLine(line));
    if (!normalizedLine) return null;
    return drivers.find((driver) => normalizeResultText(driver.name) === normalizedLine)
      || drivers.find((driver) => normalizedLine.includes(normalizeResultText(driver.name)) || normalizeResultText(driver.name).includes(normalizedLine));
  }

  function applyQuickResults() {
    setQuickStatus("");
    if (!selectedRaceId) {
      setQuickStatus("Choisis d'abord un circuit.");
      return;
    }

    const lines = quickResults.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      setQuickStatus("Colle au moins un pilote.");
      return;
    }

    const usedDrivers = new Set();
    const missing = [];
    let applied = 0;

    lines.forEach((line, index) => {
      const driver = findDriverFromLine(line);
      if (!driver || usedDrivers.has(String(driver.id))) {
        if (!driver) missing.push(cleanQuickResultLine(line));
        return;
      }
      usedDrivers.add(String(driver.id));
      updateResultEntry(driver.id, "position", index + 1);
      applied += 1;
    });

    setPositionOrder(lines.map((line) => findDriverFromLine(line)?.id || "").filter(Boolean));
    setQuickStatus(missing.length ? `${applied} positions remplies. Introuvables : ${missing.join(", ")}` : `${applied} positions remplies.`);
  }

  function updatePositionPick(positionIndex, driverId) {
    if (!selectedRaceId) {
      setQuickStatus("Choisis d'abord un circuit.");
      return;
    }

    setPositionOrder((current) => {
      const next = [...current];
      const existingIndex = next.findIndex((item) => idsEqual(item, driverId));
      if (existingIndex >= 0 && existingIndex !== positionIndex) next[existingIndex] = "";
      next[positionIndex] = driverId;
      return next;
    });

    if (driverId) updateResultEntry(driverId, "position", positionIndex + 1);
  }

  function applyQuickFlags() {
    if (!selectedRaceId) {
      setQuickStatus("Choisis d'abord un circuit.");
      return;
    }
    drivers.forEach((driver) => {
      updateResultEntry(driver.id, "pole", idsEqual(driver.id, poleDriverId));
      updateResultEntry(driver.id, "fastestLap", idsEqual(driver.id, fastestDriverId));
    });
    setQuickStatus("Pole et MT appliqués.");
  }

  return <Card title="Résultats automatiques" icon="🏆"><div style={styles.stack}><div style={styles.resultsInfo}><label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => { setSelectedCategoryId(event.target.value); setSelectedRaceId(""); setPositionOrder([]); }} style={styles.resultsSelect}>{CATEGORY_OPTIONS.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label style={styles.label}><span style={styles.labelText}>Saison</span><select value={selectedSeasonId} onChange={(event) => { setSelectedSeasonId(event.target.value); setSelectedRaceId(""); setPositionOrder([]); }} style={styles.resultsSelect}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label><label style={styles.label}><span style={styles.labelText}>Circuit</span><select value={selectedRaceId} onChange={(event) => { setSelectedRaceId(event.target.value); setPositionOrder([]); }} style={styles.resultsSelect}><option value="">Choisir un GP</option>{races.map((race) => <option key={race.id} value={race.id}>{race.round}. {race.name}</option>)}</select></label><button onClick={onValidate} disabled={isSavingResult} style={styles.primaryButton}>{isSavingResult ? "Sauvegarde..." : "Valider la course"}</button></div><p style={styles.mutedSmall}>{pointsLabel}</p>{drivers.length === 0 ? <Empty text={`Aucun pilote inscrit en ${selectedCategoryId} sur ${seasonName(selectedSeasonId)}.`} /> : <><div style={styles.quickResultBox}><PositionPicker drivers={drivers} positionOrder={positionOrder} onPick={updatePositionPick} /><label style={styles.label}><span style={styles.labelText}>Coller l'ordre d'arrivée</span><textarea value={quickResults} onChange={(event) => setQuickResults(event.target.value)} rows={8} placeholder={"Zach\nMarden\nLeroi\nNatalino"} style={styles.textarea} /></label><div style={styles.resultsInfo}><label style={styles.label}><span style={styles.labelText}>Pole</span><select value={poleDriverId} onChange={(event) => setPoleDriverId(event.target.value)} style={styles.resultsSelect}><option value="">Aucun</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label><label style={styles.label}><span style={styles.labelText}>Meilleur tour</span><select value={fastestDriverId} onChange={(event) => setFastestDriverId(event.target.value)} style={styles.resultsSelect}><option value="">Aucun</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label><button type="button" onClick={applyQuickResults} style={styles.secondaryButton}>Appliquer l'ordre collé</button><button type="button" onClick={applyQuickFlags} style={styles.secondaryButton}>Appliquer Pole / MT</button></div>{quickStatus && <p style={styles.mutedSmall}>{quickStatus}</p>}</div><ResultTable drivers={drivers} teams={teams} selectedCategoryId={selectedCategoryId} selectedSeasonId={selectedSeasonId} getResultEntry={getResultEntry} updateResultEntry={updateResultEntry} /></>}</div></Card>;
}

function PositionPicker({ drivers, positionOrder, onPick }) {
  return (
    <div>
      <span style={styles.labelText}>Saisie position par position</span>
      <div style={styles.positionGrid}>
        {drivers.map((_, index) => {
          const selectedId = positionOrder[index] || "";
          const usedIds = new Set(positionOrder.filter((driverId, driverIndex) => driverId && driverIndex !== index).map(String));
          return (
            <label key={index} style={styles.positionPick}>
              <span>P{index + 1}</span>
              <select value={selectedId} onChange={(event) => onPick(index, event.target.value)} style={styles.resultsSelect}>
                <option value="">Choisir</option>
                {drivers.filter((driver) => !usedIds.has(String(driver.id))).map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ResultTable({ drivers, teams, selectedCategoryId, selectedSeasonId, getResultEntry, updateResultEntry }) {
  return <div style={styles.tableWrap}><table style={styles.table}><thead><tr style={styles.tableHead}><th style={styles.th}>Pilote</th><th style={styles.th}>Écurie</th><th style={styles.th}>Position</th><th style={styles.th}>Pole</th><th style={styles.th}>MT</th><th style={styles.th}>Points</th></tr></thead><tbody>{drivers.map((driver, index) => { const entry = getResultEntry(driver.id); const team = getDriverSeasonTeam(driver, selectedSeasonId, teams); return <tr key={driver.id} style={styles.tr}><td style={styles.td}><DriverIdentity driver={driver} teamColor={team?.color} teamLogo={team?.logo} /></td><td style={styles.td}>{team?.name || "—"}</td><td style={styles.td}><input type="number" min="1" max="30" value={entry.position || index + 1} onChange={(event) => updateResultEntry(driver.id, "position", Number(event.target.value))} style={styles.positionInput} /></td><td style={styles.td}><input type="checkbox" checked={Boolean(entry.pole)} onChange={(event) => updateResultEntry(driver.id, "pole", event.target.checked)} /></td><td style={styles.td}><input type="checkbox" checked={Boolean(entry.fastestLap)} onChange={(event) => updateResultEntry(driver.id, "fastestLap", event.target.checked)} /></td><td style={{ ...styles.td, ...styles.points }}>{getPointsForPosition(Number(entry.position || index + 1), selectedCategoryId, selectedSeasonId)}</td></tr>; })}</tbody></table></div>;
}

function SettingsPanel({ seasons = [], onAddSeason, isSaving }) {
  const nextSeason = getNextSeasonOption(seasons);
  const latestSeason = seasons[seasons.length - 1];
  return (
    <div style={styles.section}>
      <Card title="Réglages" icon="⚙️">
        <div style={styles.cardGrid}>
          <Setting title="Accès privé" description="Le panel admin est protégé par mot de passe." active />
          <Setting title="Stats automatiques" description="Les stats sont recalculées depuis les résultats." active />
          <Setting title="Données modifiables" description="Tu peux créer pilotes, écuries et GP." active />
        </div>
      </Card>
      <Card title="Saisons" icon="📅">
        <div style={styles.itemBox}>
          <div>
            <strong>Dernière saison : {latestSeason?.name || "Aucune"}</strong>
            <p style={styles.mutedSmall}>Prochaine création : {nextSeason.name}</p>
          </div>
          <button type="button" onClick={onAddSeason} disabled={isSaving} style={styles.primaryButton}>{isSaving ? "Création..." : `Ajouter ${nextSeason.name}`}</button>
        </div>
      </Card>
    </div>
  );
}

function DriverTable({ drivers, detailed = false, raceDetails = false, races = [], raceResults = [], showExtendedStats = false, onDriverClick, teams = [], selectedSeasonId }) {
  const records = buildRecordMap(drivers, ["driverTitles", "teamTitles", "wins", "podiums", "poles", "fastestLaps", "points"]);
  return (
    <div style={styles.tableWrap}>
      <table className="urtt-standings-table urtt-driver-standings" style={{ ...styles.table, minWidth: raceDetails ? Math.max(950, 650 + races.length * 105) : 850 }}>
        <thead><tr style={styles.tableHead}><th style={styles.th}>#</th><th style={styles.th}>Pilote</th><th style={styles.th}>Écurie</th>{raceDetails && races.map((race) => <th key={race.id} style={styles.th}><span style={styles.raceColumnTitle}>R{race.round}</span><span style={styles.raceColumnSub}>{shortRaceName(race.name)}</span></th>)}{showExtendedStats && <><th style={styles.th}>Titre P.</th><th style={styles.th}>Titre C.</th><th style={styles.th}>V</th><th style={styles.th}>Pod.</th><th style={styles.th}>Poles</th><th style={styles.th}>MT</th></>}<th style={styles.th}>Points</th>{detailed && <th style={styles.th}>Triple Couronne</th>}</tr></thead>
        <tbody>{drivers.map((driver, index) => { const team = getDriverSeasonTeam(driver, selectedSeasonId, teams); return <tr key={driver.id} style={styles.tr}><td style={styles.td}>#{index + 1}</td><td style={styles.td}>{onDriverClick ? <button onClick={() => onDriverClick(driver)} style={styles.nameButton}><DriverIdentity driver={driver} teamColor={team?.color} teamLogo={team?.logo} /></button> : <DriverIdentity driver={driver} teamColor={team?.color} teamLogo={team?.logo} />}</td><td style={styles.td}>{driver.retired ? "Retraité" : driver.teamName || team?.name || "—"}</td>{raceDetails && races.map((race) => <td key={race.id} style={styles.td}><DriverRaceCell driverId={driver.id} race={race} raceResults={raceResults} /></td>)}{showExtendedStats && <><td style={styles.td}><RecordValue value={driver.driverTitles || 0} record={isRecordValue(records, "driverTitles", driver.driverTitles)} /></td><td style={styles.td}><RecordValue value={driver.teamTitles || 0} record={isRecordValue(records, "teamTitles", driver.teamTitles)} /></td><td style={styles.td}><RecordValue value={driver.wins} record={isRecordValue(records, "wins", driver.wins)} /></td><td style={styles.td}><RecordValue value={driver.podiums} record={isRecordValue(records, "podiums", driver.podiums)} /></td><td style={styles.td}><RecordValue value={driver.poles} record={isRecordValue(records, "poles", driver.poles)} /></td><td style={styles.td}><RecordValue value={driver.fastestLaps} record={isRecordValue(records, "fastestLaps", driver.fastestLaps)} /></td></>}<td style={{ ...styles.td, ...styles.points }}><RecordValue value={driver.points} record={isRecordValue(records, "points", driver.points)} /></td>{detailed && <td style={styles.td}><TripleCrown crown={driver.tripleCrown} /></td>}</tr>; })}</tbody>
      </table>
      {drivers.length === 0 && <Empty text="Aucun pilote à afficher." />}
    </div>
  );
}

function TeamTable({ teams, detailed = false, raceDetails = false, races = [], raceResults = [], drivers = [], showExtendedStats = false, selectedCategoryId = "F1", onTeamClick }) {
  const records = buildRecordMap(teams, ["driverTitles", "teamTitles", "wins", "podiums", "poles", "fastestLaps", "points"]);
  const titleSuffix = normalizeCategoryId(selectedCategoryId);
  return (
    <div style={styles.tableWrap}>
      <table className="urtt-standings-table urtt-team-standings" style={{ ...styles.table, minWidth: raceDetails ? Math.max(950, 650 + races.length * 105) : 850 }}>
        <thead><tr style={styles.tableHead}><th style={styles.th}>#</th><th style={styles.th}>Écurie</th>{raceDetails && races.map((race) => <th key={race.id} style={styles.th}><span style={styles.raceColumnTitle}>R{race.round}</span><span style={styles.raceColumnSub}>{shortRaceName(race.name)}</span></th>)}{showExtendedStats && <><th style={styles.th}>Titre P. {titleSuffix}</th><th style={styles.th}>Titre C. {titleSuffix}</th><th style={styles.th}>V</th><th style={styles.th}>Pod.</th><th style={styles.th}>Poles</th><th style={styles.th}>MT</th></>}<th style={styles.th}>Points</th>{detailed && <th style={styles.th}>Triple couronnes</th>}</tr></thead>
        <tbody>{teams.map((team, index) => <tr key={team.id} style={styles.tr}><td style={styles.td}>#{index + 1}</td><td style={styles.td}>{onTeamClick ? <button onClick={() => onTeamClick(team)} style={styles.nameButton}><TeamIdentity team={team} /></button> : <TeamIdentity team={team} />}</td>{raceDetails && races.map((race) => <td key={race.id} style={styles.td}><TeamRaceCell teamId={team.id} race={race} raceResults={raceResults} drivers={drivers} /></td>)}{showExtendedStats && <><td style={styles.td}><RecordValue value={team.driverTitles || 0} record={isRecordValue(records, "driverTitles", team.driverTitles)} /></td><td style={styles.td}><RecordValue value={team.teamTitles || 0} record={isRecordValue(records, "teamTitles", team.teamTitles)} /></td><td style={styles.td}><RecordValue value={team.wins} record={isRecordValue(records, "wins", team.wins)} /></td><td style={styles.td}><RecordValue value={team.podiums} record={isRecordValue(records, "podiums", team.podiums)} /></td><td style={styles.td}><RecordValue value={team.poles} record={isRecordValue(records, "poles", team.poles)} /></td><td style={styles.td}><RecordValue value={team.fastestLaps} record={isRecordValue(records, "fastestLaps", team.fastestLaps)} /></td></>}<td style={{ ...styles.td, ...styles.points }}><RecordValue value={team.points} record={isRecordValue(records, "points", team.points)} /></td>{detailed && <td style={styles.td}>{team.tripleCrowns}</td>}</tr>)}</tbody>
      </table>
      {teams.length === 0 && <Empty text="Aucune écurie à afficher." />}
    </div>
  );
}

function DriverRaceCell({ driverId, race, raceResults }) {
  const result = raceResults.find((entry) => String(entry.raceId) === String(race.id));
  const driverResult = result?.entries.find((entry) => idsEqual(entry.driverId, driverId));
  if (!driverResult) return <span style={styles.mutedSmall}>—</span>;
  const position = Number(driverResult.position);
  const points = getPointsForPosition(position, race.categoryId, race.seasonId);
  const badges = [];
  if (position === 1) badges.push("V");
  if (driverResult.pole) badges.push("P");
  if (driverResult.fastestLap) badges.push("MT");
  return <div style={styles.raceResultCell}><strong>P{position}</strong><span style={styles.mutedSmall}>{points} pts</span>{badges.length > 0 && <span style={styles.raceBadges}>{badges.join(" · ")}</span>}</div>;
}

function TeamRaceCell({ teamId, race, raceResults, drivers }) {
  const result = raceResults.find((entry) => String(entry.raceId) === String(race.id));
  if (!result) return <span style={styles.mutedSmall}>—</span>;
  const teamDriverIds = drivers.filter((driver) => idsEqual(driver.teamHistory?.[race.seasonId] || driver.teamId, teamId)).map((driver) => String(driver.id));
  const entries = result.entries.filter((entry) => teamDriverIds.includes(String(entry.driverId)));
  if (!entries.length) return <span style={styles.mutedSmall}>—</span>;
  const points = entries.reduce((sum, entry) => sum + getPointsForPosition(Number(entry.position), race.categoryId, race.seasonId), 0);
  const bestPosition = Math.min(...entries.map((entry) => Number(entry.position)));
  const badges = [];
  if (entries.some((entry) => Number(entry.position) === 1)) badges.push("V");
  if (entries.some((entry) => entry.pole)) badges.push("P");
  if (entries.some((entry) => entry.fastestLap)) badges.push("MT");
  return <div style={styles.raceResultCell}><strong>{points} pts</strong><span style={styles.mutedSmall}>Meilleur P{bestPosition}</span>{badges.length > 0 && <span style={styles.raceBadges}>{badges.join(" · ")}</span>}</div>;
}

function PublicSeasonResults({ races, raceResults, drivers, selectedSeasonId, selectedCategoryId, onOpenGp }) {
  const categoryId = normalizeCategoryId(selectedCategoryId || races[0]?.categoryId || "F1");
  const seasonId = normalizeSeasonId(selectedSeasonId);
  const seasonResults = raceResults.filter((result) => normalizeSeasonId(result.seasonId) === seasonId && normalizeCategoryId(result.categoryId) === categoryId);
  return <div style={styles.stack}>{races.map((race) => { const result = seasonResults.find((entry) => String(entry.raceId) === String(race.id)); const sortedEntries = result ? [...result.entries].sort((a, b) => Number(a.position) - Number(b.position)) : []; const winner = sortedEntries.find((entry) => Number(entry.position) === 1); const poleman = sortedEntries.find((entry) => entry.pole); const fastest = sortedEntries.find((entry) => entry.fastestLap); const podium = sortedEntries.slice(0, 3); return <div key={race.id} style={styles.publicRaceCard}><div style={styles.publicRaceHeader}><div><p style={styles.mutedSmall}>Course #{race.round}</p><button onClick={() => onOpenGp(race)} style={styles.raceTitleButton}>{race.name}</button></div><span style={result ? styles.badgeGreen : styles.badgeDark}>{result ? "Résultat validé" : "À venir"}</span></div><div style={styles.raceStatsGrid}><RaceStat label="Vainqueur" value={driverName(drivers, winner?.driverId)} /><RaceStat label="Poleman" value={driverName(drivers, poleman?.driverId)} /><RaceStat label="Meilleur tour" value={driverName(drivers, fastest?.driverId)} /><RaceStat label="Podium" value={podium.length ? podium.map((entry) => driverName(drivers, entry.driverId)).join(" · ") : "—"} /></div></div>; })}{races.length === 0 && <Empty text="Aucun GP dans cette saison." />}</div>;
}

function GpDetails({ gp, allRaces, raceResults, drivers, onClose }) {
  const gpRaces = allRaces.filter((race) => race.libraryRaceId === gp.libraryRaceId || race.name === gp.name);
  const gpResults = gpRaces.map((race) => { const result = raceResults.find((entry) => String(entry.raceId) === String(race.id)); const sortedEntries = result ? [...result.entries].sort((a, b) => Number(a.position) - Number(b.position)) : []; return { race, result, winner: sortedEntries.find((entry) => Number(entry.position) === 1), poleman: sortedEntries.find((entry) => entry.pole), fastest: sortedEntries.find((entry) => entry.fastestLap), podium: sortedEntries.slice(0, 3) }; }).sort((a, b) => getSeasonNumber(a.race.seasonId) - getSeasonNumber(b.race.seasonId));
  const winnerCounts = countByName(gpResults.map((item) => driverName(drivers, item.winner?.driverId)).filter((name) => name !== "—"));
  const poleCounts = countByName(gpResults.map((item) => driverName(drivers, item.poleman?.driverId)).filter((name) => name !== "—"));
  return <div style={styles.detailOverlay} onClick={onClose}><div style={styles.detailModal} onClick={(event) => event.stopPropagation()}><div style={styles.gpDetailPanel}><div style={styles.gpDetailHeader}><div><p style={styles.kicker}>FICHE GRAND PRIX</p><h2 style={styles.gpDetailTitle}>{gp.name}</h2></div><button onClick={onClose} style={styles.secondaryButton}>Fermer</button></div><div style={styles.statsGrid}><Stat label="Présences au calendrier" value={gpRaces.length} /><Stat label="Résultats validés" value={gpResults.filter((item) => item.result).length} /><Stat label="Dernier vainqueur" value={driverName(drivers, [...gpResults].reverse().find((item) => item.winner)?.winner?.driverId)} /><Stat label="Dernier poleman" value={driverName(drivers, [...gpResults].reverse().find((item) => item.poleman)?.poleman?.driverId)} /></div><div style={styles.twoColumns}><Card title="Vainqueurs" icon="🏆"><MiniCountList counts={winnerCounts} empty="Aucun vainqueur enregistré." /></Card><Card title="Polemen" icon="⚡"><MiniCountList counts={poleCounts} empty="Aucun poleman enregistré." /></Card></div><Card title="Historique du GP" icon="📜"><div style={styles.stack}>{gpResults.map((item) => <div key={item.race.id} style={styles.publicRaceCard}><div style={styles.publicRaceHeader}><div><p style={styles.mutedSmall}>{seasonName(item.race.seasonId)} · Course #{item.race.round}</p><h3 style={styles.raceTitle}>{item.race.name}</h3></div><span style={item.result ? styles.badgeGreen : styles.badgeDark}>{item.result ? "Résultat validé" : "À venir"}</span></div><div style={styles.raceStatsGrid}><RaceStat label="Vainqueur" value={driverName(drivers, item.winner?.driverId)} /><RaceStat label="Poleman" value={driverName(drivers, item.poleman?.driverId)} /><RaceStat label="Meilleur tour" value={driverName(drivers, item.fastest?.driverId)} /><RaceStat label="Podium" value={item.podium.length ? item.podium.map((entry) => driverName(drivers, entry.driverId)).join(" · ") : "—"} /></div></div>)}{gpResults.length === 0 && <Empty text="Aucun historique pour ce GP." />}</div></Card></div></div></div>;
}

function DriverDetails({ driver, raceResults, teams, selectedCategoryId, onClose }) {
  const rows = getDriverSeasonBreakdown(driver, raceResults, teams, selectedCategoryId);
  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div style={styles.detailModal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.gpDetailHeader}><div><p style={styles.kicker}>FICHE PILOTE</p><h2 style={styles.gpDetailTitle}>{driver.name}</h2></div><button onClick={onClose} style={styles.secondaryButton}>Fermer</button></div>
        <Card title="Stats par saison et catégorie" icon="👤"><SeasonBreakdownTable rows={rows} /></Card>
      </div>
    </div>
  );
}

function TeamDetails({ team, drivers, raceResults, onClose }) {
  const rows = getTeamSeasonBreakdown(team, drivers, raceResults);
  return <div style={styles.gpDetailPanel}><div style={styles.gpDetailHeader}><div><p style={styles.kicker}>FICHE ÉCURIE</p><h2 style={styles.gpDetailTitle}>{team.name}</h2></div><button onClick={onClose} style={styles.secondaryButton}>Fermer</button></div><Card title="Stats par saison et catégorie" icon="🏎️"><SeasonBreakdownTable rows={rows} /></Card></div>;
}

function SeasonBreakdownTable({ rows }) {
  const showPosition = rows.some((row) => row.position);
  return <div style={styles.tableWrap}><table style={styles.table}><thead><tr style={styles.tableHead}><th style={styles.th}>Saison</th>{showPosition && <th style={styles.th}>Position</th>}<th style={styles.th}>Écurie</th><th style={styles.th}>Catégories</th><th style={styles.th}>Points</th><th style={styles.th}>V</th><th style={styles.th}>Podiums</th><th style={styles.th}>Poles</th><th style={styles.th}>MT</th></tr></thead><tbody>{rows.map((row) => <tr key={row.seasonId} style={styles.tr}><td style={styles.td}>{seasonName(row.seasonId)}</td>{showPosition && <td style={{ ...styles.td, ...styles.points }}>{row.position ? `#${row.position}` : "—"}</td>}<td style={styles.td}>{row.team ? <TeamIdentity team={row.team} /> : row.teamName || "Sans écurie"}</td><td style={styles.td}>{row.categories.length ? row.categories.map((category) => <span key={category} style={{ ...styles.categoryBadge, background: getCategoryColor(category) }}>{category}</span>) : "—"}</td><td style={{ ...styles.td, ...styles.points }}>{row.points}</td><td style={styles.td}>{row.wins}</td><td style={styles.td}>{row.podiums}</td><td style={styles.td}>{row.poles}</td><td style={styles.td}>{row.fastestLaps}</td></tr>)}</tbody></table>{rows.length === 0 && <Empty text="Aucune participation enregistrée." />}</div>;
}

function ParticipationEditor({ form, setForm, teams = [], selectedSeasonId = "S1" }) {
  const [seasonId, setSeasonId] = useState(selectedSeasonId || "S1");
  return <div style={styles.teamPreview}><span style={styles.labelText}>Participations par saison</span><select value={seasonId} onChange={(event) => setSeasonId(event.target.value)} style={styles.input}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select><label style={styles.label}><span style={styles.labelText}>Écurie cette saison</span><select value={form.teamHistory?.[seasonId] || form.teamId || ""} onChange={(event) => setForm(updateDriverSeasonTeam(form, seasonId, event.target.value))} style={styles.input}><option value="">Sans écurie</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><div style={styles.categoryCheckboxGrid}>{CATEGORY_OPTIONS.map((category) => <label key={category.id} style={{ ...styles.checkboxPill, borderColor: getCategoryColor(category.id) }}><input type="checkbox" checked={(form.participations?.[seasonId] || []).includes(category.id)} onChange={() => setForm(toggleParticipation(form, seasonId, category.id))} /> {category.name}</label>)}</div><p style={styles.mutedSmall}>Exemple : un pilote peut faire F2 en S1, puis F1 en S2, ou même plusieurs catégories la même saison.</p></div>;
}

function MiniCountList({ counts, empty }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <Empty text={empty} />;
  return <div style={styles.stack}>{entries.map(([name, count]) => <div key={name} style={styles.itemBox}><strong>{name}</strong><span style={styles.badgeGreen}>{count}</span></div>)}</div>;
}
function RaceStat({ label, value }) { return <div style={styles.raceStat}><span style={styles.mutedSmall}>{label}</span><strong>{value || "—"}</strong></div>; }
function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("Suggestion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendFeedback(event) {
    event.preventDefault();
    setStatus("");

    if (!title.trim() || !content.trim()) {
      setStatus("Ajoute un titre et un contenu.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, content, pageUrl: window.location.href }),
      });

      if (!response.ok) throw new Error("Feedback failed");
      setStatus("Envoyé sur Discord, merci !");
      setTitle("");
      setContent("");
    } catch (error) {
      console.error("Erreur feedback:", error);
      setStatus("Impossible d'envoyer pour le moment.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} style={styles.feedbackButton}>?</button>
      {isOpen && (
        <div style={styles.detailOverlay} onClick={() => setIsOpen(false)}>
          <form onSubmit={sendFeedback} style={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.gpDetailHeader}><div><p style={styles.kicker}>RETOUR SITE</p><h2 style={styles.gpDetailTitle}>Suggestion ou bug</h2></div><button type="button" onClick={() => setIsOpen(false)} style={styles.secondaryButton}>Fermer</button></div>
            <div style={styles.feedbackChoice}>{["Suggestion", "Bug"].map((item) => <button key={item} type="button" onClick={() => setType(item)} style={{ ...styles.feedbackChoiceButton, ...(type === item ? styles.feedbackChoiceActive : {}) }}>{item}</button>)}</div>
            <Input label="Titre" value={title} onChange={setTitle} />
            <label style={styles.label}><span style={styles.labelText}>Contenu</span><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} style={styles.textarea} /></label>
            {status && <p style={styles.mutedSmall}>{status}</p>}
            <button type="submit" disabled={isSending} style={styles.fullButton}>{isSending ? "Envoi..." : "Envoyer"}</button>
          </form>
        </div>
      )}
    </>
  );
}
function RaceCountdown({ races, events = [] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const upcomingItems = [
    ...races.map((race) => ({ ...race, kind: "race", sortAt: race.startAt })),
    ...events.map((event) => ({ ...event, kind: "event", sortAt: event.startAt })),
  ]
    .filter((item) => item.sortAt && new Date(item.sortAt).getTime() > now)
    .sort((a, b) => new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime());
  const nextItem = upcomingItems[0];

  if (!nextItem) {
    return <Card title="Prochain rendez-vous" icon="⏱️"><div style={styles.countdownBox}><strong>Aucune course ou evenement programme</strong><span style={styles.mutedSmall}>Ajoute une date dans Admin &gt; Courses ou Planning.</span></div><CalendarFeedLinks /></Card>;
  }

  const remaining = Math.max(0, new Date(nextItem.sortAt).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const itemTitle = nextItem.kind === "event" ? nextItem.title : nextItem.name;
  const itemMeta = nextItem.kind === "event" ? "Evenement" : `${seasonName(nextItem.seasonId)} · Course #${nextItem.round}`;

  return (
    <Card title="Prochains rendez-vous" icon="⏱️">
      <div style={styles.countdownBox}>
        <div>
          <p style={styles.mutedSmall}>{itemMeta}</p>
          <strong style={styles.countdownRace}>{itemTitle}</strong>
          <p style={styles.mutedSmall}><CountdownBadge item={nextItem} /> {formatRaceDate(nextItem.sortAt)}</p>
          <AddToCalendarLinks race={nextItem} />
        </div>
        <div style={styles.countdownGrid}><CountdownUnit label="J" value={days} /><CountdownUnit label="H" value={hours} /><CountdownUnit label="MIN" value={minutes} /><CountdownUnit label="SEC" value={seconds} /></div>
      </div>
      {upcomingItems.length > 1 && (
        <div style={styles.upcomingList}>
          {upcomingItems.slice(1, 6).map((item) => (
            <div key={`${item.kind}-${item.id}`} style={styles.upcomingItem}>
              <div>
                <strong>{item.kind === "event" ? item.title : item.name}</strong>
                <p style={styles.mutedSmall}>{item.kind === "event" ? "Evenement" : `${seasonName(item.seasonId)} · Course #${item.round}`}</p>
                <AddToCalendarLinks race={item} compact />
              </div>
              <div style={styles.upcomingMeta}><CountdownBadge item={item} /><span style={styles.mutedSmall}>{formatRaceDate(item.sortAt)}</span></div>
            </div>
          ))}
        </div>
      )}
      <CalendarFeedLinks />
    </Card>
  );
}
function CountdownBadge({ item }) {
  if (item.kind === "event") return <span style={{ ...styles.categoryBadge, background: "#2563eb" }}>Événement</span>;
  return <span style={{ ...styles.categoryBadge, background: getCategoryColor(item.categoryId) }}>{item.categoryId}</span>;
}
function AddToCalendarLinks({ race, compact = false }) {
  const event = getRaceCalendarEvent(race);
  return (
    <div style={{ ...styles.calendarLinks, ...(compact ? styles.calendarLinksCompact : {}) }}>
      <a href={event.googleUrl} target="_blank" rel="noreferrer" style={styles.calendarLink}>Google Calendar</a>
      <a href={event.icsUrl} download={event.fileName} style={styles.calendarLink}>Apple / Outlook</a>
    </div>
  );
}
function CalendarFeedLinks() {
  const links = getCalendarFeedLinks();
  return (
    <div style={styles.calendarFeedBox}>
      <div>
        <strong>S'abonner au calendrier URTT</strong>
        <p style={styles.mutedSmall}>Les nouvelles courses planifiees se mettent a jour automatiquement.</p>
      </div>
      <div style={styles.calendarLinks}>
        <a href={links.googleUrl} target="_blank" rel="noreferrer" style={styles.calendarLink}>Google Calendar</a>
        <a href={links.appleUrl} style={styles.calendarLink}>Apple Calendar</a>
        <a href={links.downloadUrl} style={styles.calendarLink}>Lien .ics</a>
      </div>
    </div>
  );
}
function CountdownUnit({ label, value }) {
  return <div style={styles.countdownUnit}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>;
}
function RaceDateInput({ race, onSave }) {
  const [value, setValue] = useState(toDateTimeInputValue(race.startAt));
  const [isSaving, setIsSaving] = useState(false);

  async function save(nextValue) {
    setValue(nextValue);
    setIsSaving(true);
    const saved = onSave ? await onSave(race.id, nextValue) : false;
    setIsSaving(false);
    if (!saved && !onSave) {
      alert("Impossible d'enregistrer la date. Ajoute la colonne start_at dans season_calendar.");
    }
  }

  return <label style={styles.dateField}><span style={styles.mutedSmall}>{isSaving ? "Sauvegarde..." : "Depart"}</span><input type="datetime-local" value={value} onChange={(event) => save(event.target.value)} style={styles.dateInput} /></label>;
}
function RaceTable({ races, onDelete, onMoveRace, onUpdateStartAt, isSavingRace = false }) {
  return <div style={styles.stack}>{races.map((race, index) => <div key={race.id} style={styles.itemBox}><div><strong>{race.round}. {race.name}</strong><p style={styles.mutedSmall}>{seasonName(race.seasonId)} · {formatRaceDate(race.startAt)}</p><RaceDateInput race={race} onSave={onUpdateStartAt} /></div><div style={styles.actions}>{onMoveRace && <><button type="button" onClick={() => onMoveRace(race.id, -1)} disabled={isSavingRace || index === 0} style={styles.editButton}>↑</button><button type="button" onClick={() => onMoveRace(race.id, 1)} disabled={isSavingRace || index === races.length - 1} style={styles.editButton}>↓</button></>}{onDelete && <button onClick={() => onDelete(race.id)} disabled={isSavingRace} style={styles.dangerButton}>Supprimer</button>}</div></div>)}{races.length === 0 && <Empty text="Aucun GP dans cette saison." />}</div>;
}
function DriverAdminCard({ driver, team, onEdit, onDelete }) { return <div style={{ ...styles.teamCard, borderTop: `5px solid ${driver.color}` }}><DriverIdentity driver={driver} /><p style={styles.mutedSmall}>Écurie : {team?.name || "—"}</p><div style={styles.actions}><button onClick={() => onEdit(driver)} style={styles.editButton}>Modifier</button><button onClick={() => onDelete(driver.id)} style={styles.dangerButton}>Supprimer</button></div></div>; }
function TeamAdminCard({ team, onEdit, onDelete }) { return <div style={{ ...styles.teamCard, borderTop: `5px solid ${team.color}` }}><TeamIdentity team={team} /><p style={styles.mutedSmall}>Constructeur : F1 {team.teamTitlesF1 ?? team.teamTitles ?? 0} · F2 {team.teamTitlesF2 || 0} · FE {team.teamTitlesFE || 0}</p><div style={styles.actions}><button onClick={() => onEdit(team)} style={styles.editButton}>Modifier</button><button onClick={() => onDelete(team.id)} style={styles.dangerButton}>Supprimer</button></div></div>; }
function DriverIdentity({ driver, teamColor, teamLogo }) { const imageSrc = driver.avatar || (driver.retired ? "" : teamLogo); const borderColor = teamColor || driver.color || "#dc2626"; return <div className="urtt-identity" style={styles.identity}>{imageSrc ? <img src={imageSrc} alt={driver.name} style={{ ...styles.logoSmall, border: `2px solid ${borderColor}` }} /> : <div style={{ ...styles.fallbackLogo, background: driver.retired ? "#18181b" : borderColor, border: `2px solid ${borderColor}`, fontSize: driver.retired ? 20 : 12 }}>{driver.retired ? "👥" : (driver.name || "??").slice(0, 2).toUpperCase()}</div>}<div style={styles.identityText}><strong className="urtt-identity-name">{driver.name || "Pilote"}</strong><p style={styles.mutedSmall}>N° {driver.number || "—"}{driver.retired ? " · Retraité" : ""}</p></div></div>; }
function TeamIdentity({ team }) { return <div className="urtt-identity" style={styles.identity}>{team.logo ? <img src={team.logo} alt={team.name} style={{ ...styles.logoSmall, border: `2px solid ${team.color || "#dc2626"}` }} /> : <div style={{ ...styles.fallbackLogo, background: team.color || "#dc2626" }}>{(team.name || "??").slice(0, 2).toUpperCase()}</div>}<div style={styles.identityText}><strong className="urtt-team-name">{team.name || "Écurie"}</strong><p style={styles.mutedSmall}>Écurie</p></div></div>; }
function TripleCrown({ crown }) { const safe = crown || { monaco: false, indy500: false, lemans: false }; return <div style={styles.crownBox}><span style={safe.monaco ? { ...styles.badgeGreen, background: "#7c3aed", color: "white" } : styles.badgeDark}>Titre F1</span><span style={safe.indy500 ? { ...styles.badgeGreen, background: "#ffff00", color: "#18181b" } : styles.badgeDark}>Indy 300</span><span style={safe.lemans ? { ...styles.badgeGreen, background: "#006ee6" } : styles.badgeDark}>2,4H du Mans</span></div>; }
function LoginScreen({ email, setEmail, password, setPassword, loginError, onLogin, onBack }) { return <div style={styles.loginPage}><form onSubmit={onLogin} style={styles.loginCard}><div style={styles.logo}>UR</div><p style={styles.kicker}>ACCÈS PRIVÉ</p><h1 style={styles.loginTitle}>Connexion admin</h1><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email admin" style={styles.input} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mot de passe" style={styles.input} />{loginError && <p style={styles.errorText}>{loginError}</p>}<button type="submit" style={styles.fullButton}>Se connecter</button><button type="button" onClick={onBack} style={styles.linkButton}>Retour public</button><p style={styles.hint}>Comptes à créer dans Supabase Auth.</p></form></div>; }
function TitlesPanel({
  drivers,
  teams,
  titleDriverId,
  setTitleDriverId,
  titleTeamId,
  setTitleTeamId,
  onAward,
  isSaving,
}) {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="urtt-card">
        <h2 className="urtt-card-title">Gestion des titres</h2>

        <p style={{ color: "#a1a1aa", marginTop: 6 }}>
          Ajoute manuellement un titre pilote et constructeur.
        </p>

        <div
          className="urtt-form-grid"
          style={{ marginTop: 24 }}
        >
          <div>
            <label className="urtt-label">
              Pilote champion
            </label>

            <select
              className="urtt-input"
              value={titleDriverId}
              onChange={(e) => setTitleDriverId(e.target.value)}
            >
              <option value="">Choisir un pilote</option>

              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="urtt-label">
              Écurie championne
            </label>

            <select
              className="urtt-input"
              value={titleTeamId}
              onChange={(e) => setTitleTeamId(e.target.value)}
            >
              <option value="">Choisir une écurie</option>

              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="urtt-button"
          onClick={onAward}
          disabled={isSaving}
          style={{ marginTop: 24 }}
        >
          {isSaving ? "Ajout..." : "Ajouter les titres"}
        </button>
      </div>

      <div className="urtt-card">
        <h2 className="urtt-card-title">
          Aperçu des titres
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginTop: 20,
          }}
        >
          <div>
            <h3 style={{ marginBottom: 12 }}>
              Pilotes
            </h3>

            <div style={{ display: "grid", gap: 10 }}>
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="urtt-item-box"
                >
                  <span>{driver.name}</span>

                  <strong>
                    🏆 {driver.driverTitles || 0}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>
              Écuries
            </h3>

            <div style={{ display: "grid", gap: 10 }}>
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="urtt-item-box"
                >
                  <span>{team.name}</span>

                  <strong>
                    👑 {team.teamTitles || 0}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function Popup({ popup, onClose }) { return <div style={styles.popupOverlay}><div style={styles.popupCard}><div style={styles.popupIcon}>{popup.type === "error" ? "⚠️" : "✅"}</div><h3 style={styles.popupTitle}>{popup.title}</h3><p style={styles.muted}>{popup.message}</p><button onClick={onClose} style={styles.fullButton}>OK</button></div></div>; }
function Card({ title, icon, children }) { return <div className="urtt-card" style={styles.card}><div style={styles.cardHeader}><div style={styles.cardIcon}>{icon}</div><h3 style={styles.cardTitle}>{title}</h3></div>{children}</div>; }
function Stat({ label, value }) { return <div className="urtt-stat-card" style={styles.statCard}><p style={styles.muted}>{label}</p><p style={styles.statValue}>{value}</p></div>; }
function Input({ label, value, onChange, type = "text" }) { return <label style={styles.label}><span style={styles.labelText}>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} /></label>; }
function ColorInput({ label, value, onChange }) { return <label style={styles.label}><span style={styles.labelText}>{label}</span><div style={styles.colorInputRow}><input type="color" value={value} onChange={(event) => onChange(event.target.value)} style={styles.colorInput} /><input value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} /></div></label>; }
function Empty({ text }) { return <div style={styles.emptyBox}>{text}</div>; }
function Setting({ title, description, active }) { return <div style={styles.teamCard}><strong>{title}</strong><p style={styles.mutedSmall}>{description}</p><span style={active ? styles.badgeGreen : styles.badgeDark}>{active ? "ON" : "OFF"}</span></div>; }

const styles = {
  publicPage: { minHeight: "100vh", background: "radial-gradient(circle at top, #2b0909, #09090b 45%)", color: "#f4f4f5", fontFamily: "Inter, system-ui, Arial" },
  publicHeader: { maxWidth: 1280, margin: "0 auto", padding: "48px 28px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 },
  publicMain: { width: "100%", maxWidth: 1280, margin: "0 auto", padding: "24px 28px 48px", display: "grid", gap: 22 },
  publicTitle: { margin: "8px 0", fontSize: 48, lineHeight: 1, fontWeight: 950 },
  
  publicSubtitle: { color: "#d4d4d8", fontSize: 18, margin: 0, maxWidth: 680 },
  publicNav: { maxWidth: 1280, margin: "0 auto", padding: "0 28px 18px", display: "flex", gap: 10, flexWrap: "wrap" },
  publicNavButton: { background: "#18181b", border: "1px solid #27272a", color: "#d4d4d8", padding: "12px 16px", borderRadius: 999, fontWeight: 900, cursor: "pointer" },
  publicNavActive: { background: "#dc2626", color: "white", borderColor: "#dc2626" },
  page: { minHeight: "100vh", background: "#09090b", color: "#f4f4f5", display: "grid", gridTemplateColumns: "260px 1fr", fontFamily: "Inter, system-ui, Arial" },
  sidebar: { background: "#18181b", borderRight: "1px solid #27272a", padding: 24 },
  main: { padding: 32, overflow: "auto" },
  logoRow: { display: "flex", gap: 12, alignItems: "center", marginBottom: 32 },
  logo: { width: 44, height: 44, borderRadius: 16, background: "#dc2626", display: "grid", placeItems: "center", fontWeight: 900 },
  logoTitle: { margin: 0, fontSize: 22 },
  logoSubtitle: { margin: 0, color: "#a1a1aa", fontSize: 13 },
  nav: { display: "grid", gap: 10 },
  navButton: { display: "flex", alignItems: "center", gap: 12, border: 0, color: "#d4d4d8", background: "transparent", padding: "13px 14px", borderRadius: 16, cursor: "pointer", fontWeight: 800 },
  navButtonActive: { background: "#dc2626", color: "white" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, marginBottom: 28 },
  headerActions: { display: "flex", gap: 10, alignItems: "center" },
  kicker: { color: "#f87171", letterSpacing: 4, fontSize: 12, fontWeight: 900, margin: 0 },
  title: { margin: "8px 0 0", fontSize: 38, lineHeight: 1.05 },
  loginPage: { minHeight: "100vh", background: "#09090b", color: "#f4f4f5", display: "grid", placeItems: "center", fontFamily: "Inter, system-ui, Arial", padding: 24 },
  loginCard: { width: "100%", maxWidth: 420, background: "#18181b", border: "1px solid #27272a", borderRadius: 28, padding: 28, display: "grid", gap: 14 },
  loginTitle: { margin: 0, fontSize: 32 },
  errorText: { color: "#f87171", margin: 0, fontWeight: 800 },
  hint: { color: "#71717a", margin: 0, fontSize: 12, textAlign: "center" },
  linkButton: { background: "transparent", border: 0, color: "#f87171", fontWeight: 900, cursor: "pointer", padding: 8 },
  primaryButton: { background: "#dc2626", color: "white", border: 0, padding: "14px 18px", borderRadius: 16, fontWeight: 900, cursor: "pointer" },
  secondaryButton: { background: "#27272a", color: "white", border: 0, padding: "14px 18px", borderRadius: 16, fontWeight: 900, cursor: "pointer" },
  dangerButton: { background: "#7f1d1d", color: "white", border: 0, padding: "10px 12px", borderRadius: 12, fontWeight: 900, cursor: "pointer" },
  section: { display: "grid", gap: 22 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 16 },
  statCard: { background: "#18181b", border: "1px solid #27272a", borderRadius: 24, padding: 22 },
  statValue: { fontSize: 30, fontWeight: 900, margin: "6px 0 0" },
  twoColumns: { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, .8fr)", gap: 22 },
  twoColumnsSmallLeft: { display: "grid", gridTemplateColumns: "minmax(310px, .75fr) minmax(0, 1.25fr)", gap: 22 },
  card: { background: "#18181b", border: "1px solid #27272a", borderRadius: 26, padding: 22, boxShadow: "0 18px 50px rgba(0,0,0,.25)" },
  cardHeader: { display: "flex", gap: 12, alignItems: "center", marginBottom: 18 },
  cardIcon: { background: "#27272a", borderRadius: 14, padding: 10, fontSize: 20 },
  cardTitle: { margin: 0, fontSize: 22 },
  stack: { display: "grid", gap: 12 },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 },
  teamCard: { background: "#27272a", borderRadius: 20, padding: 18 },
  itemBox: { background: "#27272a", borderRadius: 18, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  raceLibraryInfo: { minWidth: 180 },
  countryEditRow: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  compactInput: { minWidth: 160, background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 12, padding: "10px 12px", outline: "none" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 },
  editButton: { background: "#3f3f46", color: "white", border: 0, borderRadius: 12, padding: "10px 12px", fontWeight: 900, cursor: "pointer" },
  muted: { color: "#a1a1aa", margin: 0 },
  mutedSmall: { color: "#a1a1aa", margin: "4px 0 0", fontSize: 13 },
  tableWrap: { overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch", border: "1px solid #27272a", borderRadius: 18 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 850 },
  tableHead: { background: "#27272a" },
  th: { padding: "10px 9px", textAlign: "left", color: "#d4d4d8", whiteSpace: "nowrap" },
  tr: { borderTop: "1px solid #27272a" },
  td: { padding: "10px 9px", verticalAlign: "top" },
  points: { color: "#f87171", fontSize: 20, fontWeight: 900 },
  recordValue: { color: "#a855f7", fontWeight: 950 },
  label: { display: "grid", gap: 8 },
  labelText: { color: "#a1a1aa", fontSize: 14, fontWeight: 800 },
  input: { background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 14, padding: 13, outline: "none", width: "100%", boxSizing: "border-box" },
  fullButton: { background: "#dc2626", color: "white", border: 0, borderRadius: 16, padding: 14, fontWeight: 900, cursor: "pointer" },
  searchBox: { background: "#27272a", borderRadius: 16, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" },
  searchInput: { flex: 1, background: "transparent", border: 0, color: "white", outline: "none" },
  colorInputRow: { display: "grid", gridTemplateColumns: "56px 1fr", gap: 10, alignItems: "center" },
  colorInput: { width: 56, height: 46, border: "1px solid #3f3f46", borderRadius: 14, background: "#09090b", padding: 4, cursor: "pointer" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12 },
  identity: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  identityText: { minWidth: 0 },
  logoSmall: {
  width: 44,
  height: 44,
  borderRadius: 14,
  objectFit: "contain",
  objectPosition: "center",
  background: "#111827",
  padding: 4,
},
  fallbackLogo: { width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", color: "white", fontWeight: 900, fontSize: 12, boxSizing: "border-box", lineHeight: 1 },
  crownBox: { display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" },
  badgeGreen: { background: "rgba(34,197,94,.15)", color: "#86efac", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, display: "inline-block", margin: 2 },
  badgeDark: { background: "#3f3f46", color: "#d4d4d8", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, display: "inline-block", margin: 2 },
  seasonSelect: { background: "#18181b", border: "1px solid #27272a", color: "white", padding: "12px 16px", borderRadius: 999, fontWeight: 900, outline: "none", cursor: "pointer" },
  categorySelect: { background: "#18181b", border: "1px solid #27272a", color: "white", padding: "12px 16px", borderRadius: 999, fontWeight: 900, outline: "none", cursor: "pointer" },
  resultsInfo: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "end", background: "#27272a", borderRadius: 18, padding: 16 },
  resultsSelect: { background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 14, padding: 14, outline: "none", fontWeight: 700 },
  quickResultBox: { background: "#202024", border: "1px solid #3f3f46", borderRadius: 18, padding: 16, display: "grid", gap: 12 },
  positionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10, marginTop: 10 },
  positionPick: { display: "grid", gridTemplateColumns: "44px minmax(0, 1fr)", alignItems: "center", gap: 8, color: "#f4f4f5", fontWeight: 900 },
  positionInput: { width: 90, background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 12, padding: 10, outline: "none" },
  feedbackButton: { position: "fixed", right: 22, bottom: 22, width: 58, height: 58, borderRadius: "50%", border: "2px solid rgba(255,255,255,.28)", background: "#2563eb", color: "white", fontSize: 24, fontWeight: 950, cursor: "pointer", zIndex: 45, boxShadow: "0 18px 42px rgba(37,99,235,.35)" },
  feedbackModal: { width: "min(620px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#18181b", border: "1px solid #3f3f46", borderRadius: 26, padding: 20, display: "grid", gap: 14 },
  feedbackChoice: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  feedbackChoiceButton: { background: "#27272a", border: "1px solid #3f3f46", color: "white", borderRadius: 14, padding: 12, fontWeight: 900, cursor: "pointer" },
  feedbackChoiceActive: { background: "#2563eb", borderColor: "#60a5fa" },
  textarea: { background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 14, padding: 13, outline: "none", width: "100%", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
  dateField: { display: "grid", gap: 4, marginTop: 8, maxWidth: 260 },
  dateInput: { background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 12, padding: 10, outline: "none" },
  countdownBox: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" },
  countdownRace: { display: "block", fontSize: 24, lineHeight: 1.1 },
  countdownGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(64px, 1fr))", gap: 10, minWidth: "min(100%, 340px)" },
  countdownUnit: { background: "#27272a", border: "1px solid #3f3f46", borderRadius: 12, padding: "12px 10px", textAlign: "center", display: "grid", gap: 4 },
  calendarLinks: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
  calendarLinksCompact: { marginTop: 8 },
  calendarLink: { background: "#2563eb", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: 999, padding: "8px 10px", fontSize: 12, fontWeight: 900, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  calendarFeedBox: { marginTop: 16, borderTop: "1px solid #27272a", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  upcomingList: { display: "grid", gap: 8, marginTop: 16, borderTop: "1px solid #27272a", paddingTop: 14 },
  upcomingItem: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "#27272a", border: "1px solid #3f3f46", borderRadius: 12, padding: "10px 12px", flexWrap: "wrap" },
  upcomingMeta: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  emptyBox: { textAlign: "center", border: "1px dashed #3f3f46", borderRadius: 24, padding: 24, color: "#a1a1aa" },
  popupOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "grid", placeItems: "center", zIndex: 50, padding: 24 },
  popupCard: { width: "100%", maxWidth: 430, background: "#18181b", border: "1px solid #3f3f46", borderRadius: 28, padding: 28, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.45)" },
  popupIcon: { fontSize: 44, marginBottom: 10 },
  popupTitle: { margin: "0 0 10px", fontSize: 28 },
  detailOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 60, padding: 24, display: "grid", placeItems: "center" },
  detailModal: { width: "min(1040px, 100%)", maxHeight: "90vh", overflow: "auto", display: "grid", gap: 18 },
  publicRaceCard: { background: "#27272a", borderRadius: 22, padding: 18, display: "grid", gap: 16 },
  publicRaceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  worldPage: { display: "grid", gap: 22 },
  worldHero: { width: "min(720px, 100%)", margin: "0 auto", textAlign: "center", border: "1px solid #a855f7", borderRadius: 18, padding: "18px 22px", background: "rgba(9,9,11,.76)", boxShadow: "0 0 34px rgba(168,85,247,.22)" },
  worldTitle: { margin: 0, fontSize: 34, letterSpacing: 1, textTransform: "uppercase" },
  worldSubtitle: { margin: "8px 0 0", color: "#d4d4d8", fontSize: 13 },
  worldLayout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 18, alignItems: "start" },
  worldMap: { position: "relative", minHeight: 460, border: "1px solid #27272a", borderRadius: 22, overflow: "hidden", background: "#111113" },
  worldMapFrame: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, filter: "grayscale(1) invert(.92) hue-rotate(185deg) brightness(.44) contrast(1.28)", transform: "scale(1.04)", pointerEvents: "none" },
  worldMapShade: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(168,85,247,.16), rgba(9,9,11,.58) 70%)", pointerEvents: "none", zIndex: 1 },
  countryPin: { position: "absolute", transform: "translate(-50%, -50%)", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(126,34,206,.9)", color: "white", border: "1px solid rgba(255,255,255,.42)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: "0 12px 26px rgba(168,85,247,.38)", zIndex: 2 },
  countryPinActive: { background: "#f97316", boxShadow: "0 0 24px rgba(249,115,22,.55)" },
  worldEmpty: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#d4d4d8", zIndex: 2 },
  raceTitle: { margin: "4px 0 0", fontSize: 22 },
  raceTitleButton: { margin: "4px 0 0", padding: 0, border: 0, background: "transparent", color: "white", fontSize: 22, fontWeight: 900, cursor: "pointer", textAlign: "left", textDecoration: "underline", textDecorationColor: "#dc2626", textUnderlineOffset: 5 },
  raceStatsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  raceStat: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 16, padding: 14, display: "grid", gap: 5 },
  gpDetailPanel: { display: "grid", gap: 22, marginTop: 22 },
  gpDetailHeader: { background: "#18181b", border: "1px solid #27272a", borderRadius: 26, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18 },
  gpDetailTitle: { margin: "8px 0 0", fontSize: 34, lineHeight: 1 },
  raceColumnTitle: { display: "block", fontWeight: 900 },
  raceColumnSub: { display: "block", color: "#a1a1aa", fontSize: 11, maxWidth: 85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  raceResultCell: { display: "grid", gap: 3, minWidth: 72 },
  raceBadges: { color: "#86efac", fontSize: 11, fontWeight: 900 },
  teamPreview: { background: "#27272a", borderRadius: 18, padding: 14, display: "grid", gap: 8 },
  nameButton: { background: "transparent", border: 0, color: "white", padding: 0, cursor: "pointer", textAlign: "left" },
  categoryBadge: { background: "#dc2626", color: "white", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900, display: "inline-block", margin: 2 },
  categoryCheckboxGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 },
  checkboxPill: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 999, padding: "9px 12px", fontWeight: 900 },
  fileInput: { background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 14, padding: 13, cursor: "pointer" },
  logoPreviewBox: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 18, padding: 14 },
  errorBox: { background: "rgba(127,29,29,.35)", border: "1px solid #7f1d1d", borderRadius: 18, padding: 14, marginTop: 16 },
};
