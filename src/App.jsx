import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useRef } from "react";

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
const ALL_CATEGORY_IDS = CATEGORY_OPTIONS.map((category) => category.id);
const ADMIN_PERMISSIONS_OWNER_EMAIL = "kolti@urtt.fr";
const PLAYER_SESSION_STORAGE_KEY = "urtt-player-session-id";
const ADMIN_PAGE_OPTIONS = [
  { id: "dashboard", icon: "🏠", label: "Dashboard" },
  { id: "supabase", icon: "🗄️", label: "Supabase" },
  { id: "search", icon: "🔎", label: "Recherche" },
  { id: "titles", icon: "👑", label: "Titres" },
  { id: "drivers", icon: "👥", label: "Pilotes" },
  { id: "teams", icon: "🏎️", label: "Écuries" },
  { id: "races", icon: "🏁", label: "Courses" },
  { id: "planning", icon: "⏱️", label: "Planning" },
  { id: "editions", icon: "🏁", label: "Hors Saison" },
  { id: "development", icon: "📈", label: "Développement" },
  { id: "games", icon: "🎮", label: "Jeux" },
  { id: "results", icon: "🏆", label: "Résultats" },
  { id: "race-awards", icon: "⚡", label: "Poles / MT" },
  { id: "permissions", icon: "🔐", label: "Permissions" },
  { id: "settings", icon: "⚙️", label: "Réglages" },
];
const ALL_ADMIN_PAGE_IDS = ADMIN_PAGE_OPTIONS.map((page) => page.id);
const defaultAdminPermissions = { role: "owner", allowedCategories: ALL_CATEGORY_IDS, allowedPages: ALL_ADMIN_PAGE_IDS };
const PUBLIC_PAGE_OPTIONS = [
  { id: "home", label: "Accueil" },
  { id: "standings", label: "Classements" },
  { id: "drivers", label: "Stats pilotes" },
  { id: "teams", label: "Stats écuries" },
  { id: "seasons", label: "Saison" },
  { id: "editions", label: "Hors Saison" },
  { id: "development", label: "Développement" },
  { id: "predictions", label: "Pronos" },
  { id: "guess-driver", label: "Défi pilote" },
  { id: "world", label: "Carte" },
];
const DEFAULT_PUBLIC_PAGE_VISIBILITY = Object.fromEntries(PUBLIC_PAGE_OPTIONS.map((page) => [page.id, true]));
const SPECIAL_EVENT_OPTIONS = [
  { id: "LEMANS24", name: "2,4H du Mans", color: "#006ee6" },
  { id: "INDY300", name: "Indy 300", color: "#ffff00" },
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
function getLatestSeasonId(seasons = getSeasonOptions()) {
  return [...seasons].sort((a, b) => (b.sortOrder || getSeasonNumber(b.id)) - (a.sortOrder || getSeasonNumber(a.id)))[0]?.id || "S1";
}
function getSeasonOptionsForCategory(calendarRaces = [], categoryId = "F1", seasons = getSeasonOptions()) {
  const activeCategoryId = normalizeCategoryId(categoryId);
  const seasonIds = new Set(calendarRaces
    .filter((race) => normalizeCategoryId(race.categoryId) === activeCategoryId)
    .map((race) => normalizeSeasonId(race.seasonId)));
  return seasons.filter((season) => seasonIds.has(normalizeSeasonId(season.id)));
}
function isDevelopmentCategory(categoryId) {
  return ["F1", "FE"].includes(normalizeCategoryId(categoryId));
}
function normalizeAllowedCategories(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const allowed = raw.map(normalizeCategoryId).filter((categoryId) => ALL_CATEGORY_IDS.includes(categoryId));
  return allowed.length ? Array.from(new Set(allowed)) : ALL_CATEGORY_IDS;
}
function normalizeAllowedPages(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const allowed = raw.map((pageId) => String(pageId || "").trim()).filter((pageId) => ALL_ADMIN_PAGE_IDS.includes(pageId));
  return allowed.length ? Array.from(new Set(allowed)) : ALL_ADMIN_PAGE_IDS;
}
function mapAdminPermissionsFromDb(row) {
  if (!row) return defaultAdminPermissions;
  return {
    role: row.role || "admin",
    allowedCategories: normalizeAllowedCategories(row.allowed_categories),
    allowedPages: normalizeAllowedPages(row.allowed_pages),
  };
}
function hasAdminCategoryAccess(permissions, categoryId) {
  return normalizeAllowedCategories(permissions?.allowedCategories).includes(normalizeCategoryId(categoryId));
}
function getAdminCategoryOptions(permissions) {
  const allowed = normalizeAllowedCategories(permissions?.allowedCategories);
  return CATEGORY_OPTIONS.filter((category) => allowed.includes(category.id));
}
function hasAdminPageAccess(permissions, pageId, user) {
  if (isPermissionsOwner(user)) return true;
  if (pageId === "permissions") return isPermissionsOwner(user);
  return normalizeAllowedPages(permissions?.allowedPages).includes(pageId);
}
function getAdminPageOptions(user, permissions) {
  return ADMIN_PAGE_OPTIONS.filter((page) => hasAdminPageAccess(permissions, page.id, user));
}
function isPermissionsOwner(user) {
  return user?.email?.trim().toLowerCase() === ADMIN_PERMISSIONS_OWNER_EMAIL;
}
function mapAdminPermissionRowFromDb(row) {
  return {
    id: row.id,
    userEmail: row.user_email || "",
    role: row.role || "admin",
    allowedCategories: normalizeAllowedCategories(row.allowed_categories),
    allowedPages: normalizeAllowedPages(row.allowed_pages),
  };
}
function createEmptyPermissionForm() {
  return { userEmail: "", role: "admin", allowedCategories: [...ALL_CATEGORY_IDS], allowedPages: ALL_ADMIN_PAGE_IDS.filter((pageId) => pageId !== "permissions") };
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
const emptyTeam = { name: "", color: "#dc2626", logo: "", driverTitles: 0, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesF3: 0, driverTitlesFE: 0, teamTitles: 0, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesF3: 0, teamTitlesFE: 0, tripleCrowns: 0 };
const emptyRace = { name: "", country: "" };
const emptyCalendarRace = { seasonId: "S16", raceId: "" };
const emptyCalendarEvent = { title: "", description: "", startAt: "", endAt: "" };
const emptySpecialEdition = { eventType: "LEMANS24", editionLabel: "", name: "", date: "", winnerDriverId: "", poleDriverId: "", podiumFirstDriverId: "", podiumSecondDriverId: "", podiumThirdDriverId: "", podium: "", notes: "", sortOrder: 1 };
const emptyDevelopmentForm = { teamId: "", seasonId: "S16", categoryId: "F1", round: 1, speed: 0, acceleration: 0, grip: 0, turbo: 0, turboEnabled: false, level: 0, driverOne: "", driverTwo: "", teamValues: {} };
const emptyPermissionForm = createEmptyPermissionForm();
const defaultSiteSettings = { publicDevelopmentEnabled: true, publicPages: DEFAULT_PUBLIC_PAGE_VISIBILITY, thanksNames: ["LORDEN", "Thibaut", "Etienne"], thanksText: "" };
const DEVELOPMENT_COEFFICIENTS = {
  F1: { speed: 1.6, acceleration: 0.71, grip: 0.69, turbo: 0 },
  FE: { speed: 1.3, acceleration: 0.6, grip: 0.54, turbo: 0.56 },
};

const demoTeams = [
  { id: 101, name: "Apex Racing", color: "#dc2626", logo: "", driverTitles: 1, driverTitlesF1: 1, driverTitlesF2: 1, driverTitlesF3: 0, driverTitlesFE: 0, teamTitles: 3, teamTitlesF1: 3, teamTitlesF2: 0, teamTitlesF3: 0, teamTitlesFE: 0, tripleCrowns: 0 },
  { id: 102, name: "Nova Motorsport", color: "#2563eb", logo: "", driverTitles: 1, driverTitlesF1: 1, driverTitlesF2: 0, driverTitlesF3: 0, driverTitlesFE: 0, teamTitles: 1, teamTitlesF1: 1, teamTitlesF2: 0, teamTitlesF3: 0, teamTitlesFE: 0, tripleCrowns: 1 },
  { id: 103, name: "Velocity Academy", color: "#ef4444", logo: "", driverTitles: 0, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesF3: 0, driverTitlesFE: 0, teamTitles: 1, teamTitlesF1: 0, teamTitlesF2: 1, teamTitlesF3: 0, teamTitlesFE: 0, tripleCrowns: 0 },
  { id: 104, name: "Thunder Junior", color: "#f97316", logo: "", driverTitles: 1, driverTitlesF1: 0, driverTitlesF2: 1, driverTitlesF3: 0, driverTitlesFE: 0, teamTitles: 0, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesF3: 0, teamTitlesFE: 0, tripleCrowns: 0 },
  { id: 105, name: "E-Volt Racing", color: "#16a34a", logo: "", driverTitles: 1, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesF3: 0, driverTitlesFE: 1, teamTitles: 2, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesF3: 0, teamTitlesFE: 2, tripleCrowns: 0 },
  { id: 106, name: "Spark Formula", color: "#22c55e", logo: "", driverTitles: 0, driverTitlesF1: 0, driverTitlesF2: 0, driverTitlesF3: 0, driverTitlesFE: 0, teamTitles: 1, teamTitlesF1: 0, teamTitlesF2: 0, teamTitlesF3: 0, teamTitlesFE: 1, tripleCrowns: 0 },
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
function getSpecialEventName(eventType) {
  return SPECIAL_EVENT_OPTIONS.find((event) => event.id === eventType)?.name || eventType || "Événement";
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
function specialEditionPodium(edition, drivers) {
  const podiumIds = [edition.podiumFirstDriverId, edition.podiumSecondDriverId, edition.podiumThirdDriverId].filter(Boolean);
  if (podiumIds.length) return podiumIds.map((driverId) => driverName(drivers, driverId)).join(" · ");
  return edition.podium || "—";
}
function getDriverSpecialEditionRows(driver, editions = []) {
  return editions
    .map((edition) => {
      const roles = [];
      const isWinner = idsEqual(edition.winnerDriverId, driver.id);
      if (isWinner) roles.push("Vainqueur");
      if (idsEqual(edition.poleDriverId, driver.id)) roles.push("Poleman");
      if (!isWinner && idsEqual(edition.podiumFirstDriverId, driver.id)) roles.push("P1");
      if (idsEqual(edition.podiumSecondDriverId, driver.id)) roles.push("P2");
      if (idsEqual(edition.podiumThirdDriverId, driver.id)) roles.push("P3");
      return { ...edition, roles };
    })
    .filter((edition) => edition.roles.length)
    .sort((a, b) => a.eventType.localeCompare(b.eventType) || Number(a.sortOrder) - Number(b.sortOrder));
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
    driverTitlesF3: team.driver_titles_f3 || 0,
    driverTitlesFE: team.driver_titles_fe || 0,
    teamTitles: team.team_titles_f1 ?? team.team_titles ?? 0,
    teamTitlesF1: team.team_titles_f1 ?? team.team_titles ?? 0,
    teamTitlesF2: team.team_titles_f2 || 0,
    teamTitlesF3: team.team_titles_f3 || 0,
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
    driver_titles_f3: Number(teamForm.driverTitlesF3) || 0,
    driver_titles_fe: Number(teamForm.driverTitlesFE) || 0,
    team_titles: Number(teamForm.teamTitlesF1) || 0,
    team_titles_f1: Number(teamForm.teamTitlesF1) || 0,
    team_titles_f2: Number(teamForm.teamTitlesF2) || 0,
    team_titles_f3: Number(teamForm.teamTitlesF3) || 0,
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
function mapSpecialEditionFromDb(edition) {
  return {
    id: edition.id,
    eventType: edition.event_type || "LEMANS24",
    editionLabel: edition.edition_label || "",
    name: edition.name || "",
    date: edition.date || "",
    winnerDriverId: edition.winner_driver_id || "",
    poleDriverId: edition.pole_driver_id || "",
    podiumFirstDriverId: edition.podium_first_driver_id || "",
    podiumSecondDriverId: edition.podium_second_driver_id || "",
    podiumThirdDriverId: edition.podium_third_driver_id || "",
    podium: edition.podium || "",
    notes: edition.notes || "",
    sortOrder: Number(edition.sort_order) || 0,
  };
}
function mapSpecialEditionToDb(edition) {
  return {
    event_type: edition.eventType,
    edition_label: edition.editionLabel.trim(),
    name: edition.name.trim(),
    date: edition.date || null,
    winner_driver_id: edition.winnerDriverId ? Number(edition.winnerDriverId) : null,
    pole_driver_id: edition.poleDriverId ? Number(edition.poleDriverId) : null,
    fastest_driver_id: null,
    podium_first_driver_id: edition.podiumFirstDriverId ? Number(edition.podiumFirstDriverId) : null,
    podium_second_driver_id: edition.podiumSecondDriverId ? Number(edition.podiumSecondDriverId) : null,
    podium_third_driver_id: edition.podiumThirdDriverId ? Number(edition.podiumThirdDriverId) : null,
    podium: edition.podium.trim(),
    notes: edition.notes.trim(),
    sort_order: Number(edition.sortOrder) || 0,
  };
}
function mapSeasonTitleFromDb(title) {
  return {
    id: title.id,
    seasonId: normalizeSeasonId(title.season_id),
    categoryId: normalizeCategoryId(title.category_id),
    driverId: title.driver_id || "",
    teamId: title.team_id || "",
  };
}
function mapSeasonTitleToDb(title) {
  return {
    season_id: normalizeSeasonId(title.seasonId),
    category_id: normalizeCategoryId(title.categoryId),
    driver_id: title.driverId ? Number(title.driverId) : null,
    team_id: title.teamId ? Number(title.teamId) : null,
  };
}
function mapDevelopmentFromDb(entry) {
  return {
    id: entry.id,
    teamId: entry.team_id,
    seasonId: normalizeSeasonId(entry.season_id),
    categoryId: normalizeCategoryId(entry.category_id),
    round: Number(entry.round) || 1,
    speed: Number(entry.speed) || 0,
    acceleration: Number(entry.acceleration) || 0,
    grip: Number(entry.grip) || 0,
    turbo: Number(entry.turbo) || 0,
    turboEnabled: Boolean(entry.turbo_enabled),
    level: Number(entry.level) || 0,
    driverOne: entry.driver_one || "",
    driverTwo: entry.driver_two || "",
  };
}
function mapDevelopmentToDb(entry) {
  return {
    team_id: entry.teamId ? Number(entry.teamId) : null,
    season_id: normalizeSeasonId(entry.seasonId),
    category_id: normalizeCategoryId(entry.categoryId),
    round: Number(entry.round) || 1,
    speed: Number(entry.speed) || 0,
    acceleration: Number(entry.acceleration) || 0,
    grip: Number(entry.grip) || 0,
    turbo: entry.turboEnabled ? Number(entry.turbo) || 0 : 0,
    turbo_enabled: Boolean(entry.turboEnabled),
    level: Number(entry.level) || 0,
    driver_one: entry.driverOne || "",
    driver_two: entry.driverTwo || "",
  };
}
function getCalendarFeedEstimate(hits, days) {
  const limit = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentHits = hits.filter((hit) => new Date(hit.created_at).getTime() >= limit);
  return new Set(recentHits.map((hit) => hit.visitor_hash).filter(Boolean)).size;
}
function getDevelopmentCoef(entry) {
  const coefficients = DEVELOPMENT_COEFFICIENTS[normalizeCategoryId(entry?.categoryId)] || DEVELOPMENT_COEFFICIENTS.F1;
  return Number(entry?.level) || (
    (Number(entry?.speed) || 0) * coefficients.speed
    + (Number(entry?.acceleration) || 0) * coefficients.acceleration
    + (Number(entry?.grip) || 0) * coefficients.grip
    + (entry?.turboEnabled ? (Number(entry?.turbo) || 0) * coefficients.turbo : 0)
  );
}
function formatDevelopmentValue(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
function getDevelopmentEntriesForSelection(entries, selectedSeasonId, selectedCategoryId) {
  return entries
    .filter((entry) => normalizeSeasonId(entry.seasonId) === normalizeSeasonId(selectedSeasonId) && normalizeCategoryId(entry.categoryId) === normalizeCategoryId(selectedCategoryId))
    .sort((a, b) => (Number(a.round) || 0) - (Number(b.round) || 0));
}
function getSeasonCategoryTeams(teams, drivers, selectedSeasonId, selectedCategoryId) {
  const teamIds = new Set();
  drivers.forEach((driver) => {
    const categories = driver.participations?.[selectedSeasonId] || [];
    if (!categories.some((category) => normalizeCategoryId(category) === normalizeCategoryId(selectedCategoryId))) return;
    const teamId = driver.teamHistory?.[selectedSeasonId] || driver.teamId;
    if (teamId) teamIds.add(String(teamId));
  });

  return teams
    .filter((team) => teamIds.has(String(team.id)))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
function getLatestDevelopmentByTeam(entries, teams) {
  const map = new Map();
  entries.forEach((entry) => {
    const current = map.get(String(entry.teamId));
    if (!current || Number(entry.round) >= Number(current.round)) map.set(String(entry.teamId), entry);
  });
  return teams
    .map((team) => ({ team, entry: map.get(String(team.id)) }))
    .filter((item) => item.entry)
    .sort((a, b) => getDevelopmentCoef(b.entry) - getDevelopmentCoef(a.entry));
}
function getPreviousDevelopmentEntry(entries, target) {
  return entries
    .filter((entry) => idsEqual(entry.teamId, target.teamId) && normalizeSeasonId(entry.seasonId) === normalizeSeasonId(target.seasonId) && normalizeCategoryId(entry.categoryId) === normalizeCategoryId(target.categoryId) && Number(entry.round) < Number(target.round))
    .sort((a, b) => Number(b.round) - Number(a.round))[0] || null;
}
function getDevelopmentSaveErrorMessage(error) {
  const message = error?.message || "";
  if (error?.code === "42P01") return "La table team_development n'existe pas encore. Lance la commande SQL de creation.";
  if (message.includes("turbo_enabled") || error?.code === "PGRST204") return "La colonne turbo_enabled manque dans team_development. Lance la commande SQL d'ajout de colonne.";
  if (message.toLowerCase().includes("row-level security") || error?.code === "42501") return "Supabase bloque l'ecriture sur team_development. Verifie les policies RLS de la table.";
  return message ? `Supabase: ${message}` : "Impossible d'enregistrer le developpement.";
}
function normalizePublicPageSettings(value, publicDevelopmentEnabled = true) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return PUBLIC_PAGE_OPTIONS.reduce((settings, page) => {
    settings[page.id] = source[page.id] !== false;
    return settings;
  }, { ...DEFAULT_PUBLIC_PAGE_VISIBILITY, development: publicDevelopmentEnabled !== false });
}
function normalizeThanksNames(value) {
  const names = Array.isArray(value) ? value : String(value || "").split(/[\n,]/);
  const cleaned = names.map((name) => String(name || "").trim()).filter(Boolean);
  return cleaned.length ? Array.from(new Set(cleaned)) : defaultSiteSettings.thanksNames;
}
function normalizeThanksText(value) {
  return String(value || "").trim();
}
function mapSiteSettingsFromDb(rows = []) {
  const rawSettings = rows.reduce((settings, row) => ({ ...settings, [row.key]: row.value }), { ...defaultSiteSettings });
  const hasPublicPagesSetting = rows.some((row) => row.key === "publicPages");
  return {
    ...defaultSiteSettings,
    ...rawSettings,
    publicPages: normalizePublicPageSettings(hasPublicPagesSetting ? rawSettings.publicPages : null, rawSettings.publicDevelopmentEnabled),
    thanksNames: normalizeThanksNames(rawSettings.thanksNames),
    thanksText: normalizeThanksText(rawSettings.thanksText),
  };
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
function mapRacePredictionFromDb(prediction) {
  const storedOrder = Array.isArray(prediction.predicted_order) ? prediction.predicted_order : [];
  return {
    id: prediction.id,
    userId: prediction.user_id || "",
    playerId: prediction.player_id || "",
    pseudo: prediction.pseudo || "",
    raceId: prediction.race_id,
    seasonId: normalizeSeasonId(prediction.season_id),
    categoryId: normalizeCategoryId(prediction.category_id),
    winnerDriverId: prediction.winner_driver_id || "",
    poleDriverId: prediction.pole_driver_id || "",
    fastestDriverId: prediction.fastest_driver_id || "",
    podiumFirstDriverId: prediction.podium_first_driver_id || "",
    podiumSecondDriverId: prediction.podium_second_driver_id || "",
    podiumThirdDriverId: prediction.podium_third_driver_id || "",
    predictedOrder: storedOrder.map((driverId) => String(driverId || "")).filter(Boolean),
    createdAt: prediction.created_at || "",
  };
}
function mapRacePredictionToDb(prediction) {
  const predictedOrder = Array.isArray(prediction.predictedOrder) ? prediction.predictedOrder.filter(Boolean).map((driverId) => Number(driverId)) : [];
  return {
    user_id: prediction.userId || null,
    player_id: prediction.playerId ? Number(prediction.playerId) : null,
    pseudo: String(prediction.pseudo || "").trim(),
    race_id: Number(prediction.raceId),
    season_id: normalizeSeasonId(prediction.seasonId),
    category_id: normalizeCategoryId(prediction.categoryId),
    winner_driver_id: prediction.winnerDriverId ? Number(prediction.winnerDriverId) : null,
    pole_driver_id: prediction.poleDriverId ? Number(prediction.poleDriverId) : null,
    fastest_driver_id: prediction.fastestDriverId ? Number(prediction.fastestDriverId) : null,
    podium_first_driver_id: prediction.podiumFirstDriverId ? Number(prediction.podiumFirstDriverId) : null,
    podium_second_driver_id: prediction.podiumSecondDriverId ? Number(prediction.podiumSecondDriverId) : null,
    podium_third_driver_id: prediction.podiumThirdDriverId ? Number(prediction.podiumThirdDriverId) : null,
    predicted_order: predictedOrder,
  };
}
function mapPlayerProfileFromDb(profile) {
  return {
    id: profile.id || profile.user_id || "",
    userId: profile.user_id || "",
    pseudo: profile.pseudo || "",
    discordName: profile.discord_name || "",
    createdAt: profile.created_at || "",
    lastSeenAt: profile.last_seen_at || "",
  };
}
function mapGuessDriverResultFromDb(result) {
  return {
    id: result.id,
    userId: result.user_id || "",
    playerId: result.player_id || "",
    pseudo: result.pseudo || "",
    discordName: result.discord_name || "",
    categoryId: normalizeCategoryId(result.category_id),
    challengeDay: result.challenge_day || "",
    driverId: result.driver_id || "",
    attempts: Number(result.attempts || 0),
    won: Boolean(result.won),
    createdAt: result.created_at || "",
  };
}
function mapPredictionControlFromDb(control) {
  return {
    id: control.id,
    raceId: control.race_id,
    closed: Boolean(control.closed),
    updatedAt: control.updated_at || "",
  };
}
function isPredictionClosedForRace(raceResults = [], controls = [], raceId) {
  return Boolean(getRaceResultForRace(raceResults, raceId)) || controls.some((control) => String(control.raceId) === String(raceId) && control.closed);
}
function getRaceResultForRace(raceResults = [], raceId) {
  return raceResults.find((result) => String(result.raceId) === String(raceId));
}
function scoreRacePrediction(prediction, raceResults = []) {
  const result = getRaceResultForRace(raceResults, prediction.raceId);
  if (!result) return { scored: false, score: 0, details: "En attente du résultat" };
  const sortedEntries = [...result.entries].sort((a, b) => Number(a.position) - Number(b.position));
  const winner = sortedEntries.find((entry) => Number(entry.position) === 1);
  const poleIds = sortedEntries.filter((entry) => entry.pole).map((entry) => String(entry.driverId));
  const fastestIds = sortedEntries.filter((entry) => entry.fastestLap).map((entry) => String(entry.driverId));
  const podiumIds = sortedEntries.slice(0, 3).map((entry) => String(entry.driverId));
  const predictedOrder = Array.isArray(prediction.predictedOrder) && prediction.predictedOrder.length
    ? prediction.predictedOrder.map((id) => String(id || "")).filter(Boolean)
    : [prediction.podiumFirstDriverId, prediction.podiumSecondDriverId, prediction.podiumThirdDriverId].map((id) => String(id || "")).filter(Boolean);
  const predictedPodium = predictedOrder.slice(0, 3);
  let score = 0;
  const parts = [];
  if (idsEqual(prediction.winnerDriverId, winner?.driverId)) { score += 10; parts.push("Vainqueur +10"); }
  if (poleIds.includes(String(prediction.poleDriverId))) { score += 5; parts.push("Pole +5"); }
  if (fastestIds.includes(String(prediction.fastestDriverId))) { score += 5; parts.push("MT +5"); }
  const podiumHits = predictedPodium.filter((driverId) => podiumIds.includes(driverId)).length;
  if (podiumHits) { score += podiumHits * 3; parts.push(`Podium +${podiumHits * 3}`); }
  if (predictedPodium.length === 3 && predictedPodium.every((driverId, index) => podiumIds[index] === driverId)) {
    score += 10;
    parts.push("Podium exact +10");
  }
  const exactPositions = predictedOrder.reduce((count, driverId, index) => sortedEntries[index] && idsEqual(sortedEntries[index].driverId, driverId) ? count + 1 : count, 0);
  if (exactPositions) { score += exactPositions * 2; parts.push(`Positions exactes +${exactPositions * 2}`); }
  return { scored: true, score, details: parts.length ? parts.join(" · ") : "0 point" };
}
function getPredictionLeaderboard(predictions = [], raceResults = []) {
  const map = new Map();
  predictions.forEach((prediction) => {
    const key = prediction.pseudo.trim().toLowerCase();
    if (!key) return;
    const scored = scoreRacePrediction(prediction, raceResults);
    const current = map.get(key) || { pseudo: prediction.pseudo, score: 0, entries: 0 };
    map.set(key, { ...current, pseudo: current.pseudo || prediction.pseudo, score: current.score + scored.score, entries: current.entries + 1 });
  });
  return Array.from(map.values()).sort((a, b) => b.score - a.score || a.pseudo.localeCompare(b.pseudo, "fr"));
}
function getDailyDriverChallenge(drivers = [], seasonId = "", categoryId = "") {
  if (!drivers.length) return null;
  const dayKey = getDailyChallengeDay();
  const seed = `${dayKey}-${normalizeSeasonId(seasonId)}-${normalizeCategoryId(categoryId)}`;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return drivers[hash % drivers.length];
}
function getDailyChallengeDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function getPreviousChallengeDay(day) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return getDailyChallengeDay(date);
}
function getGuessDriverStreak(results = [], userId = "", categoryId = "") {
  if (!userId) return 0;
  const wonDays = new Set(results
    .filter((result) => (String(result.playerId || "") === String(userId) || String(result.userId || "") === String(userId)) && result.won && normalizeCategoryId(result.categoryId) === normalizeCategoryId(categoryId))
    .map((result) => result.challengeDay)
    .filter(Boolean));
  let day = getDailyChallengeDay();
  let streak = 0;
  while (wonDays.has(day)) {
    streak += 1;
    day = getPreviousChallengeDay(day);
  }
  return streak;
}
function compareGuessValue(guessValue, targetValue) {
  const guessNumber = Number(guessValue) || 0;
  const targetNumber = Number(targetValue) || 0;
  if (guessNumber === targetNumber) return "correct";
  return targetNumber > guessNumber ? "higher" : "lower";
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
  return <span className={`urtt-stat-value${record ? " urtt-record-value" : ""}`} style={record ? styles.recordValue : undefined}>{value}</span>;
}
function getDriverSeasonBreakdown(driver, raceResults, teams = [], selectedCategoryId = "", seasonTitles = [], allDrivers = []) {
  const activeCategoryId = selectedCategoryId ? normalizeCategoryId(selectedCategoryId) : "";
  const driverPool = allDrivers.length ? allDrivers : [driver];
  return getSeasonOptions().map((season) => {
    const seasonCategories = getDriverSeasonCategories(driver, season.id);
    const categories = activeCategoryId ? seasonCategories.filter((category) => normalizeCategoryId(category) === activeCategoryId) : seasonCategories;
    const participatesInActiveCategory = activeCategoryId ? categories.length > 0 : seasonCategories.length > 0;
    const seasonResults = raceResults.filter((result) => normalizeSeasonId(result.seasonId) === season.id && (!activeCategoryId || normalizeCategoryId(result.categoryId) === activeCategoryId));
    const seasonTeam = getDriverSeasonTeam(driver, season.id, teams);
    const matchingTitles = seasonTitles.filter((title) => normalizeSeasonId(title.seasonId) === season.id && (!activeCategoryId || normalizeCategoryId(title.categoryId) === activeCategoryId));
    let points = 0;
    let wins = 0;
    let podiums = 0;
    let poles = 0;
    let fastestLaps = 0;
    let hatTricks = 0;
    seasonResults.forEach((result) => {
      const entry = result.entries.find((item) => idsEqual(item.driverId, driver.id));
      if (!entry) return;
      points += getPointsForPosition(Number(entry.position), result.categoryId, result.seasonId);
      wins += Number(entry.position) === 1 ? 1 : 0;
      podiums += Number(entry.position) <= 3 ? 1 : 0;
      poles += entry.pole ? 1 : 0;
      fastestLaps += entry.fastestLap ? 1 : 0;
      hatTricks += Number(entry.position) === 1 && entry.pole && entry.fastestLap ? 1 : 0;
    });
    const standingsMap = seasonResults.reduce((map, result) => {
      result.entries.forEach((entry) => {
        const position = Number(entry.position);
        const current = map.get(entry.driverId) || { id: entry.driverId, points: 0, resultCounts: {} };
        current.points += getPointsForPosition(position, result.categoryId, result.seasonId);
        if (Number.isFinite(position) && position > 0) current.resultCounts[position] = (current.resultCounts[position] || 0) + 1;
        map.set(entry.driverId, current);
      });
      return map;
    }, new Map());
    const standings = Array.from(standingsMap.values()).sort(sortSeasonStandings);
    const positionIndex = standings.findIndex((item) => idsEqual(item.id, driver.id));
    const teamStandingsMap = seasonResults.reduce((map, result) => {
      result.entries.forEach((entry) => {
        const entryDriver = driverPool.find((item) => idsEqual(item.id, entry.driverId));
        const teamId = entryDriver?.teamHistory?.[season.id] || entryDriver?.teamId;
        if (!teamId) return;
        const position = Number(entry.position);
        const current = map.get(String(teamId)) || { id: teamId, points: 0, resultCounts: {} };
        current.points += getPointsForPosition(position, result.categoryId, result.seasonId);
        if (Number.isFinite(position) && position > 0) current.resultCounts[position] = (current.resultCounts[position] || 0) + 1;
        map.set(String(teamId), current);
      });
      return map;
    }, new Map());
    const teamStandings = Array.from(teamStandingsMap.values()).sort(sortSeasonStandings);
    const championTeam = teamStandings[0];
    const manualDriverTitle = matchingTitles.find((title) => title.driverId);
    const manualTeamTitle = matchingTitles.find((title) => title.teamId);
    const driverChampion = manualDriverTitle ? idsEqual(manualDriverTitle.driverId, driver.id) : positionIndex === 0 && points > 0;
    const constructorChampion = participatesInActiveCategory && (manualTeamTitle ? idsEqual(manualTeamTitle.teamId, seasonTeam?.id || driver?.teamHistory?.[season.id] || driver?.teamId) : championTeam?.points > 0 && idsEqual(championTeam.id, seasonTeam?.id || driver?.teamHistory?.[season.id] || driver?.teamId));
    return { seasonId: season.id, position: positionIndex >= 0 ? positionIndex + 1 : null, team: seasonTeam, teamName: getTeamNameById(teams, driver?.teamHistory?.[season.id] || driver?.teamId), categories, driverChampion, constructorChampion, points, wins, podiums, poles, fastestLaps, hatTricks };
  }).filter((row) => row.categories.length || row.driverChampion || row.constructorChampion || row.points || row.wins || row.podiums || row.poles || row.fastestLaps || row.hatTricks);
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
      .urtt-public-title {
        cursor: pointer;
        user-select: none;
      }
      .urtt-champion-mode {
        background:
          radial-gradient(circle at 18% 0%, rgba(168, 85, 247, .38), transparent 34%),
          radial-gradient(circle at 82% 12%, rgba(220, 38, 38, .26), transparent 30%),
          radial-gradient(circle at 50% 88%, rgba(59, 130, 246, .16), transparent 34%),
          #09090b !important;
      }
      .urtt-champion-mode::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
          linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
        background-size: 42px 42px;
        mask-image: radial-gradient(circle at center, black, transparent 78%);
      }
      .urtt-champion-mode > * {
        position: relative;
        z-index: 1;
      }
      .urtt-champion-mode .urtt-public-title {
        animation: urttChampionTitle 1.7s ease-in-out infinite alternate;
        color: #fff !important;
        text-shadow: 0 0 12px rgba(168, 85, 247, .95), 0 0 28px rgba(220, 38, 38, .68);
      }
      .urtt-champion-mode .urtt-card,
      .urtt-champion-mode .urtt-stat-card {
        animation: urttChampionCard 2.4s ease-in-out infinite;
        border-color: rgba(168, 85, 247, .78) !important;
      }
      .urtt-champion-mode .urtt-stat-value,
      .urtt-champion-mode .urtt-record-value {
        animation: urttChampionValue 1.25s ease-in-out infinite alternate;
        font-weight: 950;
      }
      .urtt-champion-banner {
        max-width: 1280px;
        margin: 0 auto 10px;
        padding: 0 28px;
      }
      .urtt-champion-banner-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid rgba(168, 85, 247, .7);
        border-radius: 18px;
        background: linear-gradient(90deg, rgba(88, 28, 135, .72), rgba(127, 29, 29, .56));
        box-shadow: 0 0 24px rgba(168, 85, 247, .28);
      }
      .urtt-champion-banner strong {
        letter-spacing: .12em;
        font-size: 13px;
      }
      .urtt-champion-banner button {
        border: 1px solid rgba(255,255,255,.2);
        background: rgba(9,9,11,.7);
        color: white;
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 900;
        cursor: pointer;
      }
      @keyframes urttChampionTitle {
        from { transform: translateX(0); filter: saturate(1); }
        45% { transform: translateX(1px) skewX(-1deg); }
        55% { transform: translateX(-1px) skewX(1deg); }
        to { transform: translateX(0); filter: saturate(1.45); }
      }
      @keyframes urttChampionCard {
        0%, 100% { box-shadow: 0 18px 40px rgba(0,0,0,.32), 0 0 0 rgba(168,85,247,0); }
        50% { box-shadow: 0 22px 52px rgba(0,0,0,.44), 0 0 24px rgba(168,85,247,.28); }
      }
      @keyframes urttChampionValue {
        from { text-shadow: 0 0 0 rgba(168,85,247,0); }
        to { text-shadow: 0 0 10px rgba(168,85,247,.95), 0 0 18px rgba(220,38,38,.55); }
      }
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
        .urtt-development-cards {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }
        .urtt-public-main:has(.urtt-standings-page) {
          max-width: min(96vw, 1800px) !important;
        }
        .urtt-standings-grid {
          grid-template-columns: minmax(0, 1.12fr) minmax(0, .88fr) !important;
          align-items: start;
        }
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
        .urtt-public-main .urtt-driver-standings td:nth-child(2) {
          width: 190px;
        }
        .urtt-public-main .urtt-team-standings th:nth-child(2),
        .urtt-public-main .urtt-team-standings td:nth-child(2) {
          width: 142px;
        }
        .urtt-public-main .urtt-team-stats-table th:nth-child(2),
        .urtt-public-main .urtt-team-stats-table td:nth-child(2) {
          width: 150px;
          max-width: 150px;
        }
        .urtt-public-main .urtt-team-stats-table .urtt-identity,
        .urtt-public-main .urtt-team-stats-table .urtt-name-button {
          width: 100%;
          max-width: 100%;
        }
        .urtt-public-main .urtt-team-stats-table .urtt-identity-text {
          flex: 1 1 auto;
          min-width: 0;
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
        .urtt-public-main .urtt-compact-race-table th,
        .urtt-public-main .urtt-compact-race-table td {
          padding: 9px 5px !important;
        }
        .urtt-public-main .urtt-compact-race-table th:nth-last-child(n+2):nth-child(n+4),
        .urtt-public-main .urtt-compact-race-table td:nth-last-child(n+2):nth-child(n+4) {
          width: 42px;
          text-align: center;
        }
        .urtt-public-main .urtt-team-standings.urtt-compact-race-table th:nth-last-child(n+2):nth-child(n+3),
        .urtt-public-main .urtt-team-standings.urtt-compact-race-table td:nth-last-child(n+2):nth-child(n+3) {
          width: 42px;
          text-align: center;
        }
        .urtt-public-main .urtt-compact-race-table .urtt-race-column-sub {
          display: none !important;
        }
        .urtt-public-main .urtt-card {
          width: 100%;
        }
      }
      @media (min-width: 761px) and (max-width: 1180px) {
        .urtt-development-cards {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  const [view, setView] = useState("front");
  const [publicPage, setPublicPage] = useState("home");
  const [adminPage, setAdminPage] = useState("dashboard");
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("F1");
  const [selectedSeasonId, setSelectedSeasonId] = useState(() => getLatestSeasonId(DEFAULT_SEASON_OPTIONS));
  const [seasonOptions, setSeasonOptions] = useState(DEFAULT_SEASON_OPTIONS);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [adminUser, setAdminUser] = useState(null);
  const [adminPermissions, setAdminPermissions] = useState(defaultAdminPermissions);
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
  const [specialEditions, setSpecialEditions] = useState([]);
  const [raceResults, setRaceResults] = useState([]);
  const [seasonTitles, setSeasonTitles] = useState([]);
  const [developmentEntries, setDevelopmentEntries] = useState([]);
  const [racePredictions, setRacePredictions] = useState([]);
  const [predictionControls, setPredictionControls] = useState([]);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [guessDriverResults, setGuessDriverResults] = useState([]);
  const [adminPermissionRows, setAdminPermissionRows] = useState([]);
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [liveRaceDrafts, setLiveRaceDrafts] = useState({});
  const [driverForm, setDriverForm] = useState(emptyDriver);
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [raceForm, setRaceForm] = useState(emptyRace);
  const [calendarRaceForm, setCalendarRaceForm] = useState(emptyCalendarRace);
  const [calendarEventForm, setCalendarEventForm] = useState(emptyCalendarEvent);
  const [specialEditionForm, setSpecialEditionForm] = useState(emptySpecialEdition);
  const [editingSpecialEditionId, setEditingSpecialEditionId] = useState(null);
  const [developmentForm, setDevelopmentForm] = useState(emptyDevelopmentForm);
  const [permissionForm, setPermissionForm] = useState(emptyPermissionForm);
  const [editingPermissionId, setEditingPermissionId] = useState(null);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [popup, setPopup] = useState(null);
  const [search, setSearch] = useState("");
  const [adminGlobalSearch, setAdminGlobalSearch] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingPrediction, setIsSavingPrediction] = useState(false);
  const [isSavingPlayerAccount, setIsSavingPlayerAccount] = useState(false);
  const [isSavingGuessResult, setIsSavingGuessResult] = useState(false);
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
    async function loadPlayerProfile() {
      const storedPlayerId = window.localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);
      if (!storedPlayerId) return;
      const { data, error } = await supabase
        .from("player_accounts")
        .select("*")
        .eq("id", storedPlayerId)
        .maybeSingle();

      if (error) {
        if (error.code !== "42P01") console.error("Erreur profil joueur:", error);
        window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
        setPlayerProfile(null);
        return;
      }

      if (!data) {
        window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
        setPlayerProfile(null);
        return;
      }

      setPlayerProfile(mapPlayerProfileFromDb(data));
    }

    loadPlayerProfile();
  }, []);

  useEffect(() => {
    async function loadAdminPermissions() {
      if (!adminUser?.email) {
        setAdminPermissions(defaultAdminPermissions);
        return;
      }

      const { data, error } = await supabase
        .from("admin_permissions")
        .select("*")
        .eq("user_email", adminUser.email)
        .maybeSingle();

      if (error) {
        if (error.code !== "42P01") console.error("Erreur permissions admin:", error);
        setAdminPermissions(defaultAdminPermissions);
        return;
      }

      setAdminPermissions(mapAdminPermissionsFromDb(data));
    }

    loadAdminPermissions();
  }, [adminUser]);

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
        { data: specialEditionsData, error: specialEditionsError },
        { data: seasonTitlesData, error: seasonTitlesError },
        { data: developmentData, error: developmentError },
        { data: racePredictionsData, error: racePredictionsError },
        { data: predictionControlsData, error: predictionControlsError },
        { data: guessDriverResultsData, error: guessDriverResultsError },
        { data: adminPermissionsData, error: adminPermissionsError },
        { data: siteSettingsData, error: siteSettingsError },
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
        supabase.from("special_event_editions").select("*").order("event_type", { ascending: true }).order("sort_order", { ascending: true }),
        supabase.from("season_titles").select("*").order("season_id", { ascending: true }),
        supabase.from("team_development").select("*").order("season_id", { ascending: true }).order("round", { ascending: true }),
        supabase.from("race_predictions").select("*").order("created_at", { ascending: false }),
        supabase.from("race_prediction_controls").select("*").order("race_id", { ascending: true }),
        supabase.from("guess_driver_results").select("*").order("challenge_day", { ascending: false }),
        supabase.from("admin_permissions").select("*").order("user_email", { ascending: true }),
        supabase.from("site_settings").select("*"),
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
        specialEditionsError && specialEditionsError.code !== "42P01" && `special_event_editions: ${specialEditionsError.message}`,
        seasonTitlesError && seasonTitlesError.code !== "42P01" && `season_titles: ${seasonTitlesError.message}`,
        developmentError && developmentError.code !== "42P01" && `team_development: ${developmentError.message}`,
        racePredictionsError && racePredictionsError.code !== "42P01" && `race_predictions: ${racePredictionsError.message}`,
        predictionControlsError && predictionControlsError.code !== "42P01" && `race_prediction_controls: ${predictionControlsError.message}`,
        guessDriverResultsError && guessDriverResultsError.code !== "42P01" && `guess_driver_results: ${guessDriverResultsError.message}`,
        adminPermissionsError && adminPermissionsError.code !== "42P01" && `admin_permissions: ${adminPermissionsError.message}`,
        siteSettingsError && siteSettingsError.code !== "42P01" && `site_settings: ${siteSettingsError.message}`,
        resultsError && `race_results: ${resultsError.message}`,
        resultEntriesError && `race_result_entries: ${resultEntriesError.message}`,
      ].filter(Boolean);

      if (loadErrors.length) {
        console.error("Erreurs chargement Supabase:", loadErrors);
        setSupabaseErrors(loadErrors);
      }

      setTeams((teamsData || []).map(mapTeamFromDb));
      setDrivers((driversData || []).map((driver) => mapDriverFromDb(driver, participationsData || [])));
      const normalizedSeasons = normalizeSeasonOptions(seasonsData || []);
      setSeasonOptions(normalizedSeasons);
      setSelectedSeasonId(getLatestSeasonId(normalizedSeasons));
      setRaceLibrary(sortRacesByName((raceLibraryData || []).map(mapRaceLibraryFromDb)));
      const mappedCalendar = (calendarData || []).map(mapCalendarRaceFromDb);
      setAllCalendarRaces(mappedCalendar);
      setCalendarEvents((calendarEventsData || []).map(mapCalendarEventFromDb));
      setCalendarFeedHits(calendarFeedHitsData || []);
      setSpecialEditions((specialEditionsData || []).map(mapSpecialEditionFromDb));
      setSeasonTitles((seasonTitlesData || []).map(mapSeasonTitleFromDb));
      setDevelopmentEntries((developmentData || []).map(mapDevelopmentFromDb));
      setRacePredictions((racePredictionsData || []).map(mapRacePredictionFromDb));
      setPredictionControls((predictionControlsData || []).map(mapPredictionControlFromDb));
      setGuessDriverResults((guessDriverResultsData || []).map(mapGuessDriverResultFromDb));
      setAdminPermissionRows((adminPermissionsData || []).map(mapAdminPermissionRowFromDb));
      setSiteSettings(mapSiteSettingsFromDb(siteSettingsData || []));
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
  const availableSeasonOptions = useMemo(() => getSeasonOptionsForCategory(allCalendarRaces, selectedCategoryId, seasonOptions), [allCalendarRaces, selectedCategoryId, seasonOptions]);
  const effectiveSelectedSeasonId = availableSeasonOptions.length && !availableSeasonOptions.some((season) => normalizeSeasonId(season.id) === normalizeSeasonId(selectedSeasonId))
    ? getLatestSeasonId(availableSeasonOptions)
    : selectedSeasonId;
  const adminCategoryOptions = useMemo(() => getAdminCategoryOptions(adminPermissions), [adminPermissions]);
  const adminPageOptions = useMemo(() => getAdminPageOptions(adminUser, adminPermissions), [adminUser, adminPermissions]);
  const userCanOpenAdmin = (user) => Boolean(user && (isPermissionsOwner(user) || adminPermissionRows.some((row) => row.userEmail.trim().toLowerCase() === user.email?.trim().toLowerCase())));
  const canOpenAdmin = userCanOpenAdmin(adminUser);
  const visibleAdminPage = adminPageOptions.some((page) => page.id === adminPage) ? adminPage : adminPageOptions[0]?.id || "dashboard";
  const adminSelectedCategoryId = hasAdminCategoryAccess(adminPermissions, selectedCategoryId) ? selectedCategoryId : adminCategoryOptions[0]?.id || selectedCategoryId;
  const effectiveDevelopmentCategoryId = isDevelopmentCategory(adminSelectedCategoryId) ? adminSelectedCategoryId : adminCategoryOptions.find((category) => isDevelopmentCategory(category.id))?.id || "F1";
  const adminRacesBySelectedCategory = useMemo(() => createSeasonMapFromCalendar(allCalendarRaces, adminSelectedCategoryId), [allCalendarRaces, adminSelectedCategoryId]);
  const currentSeasonRaces = racesBySelectedCategory[effectiveSelectedSeasonId] || [];
  const currentAdminSeasonRaces = adminRacesBySelectedCategory[selectedSeasonId] || adminRacesBySelectedCategory[effectiveSelectedSeasonId] || [];
  const computed = useMemo(() => computeStats({ drivers, teams, raceResults, selectedCategoryId, seasonTitles }), [drivers, teams, raceResults, selectedCategoryId, seasonTitles]);
  const seasonOnlyDrivers = computed.driverStatsBySeason[effectiveSelectedSeasonId] || [];
  const seasonOnlyTeams = computed.teamStatsBySeason[effectiveSelectedSeasonId] || [];
  const cumulativeDrivers = computed.cumulativeDriverStatsBySeason[effectiveSelectedSeasonId] || [];
  const cumulativeTeams = computed.cumulativeTeamStatsBySeason[effectiveSelectedSeasonId] || [];

  const filteredDrivers = drivers.filter((driver) => {
    const team = teams.find((item) => item.id === driver.teamId);
    return `${driver.name} ${team?.name || ""}`.toLowerCase().includes(search.toLowerCase());
  });
  const ensureAdminCategoryAccess = (categoryId) => {
    if (hasAdminCategoryAccess(adminPermissions, categoryId)) return true;
    setPopup({ type: "error", title: "Acces refuse", message: `Ton compte n'a pas les droits pour modifier la categorie ${normalizeCategoryId(categoryId)}.` });
    return false;
  };

  async function saveDriver() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de modifier les données." });
      return;
    }

    if (!driverForm.name.trim()) {
      setPopup({ type: "error", title: "Pilote incomplet", message: "Ajoute au moins un nom de pilote." });
      return;
    }
    const driverCategories = Object.values(driverForm.participations || {}).flat().map(normalizeCategoryId);
    const forbiddenDriverCategory = driverCategories.find((categoryId) => !hasAdminCategoryAccess(adminPermissions, categoryId));
    if (forbiddenDriverCategory) {
      setPopup({ type: "error", title: "Acces refuse", message: `Ton compte ne peut pas enregistrer de participation en ${forbiddenDriverCategory}.` });
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
    if (!ensureAdminCategoryAccess(adminSelectedCategoryId)) return;

    if (!calendarRaceForm.raceId) {
      setPopup({ type: "error", title: "Aucun GP", message: "Choisis un GP à ajouter au calendrier." });
      return;
    }

    const raceData = raceLibrary.find((race) => String(race.id) === String(calendarRaceForm.raceId));
    if (!raceData) return;

    const seasonId = calendarRaceForm.seasonId || selectedSeasonId;
    const payload = {
      race_library_id: raceData.id,
      round: (adminRacesBySelectedCategory[seasonId] || []).length + 1,
      name: raceData.name,
      season_id: seasonId,
      category_id: adminSelectedCategoryId,
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

  async function saveSpecialEdition() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les editions." });
      return;
    }

    if (!specialEditionForm.editionLabel.trim()) {
      setPopup({ type: "error", title: "Edition incomplete", message: "Ajoute au moins un nom d'edition, par exemple S3." });
      return;
    }

    setIsSaving(true);
    const request = editingSpecialEditionId
      ? supabase.from("special_event_editions").update(mapSpecialEditionToDb(specialEditionForm)).eq("id", editingSpecialEditionId).select().single()
      : supabase.from("special_event_editions").insert(mapSpecialEditionToDb(specialEditionForm)).select().single();

    const { data, error } = await request;
    setIsSaving(false);

    if (error) {
      console.error("Erreur edition speciale:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: error.code === "42P01" ? "La table special_event_editions n'existe pas encore. Lance la commande SQL fournie par Codex." : "Impossible d'enregistrer cette edition." });
      return;
    }

    const edition = mapSpecialEditionFromDb(data);
    setSpecialEditions((current) => {
      const withoutEdition = current.filter((item) => !idsEqual(item.id, edition.id));
      return [...withoutEdition, edition].sort((a, b) => a.eventType.localeCompare(b.eventType) || Number(a.sortOrder) - Number(b.sortOrder));
    });
    setSpecialEditionForm({ ...emptySpecialEdition, eventType: specialEditionForm.eventType, sortOrder: Number(specialEditionForm.sortOrder) + 1 });
    setEditingSpecialEditionId(null);
    setPopup({ type: "success", title: "Edition enregistree", message: `${getSpecialEventName(edition.eventType)} ${edition.editionLabel} a ete mise a jour.` });
  }

  async function deleteSpecialEdition(editionId) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les editions." });
      return;
    }

    if (!window.confirm("Supprimer cette edition ?")) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("special_event_editions")
      .delete()
      .eq("id", editionId);
    setIsSaving(false);

    if (error) {
      console.error("Erreur suppression edition speciale:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: "Impossible de supprimer cette edition." });
      return;
    }

    setSpecialEditions((current) => current.filter((edition) => !idsEqual(edition.id, editionId)));
    if (idsEqual(editingSpecialEditionId, editionId)) {
      setEditingSpecialEditionId(null);
      setSpecialEditionForm(emptySpecialEdition);
    }
    setPopup({ type: "success", title: "Edition supprimee", message: "L'edition a ete retiree." });
  }

  async function saveDevelopmentEntry(rows = []) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier le developpement." });
      return;
    }
    const requestedDevelopmentCategoryId = rows[0]?.categoryId || developmentForm.categoryId || adminSelectedCategoryId;
    if (!ensureAdminCategoryAccess(requestedDevelopmentCategoryId)) return;

    const batchRows = Array.isArray(rows) && rows.length
      ? rows
      : developmentForm.teamId
        ? [{ ...developmentForm, seasonId: selectedSeasonId, categoryId: requestedDevelopmentCategoryId }]
        : [];

    if (!batchRows.length) {
      setPopup({ type: "error", title: "Developpement incomplet", message: "Aucune ecurie a enregistrer pour cette course." });
      return;
    }

    setIsSaving(true);
    const results = await Promise.all(batchRows.map(async (payload) => {
      const normalizedPayload = { ...payload, seasonId: payload.seasonId || selectedSeasonId, categoryId: payload.categoryId || requestedDevelopmentCategoryId };
      const existing = developmentEntries.find((entry) => idsEqual(entry.teamId, normalizedPayload.teamId) && normalizeSeasonId(entry.seasonId) === normalizeSeasonId(normalizedPayload.seasonId) && normalizeCategoryId(entry.categoryId) === normalizeCategoryId(normalizedPayload.categoryId) && Number(entry.round) === Number(normalizedPayload.round));
      const request = existing
        ? supabase.from("team_development").update(mapDevelopmentToDb(normalizedPayload)).eq("id", existing.id).select().single()
        : supabase.from("team_development").insert(mapDevelopmentToDb(normalizedPayload)).select().single();
      return request;
    }));
    setIsSaving(false);

    const failed = results.find((result) => result.error);
    const error = failed?.error;
    if (error) {
      console.error("Erreur developpement:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: getDevelopmentSaveErrorMessage(error) });
      return;
    }

    const nextEntries = results.map((result) => mapDevelopmentFromDb(result.data));
    setDevelopmentEntries((current) => {
      const nextIds = new Set(nextEntries.map((entry) => String(entry.id)));
      const withoutEntries = current.filter((entry) => !nextIds.has(String(entry.id)));
      return [...withoutEntries, ...nextEntries].sort((a, b) => Number(a.round) - Number(b.round));
    });
    setDevelopmentForm((current) => ({ ...current, seasonId: selectedSeasonId, categoryId: requestedDevelopmentCategoryId, teamValues: {}, round: Number(current.round) }));
    setPopup({ type: "success", title: "Developpement enregistre", message: `${nextEntries.length} ecuries ont ete mises a jour pour la course R${batchRows[0]?.round || developmentForm.round}.` });
  }

  async function deleteDevelopmentEntry(entry) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier le developpement." });
      return;
    }

    if (!entry?.id) return;
    if (!window.confirm(`Supprimer le developpement R${entry.round} de cette ecurie ?`)) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("team_development")
      .delete()
      .eq("id", entry.id);
    setIsSaving(false);

    if (error) {
      console.error("Erreur suppression developpement:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: getDevelopmentSaveErrorMessage(error) });
      return;
    }

    setDevelopmentEntries((current) => current.filter((item) => !idsEqual(item.id, entry.id)));
    setDevelopmentForm((current) => {
      const nextTeamValues = { ...(current.teamValues || {}) };
      delete nextTeamValues[entry.teamId];
      return { ...current, teamValues: nextTeamValues };
    });
    setPopup({ type: "success", title: "Developpement supprime", message: `La ligne R${entry.round} a ete retiree.` });
  }

  async function updateSiteSetting(key, value) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les reglages." });
      return;
    }

    setSiteSettings((current) => ({ ...current, [key]: value }));
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value }, { onConflict: "key" });

    if (error) {
      console.error("Erreur reglage site:", error);
      setSiteSettings((current) => ({ ...current, [key]: !value }));
      setPopup({ type: "error", title: "Erreur Supabase", message: error.code === "42P01" ? "La table site_settings n'existe pas encore. Lance la commande SQL fournie par Codex." : `Impossible de sauvegarder le reglage: ${error.message}` });
      return;
    }

    setPopup({ type: "success", title: "Reglage sauvegarde", message: "La visibilite publique a ete mise a jour." });
  }

  async function saveAdminPermission() {
    if (!isPermissionsOwner(adminUser)) {
      setPopup({ type: "error", title: "Acces refuse", message: "Seul kolti@urtt.fr peut modifier les permissions." });
      return;
    }

    const userEmail = permissionForm.userEmail.trim().toLowerCase();
    const allowedCategories = (permissionForm.allowedCategories || [])
      .map(normalizeCategoryId)
      .filter((categoryId) => ALL_CATEGORY_IDS.includes(categoryId));
    const allowedPages = (permissionForm.allowedPages || [])
      .map((pageId) => String(pageId || "").trim())
      .filter((pageId) => ALL_ADMIN_PAGE_IDS.includes(pageId) && pageId !== "permissions");

    if (!userEmail) {
      setPopup({ type: "error", title: "Email manquant", message: "Renseigne l'adresse mail du compte admin." });
      return;
    }
    if (!allowedCategories.length) {
      setPopup({ type: "error", title: "Categorie manquante", message: "Coche au moins une categorie pour ce compte." });
      return;
    }
    if (!allowedPages.length) {
      setPopup({ type: "error", title: "Page manquante", message: "Coche au moins une page accessible pour ce compte." });
      return;
    }

    const payload = {
      user_email: userEmail,
      role: permissionForm.role.trim() || "admin",
      allowed_categories: Array.from(new Set(allowedCategories)),
      allowed_pages: Array.from(new Set(allowedPages)),
    };

    setIsSaving(true);
    const request = editingPermissionId
      ? supabase.from("admin_permissions").update(payload).eq("id", editingPermissionId).select().single()
      : supabase.from("admin_permissions").upsert(payload, { onConflict: "user_email" }).select().single();
    const { data, error } = await request;
    setIsSaving(false);

    if (error) {
      console.error("Erreur permissions admin:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: error.code === "42P01" ? "La table admin_permissions n'existe pas encore. Lance la commande SQL fournie par Codex." : `Impossible de sauvegarder les permissions: ${error.message}` });
      return;
    }

    const savedRow = mapAdminPermissionRowFromDb(data);
    setAdminPermissionRows((current) => {
      const withoutRow = current.filter((row) => !idsEqual(row.id, savedRow.id) && row.userEmail.toLowerCase() !== savedRow.userEmail.toLowerCase());
      return [...withoutRow, savedRow].sort((a, b) => a.userEmail.localeCompare(b.userEmail));
    });
    if (adminUser?.email?.toLowerCase() === savedRow.userEmail.toLowerCase()) {
      setAdminPermissions({ role: savedRow.role, allowedCategories: savedRow.allowedCategories, allowedPages: savedRow.allowedPages });
    }
    setPermissionForm(createEmptyPermissionForm());
    setEditingPermissionId(null);
    setPopup({ type: "success", title: "Permissions sauvegardees", message: `${savedRow.userEmail} peut gerer ${savedRow.allowedCategories.join(", ")} sur ${savedRow.allowedPages.length} pages.` });
  }

  async function deleteAdminPermission(permissionId) {
    if (!isPermissionsOwner(adminUser)) {
      setPopup({ type: "error", title: "Acces refuse", message: "Seul kolti@urtt.fr peut modifier les permissions." });
      return;
    }

    const row = adminPermissionRows.find((item) => idsEqual(item.id, permissionId));
    if (!row) return;
    if (!window.confirm(`Supprimer les permissions de ${row.userEmail} ?`)) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("admin_permissions")
      .delete()
      .eq("id", permissionId);
    setIsSaving(false);

    if (error) {
      console.error("Erreur suppression permissions:", error);
      setPopup({ type: "error", title: "Erreur Supabase", message: `Impossible de supprimer les permissions: ${error.message}` });
      return;
    }

    setAdminPermissionRows((current) => current.filter((item) => !idsEqual(item.id, permissionId)));
    if (adminUser?.email?.toLowerCase() === row.userEmail.toLowerCase()) {
      setAdminPermissions(defaultAdminPermissions);
    }
    if (idsEqual(editingPermissionId, permissionId)) {
      setEditingPermissionId(null);
      setPermissionForm(createEmptyPermissionForm());
    }
    setPopup({ type: "success", title: "Permissions supprimees", message: `${row.userEmail} n'a plus de restriction personnalisee.` });
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
    if (!ensureAdminCategoryAccess(adminSelectedCategoryId)) return;

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

  async function saveSeasonTitle() {
    if (!adminUser) {
      setPopup({ type: "error", title: "Acces refuse", message: "Connecte-toi avec un compte admin avant de modifier les titres." });
      return;
    }
    if (!ensureAdminCategoryAccess(adminSelectedCategoryId)) return;

    const championDriver = drivers.find((driver) => String(driver.id) === String(titleDriverId));
    const championTeam = teams.find((team) => String(team.id) === String(titleTeamId));

    if (!championDriver || !championTeam) {
      setPopup({ type: "error", title: "Titre de saison incomplet", message: "Choisis un pilote champion et une ecurie championne." });
      return;
    }

    const payload = {
      seasonId: selectedSeasonId,
      categoryId: adminSelectedCategoryId,
      driverId: championDriver.id,
      teamId: championTeam.id,
    };
    const existingTitle = seasonTitles.find((title) => normalizeSeasonId(title.seasonId) === normalizeSeasonId(payload.seasonId) && normalizeCategoryId(title.categoryId) === normalizeCategoryId(payload.categoryId));
    const request = existingTitle
      ? supabase.from("season_titles").update(mapSeasonTitleToDb(payload)).eq("id", existingTitle.id).select().single()
      : supabase.from("season_titles").insert(mapSeasonTitleToDb(payload)).select().single();

    setIsSaving(true);
    const { data, error } = await request;
    setIsSaving(false);

    if (error) {
      console.error("Erreur titre de saison:", error);
      const missingTable = error.code === "42P01";
      setPopup({ type: "error", title: "Erreur Supabase", message: missingTable ? "La table season_titles n'existe pas encore. Lance la commande SQL fournie par Codex." : "Impossible d'enregistrer le titre de saison." });
      return;
    }

    const nextTitle = mapSeasonTitleFromDb(data);
    setSeasonTitles((current) => {
      const withoutCurrent = current.filter((title) => !(normalizeSeasonId(title.seasonId) === nextTitle.seasonId && normalizeCategoryId(title.categoryId) === nextTitle.categoryId));
      return [...withoutCurrent, nextTitle];
    });
    setPopup({ type: "success", title: "Titre de saison enregistre", message: `${seasonName(selectedSeasonId)} ${adminSelectedCategoryId} : ${championDriver.name} / ${championTeam.name}.` });
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

    const selectedRace = currentAdminSeasonRaces.find((race) => String(race.id) === String(selectedRaceId));
    if (!selectedRace) {
      setPopup({ type: "error", title: "Course introuvable", message: "Selectionne une course du calendrier actif avant de valider les resultats." });
      return;
    }
    if (!ensureAdminCategoryAccess(selectedRace.categoryId || adminSelectedCategoryId)) return;

    const resultSeasonId = selectedRace.seasonId || selectedSeasonId;
    const resultCategoryId = selectedRace.categoryId || adminSelectedCategoryId;
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

  async function savePlayerProfile(profile) {
    const pseudo = String(profile.pseudo || "").trim();
    const discordName = String(profile.discordName || "").trim();
    const accessCode = String(profile.accessCode || "").trim();
    if (!pseudo) return { ok: false, message: "Ajoute un pseudo public." };
    if (!discordName) return { ok: false, message: "Ajoute ton nom Discord." };
    if (accessCode.length < 4) return { ok: false, message: "Choisis un code secret d'au moins 4 caractères." };

    setIsSavingPlayerAccount(true);
    const { data, error } = await supabase
      .from("player_accounts")
      .insert({ pseudo, discord_name: discordName, access_code: accessCode, last_seen_at: new Date().toISOString() })
      .select()
      .single();
    setIsSavingPlayerAccount(false);

    if (error) {
      console.error("Erreur profil joueur:", error);
      const message = error.code === "42P01"
        ? "La table player_accounts n'existe pas encore. Lance la commande SQL fournie par Codex."
        : error.code === "23505"
          ? "Ce pseudo est déjà utilisé."
          : "Impossible d'enregistrer le profil joueur.";
      return { ok: false, message };
    }

    const savedProfile = mapPlayerProfileFromDb(data);
    window.localStorage.setItem(PLAYER_SESSION_STORAGE_KEY, String(savedProfile.id));
    setPlayerProfile(savedProfile);
    return { ok: true, message: "Compte joueur prêt." };
  }

  async function signUpPlayerAccount({ pseudo, discordName, accessCode }) {
    return savePlayerProfile({ pseudo, discordName, accessCode });
  }

  async function loginPlayerAccount({ pseudo, accessCode }) {
    const safePseudo = String(pseudo || "").trim();
    const safeAccessCode = String(accessCode || "").trim();
    if (!safePseudo || !safeAccessCode) return { ok: false, message: "Entre ton pseudo et ton code secret." };
    setIsSavingPlayerAccount(true);
    const { data, error } = await supabase
      .from("player_accounts")
      .select("*")
      .eq("pseudo", safePseudo)
      .eq("access_code", safeAccessCode)
      .maybeSingle();
    setIsSavingPlayerAccount(false);
    if (error) return { ok: false, message: error.code === "42P01" ? "La table player_accounts n'existe pas encore. Lance la commande SQL fournie par Codex." : "Impossible de connecter le compte joueur." };
    if (!data) return { ok: false, message: "Pseudo ou code secret incorrect." };
    const savedProfile = mapPlayerProfileFromDb(data);
    window.localStorage.setItem(PLAYER_SESSION_STORAGE_KEY, String(savedProfile.id));
    setPlayerProfile(savedProfile);
    return { ok: true, message: "Connexion réussie." };
  }

  async function logoutPlayerAccount() {
    window.localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
    setPlayerProfile(null);
  }

  async function saveRacePrediction(prediction) {
    if (!playerProfile?.id || !playerProfile?.pseudo) return { ok: false, message: "Connecte-toi avec ton compte joueur pour envoyer ton prono." };
    if (!prediction.raceId) return { ok: false, message: "Choisis une course." };
    const selectedRace = allCalendarRaces.find((race) => String(race.id) === String(prediction.raceId));
    const seasonDrivers = drivers.filter((driver) => (driver.participations?.[normalizeSeasonId(prediction.seasonId)] || []).some((category) => normalizeCategoryId(category) === normalizeCategoryId(prediction.categoryId)));
    const requiredPositionCount = Math.min(20, seasonDrivers.length || 20);
    const predictedOrder = (prediction.predictedOrder || []).slice(0, requiredPositionCount).filter(Boolean);
    if (!prediction.poleDriverId || !prediction.fastestDriverId || predictedOrder.length < requiredPositionCount) return { ok: false, message: `Remplis la pole, le MT et les ${requiredPositionCount} positions du prono.` };
    if (new Set(predictedOrder.map(String)).size < predictedOrder.length) return { ok: false, message: "Un pilote ne peut pas être choisi deux fois dans le classement." };
    if (isPredictionClosedForRace(raceResults, predictionControls, prediction.raceId)) return { ok: false, message: "Les pronos sont fermés pour cette course." };

    setIsSavingPrediction(true);
    const { data, error } = await supabase
      .from("race_predictions")
      .insert(mapRacePredictionToDb({ ...prediction, playerId: playerProfile.id, pseudo: playerProfile.pseudo, raceName: selectedRace?.name || "", predictedOrder }))
      .select()
      .single();
    setIsSavingPrediction(false);

    if (error) {
      console.error("Erreur prono:", error);
      const message = error.code === "42P01"
        ? "La table race_predictions n'existe pas encore. Lance la commande SQL fournie par Codex."
        : error.message?.toLowerCase().includes("row-level security") || error.code === "42501"
          ? "Supabase bloque l'envoi du prono. Vérifie les policies RLS de race_predictions."
          : "Impossible d'envoyer le prono pour le moment.";
      return { ok: false, message };
    }

    const savedPrediction = mapRacePredictionFromDb(data);
    setRacePredictions((current) => [savedPrediction, ...current]);
    return { ok: true, message: "Prono envoyé ! Il sera scoré quand le résultat sera validé." };
  }

  async function saveGuessDriverWin({ categoryId, challengeDay, driverId, attempts }) {
    if (!playerProfile?.id || !playerProfile?.pseudo) return { ok: false, message: "Connecte-toi avec ton compte joueur pour enregistrer ta série." };
    setIsSavingGuessResult(true);
    const { data, error } = await supabase
      .from("guess_driver_results")
      .upsert({
        player_id: Number(playerProfile.id),
        pseudo: playerProfile.pseudo,
        discord_name: playerProfile.discordName || "",
        category_id: normalizeCategoryId(categoryId),
        challenge_day: challengeDay,
        driver_id: Number(driverId),
        attempts: Number(attempts || 0),
        won: true,
      }, { onConflict: "player_id,category_id,challenge_day" })
      .select()
      .single();
    setIsSavingGuessResult(false);

    if (error) {
      console.error("Erreur défi pilote:", error);
      const message = error.code === "42P01"
        ? "La table guess_driver_results n'existe pas encore. Lance la commande SQL fournie par Codex."
        : "Impossible d'enregistrer le défi pilote.";
      return { ok: false, message };
    }

    const savedResult = mapGuessDriverResultFromDb(data);
    setGuessDriverResults((current) => {
      const withoutSameDay = current.filter((result) => !(String(result.playerId) === String(savedResult.playerId) && result.categoryId === savedResult.categoryId && result.challengeDay === savedResult.challengeDay));
      return [savedResult, ...withoutSameDay];
    });
    return { ok: true, message: "Défi enregistré dans ton compte." };
  }

  async function toggleRacePredictionClosed(raceId, closed) {
    setIsSavingPrediction(true);
    const { data, error } = await supabase
      .from("race_prediction_controls")
      .upsert({ race_id: Number(raceId), closed: Boolean(closed), updated_at: new Date().toISOString() }, { onConflict: "race_id" })
      .select()
      .single();
    setIsSavingPrediction(false);

    if (error) {
      console.error("Erreur fermeture prono:", error);
      setPopup({
        type: "error",
        title: "Erreur Supabase",
        message: error.code === "42P01" ? "La table race_prediction_controls n'existe pas encore. Lance la commande SQL fournie par Codex." : "Impossible de modifier l'état des pronos.",
      });
      return;
    }

    const savedControl = mapPredictionControlFromDb(data);
    setPredictionControls((current) => {
      const withoutControl = current.filter((control) => String(control.raceId) !== String(savedControl.raceId));
      return [...withoutControl, savedControl];
    });
  }

  async function deleteRacePrediction(predictionId) {
    if (!adminUser) {
      setPopup({ type: "error", title: "Accès refusé", message: "Connecte-toi avec un compte admin avant de supprimer un prono." });
      return;
    }
    if (!window.confirm("Supprimer ce prono ? Cette action est définitive.")) return;

    setIsSavingPrediction(true);
    const { error } = await supabase
      .from("race_predictions")
      .delete()
      .eq("id", predictionId);
    setIsSavingPrediction(false);

    if (error) {
      console.error("Erreur suppression prono:", error);
      setPopup({
        type: "error",
        title: "Erreur Supabase",
        message: error.message?.toLowerCase().includes("row-level security") || error.code === "42501"
          ? "Supabase bloque la suppression du prono. Vérifie les policies RLS de race_predictions."
          : "Impossible de supprimer ce prono.",
      });
      return;
    }

    setRacePredictions((current) => current.filter((prediction) => String(prediction.id) !== String(predictionId)));
    setPopup({ type: "success", title: "Prono supprimé", message: "Le prono a bien été retiré." });
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
          selectedSeasonId={effectiveSelectedSeasonId}
          setSelectedSeasonId={setSelectedSeasonId}
          seasonOptions={availableSeasonOptions}
          publicPage={publicPage}
          setPublicPage={setPublicPage}
          seasonOnlyDrivers={seasonOnlyDrivers}
          seasonOnlyTeams={seasonOnlyTeams}
          cumulativeDrivers={cumulativeDrivers}
          cumulativeTeams={cumulativeTeams}
          races={currentSeasonRaces}
          countdownRaces={allCalendarRaces}
          calendarEvents={calendarEvents}
          specialEditions={specialEditions}
          raceLibrary={raceLibrary}
          allRaces={allRaces}
          raceResults={raceResults}
          seasonTitles={seasonTitles}
          developmentEntries={developmentEntries}
          racePredictions={racePredictions}
          predictionControls={predictionControls}
          siteSettings={siteSettings}
          allDrivers={drivers}
          onSavePrediction={saveRacePrediction}
          isSavingPrediction={isSavingPrediction}
          adminUser={adminUser}
          playerProfile={playerProfile}
          guessDriverResults={guessDriverResults}
          onPlayerLogin={loginPlayerAccount}
          onPlayerSignup={signUpPlayerAccount}
          onPlayerLogout={logoutPlayerAccount}
          onSaveGuessDriverWin={saveGuessDriverWin}
          isSavingPlayerAccount={isSavingPlayerAccount}
          isSavingGuessResult={isSavingGuessResult}
          isAdminPreview={isAdminPreview && Boolean(adminUser)}
          onOpenAdmin={() => {
            setIsAdminPreview(false);
            setLoginError("");
            setView(canOpenAdmin ? "admin" : "login");
          }}
        />
      )}
      {view === "login" && <LoginScreen email={adminEmail} setEmail={setAdminEmail} password={adminPassword} setPassword={setAdminPassword} loginError={loginError} onLogin={async (event) => { event.preventDefault(); const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword }); if (error) { setLoginError("Email ou mot de passe incorrect."); return; } if (!userCanOpenAdmin(data.user)) { await supabase.auth.signOut(); setAdminUser(null); setLoginError("Ce compte n'a pas accès au panel admin."); return; } setAdminUser(data.user); setIsAdminPreview(false); setAdminPassword(""); setLoginError(""); setView("admin"); }} onBack={() => { setIsAdminPreview(false); setView("front"); }} />} 
      {view === "admin" && (
        <AdminLayout
          active={visibleAdminPage}
          setActive={setAdminPage}
          adminUser={adminUser}
          adminPermissions={adminPermissions}
          adminPageOptions={adminPageOptions}
          onPublic={() => { setIsAdminPreview(true); setView("front"); }}
          onLogout={async () => {
            await supabase.auth.signOut();
            setAdminUser(null);
            setIsAdminPreview(false);
            setView("front");
            setAdminPage("dashboard");
          }}
        >
          {visibleAdminPage === "dashboard" && <Dashboard drivers={computed.globalDriverStats} teams={computed.globalTeamStats} races={currentAdminSeasonRaces} selectedCategoryId={adminSelectedCategoryId} selectedSeasonId={effectiveSelectedSeasonId} />}
          {visibleAdminPage === "supabase" && <SupabasePanel isLoading={isLoadingData} lastSyncAt={lastSyncAt} errors={supabaseErrors} teams={teams} drivers={drivers} raceLibrary={raceLibrary} allCalendarRaces={allCalendarRaces} calendarFeedHits={calendarFeedHits} raceResults={raceResults} selectedCategoryId={adminSelectedCategoryId} selectedSeasonId={effectiveSelectedSeasonId} />}
          {visibleAdminPage === "search" && <AdminSearch search={adminGlobalSearch} setSearch={setAdminGlobalSearch} drivers={drivers} teams={teams} onEditDriver={(driver) => { setEditingDriverId(driver.id); setDriverForm({ ...driver, teamHistory: driver.teamHistory || {}, participations: driver.participations || {} }); setAdminPage("drivers"); }} onEditTeam={(team) => { setEditingTeamId(team.id); setTeamForm(team); setAdminPage("teams"); }} />}
          {visibleAdminPage === "titles" && (
  <TitlesPanel
    drivers={drivers}
    teams={teams}
    titleDriverId={titleDriverId}
    setTitleDriverId={setTitleDriverId}
    titleTeamId={titleTeamId}
    setTitleTeamId={setTitleTeamId}
    selectedCategoryId={adminSelectedCategoryId}
    setSelectedCategoryId={setSelectedCategoryId}
    categoryOptions={adminCategoryOptions}
    selectedSeasonId={effectiveSelectedSeasonId}
    setSelectedSeasonId={setSelectedSeasonId}
    seasonOptions={seasonOptions}
    seasonTitles={seasonTitles}
    onAward={awardManualTitles}
    onSaveSeasonTitle={saveSeasonTitle}
    isSaving={isSaving}
  />
)}
          {visibleAdminPage === "drivers" && <AdminDrivers drivers={filteredDrivers} teams={teams} selectedSeasonId={effectiveSelectedSeasonId} categoryOptions={adminCategoryOptions} form={driverForm} setForm={setDriverForm} editingId={editingDriverId} isSaving={isSaving} onSave={saveDriver} onEdit={(driver) => { setEditingDriverId(driver.id); setDriverForm({ ...driver, teamHistory: driver.teamHistory || {}, participations: driver.participations || {} }); }} onDelete={deleteDriver} onCancel={() => { setDriverForm(emptyDriver); setEditingDriverId(null); }} search={search} setSearch={setSearch} />}
          {visibleAdminPage === "teams" && <AdminTeams teams={teams} form={teamForm} setForm={setTeamForm} editingId={editingTeamId} isSaving={isSaving} onSave={saveTeam} onEdit={(team) => { setEditingTeamId(team.id); setTeamForm(team); }} onDelete={deleteTeam} onCancel={() => { setTeamForm(emptyTeam); setEditingTeamId(null); }} />}
          {visibleAdminPage === "races" && <AdminRaces raceForm={raceForm} setRaceForm={setRaceForm} raceLibrary={raceLibrary} allCalendarRaces={allCalendarRaces} calendarRaceForm={calendarRaceForm} setCalendarRaceForm={setCalendarRaceForm} racesBySeason={adminRacesBySelectedCategory} selectedCategoryId={adminSelectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} categoryOptions={adminCategoryOptions} selectedSeasonId={selectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} onSave={saveRace} onAddToSeason={addRaceToSeason} onDelete={deleteRace} onDeleteLibraryRace={deleteRaceFromLibrary} onUpdateLibraryRaceCountry={updateRaceCountry} onMoveRace={moveRace} onUpdateStartAt={updateRaceStartAt} isSavingRace={isSavingRace} />}
          {visibleAdminPage === "planning" && <PlanningPanel races={allCalendarRaces} calendarEvents={calendarEvents} eventForm={calendarEventForm} setEventForm={setCalendarEventForm} selectedCategoryId={adminSelectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} categoryOptions={adminCategoryOptions} selectedSeasonId={effectiveSelectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} onUpdateStartAt={updateRaceStartAt} onSaveEvent={saveCalendarEvent} onDeleteEvent={deleteCalendarEvent} isSavingEvent={isSavingEvent} />}
          {visibleAdminPage === "editions" && <SpecialEditionsAdmin editions={specialEditions} drivers={drivers} form={specialEditionForm} setForm={setSpecialEditionForm} editingId={editingSpecialEditionId} setEditingId={setEditingSpecialEditionId} onSave={saveSpecialEdition} onDelete={deleteSpecialEdition} isSaving={isSaving} />}
          {visibleAdminPage === "development" && <DevelopmentAdminPanel teams={teams} drivers={drivers} entries={developmentEntries} form={developmentForm} setForm={setDevelopmentForm} selectedCategoryId={effectiveDevelopmentCategoryId} setSelectedCategoryId={setSelectedCategoryId} categoryOptions={adminCategoryOptions} selectedSeasonId={effectiveSelectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} onSave={saveDevelopmentEntry} onDelete={deleteDevelopmentEntry} isSaving={isSaving} />}
          {visibleAdminPage === "games" && <GamesAdminPanel predictions={racePredictions} predictionControls={predictionControls} races={allCalendarRaces} drivers={drivers} raceResults={raceResults} selectedCategoryId={adminSelectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} categoryOptions={adminCategoryOptions} selectedSeasonId={effectiveSelectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} onToggleClosed={toggleRacePredictionClosed} onDeletePrediction={deleteRacePrediction} isSaving={isSavingPrediction} />}
          {visibleAdminPage === "results" && <ResultsManager drivers={drivers.filter((driver) => (driver.participations?.[effectiveSelectedSeasonId] || []).some((category) => normalizeCategoryId(category) === normalizeCategoryId(adminSelectedCategoryId)))} teams={teams} selectedCategoryId={adminSelectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} categoryOptions={adminCategoryOptions} races={currentAdminSeasonRaces} selectedSeasonId={effectiveSelectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} selectedRaceId={selectedRaceId} setSelectedRaceId={setSelectedRaceId} getResultEntry={getResultEntry} updateResultEntry={updateResultEntry} onValidate={validateRaceResults} isSavingResult={isSavingResult} />}
          {visibleAdminPage === "race-awards" && <RaceAwardsPanel drivers={drivers} teams={teams} raceResults={raceResults} racesBySeason={adminRacesBySelectedCategory} selectedCategoryId={adminSelectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} categoryOptions={adminCategoryOptions} selectedSeasonId={effectiveSelectedSeasonId} setSelectedSeasonId={setSelectedSeasonId} />}
          {visibleAdminPage === "permissions" && (
            <PermissionsPanel
              adminUser={adminUser}
              rows={adminPermissionRows}
              form={permissionForm}
              setForm={setPermissionForm}
              editingId={editingPermissionId}
              setEditingId={setEditingPermissionId}
              onSave={saveAdminPermission}
              onDelete={deleteAdminPermission}
              isSaving={isSaving}
            />
          )}
          {visibleAdminPage === "settings" && <SettingsPanel seasons={seasonOptions} siteSettings={siteSettings} onUpdateSetting={updateSiteSetting} onAddSeason={addSeason} isSaving={isSaving} />}
          
        </AdminLayout>
      )}
      {popup && <Popup popup={popup} onClose={() => setPopup(null)} />}
    </>
  );
}

