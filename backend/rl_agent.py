"""
LinUCB Contextual Bandit Agent for Accessibility Personalisation
CT-469 Reinforcement Learning — Project P15

Algorithm: LinUCB (Disjoint model) per user
Comparison: Thompson Sampling Contextual Bandit
"""

import numpy as np
import json
import os
import pickle
from dataclasses import dataclass, asdict
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# MDP Definition
# ─────────────────────────────────────────────

# State features (10-dim vector)
STATE_FEATURES = [
    "font_size_norm",        # current font size normalised [0,1]
    "contrast_level_norm",   # current contrast level [0,1]
    "color_scheme_idx",      # 0=default,1=dark,2=high-contrast,3=warm
    "line_spacing_norm",     # line spacing normalised [0,1]
    "scroll_speed_norm",     # user scroll speed (slow=0, fast=1)
    "misclick_rate",         # fraction of clicks that miss targets [0,1]
    "zoom_adjustments_norm", # how often user manually zooms [0,1]
    "time_on_page_norm",     # time spent on last page normalised [0,1]
    "content_type",          # 0=text-heavy, 1=image-heavy, 0.5=mixed
    "device_type",           # 0=desktop, 0.5=tablet, 1=mobile
]

STATE_DIM = len(STATE_FEATURES)

# Action space (6 discrete actions)
ACTIONS = {
    0: "increase_font",
    1: "decrease_font",
    2: "increase_contrast",
    3: "decrease_contrast",
    4: "switch_color_mode",
    5: "adjust_line_spacing",
}

N_ACTIONS = len(ACTIONS)

# Reward signal design (justified by accessibility domain knowledge)
# +time_on_page: longer engagement = comfortable reading experience
# +scroll_depth: user is reading through content, not bouncing
# +successful_clicks: accurate navigation = good visibility/sizing
# −bounces: user left immediately = poor config
# −zoom_adjustments: manual zoom = RL failed to pre-emptively adjust
# −misclick_penalty: user is struggling with current settings

def compute_reward(
    time_on_page: float,        # seconds, raw
    scroll_depth: float,        # 0.0–1.0
    successful_clicks: int,
    total_clicks: int,
    bounce: bool,
    zoom_adjustments: int,
    misclick_rate: float,
    baseline_time: float = 30.0,
) -> float:
    """
    Reward function for accessibility personalisation.

    Design justification:
    - Time on page is normalised against a baseline (30s) to avoid rewarding
      confusion-based long stays; capped at 2.0 to prevent outlier dominance.
    - Scroll depth directly measures content consumption.
    - Click accuracy measures whether font/contrast settings allow precise interaction.
    - Bounce penalty is large (-2) because it is a strong signal of discomfort.
    - Zoom adjustments are penalised because they indicate the RL agent failed to
      pre-emptively set the right magnification — each manual correction = failure.
    - Misclick rate is penalised proportionally; high misclick = poor visual config.
    """
    # Positive signals
    time_reward = min(time_on_page / baseline_time, 2.0)           # cap at 2x baseline
    scroll_reward = scroll_depth                                     # [0, 1]
    click_acc = (successful_clicks / max(total_clicks, 1))          # [0, 1]

    # Negative signals
    bounce_penalty = -2.0 if bounce else 0.0
    zoom_penalty = -0.3 * min(zoom_adjustments, 5)                  # cap at 5 adjustments
    misclick_penalty = -misclick_rate                                 # [0, -1]

    reward = (
        0.4 * time_reward
        + 0.3 * scroll_reward
        + 0.2 * click_acc
        + bounce_penalty
        + zoom_penalty
        + misclick_penalty
    )

    return float(np.clip(reward, -3.0, 3.0))


# ─────────────────────────────────────────────
# LinUCB Disjoint Model
# ─────────────────────────────────────────────

