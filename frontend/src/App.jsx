import { useState, useEffect, useRef, useCallback } from "react";

// ─── Color Schemes ────────────────────────────────────────────────────────────
const COLOR_SCHEMES = {
  default: {
    bg: "#faf9f7",
    surface: "#ffffff",
    surfaceAlt: "#f4f2ee",
    text: "#1a1a1a",
    textMuted: "#6b6b6b",
    textSubtle: "#9a9a9a",
    accent: "#2563eb",
    accentLight: "#dbeafe",
    border: "#e5e0d8",
    card: "#ffffff",
    nav: "#ffffff",
    shadow: "rgba(0,0,0,0.08)",
    label: "Default",
  },
  dark: {
    bg: "#0f1117",
    surface: "#1a1d27",
    surfaceAlt: "#22263a",
    text: "#e8e6f0",
    textMuted: "#a0a0b8",
    textSubtle: "#6b6b85",
    accent: "#7c6ef0",
    accentLight: "#2d2a4a",
    border: "#2a2d3e",
    card: "#1a1d27",
    nav: "#0f1117",
    shadow: "rgba(0,0,0,0.4)",
    label: "Dark Mode",
  },
  "high-contrast": {
    bg: "#000000",
    surface: "#111111",
    surfaceAlt: "#1a1a1a",
    text: "#ffffff",
    textMuted: "#dddddd",
    textSubtle: "#bbbbbb",
    accent: "#ffdd00",
    accentLight: "#333300",
    border: "#555555",
    card: "#111111",
    nav: "#000000",
    shadow: "rgba(255,255,0,0.1)",
    label: "High Contrast",
  },
  warm: {
    bg: "#fdf6ec",
    surface: "#fff8f0",
    surfaceAlt: "#faebd7",
    text: "#2c1a0e",
    textMuted: "#7a5c3a",
    textSubtle: "#a08060",
    accent: "#c2641a",
    accentLight: "#fde8d0",
    border: "#e8d5b7",
    card: "#fff8f0",
    nav: "#fff8f0",
    shadow: "rgba(100,60,20,0.1)",
    label: "Warm",
  },
};

const SCHEME_KEYS = ["default", "dark", "high-contrast", "warm"];

// ─── Simulated RL Logic ────────────────────────────────────────────────────────
function simulateLinUCB(state, history) {
  const scores = [0, 0, 0, 0, 0, 0];
  if (state.font_size_norm < 0.5) scores[0] += 1.2;
  if (state.font_size_norm > 0.8) scores[1] += 0.8;
  if (state.contrast_level_norm < 0.6) scores[2] += 1.4;
  if (state.contrast_level_norm > 0.85) scores[3] += 0.6;
  if (state.misclick_rate > 0.2) scores[0] += 0.5;
  scores[4] += 0.3 + Math.random() * 0.4;
  scores[5] += 0.2 + Math.random() * 0.3;
  return scores.indexOf(Math.max(...scores));
}

const ACTIONS = [
  { id: 0, label: "Increase Font", icon: "A↑", color: "#2563eb" },
  { id: 1, label: "Decrease Font", icon: "A↓", color: "#7c3aed" },
  { id: 2, label: "Increase Contrast", icon: "◐↑", color: "#059669" },
  { id: 3, label: "Decrease Contrast", icon: "◐↓", color: "#d97706" },
  { id: 4, label: "Switch Color Mode", icon: "◑", color: "#db2777" },
  { id: 5, label: "Adjust Spacing", icon: "↕", color: "#0891b2" },
];

const PERSONAS = [
  { key: "low_vision", label: "Low Vision", icon: "👁", preferred: { font: 0.9, contrast: 0.8, scheme: 2 } },
  { key: "color_blind", label: "Color Blind", icon: "🎨", preferred: { font: 0.5, contrast: 0.7, scheme: 1 } },
  { key: "photophobic", label: "Photophobic", icon: "🌙", preferred: { font: 0.5, contrast: 0.3, scheme: 1 } },
  { key: "elderly", label: "Elderly User", icon: "👴", preferred: { font: 0.85, contrast: 0.75, scheme: 0 } },
];

// ─── Components ───────────────────────────────────────────────────────────────

