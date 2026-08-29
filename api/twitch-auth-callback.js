const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_USERS_URL = "https://api.twitch.tv/helix/users";
const TWITCH_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(cookieHeader.split(";").map((cookie) => {
    const [name, ...parts] = cookie.trim().split("=");
    return [name, decodeURIComponent(parts.join("=") || "")];
  }).filter(([name]) => name));
}

function getBaseUrl(request) {
  return process.env.TWITCH_REDIRECT_BASE_URL || `https://${request.headers.host}`;
}

function html(message, details = "") {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Twitch connecté</title><style>body{margin:0;background:#09090b;color:#fff;font-family:system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}.card{background:#18181b;border:1px solid #3f3f46;border-radius:22px;padding:28px;max-width:520px}a{display:inline-block;margin-top:18px;background:#9146ff;color:white;text-decoration:none;font-weight:800;padding:12px 16px;border-radius:14px}p{color:#a1a1aa}</style></head><body><main class="card"><h1>${message}</h1>${details ? `<p>${details}</p>` : ""}<a href="/">Retour au site</a></main></body></html>`;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return response.status(500).send(html("Configuration Twitch incomplète", "Ajoute TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET dans Vercel."));
  }

  const cookies = parseCookies(request.headers.cookie || "");
  if (!request.query?.code || !request.query?.state || cookies.urtt_twitch_oauth_state !== request.query.state) {
    return response.status(400).send(html("Connexion Twitch refusée", "Le code OAuth est absent ou la session a expiré."));
  }

  try {
    const redirectUri = `${getBaseUrl(request)}/api/twitch-auth-callback`;
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: request.query.code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const tokenResponse = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token || !tokenPayload.refresh_token) {
      throw new Error(tokenPayload.message || "Impossible de récupérer le token Twitch.");
    }

    const userResponse = await fetch(TWITCH_USERS_URL, {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });
    const userPayload = await userResponse.json().catch(() => ({}));
    const user = userPayload.data?.[0];
    if (!userResponse.ok || !user?.id) {
      throw new Error(userPayload.message || "Impossible d'identifier la chaîne Twitch.");
    }

    response.setHeader("Set-Cookie", [
      "urtt_twitch_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      `urtt_twitch_refresh=${encodeURIComponent(tokenPayload.refresh_token)}; Path=/; Max-Age=${TWITCH_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
      `urtt_twitch_broadcaster_id=${encodeURIComponent(user.id)}; Path=/; Max-Age=${TWITCH_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
      `urtt_twitch_broadcaster_login=${encodeURIComponent(user.login || user.display_name || "")}; Path=/; Max-Age=${TWITCH_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    ]);
    return response.status(200).send(html("Chaîne Twitch connectée", `La chaîne ${user.display_name || user.login} est maintenant reliée à URTT Stats.`));
  } catch (error) {
    return response.status(500).send(html("Erreur Twitch", error.message || "Impossible de connecter Twitch."));
  }
}
