/**
 * api.js — API service layer
 * All calls to FastAPI backend. Falls back to mock data if backend is offline.
 */

const BASE = "/api";

export async function getRecommendation(userId, settings, userStats, agent = "linucb") {
  try {
    const res = await fetch(`${BASE}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        font_size_norm: settings.font_size_norm,
        contrast_level_norm: settings.contrast_level_norm,
        color_scheme_idx: settings.color_scheme_idx,
        line_spacing_norm: settings.line_spacing_norm,
        scroll_speed_norm: userStats.scroll_speed_norm ?? 0.5,
        misclick_rate: userStats.misclick_rate ?? 0.1,
        zoom_adjustments_norm: userStats.zoom_adjustments_norm ?? 0.0,
        time_on_page_norm: userStats.time_on_page_norm ?? 0.3,
        content_type: userStats.content_type ?? 0.0,
        device_type: userStats.device_type ?? 0.0,
        agent,
      }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch {
    // Fallback mock when backend is offline
    return mockRecommendation(settings);
  }
}

export async function submitReward(userId, sessionId, action, engagement) {
  try {
    const res = await fetch(`${BASE}/reward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        action,
        time_on_page: engagement.time_on_page,
        scroll_depth: engagement.scroll_depth,
        successful_clicks: engagement.successful_clicks,
        total_clicks: engagement.total_clicks,
        bounce: engagement.bounce,
        zoom_adjustments: engagement.zoom_adjustments,
        misclick_rate: engagement.misclick_rate,
      }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch {
    return { reward: Math.random() * 1.5, total_rounds: 0 };
  }
}

export async function getAnalytics() {
  try {
    const res = await fetch(`${BASE}/analytics`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return MOCK_ANALYTICS;
  }
}

export async function getTrainingMetrics() {
  try {
    const res = await fetch(`${BASE}/training-metrics`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return null;
  }
}

export async function getModelInfo() {
  try {
    const res = await fetch(`${BASE}/model-info`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return null;
  }
}

// ── Mock fallbacks ─────────────────────────────────────────────────────────────

function mockRecommendation(settings) {
  const scores = [
    settings.font_size_norm < 0.5 ? 1.8 : 0.4,
    settings.font_size_norm > 0.8 ? 0.9 : 0.2,
    settings.contrast_level_norm < 0.6 ? 1.6 : 0.3,
    settings.contrast_level_norm > 0.85 ? 0.5 : 0.1,
    0.5 + Math.random() * 0.4,
    0.4 + Math.random() * 0.3,
  ].map(s => s + Math.random() * 0.15);
  const action = scores.indexOf(Math.max(...scores));
  const ACTIONS_MAP = ["increase_font","decrease_font","increase_contrast","decrease_contrast","switch_color_mode","adjust_line_spacing"];
  const step = 0.12;
  const ns = { ...settings };
  if (action === 0) ns.font_size_norm = Math.min(1, ns.font_size_norm + step);
  else if (action === 1) ns.font_size_norm = Math.max(0, ns.font_size_norm - step);
  else if (action === 2) ns.contrast_level_norm = Math.min(1, ns.contrast_level_norm + step);
  else if (action === 3) ns.contrast_level_norm = Math.max(0, ns.contrast_level_norm - step);
  else if (action === 4) ns.color_scheme_idx = (ns.color_scheme_idx + 1) % 4;
  else if (action === 5) ns.line_spacing_norm = Math.min(1, ns.line_spacing_norm + step);
  return {
    session_id: crypto.randomUUID(),
    action, action_name: ACTIONS_MAP[action],
    new_settings: ns, ucb_scores: scores, agent: "linucb_mock",
  };
}

const MOCK_ANALYTICS = {
  agent_comparison: {
    linucb:   { avg_reward: 1.42, total_sessions: 320, cumulative_reward: 454.4, recent_avg: 1.61 },
    thompson: { avg_reward: 1.18, total_sessions: 320, cumulative_reward: 377.6, recent_avg: 1.31 },
    static:   { avg_reward: 0.54, total_sessions: 320, cumulative_reward: 172.8, recent_avg: 0.54 },
  },
  action_distribution: {
    increase_font: 87, increase_contrast: 112, switch_color_mode: 64,
    adjust_line_spacing: 43, decrease_contrast: 18, decrease_font: 12,
  },
  total_interactions: 960,
  recent_rewards: Array.from({ length: 50 }, () => 1.2 + Math.random() * 0.6 - 0.2),
};