class LinUCBAgent:
    """
    LinUCB Disjoint Contextual Bandit.

    For each action a, maintains:
        A_a : (d x d) regularisation matrix  (starts as identity)
        b_a : (d x 1) reward vector

    UCB score for action a given context x:
        theta_a = A_a^{-1} b_a
        p_a     = theta_a^T x + alpha * sqrt(x^T A_a^{-1} x)

    Reference: Li et al. (2010) "A Contextual-Bandit Approach to
    Personalised News Article Recommendation"
    """

    def __init__(self, n_actions: int, state_dim: int, alpha: float = 1.0):
        self.n_actions = n_actions
        self.state_dim = state_dim
        self.alpha = alpha  # exploration parameter

        # Per-action parameters
        self.A = [np.identity(state_dim) for _ in range(n_actions)]
        self.b = [np.zeros(state_dim) for _ in range(n_actions)]

        self.total_rounds = 0
        self.action_counts = np.zeros(n_actions)
        self.cumulative_reward = 0.0
        self.reward_history = []

    def select_action(self, state: np.ndarray) -> int:
        """Select action with highest UCB score."""
        x = state.reshape(-1)
        ucb_scores = []

        for a in range(self.n_actions):
            A_inv = np.linalg.inv(self.A[a])
            theta = A_inv @ self.b[a]
            exploration_bonus = self.alpha * np.sqrt(x @ A_inv @ x)
            ucb_scores.append(theta @ x + exploration_bonus)

        return int(np.argmax(ucb_scores))

    def update(self, action: int, state: np.ndarray, reward: float):
        """Update model parameters with observed reward."""
        x = state.reshape(-1)
        self.A[action] += np.outer(x, x)
        self.b[action] += reward * x

        self.total_rounds += 1
        self.action_counts[action] += 1
        self.cumulative_reward += reward
        self.reward_history.append(reward)

    def get_ucb_scores(self, state: np.ndarray) -> list:
        x = state.reshape(-1)
        scores = []
        for a in range(self.n_actions):
            A_inv = np.linalg.inv(self.A[a])
            theta = A_inv @ self.b[a]
            scores.append(float(theta @ x + self.alpha * np.sqrt(x @ A_inv @ x)))
        return scores

    def save(self, path: str):
        with open(path, "wb") as f:
            pickle.dump({"A": self.A, "b": self.b,
                         "alpha": self.alpha,
                         "total_rounds": self.total_rounds,
                         "action_counts": self.action_counts,
                         "cumulative_reward": self.cumulative_reward,
                         "reward_history": self.reward_history}, f)
        logger.info(f"LinUCB model saved to {path}")

    def load(self, path: str):
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.A = data["A"]
        self.b = data["b"]
        self.alpha = data["alpha"]
        self.total_rounds = data["total_rounds"]
        self.action_counts = data["action_counts"]
        self.cumulative_reward = data["cumulative_reward"]
        self.reward_history = data["reward_history"]
        logger.info(f"LinUCB model loaded from {path}")


# ─────────────────────────────────────────────
# Thompson Sampling Baseline
# ─────────────────────────────────────────────

class ThompsonSamplingAgent:
    """
    Thompson Sampling Contextual Bandit (Gaussian).

    Maintains Bayesian posterior for each action:
        mu_a  ~ N(mu_0, sigma_0^2)
    
    At each round, samples theta from posterior and picks argmax.
    Used as the comparison baseline against LinUCB.
    """

    def __init__(self, n_actions: int, state_dim: int):
        self.n_actions = n_actions
        self.state_dim = state_dim

        self.mu = [np.zeros(state_dim) for _ in range(n_actions)]
        self.sigma = [np.identity(state_dim) for _ in range(n_actions)]
        self.counts = np.zeros(n_actions)

        self.total_rounds = 0
        self.cumulative_reward = 0.0
        self.reward_history = []

    def select_action(self, state: np.ndarray) -> int:
        x = state.reshape(-1)
        scores = []
        for a in range(self.n_actions):
            theta_sample = np.random.multivariate_normal(self.mu[a], self.sigma[a])
            scores.append(theta_sample @ x)
        return int(np.argmax(scores))

    def update(self, action: int, state: np.ndarray, reward: float):
        x = state.reshape(-1)
        n = self.counts[action] + 1
        self.mu[action] = (self.mu[action] * self.counts[action] + reward * x) / n
        self.counts[action] = n
        self.total_rounds += 1
        self.cumulative_reward += reward
        self.reward_history.append(reward)

    def save(self, path: str):
        with open(path, "wb") as f:
            pickle.dump(self.__dict__, f)

    def load(self, path: str):
        with open(path, "rb") as f:
            self.__dict__ = pickle.load(f)