function computeStats({ drivers, teams, raceResults, selectedCategoryId, seasonTitles = [] }) {
  const activeCategoryId = normalizeCategoryId(selectedCategoryId);
  const latestSeasonId = getSeasonOptions().at(-1)?.id || "S16";
  const blankDriverStats = (driver, seasonId) => {
    const seasonTeamId = driver.teamHistory?.[seasonId] || driver.teamId;
    return {
      ...driver,
      teamId: seasonTeamId,
      teamName: teams.find((team) => idsEqual(team.id, seasonTeamId))?.name || "Sans écurie",
      driverTitles: 0,
      teamTitles: 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      fastestLaps: 0,
      hatTricks: 0,
      points: 0,
      resultCounts: {},
    };
  };
  const blankTeamStats = (team) => ({
  ...team,
  driverTitles: 0,
  driverTitlesF1: Number(team.driverTitlesF1) || 0,
  driverTitlesF2: Number(team.driverTitlesF2) || 0,
  driverTitlesF3: Number(team.driverTitlesF3) || 0,
  driverTitlesFE: Number(team.driverTitlesFE) || 0,
  teamTitles: 0,
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
        const hatTrick = position === 1 && entry.pole && entry.fastestLap ? 1 : 0;
        driver.points += points;
        driver.wins += win;
        driver.podiums += podium;
        driver.poles += pole;
        driver.fastestLaps += fastest;
        driver.hatTricks += hatTrick;
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
    const seasonTitle = seasonTitles.find((title) => normalizeSeasonId(title.seasonId) === season.id && normalizeCategoryId(title.categoryId) === activeCategoryId);
    const driverChampionIds = new Set();
    const constructorChampionTeamIds = new Set();
    let seasonDriverStats = Array.from(driverMap.values()).filter((driver) => driver.points > 0 || (driver.participations?.[season.id] || []).some((category) => normalizeCategoryId(category) === activeCategoryId)).sort(sortSeasonStandings);
    let seasonTeamStats = Array.from(teamMap.values()).filter((team) => {
      const relatedDrivers = drivers.filter((driver) => idsEqual(driver.teamHistory?.[season.id] || driver.teamId, team.id));
      return team.points > 0 || relatedDrivers.some((driver) => (driver.participations?.[season.id] || []).some((category) => normalizeCategoryId(category) === activeCategoryId));
    }).sort(sortSeasonStandings);

    if (seasonTitle?.driverId) {
      driverChampionIds.add(String(seasonTitle.driverId));
    } else if (seasonDriverStats[0]?.points > 0) {
      driverChampionIds.add(String(seasonDriverStats[0].id));
    }

    if (seasonTitle?.teamId) {
      constructorChampionTeamIds.add(String(seasonTitle.teamId));
    } else if (seasonTeamStats[0]?.points > 0) {
      constructorChampionTeamIds.add(String(seasonTeamStats[0].id));
    }

    seasonDriverStats = seasonDriverStats.map((driver) => ({
      ...driver,
      driverTitles: driverChampionIds.has(String(driver.id)) ? 1 : 0,
      teamTitles: constructorChampionTeamIds.has(String(driver.teamId)) ? 1 : 0,
    }));
    seasonTeamStats = seasonTeamStats.map((team) => ({
      ...team,
      driverTitles: seasonDriverStats.some((driver) => driver.driverTitles && idsEqual(driver.teamId, team.id)) ? 1 : 0,
      teamTitles: constructorChampionTeamIds.has(String(team.id)) ? 1 : 0,
    }));

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
    (Number(b.wins) || 0) - (Number(a.wins) || 0) ||
    (Number(b.podiums) || 0) - (Number(a.podiums) || 0) ||
    (Number(b.poles) || 0) - (Number(a.poles) || 0) ||
    (Number(b.fastestLaps) || 0) - (Number(a.fastestLaps) || 0) ||
    (Number(b.hatTricks) || 0) - (Number(a.hatTricks) || 0) ||
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
        const current = map.get(item.id) || { ...item, driverTitles: 0, teamTitles: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, hatTricks: 0, points: 0, resultCounts: {} };
        map.set(item.id, {
          ...current,
          ...item,
          driverTitles: current.driverTitles + (Number(item.driverTitles) || 0),
          teamTitles: current.teamTitles + (Number(item.teamTitles) || 0),
          wins: current.wins + item.wins,
          podiums: current.podiums + item.podiums,
          poles: current.poles + item.poles,
          fastestLaps: current.fastestLaps + item.fastestLaps,
          hatTricks: (Number(current.hatTricks) || 0) + (Number(item.hatTricks) || 0),
          points: current.points + item.points,
          resultCounts: mergeResultCounts(current.resultCounts, item.resultCounts),
        });
      });
    });
    cumulative[selectedSeason.id] = Array.from(map.values()).sort(sortByTitlesAndResults);
  });
  return cumulative;
}

