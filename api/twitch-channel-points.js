const TWITCH_API_URL = "https://api.twitch.tv/helix/predictions";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const PERIODS = {
  "30d": 30,
  "365d": 365,
};

function json(response, status, payload) {
  response.status(status).json(payload);
}

async function getAccessToken() {
  if (process.env.TWITCH_REFRESH_TOKEN && process.env.TWITCH_CLIENT_SECRET) {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.TWITCH_REFRESH_TOKEN,
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
    });
    const tokenResponse = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new Error(tokenPayload.message || "Impossible de renouveler le token Twitch.");
    }
    return tokenPayload.access_token;
  }
  return process.env.TWITCH_ACCESS_TOKEN || "";
}

function summarizePrediction(prediction) {
  const outcomes = Array.isArray(prediction.outcomes) ? prediction.outcomes : [];
  const winningOutcome = outcomes.find((outcome) => outcome.id === prediction.winning_outcome_id);
  const channelPointsSpent = outcomes.reduce((sum, outcome) => sum + Number(outcome.channel_points || 0), 0);
  const channelPointsLost = prediction.status === "RESOLVED"
    ? outcomes.filter((outcome) => outcome.id !== prediction.winning_outcome_id).reduce((sum, outcome) => sum + Number(outcome.channel_points || 0), 0)
    : 0;
  const visibleChannelPointsWon = outcomes.reduce((sum, outcome) => {
    const predictors = Array.isArray(outcome.top_predictors) ? outcome.top_predictors : [];
    return sum + predictors.reduce((predictorSum, predictor) => predictorSum + Number(predictor.channel_points_won || 0), 0);
  }, 0);
  return {
    id: prediction.id,
    title: prediction.title,
    status: prediction.status,
    createdAt: prediction.created_at,
    endedAt: prediction.ended_at,
    winningOutcomeTitle: winningOutcome?.title || "",
    channelPointsSpent,
    channelPointsLost,
    visibleChannelPointsWon,
    outcomes: outcomes.map((outcome) => ({
      id: outcome.id,
      title: outcome.title,
      users: Number(outcome.users || 0),
      channelPoints: Number(outcome.channel_points || 0),
      isWinner: outcome.id === prediction.winning_outcome_id,
    })),
  };
}

function buildTopPredictors(predictions) {
  const map = new Map();
  predictions.forEach((prediction) => {
    (prediction.outcomes || []).forEach((outcome) => {
      (outcome.top_predictors || []).forEach((predictor) => {
        const key = predictor.user_login || predictor.user_id || predictor.user_name;
        if (!key) return;
        const current = map.get(key) || {
          userId: predictor.user_id || "",
          userLogin: predictor.user_login || "",
          userName: predictor.user_name || predictor.user_login || "",
          used: 0,
          won: 0,
          predictions: 0,
        };
        map.set(key, {
          ...current,
          used: current.used + Number(predictor.channel_points_used || 0),
          won: current.won + Number(predictor.channel_points_won || 0),
          predictions: current.predictions + 1,
        });
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => b.won - a.won || b.used - a.used || a.userName.localeCompare(b.userName));
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed" });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!clientId || !broadcasterId) {
    return json(response, 500, { error: "Configure TWITCH_CLIENT_ID et TWITCH_BROADCASTER_ID dans Vercel." });
  }

  try {
    const period = PERIODS[request.query?.period] ? request.query.period : "30d";
    const since = new Date(Date.now() - PERIODS[period] * 24 * 60 * 60 * 1000);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return json(response, 500, { error: "Configure TWITCH_ACCESS_TOKEN ou TWITCH_REFRESH_TOKEN dans Vercel." });
    }

    const predictions = [];
    let cursor = "";
    for (let page = 0; page < 20; page += 1) {
      const url = new URL(TWITCH_API_URL);
      url.searchParams.set("broadcaster_id", broadcasterId);
      url.searchParams.set("first", "25");
      if (cursor) url.searchParams.set("after", cursor);

      const twitchResponse = await fetch(url, {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await twitchResponse.json().catch(() => ({}));
      if (!twitchResponse.ok) {
        return json(response, twitchResponse.status, { error: payload.message || "Erreur API Twitch." });
      }

      const pagePredictions = Array.isArray(payload.data) ? payload.data : [];
      predictions.push(...pagePredictions.filter((prediction) => new Date(prediction.created_at) >= since));
      const oldest = pagePredictions[pagePredictions.length - 1];
      if (!payload.pagination?.cursor || !oldest || new Date(oldest.created_at) < since) break;
      cursor = payload.pagination.cursor;
    }

    const summarized = predictions.map(summarizePrediction);
    const summary = summarized.reduce((sum, prediction) => ({
      predictions: sum.predictions + 1,
      resolvedPredictions: sum.resolvedPredictions + (prediction.status === "RESOLVED" ? 1 : 0),
      channelPointsSpent: sum.channelPointsSpent + prediction.channelPointsSpent,
      channelPointsLost: sum.channelPointsLost + prediction.channelPointsLost,
      visibleChannelPointsWon: sum.visibleChannelPointsWon + prediction.visibleChannelPointsWon,
    }), { predictions: 0, resolvedPredictions: 0, channelPointsSpent: 0, channelPointsLost: 0, visibleChannelPointsWon: 0 });

    return json(response, 200, {
      period,
      broadcasterId,
      broadcasterLogin: predictions[0]?.broadcaster_login || "",
      summary,
      predictions: summarized,
      topPredictors: buildTopPredictors(predictions),
    });
  } catch (error) {
    return json(response, 500, { error: error.message || "Impossible de charger Twitch." });
  }
}
