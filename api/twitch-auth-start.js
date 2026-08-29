const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_SCOPES = ["channel:read:predictions"];

function getBaseUrl(request) {
  return process.env.TWITCH_REDIRECT_BASE_URL || `https://${request.headers.host}`;
}

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    return response.status(500).send("Configure TWITCH_CLIENT_ID dans Vercel avant de connecter Twitch.");
  }

  const state = crypto.randomUUID();
  const redirectUri = `${getBaseUrl(request)}/api/twitch-auth-callback`;
  const url = new URL(TWITCH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TWITCH_SCOPES.join(" "));
  url.searchParams.set("state", state);

  response.setHeader("Set-Cookie", `urtt_twitch_oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
  response.redirect(url.toString());
}