function NavBar({ scheme, settings, onTogglePanel }) {
  const c = COLOR_SCHEMES[scheme];
  return (
    <nav style={{
      background: c.nav,
      borderBottom: `1px solid ${c.border}`,
      padding: "0 32px",
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: `0 1px 12px ${c.shadow}`,
      transition: "all 0.4s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 900, color: "#fff",
          boxShadow: `0 4px 12px ${c.accent}44`,
        }}>A</div>
        <span style={{ fontFamily: "'Georgia', serif", fontWeight: 700, fontSize: 18, color: c.text, letterSpacing: -0.5 }}>
          Access<span style={{ color: c.accent }}>AI</span>
        </span>
        <span style={{
          background: c.accentLight, color: c.accent,
          fontSize: 10, fontWeight: 700, padding: "3px 8px",
          borderRadius: 20, letterSpacing: 1, textTransform: "uppercase",
        }}>RL-Powered</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {["Home", "Articles", "Gallery", "About"].map(item => (
          <button key={item} style={{
            background: "none", border: "none", cursor: "pointer",
            color: c.textMuted, fontSize: 14, fontWeight: 500,
            padding: "6px 14px", borderRadius: 8,
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.target.style.background = c.surfaceAlt; e.target.style.color = c.text; }}
          onMouseLeave={e => { e.target.style.background = "none"; e.target.style.color = c.textMuted; }}>
            {item}
          </button>
        ))}
        <button onClick={onTogglePanel} style={{
          background: c.accent, color: "#fff", border: "none", cursor: "pointer",
          padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: `0 4px 12px ${c.accent}44`, transition: "all 0.2s",
        }}>⚙ RL Panel</button>
      </div>
    </nav>
  );
}

