import webPush from "web-push";
import { timingSafeEqual } from "node:crypto";

const TABLE_URL = "/rest/v1/tcg_push_subscriptions";
const TIME_ZONE = "Europe/Paris";

function json(response, status, body) {
  return response.status(status).json(body);
}

function getLocalDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function hasValidCronSecret(request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.authorization || "";
  if (!secret || !authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function supabaseHeaders(serviceKey, extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra };
}

async function deleteSubscription(url, serviceKey, id) {
  await fetch(`${url}${TABLE_URL}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: supabaseHeaders(serviceKey, { Prefer: "return=minimal" }),
  });
}

async function markSent(url, serviceKey, id, localDate) {
  const result = await fetch(`${url}${TABLE_URL}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: supabaseHeaders(serviceKey, {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    }),
    body: JSON.stringify({ last_sent_local_date: localDate }),
  });
  if (!result.ok) throw new Error(`Unable to update push delivery date (${result.status})`);
}

async function claimReminder(url, serviceKey, id, localDate) {
  const result = await fetch(`${url}${TABLE_URL}?id=eq.${encodeURIComponent(id)}&or=(last_attempt_local_date.is.null,last_attempt_local_date.lt.${localDate})`, {
    method: "PATCH",
    headers: supabaseHeaders(serviceKey, {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({ last_attempt_local_date: localDate }),
  });
  if (!result.ok) throw new Error(`Unable to claim push reminder (${result.status})`);
  const claimed = await result.json();
  return Array.isArray(claimed) && claimed.length > 0;
}

async function loadSubscriptions(url, serviceKey) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await fetch(`${url}${TABLE_URL}?select=id,subscription,last_sent_local_date,last_attempt_local_date&enabled=eq.true&limit=1000&offset=${offset}`, {
      headers: supabaseHeaders(serviceKey),
    });
    if (!result.ok) throw new Error(`Unable to load push subscriptions (${result.status})`);
    const page = await result.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed" });
  }
  if (!hasValidCronSecret(request)) return json(response, 401, { error: "Unauthorized" });

  const { hour, year, month, day } = getLocalDateParts(new Date());
  if (hour !== "20") return json(response, 200, { skipped: "Not 20:00 in Europe/Paris" });

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || "";
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY || "";
  const subject = process.env.WEB_PUSH_SUBJECT || "https://urtt.fr/";
  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey) {
    return json(response, 503, { error: "Push reminder service is not configured" });
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  const localDate = `${year}-${month}-${day}`;
  try {
    const subscriptions = await loadSubscriptions(supabaseUrl, serviceKey);
    let sent = 0;
    let skipped = 0;
    let removed = 0;
    const failed = [];

    for (let offset = 0; offset < subscriptions.length; offset += 25) {
      const batch = subscriptions.slice(offset, offset + 25);
      const results = await Promise.all(batch.map(async (row) => {
        if (row.last_sent_local_date === localDate || row.last_attempt_local_date === localDate) return "skipped";
        try {
          const claimed = await claimReminder(supabaseUrl, serviceKey, row.id, localDate);
          if (!claimed) return "skipped";
          await webPush.sendNotification(row.subscription, JSON.stringify({
            title: "URTT TCG",
            body: "Viens ouvrir tes pack",
            url: "/",
          }));
          await markSent(supabaseUrl, serviceKey, row.id, localDate);
          return "sent";
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await deleteSubscription(supabaseUrl, serviceKey, row.id);
            return "removed";
          }
          console.error("Push delivery failed:", row.id, error.statusCode || error.message);
          failed.push(row.id);
          return "failed";
        }
      }));
      results.forEach((result) => {
        if (result === "sent") sent += 1;
        else if (result === "skipped") skipped += 1;
        else if (result === "removed") removed += 1;
      });
    }

    return json(response, 200, { localDate, sent, skipped, removed, failed: failed.length });
  } catch (error) {
    console.error("Daily TCG reminder failed:", error);
    return json(response, 500, { error: "Daily TCG reminder failed" });
  }
}
