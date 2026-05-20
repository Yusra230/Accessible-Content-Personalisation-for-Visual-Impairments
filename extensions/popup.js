/**
 * popup.js — AccessAI Browser Extension
 * Connects to the local FastAPI backend (localhost:8000) to get
 * RL-recommended accessibility settings and applies them to the active tab.
 */

const API_BASE = "http://localhost:8000/api";

// State
let state = {
  font_size_norm: 0.4,
  contrast_level_norm: 0.5,
  color_scheme_idx: 0,
  line_spacing_norm: 0.4,
};
let rounds = 0;
let currentSessionId = null;
let autoMode = true;
const userId = "extension_user_" + (localStorage.getItem("ext_uid") || (() => {
  const id = Math.random().toString(36).slice(2);
  localStorage.setItem("ext_uid", id);
  return id;
})());

// ── DOM refs ──────────────────────────────────────────────────────────────────

const runBtn = document.getElementById("runBtn");
const autoToggle = document.getElementById("autoToggle");
const fontSlider = document.getElementById("fontSlider");
const contrastSlider = document.getElementById("contrastSlider");
const spacingSlider = document.getElementById("spacingSlider");
const fontVal = document.getElementById("fontVal");
const contrastVal = document.getElementById("contrastVal");
const spacingVal = document.getElementById("spacingVal");
const roundsCount = document.getElementById("roundsCount");
const lastReward = document.getElementById("lastReward");
const lastActionText = document.getElementById("lastActionText");
const lastActionBox = document.getElementById("lastActionBox");
const schemeBtns = document.querySelectorAll(".scheme-btn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateSliderDisplay() {
  fontVal.textContent = Math.round(14 + state.font_size_norm * 10) + "px";
  contrastVal.textContent = Math.round(80 + state.contrast_level_norm * 80) + "%";
  spacingVal.textContent = (1.4 + state.line_spacing_norm * 0.8).toFixed(1);
}

function applyToPage(settings) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (s) => {
        const fontPx = Math.round(14 + s.font_size_norm * 10);
        const contrastPct = Math.round(80 + s.contrast_level_norm * 80);
        const spacing = (1.4 + s.line_spacing_norm * 0.8).toFixed(2);
        const schemes = {
          0: { bg: null, color: null, filter: null },
          1: { filter: "invert(1) hue-rotate(180deg)" },
          2: { filter: "contrast(200%) saturate(0)" },
          3: { filter: "sepia(30%) contrast(110%)" },
        };

        // Inject or update style tag
        let styleEl = document.getElementById("accessai-ext-style");
        if (!styleEl) {
          styleEl = document.createElement("style");
          styleEl.id = "accessai-ext-style";
          document.head.appendChild(styleEl);
        }

        const schemeFilter = schemes[s.color_scheme_idx]?.filter;
        styleEl.textContent = `
          body, p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, a {
            font-size: ${fontPx}px !important;
            line-height: ${spacing} !important;
          }
          html {
            filter: contrast(${contrastPct}%) ${schemeFilter ? schemeFilter : ""} !important;
          }
        `;
      },
      args: [settings],
    });
  });
}

async function runAgent() {
  runBtn.disabled = true;
  runBtn.textContent = "⏳ Asking agent...";
  statusText.textContent = "Fetching recommendation...";

  try {
    const res = await fetch(`${API_BASE}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        ...state,
        scroll_speed_norm: 0.4,
        misclick_rate: 0.15,
        zoom_adjustments_norm: 0.1,
        time_on_page_norm: 0.5,
        content_type: 0.0,
        device_type: 0.0,
        agent: "linucb",
      }),
    });

    if (!res.ok) throw new Error("Backend offline");
    const data = await res.json();

    currentSessionId = data.session_id;
    state = { ...data.new_settings };

    // Update sliders
    fontSlider.value = state.font_size_norm;
    contrastSlider.value = state.contrast_level_norm;
    spacingSlider.value = state.line_spacing_norm;
    schemeBtns.forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.scheme) === state.color_scheme_idx);
    });
    updateSliderDisplay();
    applyToPage(state);

    lastActionBox.style.display = "block";
    lastActionText.textContent = `${getActionIcon(data.action)} ${data.action_name.replace(/_/g, " ")}`;
    rounds++;
    roundsCount.textContent = rounds;
    statusText.textContent = "Agent active on this page";
    statusDot.classList.remove("off");

    // Submit reward after 3 seconds
    setTimeout(() => submitReward(data.action), 3000);

  } catch (err) {
    statusText.textContent = "Backend offline — manual mode";
    statusDot.classList.add("off");
    applyToPage(state);
  }

  runBtn.disabled = false;
  runBtn.textContent = "▶ Run Agent Now";
}

async function submitReward(action) {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`${API_BASE}/reward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        session_id: currentSessionId,
        action,
        time_on_page: 20 + Math.random() * 40,
        scroll_depth: 0.4 + Math.random() * 0.5,
        successful_clicks: Math.floor(5 + Math.random() * 10),
        total_clicks: 12,
        bounce: false,
        zoom_adjustments: Math.floor(Math.random() * 2),
        misclick_rate: 0.05 + Math.random() * 0.15,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      lastReward.textContent = `+${data.reward.toFixed(2)}`;
      lastReward.style.color = data.reward > 0 ? "#22c55e" : "#ef4444";
    }
  } catch {}
}

function getActionIcon(action) {
  return ["A↑","A↓","◐↑","◐↓","◑","↕"][action] || "?";
}

// ── Events ────────────────────────────────────────────────────────────────────

runBtn.addEventListener("click", runAgent);

autoToggle.addEventListener("click", () => {
  autoMode = !autoMode;
  autoToggle.classList.toggle("on", autoMode);
});

fontSlider.addEventListener("input", () => {
  state.font_size_norm = parseFloat(fontSlider.value);
  updateSliderDisplay();
  applyToPage(state);
});

contrastSlider.addEventListener("input", () => {
  state.contrast_level_norm = parseFloat(contrastSlider.value);
  updateSliderDisplay();
  applyToPage(state);
});

spacingSlider.addEventListener("input", () => {
  state.line_spacing_norm = parseFloat(spacingSlider.value);
  updateSliderDisplay();
  applyToPage(state);
});

schemeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    state.color_scheme_idx = parseInt(btn.dataset.scheme);
    schemeBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    applyToPage(state);
  });
});

// Init
updateSliderDisplay();
if (autoMode) runAgent();
