const TABLE_URL = "/rest/v1/tcg_push_subscriptions";

function json(response, status, body) {
  return response.status(status).json(body);
}

function getSupabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, ""),
    serviceKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function isAllowedPushEndpoint(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:"
      && (host === "fcm.googleapis.com"
        || host === "updates.push.services.mozilla.com"
        || host.endsWith(".push.services.mozilla.com")
        || host === "web.push.apple.com"
        || host.endsWith(".push.apple.com")
        || host.endsWith(".notify.windows.com"));
  } catch {
    return false;
  }
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function getBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  try {
    return JSON.parse(String(request.body || "{}"));
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  if (!isSameOrigin(request)) return json(response, 403, { error: "Origin not allowed" });
  if (!["POST", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "POST, DELETE");
    return json(response, 405, { error: "Method not allowed" });
  }

  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) return json(response, 503, { error: "Push subscription storage is not configured" });

  const body = getBody(request);
  if (!body) return json(response, 400, { error: "Invalid JSON body" });
  const endpoint = request.method === "POST" ? body.subscription?.endpoint : body.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !isAllowedPushEndpoint(endpoint)) {
    return json(response, 400, { error: "Invalid push endpoint" });
  }

  const headers = { apikey: serviceKey, "Content-Type": "application/json" };
  if (!serviceKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceKey}`;
  const table = `${url}${TABLE_URL}`;

  try {
    if (request.method === "POST") {
      const subscription = body.subscription;
      if (!subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return json(response, 400, { error: "Invalid push subscription keys" });
      }
      const result = await fetch(`${table}?on_conflict=endpoint`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ endpoint, subscription, timezone: "Europe/Paris", enabled: true }),
      });
      if (!result.ok) {
        console.error("Push subscription upsert failed:", result.status, await result.text());
        return json(response, 502, { error: "Unable to save push subscription" });
      }
      return json(response, 200, { ok: true });
    }

    const result = await fetch(`${table}?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: "DELETE",
      headers: { ...headers, Prefer: "return=minimal" },
    });
    if (!result.ok) {
      console.error("Push subscription deletion failed:", result.status, await result.text());
      return json(response, 502, { error: "Unable to remove push subscription" });
    }
    return json(response, 200, { ok: true });
  } catch (error) {
    console.error("Push subscription request failed:", error);
    return json(response, 500, { error: "Push subscription request failed" });
  }
}