# ─────────────────────────────────────────────
# Static Default Baseline (no RL)
# ─────────────────────────────────────────────

class StaticDefaultAgent:
    """Always returns the same default accessibility settings. Used as the weakest baseline."""

    DEFAULT_ACTION = 2  # increase_contrast as safe universal default

    def select_action(self, state: np.ndarray) -> int:
        return self.DEFAULT_ACTION

    def update(self, *args, **kwargs):
        pass


# ─────────────────────────────────────────────
# User Simulator (for training without real users)
# ─────────────────────────────────────────────

@dataclass
class UserPersona:
    name: str
    preferred_font_size: float     # 0=small, 1=large
    preferred_contrast: float      # 0=low, 1=high
    preferred_color_scheme: int    # 0-3
    scroll_speed: float
    misclick_baseline: float
    zoom_tendency: float           # how often they manually zoom

PERSONAS = {
    "low_vision": UserPersona(
        name="Low Vision",
        preferred_font_size=0.9,
        preferred_contrast=0.8,
        preferred_color_scheme=2,  # high-contrast
        scroll_speed=0.3,
        misclick_baseline=0.3,
        zoom_tendency=0.6,
    ),
    "color_blind": UserPersona(
        name="Color Blind",
        preferred_font_size=0.5,
        preferred_contrast=0.7,
        preferred_color_scheme=1,  # dark mode
        scroll_speed=0.5,
        misclick_baseline=0.15,
        zoom_tendency=0.2,
    ),
    "photophobic": UserPersona(
        name="Photophobic",
        preferred_font_size=0.5,
        preferred_contrast=0.3,
        preferred_color_scheme=1,  # dark mode
        scroll_speed=0.4,
        misclick_baseline=0.1,
        zoom_tendency=0.1,
    ),
    "elderly": UserPersona(
        name="Elderly",
        preferred_font_size=0.85,
        preferred_contrast=0.75,
        preferred_color_scheme=0,  # default (familiar)
        scroll_speed=0.2,
        misclick_baseline=0.35,
        zoom_tendency=0.5,
    ),
}


class UserSimulator:
    """
    Simulates user interaction feedback given accessibility settings and a persona.
    Returns realistic engagement metrics used to compute reward.
    """

    def __init__(self, persona: UserPersona, noise: float = 0.1):
        self.persona = persona
        self.noise = noise

    def respond(self, settings: dict) -> dict:
        """Given current settings, simulate user engagement metrics."""
        p = self.persona

        font_match = 1 - abs(settings["font_size_norm"] - p.preferred_font_size)
        contrast_match = 1 - abs(settings["contrast_level_norm"] - p.preferred_contrast)
        color_match = 1.0 if settings["color_scheme_idx"] == p.preferred_color_scheme else 0.3
        comfort = (font_match * 0.4 + contrast_match * 0.4 + color_match * 0.2)

        noise = lambda: np.random.normal(0, self.noise)

        time_on_page = max(5.0, 60 * comfort + noise() * 10)
        scroll_depth = min(1.0, max(0.0, comfort * 0.9 + noise()))
        misclick_rate = max(0.0, p.misclick_baseline * (1 - comfort) + noise() * 0.05)
        zoom_adjustments = int(max(0, np.random.poisson(p.zoom_tendency * (1 - comfort) * 3)))
        total_clicks = np.random.randint(5, 20)
        successful_clicks = int(total_clicks * (1 - misclick_rate))
        bounce = comfort < 0.25

        return {
            "time_on_page": time_on_page,
            "scroll_depth": scroll_depth,
            "misclick_rate": misclick_rate,
            "zoom_adjustments": zoom_adjustments,
            "total_clicks": total_clicks,
            "successful_clicks": successful_clicks,
            "bounce": bounce,
        }