const COUNTRY_ALIASES = {
  abudhabi: "United Arab Emirates",
  afriquedusud: "South Africa",
  allemagne: "Germany",
  angleterre: "United Kingdom",
  arabiesaoudite: "Saudi Arabia",
  australie: "Australia",
  autriche: "Austria",
  azerbaidjan: "Azerbaijan",
  bahrein: "Bahrain",
  belgique: "Belgium",
  bresil: "Brazil",
  canada: "Canada",
  chine: "China",
  danemark: "Denmark",
  denmark: "Denmark",
  emiratsarabesunis: "United Arab Emirates",
  espagne: "Spain",
  etatsunis: "United States of America",
  france: "France",
  greenland: "Denmark",
  groenland: "Denmark",
  hongrie: "Hungary",
  italie: "Italy",
  japon: "Japan",
  mexique: "Mexico",
  monaco: "Monaco",
  paysbas: "Netherlands",
  portugal: "Portugal",
  qatar: "Qatar",
  royaumeuni: "United Kingdom",
  singapour: "Singapore",
  turquie: "Turkey",
  usa: "United States of America",
  unitedstates: "United States of America",
  unitedstatesofamerica: "United States of America",
};

const COUNTRY_FRENCH_NAMES = {
  Australia: "Australie",
  Austria: "Autriche",
  Azerbaijan: "Azerbaidjan",
  Bahrain: "Bahrein",
  Belgium: "Belgique",
  Brazil: "Bresil",
  Canada: "Canada",
  China: "Chine",
  Denmark: "Danemark",
  France: "France",
  Germany: "Allemagne",
  Hungary: "Hongrie",
  Italy: "Italie",
  Japan: "Japon",
  Mexico: "Mexique",
  Monaco: "Monaco",
  Netherlands: "Pays-Bas",
  Portugal: "Portugal",
  Qatar: "Qatar",
  "Saudi Arabia": "Arabie saoudite",
  Singapore: "Singapour",
  "South Africa": "Afrique du Sud",
  Spain: "Espagne",
  Turkey: "Turquie",
  "United Arab Emirates": "Emirats arabes unis",
  "United Kingdom": "Royaume-Uni",
  "United States of America": "Etats-Unis",
};