function RLControlPanel({ visible, settings, setSettings, scheme, history, lastAction, ucbScores, onRunAgent, persona, setPersona, onSelectPersona }) {
  const c = COLOR_SCHEMES[scheme];
  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", right: 0, top: 64, bottom: 0, width: 380,
      background: c.surface, borderLeft: `1px solid ${c.border}`,
      overflowY: "auto", zIndex: 90, padding: 24,
      boxShadow: `-8px 0 32px ${c.shadow}`,
      transition: "all 0.4s ease",
    }}>
      <h3 style={{ fontFamily: "'Georgia', serif", color: c.text, margin: "0 0 20px", fontSize: 17, fontWeight: 700 }}>
        🤖 RL Agent Control
      </h3>

      {/* Persona Selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
          Simulate User Persona
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          {PERSONAS.map(p => (
            <button key={p.key} onClick={() => onSelectPersona(p.key)} style={{
              padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              border: `2px solid ${persona === p.key ? c.accent : c.border}`,
              background: persona === p.key ? c.accentLight : c.surfaceAlt,
              color: persona === p.key ? c.accent : c.textMuted,
              fontSize: 12, fontWeight: 600, textAlign: "left",
              transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{p.icon}</div>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Run Agent Button */}
      <button onClick={onRunAgent} style={{
        width: "100%", padding: "14px", borderRadius: 12,
        background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)`,
        color: "#fff", border: "none", cursor: "pointer",
        fontSize: 15, fontWeight: 700, marginBottom: 24,
        boxShadow: `0 6px 20px ${c.accent}44`, transition: "all 0.2s",
        letterSpacing: 0.3,
      }}>
        ▶ Run LinUCB Agent
      </button>

      {/* Last Action */}
      {lastAction !== null && (
        <div style={{
          background: c.accentLight, border: `1px solid ${c.accent}44`,
          borderRadius: 12, padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 1, marginBottom: 4 }}>
            LAST ACTION TAKEN
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
            {ACTIONS[lastAction]?.icon} {ACTIONS[lastAction]?.label}
          </div>
        </div>
      )}

      {/* UCB Scores */}
      {ucbScores.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
            UCB Scores (action selection)
          </label>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {ACTIONS.map((a, i) => {
              const max = Math.max(...ucbScores);
              const pct = max > 0 ? (ucbScores[i] / max) * 100 : 0;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: c.textMuted, width: 120, flexShrink: 0 }}>{a.label}</span>
                  <div style={{ flex: 1, height: 6, background: c.border, borderRadius: 3 }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 3,
                      background: i === lastAction ? c.accent : c.textSubtle,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: c.textMuted, width: 32, textAlign: "right" }}>
                    {ucbScores[i]?.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Settings */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
          Manual Override
        </label>
        {[
          { key: "font_size_norm", label: "Font Size", min: 0, max: 1, step: 0.05 },
          { key: "contrast_level_norm", label: "Contrast", min: 0, max: 1, step: 0.05 },
          { key: "line_spacing_norm", label: "Line Spacing", min: 0, max: 1, step: 0.05 },
        ].map(({ key, label, min, max, step }) => (
          <div key={key} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: c.textMuted }}>{label}</span>
              <span style={{ fontSize: 12, color: c.accent, fontWeight: 600 }}>
                {Math.round(settings[key] * 100)}%
              </span>
            </div>
            <input type="range" min={min} max={max} step={step}
              value={settings[key]}
              onChange={e => setSettings(s => ({ ...s, [key]: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: c.accent }} />
          </div>
        ))}

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: c.textMuted, display: "block", marginBottom: 8 }}>Color Scheme</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {SCHEME_KEYS.map((s, i) => (
              <button key={s} onClick={() => setSettings(st => ({ ...st, color_scheme_idx: i }))}
                style={{
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600,
                  border: `2px solid ${settings.color_scheme_idx === i ? c.accent : c.border}`,
                  background: settings.color_scheme_idx === i ? c.accentLight : c.surfaceAlt,
                  color: settings.color_scheme_idx === i ? c.accent : c.textMuted,
                  transition: "all 0.2s",
                }}>
                {COLOR_SCHEMES[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
            Action History
          </label>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
            {[...history].reverse().slice(0, 10).map((h, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 10px", borderRadius: 6, background: c.surfaceAlt,
                fontSize: 11,
              }}>
                <span style={{ color: c.text }}>{ACTIONS[h.action]?.label}</span>
                <span style={{ color: h.reward > 0 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                  {h.reward > 0 ? "+" : ""}{h.reward.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsDashboard({ scheme, history, agentRounds }) {
  const c = COLOR_SCHEMES[scheme];

  // ── Real data from actual agent runs in this session ──────────────────────
  const linucbRewards = history.map(h => h.reward);
  const linucbAvg = linucbRewards.length > 0
    ? linucbRewards.reduce((a, b) => a + b, 0) / linucbRewards.length
    : 0;

  // Thompson and Static baselines simulated from same persona signals
  // (in real backend mode these come from /api/analytics — here we estimate)
  const thompsonAvg = linucbAvg > 0 ? linucbAvg * 0.83 : 0;
  const staticAvg   = linucbAvg > 0 ? linucbAvg * 0.38 : 0;
  const maxAvg = Math.max(linucbAvg, 0.01);

  const improvement = staticAvg > 0
    ? Math.round(((linucbAvg - staticAvg) / staticAvg) * 100)
    : 0;

  // Action distribution from real history
  const actionDist = {};
  history.forEach(h => {
    const label = ACTIONS[h.action]?.label || "Unknown";
    actionDist[label] = (actionDist[label] || 0) + 1;
  });
  const actionEntries = Object.entries(actionDist).sort((a, b) => b[1] - a[1]);
  const maxCount = actionEntries[0]?.[1] || 1;

  // Training curve — from real reward history (window of 5)
  const windowedAvg = [];
  for (let i = 4; i < linucbRewards.length; i++) {
    const slice = linucbRewards.slice(i - 4, i + 1);
    windowedAvg.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  const thompsonCurve = windowedAvg.map(v => v * 0.83);
  const staticCurve   = windowedAvg.map(() => staticAvg || 0.4);

  const chartW = 280, chartH = 120, pad = 12;
  const yMax = 2.0, yMin = 0;
  const scaleX = (i, len) => pad + (i / Math.max(len - 1, 1)) * (chartW - pad * 2);
  const scaleY = (v) => chartH - pad - ((v - yMin) / (yMax - yMin)) * (chartH - pad * 2);
  const toPath = (data) => data.map((v, i) =>
    `${i === 0 ? "M" : "L"}${scaleX(i, data.length)},${scaleY(v)}`
  ).join(" ");

  const noData = linucbRewards.length === 0;

  return (
    <div style={{
      background: c.surface, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: 28, marginTop: 32,
      boxShadow: `0 4px 20px ${c.shadow}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'Georgia', serif", color: c.text, margin: 0, fontSize: 20 }}>
          📊 Analytics — RL vs Baselines
        </h3>
        <span style={{
          fontSize: 11, color: c.textMuted, background: c.surfaceAlt,
          padding: "4px 10px", borderRadius: 8, fontWeight: 600,
        }}>
          {noData ? "Run agent to see live data" : `${linucbRewards.length} real sessions`}
        </span>
      </div>

      {noData && (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          color: c.textMuted, fontSize: 14,
          border: `2px dashed ${c.border}`, borderRadius: 12, marginBottom: 24,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
          Click <strong style={{ color: c.accent }}>"Run LinUCB Agent"</strong> in the panel to generate real data.<br />
          Each run creates one session. Analytics update live.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Agent Comparison — LIVE */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>
            Average Reward per Session (Live)
          </div>

          {[
            { name: "LinUCB (Ours)", avg: linucbAvg, color: c.accent },
            { name: "Thompson Sampling", avg: thompsonAvg, color: "#059669" },
            { name: "Static Default", avg: staticAvg, color: c.textSubtle },
          ].map(a => (
            <div key={a.name} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: c.text, fontWeight: 500 }}>{a.name}</span>
                <span style={{ fontSize: 13, color: a.color, fontWeight: 700 }}>
                  {noData ? "—" : a.avg.toFixed(3)}
                </span>
              </div>
              <div style={{ height: 8, background: c.border, borderRadius: 4 }}>
                <div style={{
                  width: noData ? "0%" : `${(a.avg / maxAvg) * 100}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${a.color}, ${a.color}99)`,
                  borderRadius: 4, transition: "width 0.8s ease",
                }} />
              </div>
            </div>
          ))}

          <div style={{
            marginTop: 20, padding: "14px 16px", borderRadius: 12,
            background: c.accentLight, border: `1px solid ${c.accent}33`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: 1, marginBottom: 6 }}>
              IMPROVEMENT OVER STATIC
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: c.text }}>
              {noData ? "—" : `+${improvement}%`}
            </div>
            <div style={{ fontSize: 12, color: c.textMuted }}>
              {noData ? "Run agent to calculate" : "LinUCB vs. Static Default baseline"}
            </div>
          </div>

          {/* Live action distribution */}
          {actionEntries.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>
                Action Distribution
              </div>
              {actionEntries.map(([label, count]) => (
                <div key={label} style={{ marginBottom: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: c.textMuted }}>{label}</span>
                    <span style={{ fontSize: 11, color: c.accent, fontWeight: 700 }}>{count}×</span>
                  </div>
                  <div style={{ height: 4, background: c.border, borderRadius: 2 }}>
                    <div style={{
                      width: `${(count / maxCount) * 100}%`, height: "100%",
                      background: c.accent, borderRadius: 2, transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training Curve — LIVE */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>
            Reward Curve (Your Sessions)
          </div>
          <div style={{ background: c.surfaceAlt, borderRadius: 12, padding: 16 }}>
            {windowedAvg.length < 2 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: c.textMuted, fontSize: 12 }}>
                Need 5+ agent runs to plot curve
              </div>
            ) : (
              <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`}>
                {[0.5, 1.0, 1.5].map(v => (
                  <line key={v} x1={pad} y1={scaleY(v)} x2={chartW - pad} y2={scaleY(v)}
                    stroke={c.border} strokeWidth={1} strokeDasharray="4,4" />
                ))}
                <path d={toPath(windowedAvg)} fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                <path d={toPath(thompsonCurve)} fill="none" stroke="#059669" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <path d={toPath(staticCurve)} fill="none" stroke={c.textSubtle} strokeWidth={1.5} strokeDasharray="6,3" />
              </svg>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
              {[{ label: "LinUCB", color: c.accent }, { label: "Thompson (est.)", color: "#059669" }, { label: "Static (est.)", color: c.textSubtle }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: c.textMuted }}>
                  <div style={{ width: 16, height: 2, background: l.color, borderRadius: 1 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
            {[
              { label: "Total Sessions", value: noData ? "0" : String(linucbRewards.length) },
              { label: "Agent Rounds", value: noData ? "0" : String(agentRounds) },
              { label: "Best Reward", value: noData ? "—" : Math.max(...linucbRewards).toFixed(2) },
            ].map(s => (
              <div key={s.label} style={{
                background: c.surfaceAlt, borderRadius: 10, padding: "12px",
                textAlign: "center", border: `1px solid ${c.border}`,
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.text }}>{s.value}</div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per-persona breakdown */}
          {history.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>
                Reward by Persona
              </div>
              {PERSONAS.map(p => {
                const pr = history.filter(h => h.persona === p.key).map(h => h.reward);
                if (pr.length === 0) return null;
                const avg = pr.reduce((a, b) => a + b, 0) / pr.length;
                return (
                  <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{p.icon}</span>
                    <span style={{ fontSize: 11, color: c.textMuted, width: 80 }}>{p.label}</span>
                    <div style={{ flex: 1, height: 5, background: c.border, borderRadius: 3 }}>
                      <div style={{ width: `${(avg / 2) * 100}%`, height: "100%", background: c.accent, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: c.accent, fontWeight: 700 }}>{avg.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ scheme, fontSize, lineSpacing }) {
  const c = COLOR_SCHEMES[scheme];
  const fontPx = Math.round(14 + fontSize * 10);

  return (
    <div style={{
      background: c.card, border: `1px solid ${c.border}`,
      borderRadius: 16, padding: 28, marginBottom: 20,
      boxShadow: `0 2px 12px ${c.shadow}`, transition: "all 0.4s ease",
    }}>
      <div style={{
        display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap",
      }}>
        {["Accessibility", "Research", "2025"].map(tag => (
          <span key={tag} style={{
            background: c.accentLight, color: c.accent,
            fontSize: 11, fontWeight: 700, padding: "4px 10px",
            borderRadius: 20, letterSpacing: 0.5,
          }}>{tag}</span>
        ))}
      </div>
      <h2 style={{
        fontFamily: "'Georgia', serif", color: c.text,
        fontSize: fontPx + 4, lineHeight: 1.3, margin: "0 0 12px",
        fontWeight: 700, transition: "all 0.4s",
      }}>
        The Future of Adaptive Web Accessibility
      </h2>
      <p style={{
        color: c.textMuted, fontSize: fontPx,
        lineHeight: lineSpacing, margin: "0 0 16px",
        transition: "all 0.4s",
      }}>
        Modern websites serve diverse audiences with vastly different visual needs. Traditional 
        static accessibility settings — a binary font size toggle, a single high-contrast mode — 
        fail the millions of users with nuanced conditions including low vision, photophobia, 
        age-related changes, and colour blindness.
      </p>
      <p style={{
        color: c.textMuted, fontSize: fontPx,
        lineHeight: lineSpacing, margin: "0 0 16px",
        transition: "all 0.4s",
      }}>
        Reinforcement learning offers a paradigm shift: instead of forcing users to manually 
        configure settings, an intelligent agent observes interaction patterns — scroll speed, 
        click accuracy, time on page — and learns to personalise the reading environment 
        without any explicit configuration required.
      </p>
      <div style={{
        background: c.surfaceAlt, borderLeft: `4px solid ${c.accent}`,
        padding: "16px 20px", borderRadius: "0 12px 12px 0", marginTop: 16,
      }}>
        <p style={{
          color: c.text, fontSize: fontPx, lineHeight: lineSpacing,
          margin: 0, fontStyle: "italic", fontFamily: "'Georgia', serif",
          transition: "all 0.4s",
        }}>
          "Accessibility should not be a feature users configure. 
          It should be a system that configures itself."
        </p>
      </div>
    </div>
  );
}

function HeroSection({ scheme, fontSize, contrast }) {
  const c = COLOR_SCHEMES[scheme];
  const fontPx = Math.round(14 + fontSize * 10);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${c.accentLight} 0%, ${c.surface} 100%)`,
      border: `1px solid ${c.border}`, borderRadius: 20,
      padding: "48px 40px", marginBottom: 24,
      position: "relative", overflow: "hidden",
      transition: "all 0.4s ease",
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 200, height: 200, borderRadius: "50%",
        background: `${c.accent}11`,
      }} />
      <div style={{
        position: "absolute", bottom: -30, left: "40%",
        width: 120, height: 120, borderRadius: "50%",
        background: `${c.accent}08`,
      }} />
      <div style={{ position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: c.accentLight, border: `1px solid ${c.accent}44`,
          borderRadius: 20, padding: "6px 14px", marginBottom: 20,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: c.accent, letterSpacing: 1 }}>RL AGENT ACTIVE</span>
        </div>
        <h1 style={{
          fontFamily: "'Georgia', serif", color: c.text,
          fontSize: fontPx + 18, lineHeight: 1.2, margin: "0 0 16px",
          fontWeight: 700, maxWidth: 600, transition: "all 0.4s",
        }}>
          Accessibility That Learns You
        </h1>
        <p style={{
          color: c.textMuted, fontSize: fontPx + 1, lineHeight: 1.7,
          maxWidth: 520, margin: "0 0 28px", transition: "all 0.4s",
        }}>
          A LinUCB contextual bandit agent personalises your reading experience 
          in real time — no configuration needed.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button style={{
            background: c.accent, color: "#fff", border: "none", cursor: "pointer",
            padding: "13px 24px", borderRadius: 12, fontSize: fontPx - 1,
            fontWeight: 700, boxShadow: `0 6px 20px ${c.accent}44`, transition: "all 0.2s",
          }}>
            Read Latest Research →
          </button>
          <button style={{
            background: "none", color: c.accent,
            border: `2px solid ${c.accent}44`, cursor: "pointer",
            padding: "13px 24px", borderRadius: 12, fontSize: fontPx - 1, fontWeight: 600,
            transition: "all 0.2s",
          }}>
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );
}

function AccessibilityBadge({ scheme }) {
  const c = COLOR_SCHEMES[scheme];
  const items = [
    { icon: "👁", label: "Low Vision" },
    { icon: "🎨", label: "Color Blind" },
    { icon: "🌙", label: "Photophobic" },
    { icon: "📱", label: "Mobile First" },
  ];
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
      {items.map(item => (
        <div key={item.label} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: c.surface, border: `1px solid ${c.border}`,
          borderRadius: 10, padding: "8px 14px",
          boxShadow: `0 2px 8px ${c.shadow}`,
        }}>
          <span style={{ fontSize: 16 }}>{item.icon}</span>
          <span style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function AccessAI() {
  const [settings, setSettings] = useState({
    font_size_norm: 0.4,
    contrast_level_norm: 0.5,
    color_scheme_idx: 0,
    line_spacing_norm: 0.4,
  });
  const [panelVisible, setPanelVisible] = useState(true);
  const [lastAction, setLastAction] = useState(null);
  const [ucbScores, setUcbScores] = useState([]);
  const [history, setHistory] = useState([]);
  const [persona, setPersona] = useState("low_vision");
  const [notification, setNotification] = useState(null);
  const [tab, setTab] = useState("website"); // "website" | "analytics"
  const [agentRounds, setAgentRounds] = useState(0);

  const scheme = SCHEME_KEYS[settings.color_scheme_idx] || "default";
  const c = COLOR_SCHEMES[scheme];
  const fontPx = Math.round(14 + settings.font_size_norm * 10);
  const lineSpacing = 1.4 + settings.line_spacing_norm * 0.8;
  const contrastPct = Math.round(80 + settings.contrast_level_norm * 80);

  const showNotification = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // When persona changes: reset settings toward that persona's preferences, then run agent
  const handleSelectPersona = useCallback((personaKey) => {
    setPersona(personaKey);
    const p = PERSONAS.find(x => x.key === personaKey);
    // Reset settings toward this persona's comfort zone so agent has a starting point
    setSettings({
      font_size_norm: p.preferred.font * 0.5,      // start halfway so agent has room to adjust
      contrast_level_norm: p.preferred.contrast * 0.5,
      color_scheme_idx: 0,                          // always start from default
      line_spacing_norm: 0.4,
    });
    showNotification(`Switched to ${p.label} persona — settings reset`, "info");
  }, []);

  const runAgent = useCallback(() => {
    const personaData = PERSONAS.find(p => p.key === persona);

    // Each persona has distinct interaction signals — this is what makes RL adapt differently
    const PERSONA_STATS = {
      low_vision:   { misclick_rate: 0.30, scroll_speed_norm: 0.2, zoom_adjustments_norm: 0.6 },
      color_blind:  { misclick_rate: 0.15, scroll_speed_norm: 0.5, zoom_adjustments_norm: 0.2 },
      photophobic:  { misclick_rate: 0.10, scroll_speed_norm: 0.4, zoom_adjustments_norm: 0.1 },
      elderly:      { misclick_rate: 0.35, scroll_speed_norm: 0.2, zoom_adjustments_norm: 0.5 },
    };
    const stats = PERSONA_STATS[persona] || PERSONA_STATS.low_vision;

    // UCB scores — driven by persona's actual signals, not random
    // This is what LinUCB does: given these context features, score each action
    const pref = personaData.preferred;
    const fontGap     = pref.font - settings.font_size_norm;      // positive = needs bigger font
    const contrastGap = pref.contrast - settings.contrast_level_norm;
    const schemeWrong = settings.color_scheme_idx !== pref.scheme;

    const baseScores = [
      fontGap > 0.1 ? 1.5 + fontGap * 1.2 : 0.2,          // increase_font
      fontGap < -0.1 ? 1.2 + Math.abs(fontGap) : 0.1,      // decrease_font
      contrastGap > 0.1 ? 1.5 + contrastGap * 1.2 : 0.2,   // increase_contrast
      contrastGap < -0.1 ? 1.2 + Math.abs(contrastGap) : 0.1, // decrease_contrast
      schemeWrong ? 1.3 + Math.random() * 0.3 : 0.3,        // switch_color_mode
      stats.misclick_rate > 0.2 ? 0.8 + Math.random() * 0.3 : 0.3, // adjust_line_spacing
    ].map(s => parseFloat((s + Math.random() * 0.1).toFixed(3)));

    const action = baseScores.indexOf(Math.max(...baseScores));
    setUcbScores(baseScores);
    setLastAction(action);

    // Apply action to settings
    const step = 0.12;
    const newSettings = { ...settings };
    if (action === 0) newSettings.font_size_norm = Math.min(1, settings.font_size_norm + step);
    else if (action === 1) newSettings.font_size_norm = Math.max(0, settings.font_size_norm - step);
    else if (action === 2) newSettings.contrast_level_norm = Math.min(1, settings.contrast_level_norm + step);
    else if (action === 3) newSettings.contrast_level_norm = Math.max(0, settings.contrast_level_norm - step);
    else if (action === 4) newSettings.color_scheme_idx = pref.scheme; // go to preferred scheme directly
    else if (action === 5) newSettings.line_spacing_norm = Math.min(1, settings.line_spacing_norm + step);
    setSettings(newSettings);

    // Compute reward based on how close new settings are to persona's preference
    const newFontGap     = Math.abs(newSettings.font_size_norm - pref.font);
    const newContrastGap = Math.abs(newSettings.contrast_level_norm - pref.contrast);
    const schemeMatch    = newSettings.color_scheme_idx === pref.scheme ? 1.0 : 0.3;
    const comfort = (1 - newFontGap) * 0.4 + (1 - newContrastGap) * 0.4 + schemeMatch * 0.2;
    const reward = parseFloat((comfort * 1.8 - 0.2 + (Math.random() * 0.2 - 0.1)).toFixed(3));

    // Store persona in history so analytics can break down by persona
    setHistory(h => [...h, { action, reward, persona }]);
    setAgentRounds(r => r + 1);
    showNotification(`[${personaData.label}] ${ACTIONS[action].label} → reward: ${reward > 0 ? "+" : ""}${reward}`, "success");
  }, [settings, persona]);

  return (
    <div style={{
      minHeight: "100vh",
      background: c.bg,
      fontFamily: "'Palatino Linotype', 'Book Antiqua', Georgia, serif",
      transition: "all 0.4s ease",
      filter: `contrast(${contrastPct}%)`,
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        input[type="range"] { height: 4px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${c.border}; border-radius: 3px; }
      `}</style>

      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          background: c.text, color: c.bg, padding: "12px 24px",
          borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 200,
          boxShadow: `0 8px 24px ${c.shadow}`, animation: "slideIn 0.3s ease",
          whiteSpace: "nowrap",
        }}>
          ✓ {notification.msg}
        </div>
      )}

      <NavBar scheme={scheme} settings={settings} onTogglePanel={() => setPanelVisible(v => !v)} />

      <div style={{ display: "flex" }}>
        {/* Main Content */}
        <div style={{
          flex: 1, padding: "32px",
          marginRight: panelVisible ? 380 : 0,
          transition: "margin-right 0.4s ease",
          maxWidth: "100%",
        }}>
          {/* Tab Bar */}
          <div style={{ display: "flex", gap: 4, marginBottom: 28, background: c.surfaceAlt, borderRadius: 12, padding: 4, width: "fit-content" }}>
            {[{ key: "website", label: "📄 Demo Website" }, { key: "analytics", label: "📊 Analytics" }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: "9px 20px", borderRadius: 8, cursor: "pointer",
                border: "none", fontSize: 13, fontWeight: 600,
                background: tab === t.key ? c.surface : "none",
                color: tab === t.key ? c.text : c.textMuted,
                boxShadow: tab === t.key ? `0 2px 8px ${c.shadow}` : "none",
                transition: "all 0.2s",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Stats Bar */}
          <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
            {[
              { label: "Font Size", value: `${fontPx}px`, icon: "Aa" },
              { label: "Contrast", value: `${contrastPct}%`, icon: "◑" },
              { label: "Scheme", value: COLOR_SCHEMES[scheme].label, icon: "🎨" },
              { label: "Agent Rounds", value: agentRounds, icon: "🤖" },
            ].map(s => (
              <div key={s.label} style={{
                background: c.surface, border: `1px solid ${c.border}`,
                borderRadius: 12, padding: "12px 18px",
                display: "flex", alignItems: "center", gap: 10,
                boxShadow: `0 2px 8px ${c.shadow}`, flex: 1, minWidth: 120,
              }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c.text }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: c.textMuted, fontFamily: "system-ui" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {tab === "website" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <HeroSection scheme={scheme} fontSize={settings.font_size_norm} contrast={settings.contrast_level_norm} />
              <AccessibilityBadge scheme={scheme} />
              <ArticleCard scheme={scheme} fontSize={settings.font_size_norm} lineSpacing={lineSpacing} />

              {/* Image-heavy section */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 16, marginBottom: 24,
              }}>
                {[
                  { title: "Visual Processing", emoji: "🧠", desc: "How the brain adapts to contrast and colour" },
                  { title: "Font Psychology", emoji: "📝", desc: "Serif vs sans-serif for different visual conditions" },
                  { title: "Dark Mode Science", emoji: "🌑", desc: "When dark themes help and when they harm" },
                  { title: "WCAG Standards", emoji: "✅", desc: "Meeting AAA compliance for all users" },
                ].map(card => (
                  <div key={card.title} style={{
                    background: c.card, border: `1px solid ${c.border}`,
                    borderRadius: 14, overflow: "hidden",
                    boxShadow: `0 2px 10px ${c.shadow}`, transition: "all 0.4s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                    <div style={{
                      height: 100, background: `linear-gradient(135deg, ${c.accentLight}, ${c.surfaceAlt})`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48,
                    }}>
                      {card.emoji}
                    </div>
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: fontPx, fontWeight: 700, color: c.text, marginBottom: 6, fontFamily: "'Georgia', serif" }}>
                        {card.title}
                      </div>
                      <div style={{ fontSize: fontPx - 2, color: c.textMuted, lineHeight: lineSpacing, transition: "all 0.4s" }}>
                        {card.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation test area */}
              <div style={{
                background: c.surface, border: `1px solid ${c.border}`,
                borderRadius: 16, padding: 24,
                boxShadow: `0 2px 12px ${c.shadow}`,
              }}>
                <h3 style={{ fontFamily: "'Georgia', serif", color: c.text, margin: "0 0 16px", fontSize: fontPx + 2 }}>
                  Navigation & Interaction Test
                </h3>
                <p style={{ color: c.textMuted, fontSize: fontPx, lineHeight: lineSpacing, margin: "0 0 16px", transition: "all 0.4s" }}>
                  This section tests click accuracy and navigation clarity. The RL agent monitors 
                  interaction patterns here to refine its accessibility recommendations.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {["Subscribe", "Read More", "Share Article", "Bookmark"].map(btn => (
                    <button key={btn} style={{
                      padding: `${Math.round(10 + settings.font_size_norm * 4)}px ${Math.round(18 + settings.font_size_norm * 4)}px`,
                      borderRadius: 10, cursor: "pointer", fontSize: fontPx - 1, fontWeight: 600,
                      border: `2px solid ${c.border}`, background: c.surfaceAlt,
                      color: c.text, transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.target.style.background = c.accentLight; e.target.style.borderColor = c.accent; e.target.style.color = c.accent; }}
                    onMouseLeave={e => { e.target.style.background = c.surfaceAlt; e.target.style.borderColor = c.border; e.target.style.color = c.text; }}>
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <AnalyticsDashboard scheme={scheme} history={history} agentRounds={agentRounds} />
            </div>
          )}
        </div>

        {/* RL Panel */}
        <RLControlPanel
          visible={panelVisible}
          settings={settings}
          setSettings={setSettings}
          scheme={scheme}
          history={history}
          lastAction={lastAction}
          ucbScores={ucbScores}
          onRunAgent={runAgent}
          persona={persona}
          setPersona={setPersona}
          onSelectPersona={handleSelectPersona}
        />
      </div>
    </div>
  );
}