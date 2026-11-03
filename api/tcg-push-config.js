export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (!publicKey || !privateKey || !supabaseUrl || !serviceKey || !cronSecret) {
    return response.status(503).json({ error: "Push notifications are not configured" });
  }
  try {
    const databaseCheck = await fetch(`${String(supabaseUrl).replace(/\/+$/, "")}/rest/v1/tcg_push_subscriptions?select=id&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!databaseCheck.ok) return response.status(503).json({ error: "Push subscription storage is not configured" });
  } catch {
    return response.status(503).json({ error: "Push subscription storage is not available" });
  }
  return response.status(200).json({ publicKey });
}
