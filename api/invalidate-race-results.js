import { invalidateByTag } from "@vercel/functions";
import { createClient } from "@supabase/supabase-js";

const CACHE_TAG = "race-results";
const OWNER_EMAIL = "kolti@urtt.fr";

function json(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }
  if (!isSameOrigin(request)) return json(response, 403, { error: "Origin not allowed" });

  const authorization = request.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!accessToken) return json(response, 401, { error: "Admin session required" });
  if (!supabaseUrl || !supabaseAnonKey) return json(response, 503, { error: "Supabase is not configured" });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !userData?.user?.email) return json(response, 401, { error: "Invalid admin session" });

  const email = userData.user.email.trim().toLowerCase();
  if (email !== OWNER_EMAIL) {
    const { data: permission, error: permissionError } = await supabase
      .from("admin_permissions")
      .select("user_email")
      .eq("user_email", email)
      .maybeSingle();
    if (permissionError) return json(response, 503, { error: "Could not verify admin permission" });
    if (!permission) return json(response, 403, { error: "Admin permission required" });
  }

  try {
    await invalidateByTag(CACHE_TAG);
    return json(response, 200, { invalidated: true });
  } catch (error) {
    console.error("Unable to invalidate race result cache:", error);
    return json(response, 503, { error: "Race result cache invalidation failed" });
  }
}
