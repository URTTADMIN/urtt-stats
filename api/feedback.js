const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 1800;
const ALLOWED_TYPES = new Set(["Suggestion", "Bug"]);

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return response.status(500).json({ error: "Discord webhook is not configured" });
  }

  const type = ALLOWED_TYPES.has(request.body?.type) ? request.body.type : "Suggestion";
  const title = cleanText(request.body?.title, MAX_TITLE_LENGTH);
  const content = cleanText(request.body?.content, MAX_CONTENT_LENGTH);
  const pageUrl = cleanText(request.body?.pageUrl, 300);
  const player = request.body?.player || null;
  const playerPseudo = cleanText(player?.pseudo, 80);
  const playerDiscord = cleanText(player?.discordName, 80);
  const playerId = cleanText(player?.id, 80);

  if (!title || !content) {
    return response.status(400).json({ error: "Title and content are required" });
  }

  const fields = [];
  if (playerPseudo || playerDiscord || playerId) {
    fields.push({
      name: "Compte joueur",
      value: [
        playerPseudo && `Pseudo : ${playerPseudo}`,
        playerDiscord && `Discord : ${playerDiscord}`,
        playerId && `ID : ${playerId}`,
      ].filter(Boolean).join("\n"),
    });
  } else {
    fields.push({ name: "Compte joueur", value: "Non connecté" });
  }
  if (pageUrl) fields.push({ name: "Page", value: pageUrl });

  const discordResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "URTT Feedback",
      embeds: [
        {
          title: `[${type}] ${title}`,
          description: content,
          color: type === "Bug" ? 0xdc2626 : 0x2563eb,
          fields,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!discordResponse.ok) {
    return response.status(502).json({ error: "Discord webhook failed" });
  }

  return response.status(200).json({ ok: true });
}