function getCountryKey(country) {
  return normalizeResultText(country);
}

function getCanonicalCountry(country) {
  const key = getCountryKey(country);
  if (!key) return "";
  return COUNTRY_ALIASES[key] || String(country || "").trim();
}

function getCountryDisplayName(country) {
  return COUNTRY_FRENCH_NAMES[country] || country;
}

function getRaceCountry(race, raceLibrary) {
  return raceLibrary.find((item) => idsEqual(item.id, race.libraryRaceId))?.country || race.country || "";
}

function countryNameFromFeature(feature) {
  return getCanonicalCountry(feature?.properties?.ADMIN || feature?.properties?.name || feature?.properties?.NAME || "");
}

function buildCircuitsByCountry(races, raceLibrary) {
  return races.reduce((acc, race) => {
    const country = getCanonicalCountry(getRaceCountry(race, raceLibrary));
    if (!country) return acc;
    if (!acc[country]) acc[country] = [];
    acc[country].push(race);
    return acc;
  }, {});
}

const AREKU_MEDIA_LINKS = [
  { label: "Chaîne YouTube", detail: "Vidéos et rediffusions AREKU_F1", url: "https://www.youtube.com/@AREKU_F1", color: "#dc2626" },
  { label: "Chaîne Twitch", detail: "Lives et événements en direct", url: "https://www.twitch.tv/AREKU_F1", color: "#9146ff" },
];

function PublicSite({ selectedCategoryId, setSelectedCategoryId, selectedSeasonId, setSelectedSeasonId, seasonOptions = [], publicPage, setPublicPage, seasonOnlyDrivers, seasonOnlyTeams, cumulativeDrivers, cumulativeTeams, races, countdownRaces = [], calendarEvents = [], specialEditions = [], raceLibrary = [], allRaces, raceResults, seasonTitles = [], developmentEntries = [], racePredictions = [], predictionControls = [], siteSettings = defaultSiteSettings, allDrivers, teams = [], onSavePrediction, isSavingPrediction = false, adminUser = null, playerProfile = null, guessDriverResults = [], onPlayerLogin, onPlayerSignup, onPlayerLogout, onSaveGuessDriverWin, isSavingPlayerAccount = false, isSavingGuessResult = false, isAdminPreview = false, onOpenAdmin }) {
  const [selectedGp, setSelectedGp] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [championMode, setChampionMode] = useState(false);
  const championClicksRef = useRef([]);
  const categoryColor = getCategoryColor(selectedCategoryId);
  const publicVisibility = normalizePublicPageSettings(siteSettings.publicPages, siteSettings.publicDevelopmentEnabled);
  const publicPages = PUBLIC_PAGE_OPTIONS
    .filter((page) => page.id !== "development" || isDevelopmentCategory(selectedCategoryId))
    .filter((page) => isAdminPreview || publicVisibility[page.id] !== false)
    .map((page) => page.id);
  const activePublicPage = publicPages.includes(publicPage) ? publicPage : publicPages[0] || "home";
  const seasonSelectValue = seasonOptions.some((season) => normalizeSeasonId(season.id) === normalizeSeasonId(selectedSeasonId)) ? selectedSeasonId : seasonOptions[0]?.id || "";
  
  const leaderDriver = seasonOnlyDrivers[0]?.name || "—";
  const leaderTeam = seasonOnlyTeams[0]?.name || "—";
  const handleChampionTitleClick = () => {
    const now = Date.now();
    const recentClicks = [...championClicksRef.current.filter((time) => now - time < 1800), now];
    if (recentClicks.length >= 7) {
      setChampionMode(true);
      championClicksRef.current = [];
      return;
    }
    championClicksRef.current = recentClicks;
  };
  return (
    <div className={`urtt-public-page${championMode ? " urtt-champion-mode" : ""}`} style={styles.publicPage}>
      <header className="urtt-public-header" style={styles.publicHeader}>
        <div>
          <p style={{ ...styles.kicker, color: categoryColor }}>URTT DATABASE · {selectedCategoryId}</p>
          <h1 className="urtt-public-title" onClick={handleChampionTitleClick} style={styles.publicTitle}>Statistiques URTT AREKU_F1</h1>
          <p className="urtt-public-subtitle" style={styles.publicSubtitle}>Site public pour consulter les stats par saison, les pilotes, les écuries et les résultats.</p>
        </div>
        <div style={styles.publicSessionBox}>
          {adminUser?.email && <span style={styles.sessionBadge}>Vous êtes connecté sur : <strong>{adminUser.email}</strong></span>}
          <PlayerAccountBox profile={playerProfile} onLogin={onPlayerLogin} onSignup={onPlayerSignup} onLogout={onPlayerLogout} isSaving={isSavingPlayerAccount} />
          <button onClick={onOpenAdmin} style={{ ...styles.primaryButton, background: categoryColor }}>Admin</button>
        </div>
      </header>
      {championMode && (
        <div className="urtt-champion-banner">
          <div className="urtt-champion-banner-inner">
            <strong>CHAMPION MODE ACTIVÉ</strong>
            <button type="button" onClick={() => setChampionMode(false)}>Désactiver</button>
          </div>
        </div>
      )}
      <nav className="urtt-public-nav" style={styles.publicNav}>
        <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={{ ...styles.categorySelect, background: categoryColor, borderColor: categoryColor }}>{CATEGORY_OPTIONS.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select value={seasonSelectValue} onChange={(event) => setSelectedSeasonId(event.target.value)} disabled={!seasonOptions.length} style={styles.seasonSelect}>{seasonOptions.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select>
        {publicPages.map((key) => {
          const label = PUBLIC_PAGE_OPTIONS.find((page) => page.id === key)?.label || key;
          return <button key={key} onClick={() => setPublicPage(key)} style={{ ...styles.publicNavButton, ...(activePublicPage === key ? { ...styles.publicNavActive, background: categoryColor, borderColor: categoryColor } : {}) }}>{label}</button>;
        })}
      </nav>
      <main className="urtt-public-main" style={styles.publicMain}>
        {activePublicPage === "home" && <HomePage countdownRaces={countdownRaces} calendarEvents={calendarEvents} selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} leaderDriver={leaderDriver} leaderTeam={leaderTeam} races={races} thanksNames={siteSettings.thanksNames} thanksText={siteSettings.thanksText} />}
        {activePublicPage === "standings" && <StandingsPage selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} leaderDriver={leaderDriver} leaderTeam={leaderTeam} seasonOnlyDrivers={seasonOnlyDrivers} seasonOnlyTeams={seasonOnlyTeams} races={races} raceResults={raceResults} allDrivers={allDrivers} teams={teams} />}
        {activePublicPage === "drivers" && <><Card title={`Stats pilotes cumulées S1 → ${seasonName(selectedSeasonId)}`} icon="👥"><DriverTable drivers={cumulativeDrivers} detailed showExtendedStats teams={teams} selectedSeasonId={selectedSeasonId} onDriverClick={(driver) => setSelectedDriver(allDrivers.find((item) => item.id === driver.id) || driver)} /></Card>{selectedDriver && <DriverDetails driver={selectedDriver} raceResults={raceResults} teams={teams} selectedCategoryId={selectedCategoryId} seasonTitles={seasonTitles} specialEditions={specialEditions} allDrivers={allDrivers} onClose={() => setSelectedDriver(null)} />}</>}
        {activePublicPage === "teams" && <><Card title={`Stats écuries cumulées S1 → ${seasonName(selectedSeasonId)}`} icon="🏎️"><TeamTable teams={cumulativeTeams} detailed showExtendedStats selectedCategoryId={selectedCategoryId} onTeamClick={(team) => setSelectedTeam(teams.find((item) => item.id === team.id) || team)} /></Card>{selectedTeam && <TeamDetails team={selectedTeam} drivers={allDrivers} raceResults={raceResults} onClose={() => setSelectedTeam(null)} />}</>}
        {activePublicPage === "seasons" && <><Card title={`Résultats — ${seasonName(selectedSeasonId)}`} icon="🏁"><PublicSeasonResults races={races} raceResults={raceResults} drivers={allDrivers} selectedSeasonId={selectedSeasonId} onOpenGp={setSelectedGp} /></Card>{selectedGp && <GpDetails gp={selectedGp} allRaces={allRaces} raceResults={raceResults} drivers={allDrivers} onClose={() => setSelectedGp(null)} />}</>}
        {activePublicPage === "editions" && <SpecialEditionsPage editions={specialEditions} drivers={allDrivers} />}
        {activePublicPage === "development" && <DevelopmentPage teams={teams} drivers={allDrivers} entries={developmentEntries} selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} isAdminPreview={isAdminPreview && publicVisibility.development === false} />}
        {activePublicPage === "predictions" && <PredictionsPage races={races} drivers={allDrivers} teams={teams} currentRankingDrivers={seasonOnlyDrivers} selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} raceResults={raceResults} predictions={racePredictions} predictionControls={predictionControls} playerProfile={playerProfile} onSubmit={onSavePrediction} isSaving={isSavingPrediction} />}
        {activePublicPage === "guess-driver" && <GuessDriverPage key={`${selectedCategoryId}-${playerProfile?.id || "guest"}`} drivers={cumulativeDrivers} teams={teams} selectedCategoryId={selectedCategoryId} profile={playerProfile} results={guessDriverResults} onSaveWin={onSaveGuessDriverWin} isSaving={isSavingGuessResult} />}
        {activePublicPage === "world" && <WorldCircuitsPage races={races} raceLibrary={raceLibrary} selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} allRaces={allRaces} raceResults={raceResults} drivers={allDrivers} />}
      </main>
      <FeedbackWidget />
    </div>
  );
}

function PlayerAccountBox({ profile, onLogin, onSignup, onLogout, isSaving }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ pseudo: "", discordName: "", accessCode: "" });
  const [status, setStatus] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setStatus("");
    const response = mode === "signup" ? await onSignup?.(form) : await onLogin?.(form);
    setStatus(response?.message || "");
    if (response?.ok) setOpen(false);
  };

  return (
    <div style={styles.accountBox}>
      {profile?.pseudo && <span style={styles.sessionBadge}>Joueur : <strong>{profile.pseudo}</strong>{profile.discordName ? ` · ${profile.discordName}` : ""}</span>}
      <div style={styles.headerActions}>
        <button type="button" onClick={() => setOpen(true)} style={styles.secondaryButton}>{profile ? "Compte" : "Connexion"}</button>
        {profile && <button type="button" onClick={onLogout} style={styles.linkButton}>Déconnexion</button>}
      </div>
      {open && (
        <div style={styles.detailOverlay} onMouseDown={() => setOpen(false)}>
          <form onSubmit={submit} style={{ ...styles.feedbackModal, maxWidth: 460 }} onMouseDown={(event) => event.stopPropagation()}>
            <div style={styles.publicRaceHeader}>
              <div><p style={styles.kicker}>COMPTE JOUEUR</p><h2 style={styles.raceTitle}>{mode === "signup" ? "Créer un compte" : "Connexion"}</h2></div>
              <button type="button" onClick={() => setOpen(false)} style={styles.secondaryButton}>Fermer</button>
            </div>
            <div style={styles.feedbackChoice}>
              <button type="button" onClick={() => setMode("login")} style={{ ...styles.feedbackChoiceButton, ...(mode === "login" ? styles.feedbackChoiceActive : {}) }}>Connexion</button>
              <button type="button" onClick={() => setMode("signup")} style={{ ...styles.feedbackChoiceButton, ...(mode === "signup" ? styles.feedbackChoiceActive : {}) }}>Inscription</button>
            </div>
            <Input label="Pseudo" value={form.pseudo} onChange={(value) => update("pseudo", value)} />
            <Input label="Code secret" type="password" value={form.accessCode} onChange={(value) => update("accessCode", value)} />
            {mode === "signup" && (
              <>
                <Input label="Nom Discord" value={form.discordName} onChange={(value) => update("discordName", value)} />
              </>
            )}
            <button type="submit" disabled={isSaving} style={styles.fullButton}>{isSaving ? "Patiente..." : mode === "signup" ? "Créer mon compte" : "Se connecter"}</button>
            {status && <p style={styles.mutedSmall}>{status}</p>}
          </form>
        </div>
      )}
    </div>
  );
}

