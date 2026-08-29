function parseCookies(cookieHeader = "") {
  return Object.fromEntries(cookieHeader.split(";").map((cookie) => {
    const [name, ...parts] = cookie.trim().split("=");
    return [name, decodeURIComponent(parts.join("=") || "")];
  }).filter(([name]) => name));
}

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const cookies = parseCookies(request.headers.cookie || "");
  const connected = Boolean(cookies.urtt_twitch_refresh || process.env.TWITCH_REFRESH_TOKEN || process.env.TWITCH_ACCESS_TOKEN);
  response.status(200).json({
    connected,
    broadcasterId: cookies.urtt_twitch_broadcaster_id || process.env.TWITCH_BROADCASTER_ID || "",
    broadcasterLogin: cookies.urtt_twitch_broadcaster_login || "",
    canConnect: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
  });
}
