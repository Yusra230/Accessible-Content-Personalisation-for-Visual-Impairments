"""
FastAPI Backend — CT-469 Project P15
Serves accessibility recommendations via REST API.
Connects RL agent to the frontend website.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
import os
import json
import pickle
import logging
from datetime import datetime
import uuid

from rl_agent import (
    LinUCBAgent, ThompsonSamplingAgent,
    N_ACTIONS, STATE_DIM, ACTIONS, compute_reward
)
from environment import AccessibilitySettings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AccessAI — RL Accessibility API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
SESSIONS_FILE = os.path.join(MODELS_DIR, "sessions.json")

# ─── Load or init agents ───────────────────────────────────────────────────────

linucb = LinUCBAgent(N_ACTIONS, STATE_DIM, alpha=1.0)
thompson = ThompsonSamplingAgent(N_ACTIONS, STATE_DIM)

def load_models():
    lp = os.path.join(MODELS_DIR, "linucb.pkl")
    tp = os.path.join(MODELS_DIR, "thompson.pkl")
    if os.path.exists(lp):
        linucb.load(lp)
        logger.info("LinUCB model loaded")
    if os.path.exists(tp):
        thompson.load(tp)
        logger.info("Thompson Sampling model loaded")

load_models()

# In-memory session store
sessions: dict = {}
analytics_log: list = []

# ─── Schemas ──────────────────────────────────────────────────────────────────

class StateRequest(BaseModel):
    user_id: str
    font_size_norm: float = 0.4
    contrast_level_norm: float = 0.5
    color_scheme_idx: int = 0
    line_spacing_norm: float = 0.4
    scroll_speed_norm: float = 0.5
    misclick_rate: float = 0.1
    zoom_adjustments_norm: float = 0.0
    time_on_page_norm: float = 0.3
    content_type: float = 0.0
    device_type: float = 0.0
    agent: str = "linucb"  # "linucb" | "thompson" | "static"

class RewardRequest(BaseModel):
    user_id: str
    session_id: str
    action: int
    time_on_page: float
    scroll_depth: float
    successful_clicks: int
    total_clicks: int
    bounce: bool
    zoom_adjustments: int
    misclick_rate: float

class SettingsState(BaseModel):
    font_size_norm: float
    contrast_level_norm: float
    color_scheme_idx: int
    line_spacing_norm: float

# ─── Helpers ──────────────────────────────────────────────────────────────────

def build_state_vector(req: StateRequest) -> np.ndarray:
    return np.array([
        req.font_size_norm,
        req.contrast_level_norm,
        req.color_scheme_idx / 3.0,
        req.line_spacing_norm,
        req.scroll_speed_norm,
        req.misclick_rate,
        req.zoom_adjustments_norm,
        req.time_on_page_norm,
        req.content_type,
        req.device_type,
    ], dtype=np.float64)

def settings_to_css(font_norm: float, contrast_norm: float, scheme: int, spacing_norm: float) -> dict:
    """Convert normalised settings to actual CSS values."""
    font_px = int(14 + font_norm * 10)  # 14–24px
    contrast_pct = int(80 + contrast_norm * 80)  # 80–160%
    schemes = ["default", "dark", "high-contrast", "warm"]
    spacing = round(1.4 + spacing_norm * 0.8, 2)  # 1.4–2.2

    return {
        "font_size": f"{font_px}px",
        "contrast": f"{contrast_pct}%",
        "color_scheme": schemes[scheme % 4],
        "line_spacing": spacing,
        "font_size_px": font_px,
        "contrast_pct": contrast_pct,
    }

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "project": "CT-469 P15 AccessAI"}

@app.post("/api/recommend")
def recommend_action(req: StateRequest):
    """Get RL-recommended accessibility action for a user."""
    state = build_state_vector(req)

    if req.agent == "linucb":
        action = linucb.select_action(state)
        ucb_scores = linucb.get_ucb_scores(state)
    elif req.agent == "thompson":
        action = thompson.select_action(state)
        ucb_scores = []
    else:
        action = 2  # static default
        ucb_scores = []

    # Apply action to current settings using environment's AccessibilitySettings
    current = AccessibilitySettings(
        font_size_norm=req.font_size_norm,
        contrast_level_norm=req.contrast_level_norm,
        color_scheme_idx=req.color_scheme_idx,
        line_spacing_norm=req.line_spacing_norm,
    )
    updated = current.apply_action(action)
    new_settings = {
        "font_size_norm": updated.font_size_norm,
        "contrast_level_norm": updated.contrast_level_norm,
        "color_scheme_idx": updated.color_scheme_idx,
        "line_spacing_norm": updated.line_spacing_norm,
    }
    css = settings_to_css(
        updated.font_size_norm,
        updated.contrast_level_norm,
        updated.color_scheme_idx,
        updated.line_spacing_norm,
    )

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "user_id": req.user_id,
        "action": action,
        "state": state.tolist(),
        "settings": new_settings,
        "agent": req.agent,
        "timestamp": datetime.utcnow().isoformat(),
    }

    return {
        "session_id": session_id,
        "action": action,
        "action_name": ACTIONS[action],
        "new_settings": new_settings,
        "css_values": css,
        "ucb_scores": ucb_scores,
        "agent": req.agent,
    }

@app.post("/api/reward")
def submit_reward(req: RewardRequest):
    """Submit interaction feedback to update the RL agent."""
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[req.session_id]
    state = np.array(session["state"])

    reward = compute_reward(
        time_on_page=req.time_on_page,
        scroll_depth=req.scroll_depth,
        successful_clicks=req.successful_clicks,
        total_clicks=req.total_clicks,
        bounce=req.bounce,
        zoom_adjustments=req.zoom_adjustments,
        misclick_rate=req.misclick_rate,
    )

    agent_name = session.get("agent", "linucb")
    if agent_name == "linucb":
        linucb.update(req.action, state, reward)
    elif agent_name == "thompson":
        thompson.update(req.action, state, reward)

    # Log for analytics
    analytics_log.append({
        "user_id": req.user_id,
        "agent": agent_name,
        "action": req.action,
        "action_name": ACTIONS[req.action],
        "reward": reward,
        "time_on_page": req.time_on_page,
        "scroll_depth": req.scroll_depth,
        "bounce": req.bounce,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Persist models periodically
    if linucb.total_rounds % 10 == 0:
        linucb.save(os.path.join(MODELS_DIR, "linucb.pkl"))

    return {"reward": reward, "total_rounds": linucb.total_rounds}

@app.get("/api/analytics")
def get_analytics():
    """Return analytics comparing RL vs baseline engagement."""
    if not analytics_log:
        # Return mock data if no real sessions yet
        return _mock_analytics()

    by_agent = {"linucb": [], "thompson": [], "static": []}
    for entry in analytics_log:
        a = entry.get("agent", "linucb")
        if a in by_agent:
            by_agent[a].append(entry["reward"])

    result = {}
    for agent, rewards in by_agent.items():
        if rewards:
            result[agent] = {
                "avg_reward": round(float(np.mean(rewards)), 4),
                "total_sessions": len(rewards),
                "cumulative_reward": round(float(np.sum(rewards)), 2),
                "recent_avg": round(float(np.mean(rewards[-20:])), 4),
            }

    action_dist = {}
    for entry in analytics_log[-100:]:
        a = entry["action_name"]
        action_dist[a] = action_dist.get(a, 0) + 1

    return {
        "agent_comparison": result,
        "action_distribution": action_dist,
        "total_interactions": len(analytics_log),
        "recent_rewards": [e["reward"] for e in analytics_log[-50:]],
    }

@app.get("/api/training-metrics")
def get_training_metrics():
    """Return saved training curve data."""
    path = os.path.join(MODELS_DIR, "training_metrics.json")
    if not os.path.exists(path):
        return {"error": "No training metrics found. Run train.py first."}
    with open(path) as f:
        return json.load(f)

@app.get("/api/model-info")
def get_model_info():
    return {
        "linucb": {
            "total_rounds": linucb.total_rounds,
            "action_counts": linucb.action_counts.tolist(),
            "cumulative_reward": round(linucb.cumulative_reward, 2),
            "alpha": linucb.alpha,
        },
        "thompson": {
            "total_rounds": thompson.total_rounds,
            "cumulative_reward": round(thompson.cumulative_reward, 2),
        }
    }

def _mock_analytics():
    """Return realistic mock data for demo purposes."""
    return {
        "agent_comparison": {
            "linucb":   {"avg_reward": 1.42, "total_sessions": 320, "cumulative_reward": 454.4, "recent_avg": 1.61},
            "thompson": {"avg_reward": 1.18, "total_sessions": 320, "cumulative_reward": 377.6, "recent_avg": 1.31},
            "static":   {"avg_reward": 0.54, "total_sessions": 320, "cumulative_reward": 172.8, "recent_avg": 0.54},
        },
        "action_distribution": {
            "increase_font": 87,
            "increase_contrast": 112,
            "switch_color_mode": 64,
            "adjust_line_spacing": 43,
            "decrease_contrast": 18,
            "decrease_font": 12,
        },
        "total_interactions": 960,
        "recent_rewards": list(np.random.normal(1.4, 0.3, 50).clip(-1, 3)),
    }