function WorldCircuitsPage({ races, raceLibrary, selectedSeasonId, selectedCategoryId, allRaces, raceResults, drivers }) {
  const [mapRef] = useState(() => ({ current: null }));
  const [mapStateRef] = useState(() => ({ current: { map: null, layer: null, selectedLayer: null, countryLayers: {} } }));
  const [search, setSearch] = useState("");
  const [mapError, setMapError] = useState("");
  const [mapVersion, setMapVersion] = useState(0);
  const [selectedGp, setSelectedGp] = useState(null);
  const circuitsByCountry = useMemo(() => buildCircuitsByCountry(races, raceLibrary), [races, raceLibrary]);
  const countryList = Object.keys(circuitsByCountry).sort((a, b) => getCountryDisplayName(a).localeCompare(getCountryDisplayName(b), "fr"));
  const raceLookup = useMemo(() => new Map(races.map((race) => [String(race.id), race])), [races]);

  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || !L) {
      setMapError("Carte indisponible. Leaflet n'a pas encore charge.");
      return undefined;
    }
    if (mapStateRef.current.map) return undefined;

    const map = L.map(mapRef.current, { zoomControl: false, minZoom: 2, maxZoom: 7, worldCopyJump: true }).setView([28, 8], 3);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20 }).addTo(map);
    mapStateRef.current.map = map;

    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
      .then((response) => response.json())
      .then((geojson) => {
        mapStateRef.current.layer = L.geoJSON(geojson).addTo(map);
        setMapVersion((version) => version + 1);
      })
      .catch((error) => {
        console.error("Erreur carte pays:", error);
        setMapError("Impossible de charger les pays de la carte.");
      });

    return () => {
      map.remove();
      mapStateRef.current = { map: null, layer: null, selectedLayer: null, countryLayers: {} };
    };
  }, [mapRef, mapStateRef]);

  useEffect(() => {
    const L = window.L;
    const { layer } = mapStateRef.current;
    if (!L || !layer) return;

    mapStateRef.current.countryLayers = {};
    const styleCountry = (feature) => {
      const name = countryNameFromFeature(feature);
      const active = Boolean(circuitsByCountry[name]);
      return { fillColor: active ? "#c000ff" : "#2b1238", weight: active ? 1.1 : 0.7, opacity: 1, color: active ? "rgba(255,255,255,.38)" : "rgba(255,255,255,.16)", fillOpacity: active ? 0.64 : 0.38 };
    };

    const popupHtml = (name) => {
      const circuits = circuitsByCountry[name] || [];
      const shownName = getCountryDisplayName(name);
      if (!circuits.length) return '<div class="urtt-map-popup-title"><h2>' + shownName + '</h2><span>0 circuit</span></div><div class="urtt-map-empty">Aucun circuit n\'est encore renseigne pour ce pays.</div>';
      return '<div class="urtt-map-popup-title"><h2>' + shownName + '</h2><span>' + circuits.length + ' circuit' + (circuits.length > 1 ? 's' : '') + '</span></div>' + circuits.map((race) => '<button type="button" class="urtt-map-circuit urtt-map-circuit-button" data-race-id="' + race.id + '"><b>' + race.round + '. ' + race.name + '</b><span>' + race.categoryId + ' - ' + seasonName(race.seasonId) + '<br>' + formatRaceDate(race.startAt) + '</span><small>Voir historique du circuit</small></button>').join('');
    };

    const selectLayer = (countryLayer, name) => {
      if (mapStateRef.current.selectedLayer) {
        mapStateRef.current.selectedLayer.setStyle(styleCountry(mapStateRef.current.selectedLayer.feature));
      }
      mapStateRef.current.selectedLayer = countryLayer;
      countryLayer.setStyle({ fillColor: "#ff38f2", fillOpacity: 0.9, color: "#ffffff", weight: 2 });
      countryLayer.bringToFront();
      countryLayer.bindPopup(popupHtml(name), { maxWidth: 380 }).openPopup();
    };

    layer.eachLayer((countryLayer) => {
      const name = countryNameFromFeature(countryLayer.feature);
      mapStateRef.current.countryLayers[getCountryKey(name)] = countryLayer;
      countryLayer.setStyle(styleCountry(countryLayer.feature));
      countryLayer.off();
      countryLayer.on({
        mouseover: (event) => {
          if (event.target !== mapStateRef.current.selectedLayer) event.target.setStyle({ fillOpacity: circuitsByCountry[name] ? 0.86 : 0.55, color: "#fff", weight: 1.5 });
        },
        mouseout: (event) => {
          if (event.target !== mapStateRef.current.selectedLayer) event.target.setStyle(styleCountry(event.target.feature));
        },
        click: (event) => selectLayer(event.target, name),
      });
    });
  }, [circuitsByCountry, mapStateRef, mapVersion]);

  useEffect(() => {
    const map = mapStateRef.current.map;
    if (!map) return undefined;
    const openHistory = (event) => {
      const buttons = event.popup.getElement()?.querySelectorAll(".urtt-map-circuit-button") || [];
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const race = raceLookup.get(String(button.dataset.raceId));
          if (race) setSelectedGp(race);
        });
      });
    };
    map.on("popupopen", openHistory);
    return () => map.off("popupopen", openHistory);
  }, [mapStateRef, mapVersion, raceLookup]);

  function searchCountry(event) {
    event.preventDefault();
    const name = getCanonicalCountry(search);
    const layer = mapStateRef.current.countryLayers[getCountryKey(name)];
    if (!layer || !mapStateRef.current.map) return;
    mapStateRef.current.map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 5 });
    layer.fire("click");
  }

  const popupStyles = ".urtt-map .leaflet-control-attribution{background:rgba(0,0,0,.55)!important;color:#ddd!important}.urtt-map .leaflet-control-attribution a{color:#fff!important}.urtt-map .leaflet-popup-content-wrapper{background:rgba(15,10,20,.96);color:white;border:2px solid #c000ff;border-radius:18px;box-shadow:0 0 36px rgba(192,0,255,.35)}.urtt-map .leaflet-popup-tip{background:#c000ff}.urtt-map .leaflet-popup-content{width:320px!important;margin:16px}.urtt-map-popup-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.urtt-map-popup-title h2{margin:0;font-size:1.35rem;text-transform:uppercase;letter-spacing:.04em}.urtt-map-popup-title span{padding:4px 9px;border-radius:999px;background:#c000ff;color:white;font-size:.78rem;font-weight:800;white-space:nowrap}.urtt-map-circuit{width:100%;padding:11px 0;border:0;border-top:1px solid rgba(255,255,255,.14);background:transparent;color:white;text-align:left;cursor:pointer}.urtt-map-circuit:hover b{color:#ff38f2}.urtt-map-circuit b{display:block;font-size:1.02rem;margin-bottom:3px}.urtt-map-circuit span,.urtt-map-empty{color:#cfc7d8;font-size:.9rem;line-height:1.35}.urtt-map-circuit small{display:block;margin-top:6px;color:#ff38f2;font-weight:800}";

  return (
    <div style={styles.worldPage}>
      <style>{popupStyles}</style>
      <div style={styles.worldHero}>
        <h2 style={styles.worldTitle}>{seasonName(selectedSeasonId)} - Circuits du monde</h2>
        <p style={styles.worldSubtitle}>Clique sur un pays pour voir les circuits disponibles en {selectedCategoryId}.</p>
      </div>
      <div style={styles.worldMapShell}>
        <div ref={(node) => { mapRef.current = node; }} className="urtt-map" style={styles.worldLeafletMap} />
        <form onSubmit={searchCountry} style={styles.worldSearch}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un pays..." style={styles.worldSearchInput} />
        </form>
        <div style={styles.worldLegend}>
          <div><span style={{ ...styles.worldSwatch, background: "#c000ff" }} /> Pays avec circuits</div>
          <div><span style={{ ...styles.worldSwatch, background: "#2b1238" }} /> Pays cliquable</div>
        </div>
        <div style={styles.worldCountrySummary}>
          <strong>{countryList.length} pays renseigne{countryList.length > 1 ? "s" : ""}</strong>
          <span>{countryList.map(getCountryDisplayName).join(" · ") || "Ajoute un pays dans Admin > Courses."}</span>
        </div>
        {mapError && <div style={styles.worldEmpty}>{mapError}</div>}
      </div>
      {countryList.length === 0 && (
        <Card title="Pays a renseigner" icon="🌍">
          <div style={styles.stack}>
            <Empty text="Ajoute le pays des circuits dans Admin > Courses > Bibliotheque des GP pour les voir apparaitre sur la carte." />
          </div>
        </Card>
      )}
      {selectedGp && <GpDetails gp={selectedGp} allRaces={allRaces} raceResults={raceResults} drivers={drivers} onClose={() => setSelectedGp(null)} />}
    </div>
  );
}

function HomePage({ countdownRaces = [], calendarEvents = [], selectedSeasonId, selectedCategoryId, leaderDriver, leaderTeam, races = [], thanksNames = defaultSiteSettings.thanksNames, thanksText = "" }) {
  return (
    <div style={styles.section}>
      <SeasonSummary selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} leaderDriver={leaderDriver} leaderTeam={leaderTeam} races={races} />
      <RaceCountdown races={countdownRaces} events={calendarEvents} />
      <MediaLinksCard thanksNames={thanksNames} thanksText={thanksText} />
    </div>
  );
}

function SeasonSummary({ selectedSeasonId, selectedCategoryId, leaderDriver, leaderTeam, races = [] }) {
  return (
    <div style={styles.statsGrid}>
      <Stat label="Catégorie" value={selectedCategoryId} />
      <Stat label="Saison" value={seasonName(selectedSeasonId)} />
      <Stat label="Leader pilote" value={leaderDriver} />
      <Stat label="Leader écurie" value={leaderTeam} />
      <Stat label="GP" value={races.length} />
    </div>
  );
}

function StandingsPage({ selectedSeasonId, selectedCategoryId, leaderDriver, leaderTeam, seasonOnlyDrivers, seasonOnlyTeams, races, raceResults, allDrivers, teams }) {
  return (
    <div className="urtt-standings-page" style={styles.section}>
      <SeasonSummary selectedSeasonId={selectedSeasonId} selectedCategoryId={selectedCategoryId} leaderDriver={leaderDriver} leaderTeam={leaderTeam} races={races} />
      <div className="urtt-standings-grid" style={styles.standingsGrid}>
        <Card title={`Classement pilotes — ${seasonName(selectedSeasonId)}`} icon="🏆"><DriverTable drivers={seasonOnlyDrivers} raceDetails compactRaceDetails races={races} raceResults={raceResults} teams={teams} selectedSeasonId={selectedSeasonId} /></Card>
        <Card title={`Classement écuries — ${seasonName(selectedSeasonId)}`} icon="🏎️"><TeamTable teams={seasonOnlyTeams} raceDetails compactRaceDetails races={races} raceResults={raceResults} drivers={allDrivers} selectedCategoryId={selectedCategoryId} /></Card>
      </div>
    </div>
  );
}

function PredictionsPage({ races = [], drivers = [], teams = [], currentRankingDrivers = [], selectedSeasonId, selectedCategoryId, raceResults = [], predictions = [], predictionControls = [], playerProfile = null, onSubmit, isSaving }) {
  const categoryId = normalizeCategoryId(selectedCategoryId);
  const seasonId = normalizeSeasonId(selectedSeasonId);
  const eligibleDrivers = drivers
    .filter((driver) => (driver.participations?.[seasonId] || []).some((category) => normalizeCategoryId(category) === categoryId))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const openRaces = races.filter((race) => !isPredictionClosedForRace(raceResults, predictionControls, race.id));
  const [selectedRaceId, setSelectedRaceId] = useState(openRaces[0]?.id || races[0]?.id || "");
  const [form, setForm] = useState({ poleDriverId: "", fastestDriverId: "", predictedOrder: [] });
  const [status, setStatus] = useState("");
  const activeRaceId = races.some((race) => String(race.id) === String(selectedRaceId)) ? selectedRaceId : openRaces[0]?.id || races[0]?.id || "";
  const selectedRace = races.find((race) => String(race.id) === String(activeRaceId));
  const raceClosed = selectedRace ? isPredictionClosedForRace(raceResults, predictionControls, selectedRace.id) : true;
  const visiblePredictions = predictions.filter((prediction) => normalizeSeasonId(prediction.seasonId) === seasonId && normalizeCategoryId(prediction.categoryId) === categoryId);
  const racePredictions = visiblePredictions.filter((prediction) => String(prediction.raceId) === String(activeRaceId));
  const leaderboard = getPredictionLeaderboard(visiblePredictions, raceResults).slice(0, 10);
  const driverOptions = eligibleDrivers.length ? eligibleDrivers : drivers;
  const defaultOrder = (currentRankingDrivers.length ? currentRankingDrivers : driverOptions).slice(0, 20).map((driver) => String(driver.id));
  const formOrder = (form.predictedOrder || []).map(String).filter((driverId) => defaultOrder.includes(driverId));
  const predictionOrder = formOrder.length === defaultOrder.length ? formOrder : defaultOrder;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setPredictionOrder = (nextOrder) => setForm((current) => ({ ...current, predictedOrder: nextOrder.map(String) }));
  const movePredictionDriver = (fromIndex, toIndex) => setForm((current) => {
    const currentOrder = (current.predictedOrder || []).map(String).filter((driverId) => defaultOrder.includes(driverId));
    const nextOrder = [...(currentOrder.length === defaultOrder.length ? currentOrder : defaultOrder)];
    if (toIndex < 0 || toIndex >= nextOrder.length) return current;
    const [driverId] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, driverId);
    return { ...current, predictedOrder: nextOrder };
  });
  const submit = async (event) => {
    event.preventDefault();
    setStatus("");
    const predictedOrder = predictionOrder.slice(0, 20);
    const response = await onSubmit?.({
      ...form,
      predictedOrder,
      winnerDriverId: predictedOrder[0] || "",
      podiumFirstDriverId: predictedOrder[0] || "",
      podiumSecondDriverId: predictedOrder[1] || "",
      podiumThirdDriverId: predictedOrder[2] || "",
      raceId: activeRaceId,
      seasonId,
      categoryId,
    });
    setStatus(response?.message || "");
    if (response?.ok) setForm({ poleDriverId: "", fastestDriverId: "", predictedOrder: [] });
  };

  return (
    <div style={styles.section}>
      <Card title={`Pronos GP — ${selectedCategoryId} ${seasonName(selectedSeasonId)}`} icon="🎮">
        <form onSubmit={submit} style={styles.stack}>
          <div style={styles.resultsInfo}>
            <label style={styles.label}><span style={styles.labelText}>Course</span><select value={activeRaceId} onChange={(event) => setSelectedRaceId(event.target.value)} style={styles.resultsSelect}>{races.map((race) => <option key={race.id} value={race.id}>{race.round}. {race.name}{isPredictionClosedForRace(raceResults, predictionControls, race.id) ? " · fermé" : ""}</option>)}</select></label>
            <div style={styles.raceStat}><span style={styles.mutedSmall}>Joueur</span><strong>{playerProfile?.pseudo || "Connexion requise"}</strong></div>
            <div style={styles.raceStat}><span style={styles.mutedSmall}>Statut</span><strong>{raceClosed ? "Pronos fermés" : "Pronos ouverts"}</strong></div>
          </div>
          {races.length === 0 ? <Empty text="Aucune course disponible pour cette saison." /> : (
            <>
              <div style={styles.formGrid}>
                <PredictionSelect label="Poleman" value={form.poleDriverId} onChange={(value) => update("poleDriverId", value)} drivers={driverOptions} />
                <PredictionSelect label="Meilleur tour" value={form.fastestDriverId} onChange={(value) => update("fastestDriverId", value)} drivers={driverOptions} />
              </div>
              <PredictionOrderPicker drivers={driverOptions.slice(0, 20)} teams={teams} seasonId={seasonId} order={predictionOrder} defaultOrder={defaultOrder} onMove={movePredictionDriver} onSetOrder={setPredictionOrder} />
              <button type="submit" disabled={isSaving || raceClosed || !onSubmit || !playerProfile?.pseudo} style={styles.fullButton}>{isSaving ? "Envoi..." : raceClosed ? "Course fermée" : !playerProfile?.pseudo ? "Connecte-toi pour pronostiquer" : "Envoyer mon prono"}</button>
              {status && <p style={styles.mutedSmall}>{status}</p>}
            </>
          )}
        </form>
      </Card>
      <div style={styles.twoColumns}>
        <Card title="Classement pronos" icon="🏆">
          <PredictionLeaderboard leaderboard={leaderboard} />
        </Card>
        <Card title={selectedRace ? `Pronos envoyés — ${selectedRace.name}` : "Pronos envoyés"} icon="📋">
          <PredictionSummary predictions={racePredictions} drivers={drivers} teams={teams} raceResults={raceResults} />
        </Card>
      </div>
    </div>
  );
}

function PredictionSelect({ label, value, onChange, drivers = [] }) {
  return <label style={styles.label}><span style={styles.labelText}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} style={styles.resultsSelect}><option value="">Choisir un pilote</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>;
}

function PredictionOrderPicker({ drivers = [], teams = [], seasonId, order = [], defaultOrder = [], onMove, onSetOrder }) {
  const [dragIndex, setDragIndex] = useState(null);
  const driverMap = new Map(drivers.map((driver) => [String(driver.id), driver]));
  const orderedDriverIds = order.filter((driverId) => driverMap.has(String(driverId)));
  const missingDriverIds = drivers.map((driver) => String(driver.id)).filter((driverId) => !orderedDriverIds.includes(driverId));
  const fullOrder = [...orderedDriverIds, ...missingDriverIds].slice(0, 20);
  const move = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= fullOrder.length) return;
    onMove?.(fromIndex, toIndex);
  };
  const randomize = () => {
    const shuffled = [...fullOrder];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    onSetOrder?.(shuffled);
  };
  const reset = () => onSetOrder?.(defaultOrder.length ? defaultOrder : drivers.map((driver) => String(driver.id)).slice(0, 20));
  const dropOn = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    move(dragIndex, targetIndex);
    setDragIndex(null);
  };

  return (
    <div style={styles.predictionOrderBox}>
      <div style={styles.predictionOrderHeader}>
        <div>
          <strong>Classement prédit</strong>
          <p style={styles.mutedSmall}>Déplace les pilotes pour construire ton top 20.</p>
        </div>
        <div style={styles.actions}>
          <button type="button" onClick={reset} style={styles.editButton}>Classement actuel</button>
          <button type="button" onClick={randomize} style={styles.secondaryButton}>Mélanger</button>
        </div>
      </div>
      <div style={styles.predictionOrderList}>
        {fullOrder.map((driverId, index) => {
          const driver = driverMap.get(String(driverId));
          const team = driver ? getDriverSeasonTeam(driver, seasonId, teams) : null;
          return (
            <div
              key={driverId}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(index)}
              onDragEnd={() => setDragIndex(null)}
              style={{ ...styles.predictionOrderRow, ...(dragIndex === index ? styles.predictionOrderRowDragging : {}) }}
            >
              <span style={styles.predictionPosition}>P{index + 1}</span>
              {driver ? <DriverIdentity driver={driver} teamColor={team?.color} teamLogo={team?.logo} /> : <strong>Pilote inconnu</strong>}
              <div style={styles.predictionMoveButtons}>
                <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} style={styles.editButton}>↑</button>
                <button type="button" onClick={() => move(index, index + 1)} disabled={index === fullOrder.length - 1} style={styles.editButton}>↓</button>
                <span style={styles.predictionDragHandle}>≡</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PredictionLeaderboard({ leaderboard }) {
  if (!leaderboard.length) return <Empty text="Aucun score pour le moment." />;
  return <div style={styles.stack}>{leaderboard.map((row, index) => <div key={row.pseudo} style={styles.itemBox}><div><strong>#{index + 1} {row.pseudo}</strong><p style={styles.mutedSmall}>{row.entries} prono{row.entries > 1 ? "s" : ""}</p></div><span style={styles.points}>{row.score}</span></div>)}</div>;
}

function PredictionSummary({ predictions = [], drivers = [], teams = [], raceResults = [] }) {
  if (!predictions.length) return <Empty text="Aucun prono envoyé pour cette course." />;
  return <div style={styles.stack}>{predictions.map((prediction) => {
    const score = scoreRacePrediction(prediction, raceResults);
    return (
      <div key={prediction.id} style={styles.publicRaceCard}>
        <div style={styles.publicRaceHeader}>
          <div><strong>{prediction.pseudo}</strong><p style={styles.mutedSmall}>{prediction.createdAt ? new Date(prediction.createdAt).toLocaleString("fr-FR") : "Date inconnue"}</p></div>
          <span style={score.scored ? styles.badgeGreen : styles.badgeDark}>{score.scored ? `${score.score} pts` : "En attente"}</span>
        </div>
        <div style={styles.raceStatsGrid}>
          <RaceStat label="Vainqueur" value={driverName(drivers, prediction.winnerDriverId)} />
          <RaceStat label="Poleman" value={driverName(drivers, prediction.poleDriverId)} />
          <RaceStat label="Meilleur tour" value={driverName(drivers, prediction.fastestDriverId)} />
          <RaceStat label="Podium" value={(prediction.predictedOrder?.length ? prediction.predictedOrder.slice(0, 3) : [prediction.podiumFirstDriverId, prediction.podiumSecondDriverId, prediction.podiumThirdDriverId]).map((id) => driverName(drivers, id)).join(" · ")} />
        </div>
        <p style={styles.mutedSmall}>{score.details}</p>
        <div style={styles.titleBadgeRow}>{(prediction.predictedOrder?.length ? prediction.predictedOrder : [prediction.winnerDriverId, prediction.podiumFirstDriverId, prediction.podiumSecondDriverId, prediction.podiumThirdDriverId]).filter(Boolean).slice(0, 20).map((driverId, index) => {
          const driver = drivers.find((item) => idsEqual(item.id, driverId));
          const team = driver ? getDriverSeasonTeam(driver, prediction.seasonId, teams) : null;
          return driver ? <span key={`${prediction.id}-${driverId}`} style={styles.titleBadge}>P{index + 1} · {team?.name ? `${team.name} · ` : ""}{driver.name}</span> : null;
        })}</div>
      </div>
    );
  })}</div>;
}

function GuessDriverPage({ drivers = [], teams = [], selectedCategoryId, profile = null, results = [], onSaveWin, isSaving = false }) {
  const playableDrivers = [...drivers].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const targetDriver = getDailyDriverChallenge(playableDrivers, "ALL", selectedCategoryId);
  const challengeDay = getDailyChallengeDay();
  const savedToday = results.some((result) => String(result.playerId) === String(profile?.id || "") && result.challengeDay === challengeDay && normalizeCategoryId(result.categoryId) === normalizeCategoryId(selectedCategoryId) && result.won);
  const streak = getGuessDriverStreak(results, profile?.id || "", selectedCategoryId);
  const [guessId, setGuessId] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [message, setMessage] = useState("");
  const guessedDrivers = attempts.map((driverId) => playableDrivers.find((driver) => idsEqual(driver.id, driverId))).filter(Boolean);
  const won = targetDriver && (savedToday || attempts.some((driverId) => idsEqual(driverId, targetDriver.id)));
  const remainingDrivers = playableDrivers.filter((driver) => !attempts.some((driverId) => idsEqual(driverId, driver.id)));

  async function submitGuess(event) {
    event.preventDefault();
    setMessage("");
    if (!profile?.id || !profile?.pseudo) {
      setMessage("Connecte-toi avec ton compte joueur pour enregistrer ta série.");
      return;
    }
    if (!guessId) {
      setMessage("Choisis un pilote.");
      return;
    }
    if (attempts.some((driverId) => idsEqual(driverId, guessId))) {
      setMessage("Tu as déjà tenté ce pilote.");
      return;
    }
    const nextAttempts = [...attempts, guessId];
    setAttempts(nextAttempts);
    setGuessId("");
    if (targetDriver && idsEqual(guessId, targetDriver.id) && !savedToday) {
      const response = await onSaveWin?.({ categoryId: selectedCategoryId, challengeDay, driverId: targetDriver.id, attempts: nextAttempts.length });
      setMessage(response?.message || "");
    }
  }

  if (!targetDriver) {
    return <Card title="Défi pilote" icon="❓"><Empty text="Aucun pilote disponible pour cette saison/catégorie." /></Card>;
  }

  return (
    <div style={styles.section}>
      <Card title={`Défi pilote — ${selectedCategoryId}`} icon="❓">
        <div style={styles.guessHero}>
          <div>
            <p style={styles.kicker}>PILOTE MYSTÈRE DU JOUR</p>
            <h2 style={styles.gpDetailTitle}>{won ? targetDriver.name : "Qui est-ce ?"}</h2>
            <p style={styles.mutedSmall}>Le pilote mystère est choisi parmi tous les pilotes {selectedCategoryId} visibles dans les stats cumulées. ↑ veut dire que le pilote mystère a une valeur plus haute, ↓ plus basse.</p>
          </div>
          <div style={styles.statsGrid}>
            <Stat label="Essais" value={attempts.length} />
            <Stat label="Pilotes possibles" value={playableDrivers.length} />
            <Stat label="Série" value={streak} />
          </div>
        </div>
        {!profile?.pseudo && <div style={styles.previewNotice}><strong>Compte requis</strong><span>Connecte-toi pour garder ta série et relier ton défi à ton pseudo Discord.</span></div>}
        <form onSubmit={submitGuess} style={styles.resultsInfo}>
          <label style={styles.label}>
            <span style={styles.labelText}>Ton essai</span>
            <select value={guessId} onChange={(event) => setGuessId(event.target.value)} disabled={won} style={styles.resultsSelect}>
              <option value="">Choisir un pilote</option>
              {remainingDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={won || isSaving} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : won ? "Trouvé" : "Valider l'essai"}</button>
        </form>
        {message && <p style={styles.mutedSmall}>{message}</p>}
        {won && <div style={styles.previewNotice}><strong>Bravo !</strong><span>Tu as trouvé {targetDriver.name}{attempts.length ? ` en ${attempts.length} essai${attempts.length > 1 ? "s" : ""}` : ""}. Série actuelle : {streak}.</span></div>}
      </Card>
      <Card title="Indices" icon="📊">
        <GuessDriverTable guesses={guessedDrivers} target={targetDriver} teams={teams} />
      </Card>
    </div>
  );
}

function GuessDriverTable({ guesses = [], target, teams = [] }) {
  if (!guesses.length) return <Empty text="Fais un premier essai pour afficher les indices." />;
  const statColumns = [
    { key: "points", label: "Points" },
    { key: "wins", label: "V" },
    { key: "podiums", label: "Pod." },
    { key: "poles", label: "Poles" },
    { key: "fastestLaps", label: "MT" },
    { key: "hatTricks", label: "HT" },
  ];

  return (
    <div style={styles.tableWrap}>
      <table style={{ ...styles.table, minWidth: 900 }}>
        <thead><tr style={styles.tableHead}><th style={styles.th}>Pilote</th><th style={styles.th}>Écurie</th>{statColumns.map((column) => <th key={column.key} style={styles.th}>{column.label}</th>)}</tr></thead>
        <tbody>{[...guesses].reverse().map((guess) => {
          const team = teams.find((item) => idsEqual(item.id, guess.teamId)) || null;
          const targetTeam = teams.find((item) => idsEqual(item.id, target.teamId)) || null;
          return (
            <tr key={guess.id} style={styles.tr}>
              <td style={styles.td}><GuessCell correct={idsEqual(guess.id, target.id)}><DriverIdentity driver={guess} teamColor={team?.color} teamLogo={team?.logo} /></GuessCell></td>
              <td style={styles.td}><GuessCell correct={idsEqual(team?.id, targetTeam?.id)}>{team?.name || "—"}</GuessCell></td>
              {statColumns.map((column) => <td key={column.key} style={styles.td}><GuessStatCell value={guess[column.key]} state={compareGuessValue(guess[column.key], target[column.key])} /></td>)}
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function GuessCell({ correct, children }) {
  return <div style={{ ...styles.guessCell, ...(correct ? styles.guessCellCorrect : styles.guessCellWrong) }}>{children}</div>;
}

function GuessStatCell({ value, state }) {
  const marker = state === "correct" ? "✓" : state === "higher" ? "↑" : "↓";
  return <div style={{ ...styles.guessCell, ...(state === "correct" ? styles.guessCellCorrect : styles.guessCellWrong) }}><strong>{value || 0}</strong><span>{marker}</span></div>;
}

function SpecialEditionsPage({ editions = [], drivers = [] }) {
  const sortedEditions = [...editions].sort((a, b) => a.eventType.localeCompare(b.eventType) || Number(a.sortOrder) - Number(b.sortOrder));
  return (
    <div style={styles.section}>
      {SPECIAL_EVENT_OPTIONS.map((event) => {
        const eventEditions = sortedEditions.filter((edition) => edition.eventType === event.id);
        return (
          <Card key={event.id} title={event.name} icon="🏁">
            <div style={styles.stack}>
              {eventEditions.map((edition) => (
                <div key={edition.id} style={{ ...styles.publicRaceCard, borderColor: event.color }}>
                  <div style={styles.publicRaceHeader}>
                    <div>
                      <p style={styles.mutedSmall}>{edition.date ? new Date(edition.date).toLocaleDateString("fr-FR") : "Date non définie"}</p>
                      <h3 style={styles.raceTitle}>{edition.editionLabel}{edition.name ? ` · ${edition.name}` : ""}</h3>
                    </div>
                    <span style={{ ...styles.categoryBadge, background: event.color, color: event.id === "INDY300" ? "#18181b" : "white" }}>{event.name}</span>
                  </div>
                  <div style={styles.raceStatsGrid}>
                    <RaceStat label="Vainqueur" value={driverName(drivers, edition.winnerDriverId)} />
                    <RaceStat label="Poleman" value={driverName(drivers, edition.poleDriverId)} />
                    <RaceStat label="Podium" value={specialEditionPodium(edition, drivers)} />
                  </div>
                  {edition.notes && <p style={styles.mutedSmall}>{edition.notes}</p>}
                </div>
              ))}
              {eventEditions.length === 0 && <Empty text={`Aucune édition ${event.name} enregistrée.`} />}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function DevelopmentPage({ teams, drivers = [], entries = [], selectedSeasonId, selectedCategoryId, isAdminPreview = false }) {
  const selectedEntries = getDevelopmentEntriesForSelection(entries, selectedSeasonId, selectedCategoryId);
  const seasonTeams = getSeasonCategoryTeams(teams, drivers, selectedSeasonId, selectedCategoryId);
  const latestRound = Math.max(1, ...selectedEntries.map((entry) => Number(entry.round) || 1));
  const savedLatestByTeam = getLatestDevelopmentByTeam(selectedEntries, seasonTeams);
  const savedMap = new Map(savedLatestByTeam.map((item) => [String(item.team.id), item.entry]));
  const latestByTeam = seasonTeams.map((team) => ({
    team,
    entry: savedMap.get(String(team.id)) || { teamId: team.id, seasonId: selectedSeasonId, categoryId: selectedCategoryId, round: latestRound, speed: 0, acceleration: 0, grip: 0, turbo: 0, turboEnabled: normalizeCategoryId(selectedCategoryId) === "FE", level: 0 },
  })).sort((a, b) => getDevelopmentCoef(b.entry) - getDevelopmentCoef(a.entry) || a.team.name.localeCompare(b.team.name, "fr"));
  return (
    <div style={styles.section}>
      {isAdminPreview && <div style={styles.previewNotice}><strong>Aperçu admin</strong><span>Cette page est masquée pour le public.</span></div>}
      <Card title={`Développement — ${selectedCategoryId} ${seasonName(selectedSeasonId)}`} icon="📈">
        <DevelopmentChart teams={teams} entries={selectedEntries} />
      </Card>
      <Card title="Classement développement" icon="🏁">
        <DevelopmentBarChart rows={latestByTeam} />
      </Card>
      <div className="urtt-development-cards" style={styles.developmentCards}>
        {latestByTeam.map(({ team, entry }) => <DevelopmentTeamCard key={team.id} team={team} entry={entry} previous={getPreviousDevelopmentEntry(selectedEntries, entry)} />)}
      </div>
      {latestByTeam.length === 0 && <Empty text="Aucune écurie inscrite pour cette saison/catégorie." />}
    </div>
  );
}

function DevelopmentBarChart({ rows = [] }) {
  const maxValue = Math.max(1, ...rows.map(({ entry }) => getDevelopmentCoef(entry)));
  if (!rows.length) return <Empty text="Aucune écurie inscrite pour cette saison/catégorie." />;

  return (
    <div style={styles.developmentBarChart}>
      {rows.map(({ team, entry }, index) => {
        const value = getDevelopmentCoef(entry);
        const width = `${Math.max(8, (value / maxValue) * 100)}%`;
        return (
          <div key={team.id} style={styles.developmentBarRow}>
            <div style={styles.developmentBarTrack}>
              <div style={{ ...styles.developmentBarFill, width, background: team.color || "#dc2626" }}>
                <span style={styles.developmentBarRank}>#{index + 1}</span>
                <span style={styles.developmentBarName}>{team.name}</span>
                <strong style={styles.developmentBarValue}>{formatDevelopmentValue(value)}</strong>
              </div>
              <div style={styles.developmentBarLogoSlot}>
                {team.logo ? <img src={team.logo} alt={team.name} style={styles.developmentBarLogo} /> : <span style={{ ...styles.developmentBarFallback, background: team.color || "#dc2626" }}>{(team.name || "??").slice(0, 2).toUpperCase()}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DevelopmentChart({ teams, entries = [] }) {
  const rounds = Array.from(new Set(entries.map((entry) => Number(entry.round) || 1))).sort((a, b) => a - b);
  const maxRound = Math.max(...rounds, 1);
  const values = entries.map(getDevelopmentCoef);
  const minValue = Math.max(0, Math.floor(Math.min(...values) - 2));
  const maxValue = Math.ceil(Math.max(10, ...values) + 2);
  const valueRange = Math.max(maxValue - minValue, 1);
  const width = 1080;
  const height = 380;
  const padLeft = 48;
  const padRight = 32;
  const padTop = 34;
  const padBottom = 46;
  const x = (round) => padLeft + ((Number(round) - 1) / Math.max(maxRound - 1, 1)) * (width - padLeft - padRight);
  const y = (value) => height - padBottom - ((Number(value) - minValue) / valueRange) * (height - padTop - padBottom);
  const entriesByTeam = teams.map((team) => ({
    team,
    entries: entries.filter((entry) => idsEqual(entry.teamId, team.id)).sort((a, b) => Number(a.round) - Number(b.round)),
  })).filter((item) => item.entries.length).sort((a, b) => getDevelopmentCoef(b.entries.at(-1)) - getDevelopmentCoef(a.entries.at(-1)) || a.team.name.localeCompare(b.team.name, "fr"));

  if (entriesByTeam.length === 0) return <Empty text="Ajoute des données dans Admin > Développement." />;

  return (
    <div style={styles.developmentChartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} style={styles.developmentChart} role="img" aria-label="Courbe de développement des écuries">
        {Array.from({ length: 6 }, (_, index) => {
          const value = Math.round(minValue + (valueRange / 5) * index);
          return <g key={value}><line x1={padLeft} y1={y(value)} x2={width - padRight} y2={y(value)} stroke="rgba(255,255,255,.12)" /><text x={14} y={y(value) + 4} fill="#d4d4d8" fontSize="12" fontWeight="800">{value}</text></g>;
        })}
        {rounds.map((round) => <g key={round}><line x1={x(round)} y1={padTop} x2={x(round)} y2={height - padBottom} stroke="rgba(255,255,255,.07)" /><text x={x(round) - 8} y={height - 15} fill="#d4d4d8" fontSize="12" fontWeight="800">R{round}</text></g>)}
        {entriesByTeam.map(({ team, entries: teamEntries }) => {
          const points = teamEntries.map((entry) => `${x(entry.round)},${y(getDevelopmentCoef(entry))}`).join(" ");
          return <g key={team.id}><polyline points={points} fill="none" stroke="rgba(0,0,0,.72)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" /><polyline points={points} fill="none" stroke={team.color || "#dc2626"} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />{teamEntries.map((entry) => <circle key={entry.id || `${team.id}-${entry.round}`} cx={x(entry.round)} cy={y(getDevelopmentCoef(entry))} r="5" fill={team.color || "#dc2626"} stroke="#09090b" strokeWidth="2" />)}</g>;
        })}
      </svg>
      <div style={styles.developmentLegend}>{entriesByTeam.map(({ team }) => <span key={team.id} style={styles.developmentLegendItem}><span style={{ ...styles.mediaDot, background: team.color || "#dc2626" }} />{team.name}</span>)}</div>
    </div>
  );
}

function DevelopmentTeamCard({ team, entry, previous }) {
  return (
    <div style={{ ...styles.developmentCard, borderTop: `4px solid ${team.color || "#dc2626"}` }}>
      <div style={styles.developmentCardHeader}>
        <TeamIdentity team={team} />
        <span style={{ ...styles.badgeDark, background: team.color || "#3f3f46" }}>R{entry.round}</span>
      </div>
      <div style={styles.developmentStats}>
        <DevelopmentStat label="Speed" value={entry.speed} previous={previous?.speed} />
        <DevelopmentStat label="Acceleration" value={entry.acceleration} previous={previous?.acceleration} />
        <DevelopmentStat label="Grip" value={entry.grip} previous={previous?.grip} />
        {entry.turboEnabled && <DevelopmentStat label="Turbo" value={entry.turbo} previous={previous?.turboEnabled ? previous?.turbo : undefined} />}
      </div>
    </div>
  );
}

function DevelopmentStat({ label, value, previous }) {
  const delta = Number(value) - Number(previous || value);
  return (
    <div style={styles.developmentStat}>
      <span style={styles.developmentStatLabel}>{label}</span>
      <span style={styles.developmentDeltaSlot}>{delta !== 0 && <span style={delta > 0 ? styles.devDeltaUp : styles.devDeltaDown}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}</span>}</span>
      <strong style={styles.developmentStatValue}>{value}</strong>
    </div>
  );
}

function MediaLinksCard({ thanksNames = defaultSiteSettings.thanksNames, thanksText = "" }) {
  const names = normalizeThanksNames(thanksNames);
  const text = normalizeThanksText(thanksText);
  return (
    <Card title="AREKU_F1 en vidéo" icon="▶️">
      <div style={styles.mediaGrid}>
        {AREKU_MEDIA_LINKS.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer" style={{ ...styles.mediaLinkCard, borderColor: link.color }}>
            <span style={{ ...styles.mediaDot, background: link.color }} />
            <div>
              <strong>{link.label}</strong>
              <p style={styles.mutedSmall}>{link.detail}</p>
            </div>
          </a>
        ))}
      </div>
      <div style={styles.thanksCard}>
        <strong>Remerciements</strong>
        {text && <p style={styles.thanksText}>{text}</p>}
        <div style={styles.thanksList}>
          {names.map((name) => <span key={name} style={styles.thanksBadge}>{name}</span>)}
        </div>
      </div>
    </Card>
  );
}

function AdminLayout({ active, setActive, adminUser, adminPermissions = defaultAdminPermissions, adminPageOptions = ADMIN_PAGE_OPTIONS, onPublic, onLogout, children }) {
  return (
    <div className="urtt-admin-page" style={styles.page}>
      <aside className="urtt-admin-sidebar" style={styles.sidebar}>
        <div className="urtt-admin-logo" style={styles.logoRow}>
          <div style={styles.logo}>UR</div>
          <div><h1 style={styles.logoTitle}>URTT Admin</h1><p style={styles.logoSubtitle}>Panel privé</p></div>
        </div>
        <nav className="urtt-admin-nav" style={styles.nav}>
          {adminPageOptions.map(({ id, icon, label }) => <button className="urtt-admin-nav-button" key={id} onClick={() => setActive(id)} style={{ ...styles.navButton, ...(active === id ? styles.navButtonActive : {}) }}><span>{icon}</span><span>{label}</span></button>)}
        </nav>
      </aside>
      <main className="urtt-admin-main" style={styles.main}>
        <header className="urtt-admin-header" style={styles.header}>
          <div><p style={styles.kicker}>PANEL ADMIN</p><h2 style={styles.title}>Gestion URTT</h2>{adminUser?.email && <p style={styles.mutedSmall}>Connecté : {adminUser.email} · Catégories : {normalizeAllowedCategories(adminPermissions.allowedCategories).join(", ")}</p>}</div>
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

function AdminDrivers({ drivers, teams, selectedSeasonId, categoryOptions = CATEGORY_OPTIONS, form, setForm, editingId, isSaving, onSave, onEdit, onDelete, onCancel, search, setSearch }) {
  return <div style={styles.twoColumnsSmallLeft}><Card title={editingId ? "Modifier un pilote" : "Créer un pilote"} icon="➕"><DriverForm form={form} setForm={setForm} teams={teams} selectedSeasonId={selectedSeasonId} categoryOptions={categoryOptions} onSave={onSave} onCancel={onCancel} editingId={editingId} isSaving={isSaving} /></Card><Card title="Pilotes" icon="👥"><div style={styles.searchBox}>🔎 <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." style={styles.searchInput} /></div><div style={styles.cardGrid}>{drivers.map((driver) => <DriverAdminCard key={driver.id} driver={driver} team={teams.find((team) => team.id === driver.teamId)} onEdit={onEdit} onDelete={onDelete} />)}</div>{drivers.length === 0 && <Empty text="Aucun pilote pour le moment." />}</Card></div>;
}

function PlanningPanel({ races, calendarEvents = [], eventForm, setEventForm, selectedCategoryId, setSelectedCategoryId, categoryOptions = CATEGORY_OPTIONS, selectedSeasonId, setSelectedSeasonId, onUpdateStartAt, onSaveEvent, onDeleteEvent, isSavingEvent }) {
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
          <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={styles.resultsSelect}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
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

function DevelopmentAdminPanel({ teams, drivers = [], entries = [], form, setForm, selectedCategoryId, setSelectedCategoryId, categoryOptions = CATEGORY_OPTIONS, selectedSeasonId, setSelectedSeasonId, onSave, onDelete, isSaving }) {
  const developmentCategoryOptions = categoryOptions.filter((category) => isDevelopmentCategory(category.id));
  const selectedEntries = getDevelopmentEntriesForSelection(entries, selectedSeasonId, selectedCategoryId);
  const seasonTeams = getSeasonCategoryTeams(teams, drivers, selectedSeasonId, selectedCategoryId);
  const selectedRound = Number(form.round) || 1;
  const roundEntries = selectedEntries.filter((entry) => Number(entry.round) === selectedRound);
  const turboEnabled = normalizeCategoryId(selectedCategoryId) === "FE" || Boolean(form.turboEnabled);
  const update = (key, value) => setForm({ ...form, seasonId: selectedSeasonId, categoryId: selectedCategoryId, [key]: value });
  const updateTeamValue = (teamId, key, value) => setForm((current) => ({
    ...current,
    seasonId: selectedSeasonId,
    categoryId: selectedCategoryId,
    teamValues: {
      ...(current.teamValues || {}),
      [teamId]: { ...(current.teamValues?.[teamId] || {}), [key]: value },
    },
  }));
  const getTeamValue = (teamId, key) => {
    const draftValue = form.teamValues?.[teamId]?.[key];
    if (draftValue !== undefined) return draftValue;
    const existing = roundEntries.find((entry) => idsEqual(entry.teamId, teamId));
    return existing?.[key] ?? 0;
  };
  const buildRows = () => seasonTeams.map((team) => ({
    teamId: team.id,
    seasonId: selectedSeasonId,
    categoryId: selectedCategoryId,
    round: selectedRound,
    speed: getTeamValue(team.id, "speed"),
    acceleration: getTeamValue(team.id, "acceleration"),
    grip: getTeamValue(team.id, "grip"),
    turbo: turboEnabled ? getTeamValue(team.id, "turbo") : 0,
    turboEnabled,
    level: 0,
    driverOne: "",
    driverTwo: "",
  }));
  const editEntry = (entry) => setForm({ ...entry });
  const updateCategory = (value) => {
    setSelectedCategoryId(value);
    setForm({ ...form, categoryId: value, turboEnabled: normalizeCategoryId(value) === "FE" ? true : false, teamValues: {} });
  };
  const updateSeason = (value) => {
    setSelectedSeasonId(value);
    setForm({ ...form, seasonId: value, teamValues: {} });
  };

  return (
    <div style={styles.section}>
      <Card title="Développement écuries" icon="📈">
        <div style={styles.resultsInfo}>
          <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => updateCategory(event.target.value)} style={styles.resultsSelect}>{developmentCategoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label style={styles.label}><span style={styles.labelText}>Saison</span><select value={selectedSeasonId} onChange={(event) => updateSeason(event.target.value)} style={styles.resultsSelect}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
          <Input label="Course / Round" type="number" value={form.round} onChange={(value) => update("round", value)} />
          <label style={styles.checkboxPill}><input type="checkbox" checked={Boolean(form.turboEnabled)} onChange={(event) => update("turboEnabled", event.target.checked)} /> Activer Turbo</label>
        </div>
        <div style={styles.developmentAdminGrid}>
          {seasonTeams.map((team) => (
            <div key={team.id} style={{ ...styles.developmentAdminTeamCard, borderTopColor: team.color || "#dc2626" }}>
              <TeamIdentity team={team} />
              <Input label="Speed" type="number" value={getTeamValue(team.id, "speed")} onChange={(value) => updateTeamValue(team.id, "speed", value)} />
              <Input label="Acceleration" type="number" value={getTeamValue(team.id, "acceleration")} onChange={(value) => updateTeamValue(team.id, "acceleration", value)} />
              <Input label="Grip" type="number" value={getTeamValue(team.id, "grip")} onChange={(value) => updateTeamValue(team.id, "grip", value)} />
              {turboEnabled && <Input label="Turbo" type="number" value={getTeamValue(team.id, "turbo")} onChange={(value) => updateTeamValue(team.id, "turbo", value)} />}
            </div>
          ))}
        </div>
        {seasonTeams.length === 0 && <Empty text="Aucune écurie inscrite pour cette saison/catégorie." />}
        <button type="button" onClick={() => onSave(buildRows())} disabled={isSaving || seasonTeams.length === 0} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : `Enregistrer les ${seasonTeams.length} écuries`}</button>
      </Card>

      <Card title={`Données enregistrées — ${selectedCategoryId} ${seasonName(selectedSeasonId)}`} icon="📋">
        <div style={styles.stack}>
          {selectedEntries.map((entry) => {
            const team = teams.find((item) => idsEqual(item.id, entry.teamId));
            return (
              <div key={entry.id || `${entry.teamId}-${entry.round}`} style={styles.itemBox}>
                <div><strong>R{entry.round} · {team?.name || "Écurie"}</strong><p style={styles.mutedSmall}>Speed {entry.speed} · Acc {entry.acceleration} · Grip {entry.grip}{entry.turboEnabled ? ` · Turbo ${entry.turbo}` : ""}</p></div>
                <div style={styles.actions}>
                  <button type="button" onClick={() => editEntry(entry)} style={styles.editButton}>Modifier</button>
                  <button type="button" onClick={() => onDelete(entry)} disabled={isSaving} style={styles.dangerButton}>Supprimer</button>
                </div>
              </div>
            );
          })}
          {selectedEntries.length === 0 && <Empty text="Aucune donnée enregistrée pour cette sélection." />}
        </div>
      </Card>
    </div>
  );
}

function DriverForm({ form, setForm, teams, selectedSeasonId, categoryOptions = CATEGORY_OPTIONS, onSave, onCancel, editingId, isSaving }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  const updateCrown = (key, value) => setForm({ ...form, tripleCrown: { ...form.tripleCrown, [key]: value } });

  return <div style={styles.stack}><Input label="Nom du pilote" value={form.name} onChange={(value) => update("name", value)} /><label style={styles.checkboxPill}><input type="checkbox" checked={Boolean(form.retired)} onChange={(event) => update("retired", event.target.checked)} /> Pilote retraité</label><div style={styles.formGrid}><Input label="Titres pilote" type="number" value={form.driverTitles} onChange={(value) => update("driverTitles", value)} /><Input label="Titres écurie" type="number" value={form.teamTitles} onChange={(value) => update("teamTitles", value)} /></div><div style={styles.teamPreview}><span style={styles.labelText}>Triple Couronne</span><label><input type="checkbox" checked={form.tripleCrown.monaco} onChange={(event) => updateCrown("monaco", event.target.checked)} /> Titre F1</label><label><input type="checkbox" checked={form.tripleCrown.indy500} onChange={(event) => updateCrown("indy500", event.target.checked)} /> Indy 300</label><label><input type="checkbox" checked={form.tripleCrown.lemans} onChange={(event) => updateCrown("lemans", event.target.checked)} /> 2,4H du Mans</label></div><ParticipationEditor form={form} setForm={setForm} teams={teams} selectedSeasonId={selectedSeasonId} categoryOptions={categoryOptions} /><button onClick={onSave} disabled={isSaving} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : editingId ? "Enregistrer" : "Créer le pilote"}</button>{editingId && <button onClick={onCancel} style={styles.secondaryButton}>Annuler</button>}</div>;
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
  return <div style={styles.stack}><Input label="Nom de l’écurie" value={form.name} onChange={(value) => update("name", value)} /><ColorInput label="Couleur" value={form.color} onChange={(value) => update("color", value)} /><Input label="Logo URL" value={form.logo} onChange={(value) => update("logo", value)} /><label style={styles.label}><span style={styles.labelText}>Importer un logo</span><input type="file" accept="image/*" onChange={(event) => uploadTeamLogo(event.target.files?.[0])} style={styles.fileInput} /></label>{form.logo && <div style={styles.logoPreviewBox}><TeamIdentity team={form} /></div>}<div style={styles.formGrid}><Input label="Titre pilote F1" type="number" value={form.driverTitlesF1 ?? form.driverTitles ?? 0} onChange={updateDriverTitleF1} /><Input label="Titre pilote F2" type="number" value={form.driverTitlesF2 ?? 0} onChange={(value) => update("driverTitlesF2", value)} /><Input label="Titre pilote F3" type="number" value={form.driverTitlesF3 ?? 0} onChange={(value) => update("driverTitlesF3", value)} /><Input label="Titre pilote FE" type="number" value={form.driverTitlesFE ?? 0} onChange={(value) => update("driverTitlesFE", value)} /><Input label="Titre constructeur F1" type="number" value={form.teamTitlesF1 ?? form.teamTitles ?? 0} onChange={updateTeamTitleF1} /><Input label="Titre constructeur F2" type="number" value={form.teamTitlesF2 ?? 0} onChange={(value) => update("teamTitlesF2", value)} /><Input label="Titre constructeur F3" type="number" value={form.teamTitlesF3 ?? 0} onChange={(value) => update("teamTitlesF3", value)} /><Input label="Titre constructeur FE" type="number" value={form.teamTitlesFE ?? 0} onChange={(value) => update("teamTitlesFE", value)} /><Input label="Triple couronnes" type="number" value={form.tripleCrowns} onChange={(value) => update("tripleCrowns", value)} /></div><button onClick={onSave} disabled={isSaving} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : editingId ? "Enregistrer" : "Créer l’écurie"}</button>{editingId && <button onClick={onCancel} style={styles.secondaryButton}>Annuler</button>}</div>;
}

function SpecialEditionsAdmin({ editions = [], drivers = [], form, setForm, editingId, setEditingId, onSave, onDelete, isSaving }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  const editEdition = (edition) => {
    setEditingId(edition.id);
    setForm({ ...emptySpecialEdition, ...edition });
  };
  const cancel = () => {
    setEditingId(null);
    setForm(emptySpecialEdition);
  };
  const sortedEditions = [...editions].sort((a, b) => a.eventType.localeCompare(b.eventType) || Number(a.sortOrder) - Number(b.sortOrder));

  return (
    <div style={styles.twoColumnsSmallLeft}>
      <Card title={editingId ? "Modifier un hors saison" : "Créer un hors saison"} icon="🏁">
        <div style={styles.stack}>
          <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={form.eventType} onChange={(event) => update("eventType", event.target.value)} style={styles.input}>{SPECIAL_EVENT_OPTIONS.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
          <Input label="Édition" value={form.editionLabel} onChange={(value) => update("editionLabel", value)} />
          <Input label="Nom optionnel" value={form.name} onChange={(value) => update("name", value)} />
          <Input label="Date" type="date" value={form.date || ""} onChange={(value) => update("date", value)} />
          <Input label="Ordre d'affichage" type="number" value={form.sortOrder} onChange={(value) => update("sortOrder", value)} />
          <div style={styles.formGrid}>
            <DriverSelect label="Vainqueur" value={form.winnerDriverId} onChange={(value) => update("winnerDriverId", value)} drivers={drivers} />
            <DriverSelect label="Poleman" value={form.poleDriverId} onChange={(value) => update("poleDriverId", value)} drivers={drivers} />
          </div>
          <div style={styles.formGrid}>
            <DriverSelect label="Podium P1" value={form.podiumFirstDriverId} onChange={(value) => update("podiumFirstDriverId", value)} drivers={drivers} />
            <DriverSelect label="Podium P2" value={form.podiumSecondDriverId} onChange={(value) => update("podiumSecondDriverId", value)} drivers={drivers} />
            <DriverSelect label="Podium P3" value={form.podiumThirdDriverId} onChange={(value) => update("podiumThirdDriverId", value)} drivers={drivers} />
          </div>
          <label style={styles.label}><span style={styles.labelText}>Notes</span><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={4} style={styles.textarea} /></label>
          <button type="button" onClick={onSave} disabled={isSaving} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : editingId ? "Modifier l'édition" : "Créer l'édition"}</button>
          {editingId && <button type="button" onClick={cancel} style={styles.secondaryButton}>Annuler</button>}
        </div>
      </Card>
      <Card title="Hors Saison enregistrés" icon="📋">
        <div style={styles.stack}>
          {sortedEditions.map((edition) => (
            <div key={edition.id} style={styles.itemBox}>
              <div>
                <strong>{getSpecialEventName(edition.eventType)} · {edition.editionLabel}</strong>
                <p style={styles.mutedSmall}>{edition.date ? new Date(edition.date).toLocaleDateString("fr-FR") : "Date non définie"} · Vainqueur {driverName(drivers, edition.winnerDriverId)}</p>
              </div>
              <div style={styles.actions}>
                <button type="button" onClick={() => editEdition(edition)} style={styles.editButton}>Modifier</button>
                <button type="button" onClick={() => onDelete(edition.id)} disabled={isSaving} style={styles.dangerButton}>Supprimer</button>
              </div>
            </div>
          ))}
          {sortedEditions.length === 0 && <Empty text="Aucun hors saison enregistré." />}
        </div>
      </Card>
    </div>
  );
}

function DriverSelect({ label, value, onChange, drivers }) {
  return <label style={styles.label}><span style={styles.labelText}>{label}</span><select value={value || ""} onChange={(event) => onChange(event.target.value)} style={styles.input}><option value="">Aucun</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>;
}

function AdminRaces({ raceForm, setRaceForm, raceLibrary, allCalendarRaces = [], calendarRaceForm, setCalendarRaceForm, racesBySeason, selectedCategoryId, setSelectedCategoryId, categoryOptions = CATEGORY_OPTIONS, selectedSeasonId, setSelectedSeasonId, onSave, onAddToSeason, onDelete, onDeleteLibraryRace, onUpdateLibraryRaceCountry, onMoveRace, onUpdateStartAt, isSavingRace }) {
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
        <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={styles.input}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
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

function ResultsManager({ drivers, teams, selectedCategoryId, setSelectedCategoryId, categoryOptions = CATEGORY_OPTIONS, races, selectedSeasonId, setSelectedSeasonId, selectedRaceId, setSelectedRaceId, getResultEntry, updateResultEntry, onValidate, isSavingResult }) {
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

  return <Card title="Résultats automatiques" icon="🏆"><div style={styles.stack}><div style={styles.resultsInfo}><label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => { setSelectedCategoryId(event.target.value); setSelectedRaceId(""); setPositionOrder([]); }} style={styles.resultsSelect}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label style={styles.label}><span style={styles.labelText}>Saison</span><select value={selectedSeasonId} onChange={(event) => { setSelectedSeasonId(event.target.value); setSelectedRaceId(""); setPositionOrder([]); }} style={styles.resultsSelect}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label><label style={styles.label}><span style={styles.labelText}>Circuit</span><select value={selectedRaceId} onChange={(event) => { setSelectedRaceId(event.target.value); setPositionOrder([]); }} style={styles.resultsSelect}><option value="">Choisir un GP</option>{races.map((race) => <option key={race.id} value={race.id}>{race.round}. {race.name}</option>)}</select></label><button onClick={onValidate} disabled={isSavingResult} style={styles.primaryButton}>{isSavingResult ? "Sauvegarde..." : "Valider la course"}</button></div><p style={styles.mutedSmall}>{pointsLabel}</p>{drivers.length === 0 ? <Empty text={`Aucun pilote inscrit en ${selectedCategoryId} sur ${seasonName(selectedSeasonId)}.`} /> : <><div style={styles.quickResultBox}><PositionPicker drivers={drivers} positionOrder={positionOrder} onPick={updatePositionPick} /><label style={styles.label}><span style={styles.labelText}>Coller l'ordre d'arrivée</span><textarea value={quickResults} onChange={(event) => setQuickResults(event.target.value)} rows={8} placeholder={"Zach\nMarden\nLeroi\nNatalino"} style={styles.textarea} /></label><div style={styles.resultsInfo}><label style={styles.label}><span style={styles.labelText}>Pole</span><select value={poleDriverId} onChange={(event) => setPoleDriverId(event.target.value)} style={styles.resultsSelect}><option value="">Aucun</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label><label style={styles.label}><span style={styles.labelText}>Meilleur tour</span><select value={fastestDriverId} onChange={(event) => setFastestDriverId(event.target.value)} style={styles.resultsSelect}><option value="">Aucun</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label><button type="button" onClick={applyQuickResults} style={styles.secondaryButton}>Appliquer l'ordre collé</button><button type="button" onClick={applyQuickFlags} style={styles.secondaryButton}>Appliquer Pole / MT</button></div>{quickStatus && <p style={styles.mutedSmall}>{quickStatus}</p>}</div><ResultTable drivers={drivers} teams={teams} selectedCategoryId={selectedCategoryId} selectedSeasonId={selectedSeasonId} getResultEntry={getResultEntry} updateResultEntry={updateResultEntry} /></>}</div></Card>;
}

function RaceAwardsPanel({ drivers = [], teams = [], raceResults = [], racesBySeason = {}, selectedCategoryId, setSelectedCategoryId, categoryOptions = CATEGORY_OPTIONS, selectedSeasonId, setSelectedSeasonId }) {
  const races = [...(racesBySeason[selectedSeasonId] || [])].sort((a, b) => Number(a.round) - Number(b.round));
  const buildAwardRows = (awardKey) => races.map((race) => {
    const result = raceResults.find((entry) => String(entry.raceId) === String(race.id));
    const awards = (result?.entries || [])
      .filter((entry) => Boolean(entry[awardKey]))
      .map((entry) => {
        const driver = drivers.find((item) => idsEqual(item.id, entry.driverId));
        const team = driver ? getDriverSeasonTeam(driver, race.seasonId, teams) : null;
        return { driver, team };
      });
    return { race, result, awards };
  });

  return (
    <div style={styles.section}>
      <Card title="Poles & meilleurs tours" icon="⚡">
        <div style={styles.resultsInfo}>
          <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={styles.resultsSelect}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label style={styles.label}><span style={styles.labelText}>Saison</span><select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} style={styles.resultsSelect}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        </div>
        <p style={styles.mutedSmall}>Vue rapide des polemen et des meilleurs tours pour chaque course validée de la saison.</p>
      </Card>
      <div style={styles.twoColumns}>
        <RaceAwardTable title={`Poles — ${seasonName(selectedSeasonId)}`} icon="⚡" rows={buildAwardRows("pole")} empty="Aucune pole enregistrée pour cette saison." />
        <RaceAwardTable title={`Meilleurs tours — ${seasonName(selectedSeasonId)}`} icon="🟢" rows={buildAwardRows("fastestLap")} empty="Aucun meilleur tour enregistré pour cette saison." />
      </div>
    </div>
  );
}

function RaceAwardTable({ title, icon, rows = [], empty }) {
  const visibleRows = rows.filter((row) => row.result);
  return (
    <Card title={title} icon={icon}>
      <div style={styles.tableWrap}>
        <table style={{ ...styles.table, minWidth: 620 }}>
          <thead><tr style={styles.tableHead}><th style={styles.th}>Course</th><th style={styles.th}>Pilote</th><th style={styles.th}>Écurie</th></tr></thead>
          <tbody>{visibleRows.map((row) => (
            <tr key={row.race.id} style={styles.tr}>
              <td style={styles.td}><strong>R{row.race.round}</strong><p style={styles.mutedSmall}>{row.race.name}</p></td>
              <td style={styles.td}>{row.awards.length ? <div style={styles.stack}>{row.awards.map((award, index) => award.driver ? <AwardDriverIdentity key={`${row.race.id}-driver-${award.driver.id}`} driver={award.driver} team={award.team} /> : <span key={`${row.race.id}-missing-${index}`}>—</span>)}</div> : "—"}</td>
              <td style={styles.td}>{row.awards.length ? <div style={styles.stack}>{row.awards.map((award, index) => award.team ? <TeamIdentity key={`${row.race.id}-team-${award.team.id}`} team={award.team} /> : <span key={`${row.race.id}-team-missing-${index}`}>—</span>)}</div> : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {visibleRows.length === 0 && <Empty text={empty} />}
    </Card>
  );
}

function AwardDriverIdentity({ driver, team }) {
  return <DriverIdentity driver={{ ...driver, avatar: "" }} teamColor={team?.color} teamLogo={team?.logo} showRetired={false} />;
}

function GamesAdminPanel({ predictions = [], predictionControls = [], races = [], drivers = [], raceResults = [], selectedCategoryId, setSelectedCategoryId, categoryOptions = CATEGORY_OPTIONS, selectedSeasonId, setSelectedSeasonId, onToggleClosed, onDeletePrediction, isSaving }) {
  const categoryId = normalizeCategoryId(selectedCategoryId);
  const seasonId = normalizeSeasonId(selectedSeasonId);
  const seasonRaces = races.filter((race) => normalizeCategoryId(race.categoryId) === categoryId && normalizeSeasonId(race.seasonId) === seasonId).sort((a, b) => Number(a.round) - Number(b.round));
  const visiblePredictions = predictions.filter((prediction) => normalizeCategoryId(prediction.categoryId) === categoryId && normalizeSeasonId(prediction.seasonId) === seasonId);
  const leaderboard = getPredictionLeaderboard(visiblePredictions, raceResults);
  const raceCounts = seasonRaces.map((race) => ({ race, count: visiblePredictions.filter((prediction) => String(prediction.raceId) === String(race.id)).length })).sort((a, b) => b.count - a.count);
  const topRace = raceCounts[0];

  return (
    <div style={styles.section}>
      <Card title="Jeux — Pronos GP" icon="🎮">
        <div style={styles.resultsInfo}>
          <label style={styles.label}><span style={styles.labelText}>Catégorie</span><select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} style={styles.resultsSelect}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label style={styles.label}><span style={styles.labelText}>Saison</span><select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} style={styles.resultsSelect}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        </div>
        <div style={styles.statsGrid}>
          <Stat label="Pronos" value={visiblePredictions.length} />
          <Stat label="Joueurs" value={new Set(visiblePredictions.map((prediction) => prediction.pseudo.trim().toLowerCase()).filter(Boolean)).size} />
          <Stat label="Courses" value={seasonRaces.length} />
          <Stat label="Course la plus jouée" value={topRace?.count ? `${topRace.race.name} (${topRace.count})` : "—"} />
        </div>
      </Card>
      <div style={styles.twoColumns}>
        <Card title="Classement joueurs" icon="🏆">
          <PredictionLeaderboard leaderboard={leaderboard} />
        </Card>
        <Card title="Pronos par course" icon="📋">
          <div style={styles.stack}>
            {seasonRaces.map((race) => {
              const count = visiblePredictions.filter((prediction) => String(prediction.raceId) === String(race.id)).length;
              const resultClosed = Boolean(getRaceResultForRace(raceResults, race.id));
              const manuallyClosed = predictionControls.some((control) => String(control.raceId) === String(race.id) && control.closed);
              const closed = resultClosed || manuallyClosed;
              return <div key={race.id} style={styles.itemBox}><div><strong>R{race.round} · {race.name}</strong><p style={styles.mutedSmall}>{resultClosed ? "Résultat validé" : manuallyClosed ? "Fermé manuellement" : "Ouvert"} · {formatRaceDate(race.startAt)}</p></div><div style={styles.actions}><span style={closed ? styles.badgeGreen : styles.badgeDark}>{count} prono{count > 1 ? "s" : ""}</span><button type="button" disabled={isSaving || resultClosed} onClick={() => onToggleClosed?.(race.id, !manuallyClosed)} style={manuallyClosed ? styles.editButton : styles.dangerButton}>{manuallyClosed ? "Rouvrir" : "Fermer"}</button></div></div>;
            })}
            {seasonRaces.length === 0 && <Empty text="Aucune course dans cette saison." />}
          </div>
        </Card>
      </div>
      <Card title="Toutes les participations" icon="🧾">
        <PredictionAdminTable predictions={visiblePredictions} races={seasonRaces} drivers={drivers} raceResults={raceResults} onDelete={onDeletePrediction} isSaving={isSaving} />
      </Card>
    </div>
  );
}

function PredictionAdminTable({ predictions = [], races = [], drivers = [], raceResults = [], onDelete, isSaving }) {
  if (!predictions.length) return <Empty text="Aucun prono enregistré sur cette sélection." />;
  return (
    <div style={styles.tableWrap}>
      <table style={{ ...styles.table, minWidth: 980 }}>
        <thead><tr style={styles.tableHead}><th style={styles.th}>Pseudo</th><th style={styles.th}>Course</th><th style={styles.th}>P1</th><th style={styles.th}>Pole</th><th style={styles.th}>MT</th><th style={styles.th}>Classement prédit</th><th style={styles.th}>Score</th><th style={styles.th}>Action</th></tr></thead>
        <tbody>{predictions.map((prediction) => {
          const race = races.find((item) => String(item.id) === String(prediction.raceId));
          const score = scoreRacePrediction(prediction, raceResults);
          return (
            <tr key={prediction.id} style={styles.tr}>
              <td style={styles.td}><strong>{prediction.pseudo}</strong><p style={styles.mutedSmall}>{prediction.createdAt ? new Date(prediction.createdAt).toLocaleString("fr-FR") : "—"}</p></td>
              <td style={styles.td}>{race ? `R${race.round} · ${race.name}` : prediction.raceId}</td>
              <td style={styles.td}>{driverName(drivers, prediction.predictedOrder?.[0] || prediction.winnerDriverId)}</td>
              <td style={styles.td}>{driverName(drivers, prediction.poleDriverId)}</td>
              <td style={styles.td}>{driverName(drivers, prediction.fastestDriverId)}</td>
              <td style={styles.td}>{(prediction.predictedOrder?.length ? prediction.predictedOrder : [prediction.podiumFirstDriverId, prediction.podiumSecondDriverId, prediction.podiumThirdDriverId]).filter(Boolean).map((id, index) => `P${index + 1} ${driverName(drivers, id)}`).join(" · ")}</td>
              <td style={{ ...styles.td, ...styles.points }}>{score.scored ? score.score : "—"}</td>
              <td style={styles.td}><button type="button" onClick={() => onDelete?.(prediction.id)} disabled={isSaving || !onDelete} style={styles.dangerButton}>Supprimer</button></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
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

function PermissionsPanel({ adminUser, rows = [], form, setForm, editingId, setEditingId, onSave, onDelete, isSaving }) {
  if (!isPermissionsOwner(adminUser)) {
    return <div style={styles.section}><Card title="Permissions admin" icon="🔐"><Empty text="Seul kolti@urtt.fr peut gérer les permissions du panel." /></Card></div>;
  }

  const selectedCategories = form.allowedCategories || [];
  const selectedPages = form.allowedPages || [];
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleCategory = (categoryId) => {
    const normalizedCategoryId = normalizeCategoryId(categoryId);
    setForm((current) => {
      const currentCategories = current.allowedCategories || [];
      const nextCategories = currentCategories.includes(normalizedCategoryId)
        ? currentCategories.filter((item) => item !== normalizedCategoryId)
        : [...currentCategories, normalizedCategoryId];
      return { ...current, allowedCategories: nextCategories };
    });
  };
  const togglePage = (pageId) => {
    if (pageId === "permissions") return;
    setForm((current) => {
      const currentPages = current.allowedPages || [];
      const nextPages = currentPages.includes(pageId)
        ? currentPages.filter((item) => item !== pageId)
        : [...currentPages, pageId];
      return { ...current, allowedPages: nextPages };
    });
  };
  const editRow = (row) => {
    setEditingId(row.id);
    setForm({ userEmail: row.userEmail, role: row.role, allowedCategories: [...row.allowedCategories], allowedPages: row.allowedPages.filter((pageId) => pageId !== "permissions") });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(createEmptyPermissionForm());
  };

  return (
    <div style={styles.section}>
      <Card title="Permissions admin" icon="🔐">
        <div style={styles.formGrid}>
          <label style={styles.label}><span style={styles.labelText}>Email utilisateur</span><input value={form.userEmail} onChange={(event) => updateForm("userEmail", event.target.value)} placeholder="exemple@urtt.fr" style={styles.input} /></label>
          <label style={styles.label}><span style={styles.labelText}>Rôle</span><input value={form.role} onChange={(event) => updateForm("role", event.target.value)} placeholder="Admin F1, Résultats, Courses..." style={styles.input} /></label>
        </div>
        <p style={styles.labelText}>Catégories accessibles</p>
        <div style={styles.permissionCategoryGrid}>
          {CATEGORY_OPTIONS.map((category) => (
            <label key={category.id} style={{ ...styles.permissionCategoryPill, borderColor: category.color, background: selectedCategories.includes(category.id) ? `${category.color}33` : "#18181b" }}>
              <input type="checkbox" checked={selectedCategories.includes(category.id)} onChange={() => toggleCategory(category.id)} />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
        <p style={{ ...styles.labelText, marginTop: 18 }}>Pages accessibles</p>
        <div style={styles.permissionPageGrid}>
          {ADMIN_PAGE_OPTIONS.filter((page) => page.id !== "permissions").map((page) => (
            <label key={page.id} style={{ ...styles.permissionPagePill, background: selectedPages.includes(page.id) ? "rgba(124,58,237,.22)" : "#18181b", borderColor: selectedPages.includes(page.id) ? "#7c3aed" : "#3f3f46" }}>
              <input type="checkbox" checked={selectedPages.includes(page.id)} onChange={() => togglePage(page.id)} />
              <span>{page.icon}</span>
              <span>{page.label}</span>
            </label>
          ))}
        </div>
        <div style={styles.actions}>
          <button type="button" onClick={onSave} disabled={isSaving} style={styles.fullButton}>{isSaving ? "Sauvegarde..." : editingId ? "Modifier les permissions" : "Ajouter les permissions"}</button>
          {editingId && <button type="button" onClick={cancelEdit} style={styles.secondaryButton}>Annuler</button>}
        </div>
        <p style={styles.mutedSmall}>Seul {ADMIN_PERMISSIONS_OWNER_EMAIL} voit cet onglet. Les comptes ajoutés ici seront limités aux catégories cochées dans le panel admin.</p>
      </Card>
      <Card title="Comptes configurés" icon="👥">
        <div style={styles.stack}>
          {rows.map((row) => (
            <div key={row.id || row.userEmail} style={styles.itemBox}>
              <div>
                <strong>{row.userEmail}</strong>
                <p style={styles.mutedSmall}>{row.role} · {row.allowedCategories.join(", ")} · {row.allowedPages.filter((pageId) => pageId !== "permissions").map((pageId) => ADMIN_PAGE_OPTIONS.find((page) => page.id === pageId)?.label || pageId).join(", ")}</p>
              </div>
              <div style={styles.actions}>
                <button type="button" onClick={() => editRow(row)} style={styles.editButton}>Modifier</button>
                <button type="button" onClick={() => onDelete(row.id)} disabled={isSaving} style={styles.dangerButton}>Supprimer</button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <Empty text="Aucune permission enregistrée. Ajoute un compte pour limiter ses catégories." />}
        </div>
      </Card>
    </div>
  );
}

function SettingsPanel({ seasons = [], siteSettings = defaultSiteSettings, onUpdateSetting, onAddSeason, isSaving }) {
  const nextSeason = getNextSeasonOption(seasons);
  const latestSeason = seasons[seasons.length - 1];
  const publicPages = normalizePublicPageSettings(siteSettings.publicPages, siteSettings.publicDevelopmentEnabled);

  const updatePublicPage = (pageId, visible) => {
    onUpdateSetting("publicPages", { ...publicPages, [pageId]: visible });
  };

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
      <Card title="Visibilité publique" icon="👁️">
        <div style={styles.stack}>
          {PUBLIC_PAGE_OPTIONS.map((page) => (
            <div key={page.id} style={styles.itemBox}>
              <div>
                <strong>Page {page.label}</strong>
                <p style={styles.mutedSmall}>{page.id === "development" ? "Quand c'est désactivé, le public ne voit pas l'onglet. L'admin garde accès en aperçu." : "Quand c'est désactivé, l'onglet disparaît côté public."}</p>
              </div>
              <label style={styles.checkboxPill}><input type="checkbox" checked={publicPages[page.id] !== false} onChange={(event) => updatePublicPage(page.id, event.target.checked)} /> Visible public</label>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Remerciements accueil" icon="🙏">
        <ThanksSettings key={`${normalizeThanksNames(siteSettings.thanksNames).join("|")}::${normalizeThanksText(siteSettings.thanksText)}`} siteSettings={siteSettings} onUpdateSetting={onUpdateSetting} isSaving={isSaving} />
      </Card>
    </div>
  );
}

function ThanksSettings({ siteSettings = defaultSiteSettings, onUpdateSetting, isSaving }) {
  const [thanksDraft, setThanksDraft] = useState(() => normalizeThanksNames(siteSettings.thanksNames).join("\n"));
  const [thanksTextDraft, setThanksTextDraft] = useState(() => normalizeThanksText(siteSettings.thanksText));
  const saveThanksNames = () => {
    onUpdateSetting("thanksNames", normalizeThanksNames(thanksDraft));
    onUpdateSetting("thanksText", normalizeThanksText(thanksTextDraft));
  };

  return (
    <div style={styles.stack}>
      <label style={styles.label}>
        <span style={styles.labelText}>Texte affiché</span>
        <textarea value={thanksTextDraft} onChange={(event) => setThanksTextDraft(event.target.value)} placeholder="Texte libre affiché au-dessus des noms..." style={{ ...styles.input, minHeight: 110, resize: "vertical" }} />
      </label>
      <label style={styles.label}>
        <span style={styles.labelText}>Noms affichés</span>
        <textarea value={thanksDraft} onChange={(event) => setThanksDraft(event.target.value)} placeholder="Un nom par ligne" style={{ ...styles.input, minHeight: 130, resize: "vertical" }} />
      </label>
      <div style={styles.itemBox}>
        <div>
          <strong>Aperçu</strong>
          {normalizeThanksText(thanksTextDraft) && <p style={styles.thanksText}>{normalizeThanksText(thanksTextDraft)}</p>}
          <div style={styles.thanksList}>{normalizeThanksNames(thanksDraft).map((name) => <span key={name} style={styles.thanksBadge}>{name}</span>)}</div>
        </div>
        <button type="button" onClick={saveThanksNames} disabled={isSaving} style={styles.primaryButton}>{isSaving ? "Sauvegarde..." : "Sauvegarder"}</button>
      </div>
    </div>
  );
}

function sortStatRows(rows = [], sortConfig) {
  if (!sortConfig?.key) return rows;
  const direction = sortConfig.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const valueA = Number(a[sortConfig.key]) || 0;
    const valueB = Number(b[sortConfig.key]) || 0;
    if (valueA !== valueB) return (valueA - valueB) * direction;
    return String(a.name || "").localeCompare(String(b.name || ""), "fr");
  });
}

function SortableTh({ label, sortKey, sortConfig, onSort }) {
  const active = sortConfig?.key === sortKey;
  return (
    <th style={styles.th}>
      <button type="button" onClick={() => onSort(sortKey)} style={{ ...styles.sortHeaderButton, ...(active ? styles.sortHeaderButtonActive : {}) }}>
        {label}{active ? (sortConfig.direction === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}

function DriverTable({ drivers, detailed = false, raceDetails = false, compactRaceDetails = false, races = [], raceResults = [], showExtendedStats = false, onDriverClick, teams = [], selectedSeasonId }) {
  const [sortConfig, setSortConfig] = useState(null);
  const sortedDrivers = sortStatRows(drivers, sortConfig);
  const updateSort = (key) => setSortConfig((current) => ({ key, direction: current?.key === key && current.direction === "desc" ? "asc" : "desc" }));
  const records = buildRecordMap(drivers, ["driverTitles", "teamTitles", "wins", "podiums", "poles", "fastestLaps", "hatTricks", "points"]);
  return (
    <div style={styles.tableWrap}>
      <table className={`urtt-standings-table urtt-driver-standings${compactRaceDetails ? " urtt-compact-race-table" : ""}`} style={{ ...styles.table, minWidth: raceDetails ? Math.max(compactRaceDetails ? 720 : 950, (compactRaceDetails ? 430 : 650) + races.length * (compactRaceDetails ? 42 : 105)) : 850 }}>
        <thead><tr style={styles.tableHead}><th style={styles.th}>#</th><th style={styles.th}>Pilote</th><th style={styles.th}>Écurie</th>{raceDetails && races.map((race) => <th key={race.id} style={styles.th}><span style={styles.raceColumnTitle}>R{race.round}</span><span className="urtt-race-column-sub" style={styles.raceColumnSub}>{shortRaceName(race.name)}</span></th>)}{showExtendedStats && <><SortableTh label="Titre P." sortKey="driverTitles" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="Titre C." sortKey="teamTitles" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="V" sortKey="wins" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="Pod." sortKey="podiums" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="Poles" sortKey="poles" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="MT" sortKey="fastestLaps" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="HT" sortKey="hatTricks" sortConfig={sortConfig} onSort={updateSort} /></>}<SortableTh label="Points" sortKey="points" sortConfig={sortConfig} onSort={updateSort} />{detailed && <th style={styles.th}>Triple Couronne</th>}</tr></thead>
        <tbody>{sortedDrivers.map((driver, index) => { const team = getDriverSeasonTeam(driver, selectedSeasonId, teams); const showRetired = Boolean(detailed); return <tr key={driver.id} style={styles.tr}><td style={styles.td}>#{index + 1}</td><td style={styles.td}>{onDriverClick ? <button onClick={() => onDriverClick(driver)} style={styles.nameButton}><DriverIdentity driver={driver} teamColor={team?.color} teamLogo={team?.logo} showRetired={showRetired} /></button> : <DriverIdentity driver={driver} teamColor={team?.color} teamLogo={team?.logo} showRetired={showRetired} />}</td><td style={styles.td}>{showRetired && driver.retired ? "Retraité" : driver.teamName || team?.name || "—"}</td>{raceDetails && races.map((race) => <td key={race.id} style={styles.td}><DriverRaceCell driverId={driver.id} race={race} raceResults={raceResults} compact={compactRaceDetails} /></td>)}{showExtendedStats && <><td style={styles.td}><RecordValue value={driver.driverTitles || 0} record={isRecordValue(records, "driverTitles", driver.driverTitles)} /></td><td style={styles.td}><RecordValue value={driver.teamTitles || 0} record={isRecordValue(records, "teamTitles", driver.teamTitles)} /></td><td style={styles.td}><RecordValue value={driver.wins} record={isRecordValue(records, "wins", driver.wins)} /></td><td style={styles.td}><RecordValue value={driver.podiums} record={isRecordValue(records, "podiums", driver.podiums)} /></td><td style={styles.td}><RecordValue value={driver.poles} record={isRecordValue(records, "poles", driver.poles)} /></td><td style={styles.td}><RecordValue value={driver.fastestLaps} record={isRecordValue(records, "fastestLaps", driver.fastestLaps)} /></td><td style={styles.td}><RecordValue value={driver.hatTricks || 0} record={isRecordValue(records, "hatTricks", driver.hatTricks)} /></td></>}<td style={{ ...styles.td, ...styles.points }}><RecordValue value={driver.points} record={isRecordValue(records, "points", driver.points)} /></td>{detailed && <td style={styles.td}><TripleCrown crown={driver.tripleCrown} /></td>}</tr>; })}</tbody>
      </table>
      {drivers.length === 0 && <Empty text="Aucun pilote à afficher." />}
    </div>
  );
}

function TeamTable({ teams, detailed = false, raceDetails = false, compactRaceDetails = false, races = [], raceResults = [], drivers = [], showExtendedStats = false, selectedCategoryId = "F1", onTeamClick }) {
  const [sortConfig, setSortConfig] = useState(null);
  const sortedTeams = sortStatRows(teams, sortConfig);
  const updateSort = (key) => setSortConfig((current) => ({ key, direction: current?.key === key && current.direction === "desc" ? "asc" : "desc" }));
  const records = buildRecordMap(teams, ["driverTitles", "teamTitles", "wins", "podiums", "poles", "fastestLaps", "points"]);
  const titleSuffix = normalizeCategoryId(selectedCategoryId);
  return (
    <div style={styles.tableWrap}>
      <table className={`urtt-standings-table urtt-team-standings${showExtendedStats ? " urtt-team-stats-table" : ""}${compactRaceDetails ? " urtt-compact-race-table" : ""}`} style={{ ...styles.table, minWidth: raceDetails ? Math.max(compactRaceDetails ? 650 : 950, (compactRaceDetails ? 330 : 650) + races.length * (compactRaceDetails ? 42 : 105)) : 850 }}>
        <thead><tr style={styles.tableHead}><th style={styles.th}>#</th><th style={styles.th}>Écurie</th>{raceDetails && races.map((race) => <th key={race.id} style={styles.th}><span style={styles.raceColumnTitle}>R{race.round}</span><span className="urtt-race-column-sub" style={styles.raceColumnSub}>{shortRaceName(race.name)}</span></th>)}{showExtendedStats && <><SortableTh label={`Titre P. ${titleSuffix}`} sortKey="driverTitles" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label={`Titre C. ${titleSuffix}`} sortKey="teamTitles" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="V" sortKey="wins" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="Pod." sortKey="podiums" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="Poles" sortKey="poles" sortConfig={sortConfig} onSort={updateSort} /><SortableTh label="MT" sortKey="fastestLaps" sortConfig={sortConfig} onSort={updateSort} /></>}<SortableTh label="Points" sortKey="points" sortConfig={sortConfig} onSort={updateSort} />{detailed && <th style={styles.th}>Triple couronnes</th>}</tr></thead>
        <tbody>{sortedTeams.map((team, index) => <tr key={team.id} style={styles.tr}><td style={styles.td}>#{index + 1}</td><td style={styles.td}>{onTeamClick ? <button className="urtt-name-button" onClick={() => onTeamClick(team)} style={styles.nameButton}><TeamIdentity team={team} /></button> : <TeamIdentity team={team} />}</td>{raceDetails && races.map((race) => <td key={race.id} style={styles.td}><TeamRaceCell teamId={team.id} race={race} raceResults={raceResults} drivers={drivers} compact={compactRaceDetails} /></td>)}{showExtendedStats && <><td style={styles.td}><RecordValue value={team.driverTitles || 0} record={isRecordValue(records, "driverTitles", team.driverTitles)} /></td><td style={styles.td}><RecordValue value={team.teamTitles || 0} record={isRecordValue(records, "teamTitles", team.teamTitles)} /></td><td style={styles.td}><RecordValue value={team.wins} record={isRecordValue(records, "wins", team.wins)} /></td><td style={styles.td}><RecordValue value={team.podiums} record={isRecordValue(records, "podiums", team.podiums)} /></td><td style={styles.td}><RecordValue value={team.poles} record={isRecordValue(records, "poles", team.poles)} /></td><td style={styles.td}><RecordValue value={team.fastestLaps} record={isRecordValue(records, "fastestLaps", team.fastestLaps)} /></td></>}<td style={{ ...styles.td, ...styles.points }}><RecordValue value={team.points} record={isRecordValue(records, "points", team.points)} /></td>{detailed && <td style={styles.td}>{team.tripleCrowns}</td>}</tr>)}</tbody>
      </table>
      {teams.length === 0 && <Empty text="Aucune écurie à afficher." />}
    </div>
  );
}

function DriverRaceCell({ driverId, race, raceResults, compact = false }) {
  const result = raceResults.find((entry) => String(entry.raceId) === String(race.id));
  const driverResult = result?.entries.find((entry) => idsEqual(entry.driverId, driverId));
  if (!driverResult) return <span style={styles.mutedSmall}>—</span>;
  const position = Number(driverResult.position);
  const points = getPointsForPosition(position, race.categoryId, race.seasonId);
  const badges = [];
  if (position === 1) badges.push("V");
  if (driverResult.pole) badges.push("P");
  if (driverResult.fastestLap) badges.push("MT");
  if (compact) return <div style={styles.compactRaceResultCell}><strong>P{position}</strong>{badges.length > 0 && <span style={styles.compactRaceBadges}>{badges.join("/")}</span>}</div>;
  return <div style={styles.raceResultCell}><strong>P{position}</strong><span style={styles.mutedSmall}>{points} pts</span>{badges.length > 0 && <span style={styles.raceBadges}>{badges.join(" · ")}</span>}</div>;
}

function TeamRaceCell({ teamId, race, raceResults, drivers, compact = false }) {
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
  if (compact) return <div style={styles.compactRaceResultCell}><strong>{points}</strong>{badges.length > 0 && <span style={styles.compactRaceBadges}>{badges.join("/")}</span>}</div>;
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

function DriverDetails({ driver, raceResults, teams, selectedCategoryId, seasonTitles, specialEditions = [], allDrivers, onClose }) {
  const rows = getDriverSeasonBreakdown(driver, raceResults, teams, selectedCategoryId, seasonTitles, allDrivers);
  const specialRows = getDriverSpecialEditionRows(driver, specialEditions);
  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div style={styles.detailModal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.gpDetailHeader}><div><p style={styles.kicker}>FICHE PILOTE</p><h2 style={styles.gpDetailTitle}>{driver.name}</h2></div><button onClick={onClose} style={styles.secondaryButton}>Fermer</button></div>
        <Card title="Stats par saison et catégorie" icon="👤"><SeasonBreakdownTable rows={rows} /></Card>
        <Card title="2,4H du Mans & Indy 300" icon="🏁"><SpecialEditionDriverTable rows={specialRows} /></Card>
      </div>
    </div>
  );
}

function SpecialEditionDriverTable({ rows }) {
  return <div style={styles.tableWrap}><table style={styles.table}><thead><tr style={styles.tableHead}><th style={styles.th}>Événement</th><th style={styles.th}>Édition</th><th style={styles.th}>Date</th><th style={styles.th}>Résultat</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.eventType}-${row.id}`} style={styles.tr}><td style={styles.td}><span style={{ ...styles.categoryBadge, background: SPECIAL_EVENT_OPTIONS.find((event) => event.id === row.eventType)?.color || "#7c3aed", color: row.eventType === "INDY300" ? "#18181b" : "white" }}>{getSpecialEventName(row.eventType)}</span></td><td style={styles.td}>{row.editionLabel}{row.name ? ` · ${row.name}` : ""}</td><td style={styles.td}>{row.date ? new Date(row.date).toLocaleDateString("fr-FR") : "—"}</td><td style={styles.td}><div style={styles.titleBadgeRow}>{row.roles.map((role) => <span key={role} style={styles.titleBadge}>🏆 {role}</span>)}</div></td></tr>)}</tbody></table>{rows.length === 0 && <Empty text="Aucune participation enregistrée sur ces éditions." />}</div>;
}

function TeamDetails({ team, drivers, raceResults, onClose }) {
  const rows = getTeamSeasonBreakdown(team, drivers, raceResults);
  return <div style={styles.gpDetailPanel}><div style={styles.gpDetailHeader}><div><p style={styles.kicker}>FICHE ÉCURIE</p><h2 style={styles.gpDetailTitle}>{team.name}</h2></div><button onClick={onClose} style={styles.secondaryButton}>Fermer</button></div><Card title="Stats par saison et catégorie" icon="🏎️"><SeasonBreakdownTable rows={rows} /></Card></div>;
}

function SeasonBreakdownTable({ rows }) {
  const showPosition = rows.some((row) => row.position);
  const showTitles = rows.some((row) => row.driverChampion || row.constructorChampion);
  return <div style={styles.tableWrap}><table style={styles.table}><thead><tr style={styles.tableHead}><th style={styles.th}>Saison</th>{showPosition && <th style={styles.th}>Position</th>}{showTitles && <th style={styles.th}>Titres</th>}<th style={styles.th}>Écurie</th><th style={styles.th}>Catégories</th><th style={styles.th}>Points</th><th style={styles.th}>V</th><th style={styles.th}>Podiums</th><th style={styles.th}>Poles</th><th style={styles.th}>MT</th><th style={styles.th}>HT</th></tr></thead><tbody>{rows.map((row) => <tr key={row.seasonId} style={styles.tr}><td style={styles.td}>{seasonName(row.seasonId)}</td>{showPosition && <td style={{ ...styles.td, ...styles.points }}>{row.position ? `#${row.position}` : "—"}</td>}{showTitles && <td style={styles.td}><div style={styles.titleBadgeRow}>{row.driverChampion && <span style={styles.titleBadge}>🏆 Pilote</span>}{row.constructorChampion && <span style={styles.titleBadge}>🏆 Constructeur</span>}{!row.driverChampion && !row.constructorChampion && "—"}</div></td>}<td style={styles.td}>{row.team ? <TeamIdentity team={row.team} /> : row.teamName || "Sans écurie"}</td><td style={styles.td}>{row.categories.length ? row.categories.map((category) => <span key={category} style={{ ...styles.categoryBadge, background: getCategoryColor(category) }}>{category}</span>) : "—"}</td><td style={{ ...styles.td, ...styles.points }}>{row.points}</td><td style={styles.td}>{row.wins}</td><td style={styles.td}>{row.podiums}</td><td style={styles.td}>{row.poles}</td><td style={styles.td}>{row.fastestLaps}</td><td style={styles.td}>{row.hatTricks || 0}</td></tr>)}</tbody></table>{rows.length === 0 && <Empty text="Aucune participation enregistrée." />}</div>;
}

function ParticipationEditor({ form, setForm, teams = [], selectedSeasonId = "S1", categoryOptions = CATEGORY_OPTIONS }) {
  const [seasonId, setSeasonId] = useState(selectedSeasonId || "S1");
  return <div style={styles.teamPreview}><span style={styles.labelText}>Participations par saison</span><select value={seasonId} onChange={(event) => setSeasonId(event.target.value)} style={styles.input}>{getSeasonOptions().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select><label style={styles.label}><span style={styles.labelText}>Écurie cette saison</span><select value={form.teamHistory?.[seasonId] || form.teamId || ""} onChange={(event) => setForm(updateDriverSeasonTeam(form, seasonId, event.target.value))} style={styles.input}><option value="">Sans écurie</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><div style={styles.categoryCheckboxGrid}>{categoryOptions.map((category) => <label key={category.id} style={{ ...styles.checkboxPill, borderColor: getCategoryColor(category.id) }}><input type="checkbox" checked={(form.participations?.[seasonId] || []).includes(category.id)} onChange={() => setForm(toggleParticipation(form, seasonId, category.id))} /> {category.name}</label>)}</div><p style={styles.mutedSmall}>Exemple : un pilote peut faire F2 en S1, puis F1 en S2, ou même plusieurs catégories la même saison.</p></div>;
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
function TeamAdminCard({ team, onEdit, onDelete }) { return <div style={{ ...styles.teamCard, borderTop: `5px solid ${team.color}` }}><TeamIdentity team={team} /><p style={styles.mutedSmall}>Constructeur : F1 {team.teamTitlesF1 ?? team.teamTitles ?? 0} · F2 {team.teamTitlesF2 || 0} · F3 {team.teamTitlesF3 || 0} · FE {team.teamTitlesFE || 0}</p><div style={styles.actions}><button onClick={() => onEdit(team)} style={styles.editButton}>Modifier</button><button onClick={() => onDelete(team.id)} style={styles.dangerButton}>Supprimer</button></div></div>; }
function DriverIdentity({ driver, teamColor, teamLogo, showRetired = true }) { const isRetiredVisible = showRetired && driver.retired; const imageSrc = driver.avatar || (isRetiredVisible ? "" : teamLogo); const borderColor = teamColor || driver.color || "#dc2626"; return <div className="urtt-identity" style={styles.identity}>{imageSrc ? <img src={imageSrc} alt={driver.name} style={{ ...styles.logoSmall, border: `2px solid ${borderColor}` }} /> : <div style={{ ...styles.fallbackLogo, background: isRetiredVisible ? "#18181b" : borderColor, border: `2px solid ${borderColor}`, fontSize: isRetiredVisible ? 20 : 12 }}>{isRetiredVisible ? "👥" : (driver.name || "??").slice(0, 2).toUpperCase()}</div>}<div style={styles.identityText}><strong className="urtt-identity-name">{driver.name || "Pilote"}</strong><p style={styles.mutedSmall}>N° {driver.number || "—"}{isRetiredVisible ? " · Retraité" : ""}</p></div></div>; }
function TeamIdentity({ team }) { return <div className="urtt-identity" style={styles.identity}>{team.logo ? <img src={team.logo} alt={team.name} style={{ ...styles.logoSmall, border: `2px solid ${team.color || "#dc2626"}` }} /> : <div style={{ ...styles.fallbackLogo, background: team.color || "#dc2626" }}>{(team.name || "??").slice(0, 2).toUpperCase()}</div>}<div className="urtt-identity-text" style={styles.identityText}><strong className="urtt-team-name">{team.name || "Écurie"}</strong><p style={styles.mutedSmall}>Écurie</p></div></div>; }
function TripleCrown({ crown }) { const safe = crown || { monaco: false, indy500: false, lemans: false }; return <div style={styles.crownBox}><span style={safe.monaco ? { ...styles.badgeGreen, background: "#7c3aed", color: "white" } : styles.badgeDark}>Titre F1</span><span style={safe.indy500 ? { ...styles.badgeGreen, background: "#ffff00", color: "#18181b" } : styles.badgeDark}>Indy 300</span><span style={safe.lemans ? { ...styles.badgeGreen, background: "#006ee6" } : styles.badgeDark}>2,4H du Mans</span></div>; }
function LoginScreen({ email, setEmail, password, setPassword, loginError, onLogin, onBack }) { return <div style={styles.loginPage}><form onSubmit={onLogin} style={styles.loginCard}><div style={styles.logo}>UR</div><p style={styles.kicker}>ACCÈS PRIVÉ</p><h1 style={styles.loginTitle}>Connexion admin</h1><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email admin" style={styles.input} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mot de passe" style={styles.input} />{loginError && <p style={styles.errorText}>{loginError}</p>}<button type="submit" style={styles.fullButton}>Se connecter</button><button type="button" onClick={onBack} style={styles.linkButton}>Retour public</button><p style={styles.hint}>Comptes à créer dans Supabase Auth.</p></form></div>; }
function TitlesPanel({
  drivers,
  teams,
  titleDriverId,
  setTitleDriverId,
  titleTeamId,
  setTitleTeamId,
  selectedCategoryId,
  setSelectedCategoryId,
  categoryOptions = CATEGORY_OPTIONS,
  selectedSeasonId,
  setSelectedSeasonId,
  seasonOptions = [],
  seasonTitles = [],
  onAward,
  onSaveSeasonTitle,
  isSaving,
}) {
  const currentSeasonTitle = seasonTitles.find((title) => normalizeSeasonId(title.seasonId) === normalizeSeasonId(selectedSeasonId) && normalizeCategoryId(title.categoryId) === normalizeCategoryId(selectedCategoryId));
  const currentDriver = drivers.find((driver) => idsEqual(driver.id, currentSeasonTitle?.driverId));
  const currentTeam = teams.find((team) => idsEqual(team.id, currentSeasonTitle?.teamId));
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
        <h2 className="urtt-card-title">Titre par saison</h2>
        <p style={{ color: "#a1a1aa", marginTop: 6 }}>
          Associe une saison a un champion pilote et une ecurie championne pour afficher les trophees dans la fiche pilote.
        </p>

        <div className="urtt-form-grid" style={{ marginTop: 24 }}>
          <div>
            <label className="urtt-label">Catégorie</label>
            <select className="urtt-input" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
              {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>

          <div>
            <label className="urtt-label">Saison</label>
            <select className="urtt-input" value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)}>
              {seasonOptions.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
            </select>
          </div>
        </div>

        <button className="urtt-button" onClick={onSaveSeasonTitle} disabled={isSaving} style={{ marginTop: 24 }}>
          {isSaving ? "Enregistrement..." : "Enregistrer le titre de saison"}
        </button>

        <div style={{ ...styles.itemBox, marginTop: 16 }}>
          <span>{seasonName(selectedSeasonId)} · {selectedCategoryId}</span>
          <strong>{currentDriver?.name || "Aucun pilote"} / {currentTeam?.name || "Aucune ecurie"}</strong>
        </div>
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
  publicSessionBox: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 },
  accountBox: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 },
  sessionBadge: { background: "rgba(24, 24, 27, .92)", border: "1px solid #3f3f46", color: "#e4e4e7", borderRadius: 999, padding: "9px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" },
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
  standingsGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 22, width: "100%" },
  mediaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 },
  mediaLinkCard: { display: "flex", alignItems: "center", gap: 12, background: "#27272a", border: "1px solid #3f3f46", borderRadius: 18, padding: 16, color: "white", textDecoration: "none" },
  mediaDot: { width: 14, height: 14, borderRadius: "50%", flex: "0 0 auto", boxShadow: "0 0 22px currentColor" },
  thanksCard: { marginTop: 14, background: "#18181b", border: "1px solid #3f3f46", borderRadius: 14, padding: 14, display: "grid", gap: 10 },
  thanksText: { color: "#d4d4d8", margin: 0, lineHeight: 1.45, whiteSpace: "pre-line" },
  thanksList: { display: "flex", flexWrap: "wrap", gap: 8 },
  thanksBadge: { background: "rgba(124,58,237,.2)", border: "1px solid rgba(168,85,247,.55)", borderRadius: 999, color: "white", fontWeight: 900, padding: "6px 10px" },
  developmentChartWrap: { display: "grid", gap: 14 },
  developmentChart: { width: "100%", minHeight: 340, background: "#09090b", border: "1px solid #27272a", borderRadius: 18 },
  developmentLegend: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  developmentLegendItem: { display: "inline-flex", gap: 6, alignItems: "center", color: "#f4f4f5", fontWeight: 900, background: "#18181b", border: "1px solid #27272a", borderRadius: 999, padding: "6px 9px" },
  developmentBarChart: { display: "grid", gap: 8, background: "#09090b", border: "1px solid #3f3f46", borderRadius: 18, padding: 14, overflow: "hidden" },
  developmentBarRow: { minHeight: 34, display: "grid", alignItems: "center" },
  developmentBarTrack: { position: "relative", minHeight: 34, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, overflow: "hidden" },
  developmentBarFill: { minHeight: 34, display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) auto", alignItems: "center", gap: 8, padding: "0 52px 0 10px", color: "#09090b", fontWeight: 950, textShadow: "0 1px rgba(255,255,255,.35)", boxSizing: "border-box", transition: "width .25s ease" },
  developmentBarRank: { fontSize: 12, opacity: .8 },
  developmentBarName: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "uppercase" },
  developmentBarValue: { color: "#09090b", whiteSpace: "nowrap" },
  developmentBarLogoSlot: { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 42, height: 28, display: "grid", placeItems: "center" },
  developmentBarLogo: { maxWidth: 40, maxHeight: 28, objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" },
  developmentBarFallback: { width: 32, height: 24, borderRadius: 6, display: "grid", placeItems: "center", color: "white", fontSize: 10, fontWeight: 950, border: "1px solid rgba(255,255,255,.4)" },
  developmentCards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 },
  developmentCard: { background: "#101827", border: "1px solid #1f2937", borderRadius: 18, padding: 16, display: "grid", gap: 14, boxShadow: "0 18px 42px rgba(0,0,0,.22)" },
  developmentCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  developmentStats: { display: "grid", gap: 8 },
  developmentStat: { background: "#151f2e", border: "1px solid #1f2937", borderRadius: 10, padding: 10, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 48px 28px", alignItems: "center", gap: 8 },
  developmentStatLabel: { color: "#a1a1aa", margin: 0, fontSize: 13, minWidth: 0 },
  developmentDeltaSlot: { minWidth: 48, display: "flex", justifyContent: "center", alignItems: "center" },
  developmentStatValue: { textAlign: "right", fontWeight: 950 },
  developmentAdminGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 14, marginTop: 16 },
  developmentAdminTeamCard: { background: "#101827", border: "1px solid #1f2937", borderTop: "4px solid #dc2626", borderRadius: 16, padding: 14, display: "grid", gap: 10 },
  developmentDrivers: { display: "grid", gap: 6 },
  devDeltaUp: { color: "#22c55e", fontSize: 12, fontWeight: 950 },
  devDeltaDown: { color: "#ef4444", fontSize: 12, fontWeight: 950 },
  previewNotice: { background: "rgba(124,58,237,.16)", border: "1px solid rgba(168,85,247,.55)", color: "#f5f3ff", borderRadius: 16, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
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
  sortHeaderButton: { background: "transparent", border: 0, color: "#d4d4d8", padding: 0, font: "inherit", fontWeight: 900, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" },
  sortHeaderButtonActive: { color: "#a855f7" },
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
  permissionCategoryGrid: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 },
  permissionCategoryPill: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #3f3f46", borderRadius: 999, padding: "10px 13px", color: "white", fontWeight: 900, cursor: "pointer" },
  permissionPageGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 10, marginTop: 10 },
  permissionPagePill: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #3f3f46", borderRadius: 14, padding: "11px 12px", color: "white", fontWeight: 900, cursor: "pointer" },
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
  titleBadgeRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  titleBadge: { background: "rgba(168,85,247,.16)", color: "#c084fc", border: "1px solid rgba(168,85,247,.45)", padding: "6px 9px", borderRadius: 999, fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" },
  seasonSelect: { background: "#18181b", border: "1px solid #27272a", color: "white", padding: "12px 16px", borderRadius: 999, fontWeight: 900, outline: "none", cursor: "pointer" },
  categorySelect: { background: "#18181b", border: "1px solid #27272a", color: "white", padding: "12px 16px", borderRadius: 999, fontWeight: 900, outline: "none", cursor: "pointer" },
  resultsInfo: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "end", background: "#27272a", borderRadius: 18, padding: 16 },
  resultsSelect: { background: "#09090b", border: "1px solid #3f3f46", color: "white", borderRadius: 14, padding: 14, outline: "none", fontWeight: 700 },
  quickResultBox: { background: "#202024", border: "1px solid #3f3f46", borderRadius: 18, padding: 16, display: "grid", gap: 12 },
  predictionOrderBox: { background: "#202024", border: "1px solid #3f3f46", borderRadius: 18, padding: 16, display: "grid", gap: 14 },
  predictionOrderHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  predictionOrderList: { display: "grid", gap: 8 },
  predictionOrderRow: { background: "#18181b", border: "1px solid #2f2f36", borderRadius: 14, padding: "10px 12px", display: "grid", gridTemplateColumns: "54px minmax(0, 1fr) auto", alignItems: "center", gap: 10, cursor: "grab" },
  predictionOrderRowDragging: { opacity: .55, borderColor: "#a855f7", boxShadow: "0 0 18px rgba(168,85,247,.28)" },
  predictionPosition: { color: "#f87171", fontWeight: 950, fontSize: 16 },
  predictionMoveButtons: { display: "flex", alignItems: "center", gap: 6 },
  predictionDragHandle: { color: "#a1a1aa", fontSize: 20, fontWeight: 950, padding: "0 4px" },
  guessHero: { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, .8fr)", gap: 18, alignItems: "center", marginBottom: 16 },
  guessCell: { minHeight: 52, borderRadius: 14, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontWeight: 950 },
  guessCellCorrect: { background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.55)", color: "#bbf7d0" },
  guessCellWrong: { background: "rgba(127,29,29,.22)", border: "1px solid rgba(248,113,113,.45)", color: "#fecaca" },
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
  detailOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 5000, padding: 24, display: "grid", placeItems: "center" },
  detailModal: { position: "relative", zIndex: 5001, width: "min(1040px, 100%)", maxHeight: "90vh", overflow: "auto", display: "grid", gap: 18 },
  publicRaceCard: { background: "#27272a", borderRadius: 22, padding: 18, display: "grid", gap: 16 },
  publicRaceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  worldPage: { display: "grid", gap: 22 },
  worldHero: { width: "min(720px, 100%)", margin: "0 auto", textAlign: "center", border: "1px solid #a855f7", borderRadius: 18, padding: "18px 22px", background: "rgba(9,9,11,.76)", boxShadow: "0 0 34px rgba(168,85,247,.22)" },
  worldTitle: { margin: 0, fontSize: 34, letterSpacing: 1, textTransform: "uppercase" },
  worldSubtitle: { margin: "8px 0 0", color: "#d4d4d8", fontSize: 13 },
  worldMapShell: { position: "relative", minHeight: 620, border: "1px solid #27272a", borderRadius: 22, overflow: "hidden", background: "radial-gradient(circle at center, rgba(192,0,255,.18), transparent 36%), linear-gradient(135deg, #06020a, #160020)" },
  worldLeafletMap: { position: "absolute", inset: 0, height: "100%", width: "100%", background: "transparent" },
  worldLegend: { position: "absolute", left: 18, bottom: 18, zIndex: 1000, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(192,0,255,.65)", background: "rgba(10,4,18,.82)", color: "white", boxShadow: "0 0 28px rgba(0,0,0,.4)", display: "grid", gap: 6 },
  worldSwatch: { width: 18, height: 12, borderRadius: 4, display: "inline-block", marginRight: 8 },
  worldSearch: { position: "absolute", right: 18, bottom: 18, zIndex: 1000, width: "min(310px, calc(100% - 36px))", borderRadius: 14, border: "1px solid rgba(192,0,255,.65)", background: "rgba(10,4,18,.82)", padding: 10, boxShadow: "0 0 28px rgba(0,0,0,.4)" },
  worldSearchInput: { width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.16)", outline: "none", borderRadius: 10, background: "rgba(255,255,255,.08)", color: "white", padding: "10px 12px", fontSize: 15 },
  worldCountrySummary: { position: "absolute", left: 18, top: 18, zIndex: 1000, maxWidth: "min(520px, calc(100% - 36px))", borderRadius: 14, border: "1px solid rgba(192,0,255,.65)", background: "rgba(10,4,18,.82)", padding: "12px 14px", boxShadow: "0 0 28px rgba(0,0,0,.4)", display: "grid", gap: 4 },
  worldEmpty: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#d4d4d8", zIndex: 1001, background: "rgba(9,9,11,.72)" },
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
  compactRaceResultCell: { display: "grid", justifyItems: "center", gap: 2, fontSize: 12, lineHeight: 1.1 },
  compactRaceBadges: { color: "#86efac", fontSize: 10, fontWeight: 950 },
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
