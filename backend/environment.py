"""
environment.py — Custom Accessibility RL Environment

Models the web accessibility personalisation problem as a structured
contextual bandit environment. Reproducible with a fixed random seed.

This is separate from the agent (rl_agent.py) — it defines the world,
not the learner. Following standard gym-like interface.
"""

import numpy as np
from dataclasses import dataclass
from typing import Tuple, Dict, Optional

# ─── Environment Constants ────────────────────────────────────────────────────

N_ACTIONS = 6
STATE_DIM = 10

ACTION_NAMES = {
    0: "increase_font",
    1: "decrease_font",
    2: "increase_contrast",
    3: "decrease_contrast",
    4: "switch_color_mode",
    5: "adjust_line_spacing",
}

# Settings bounds
FONT_MIN, FONT_MAX = 0.0, 1.0        # normalised; maps to 14–24px
CONTRAST_MIN, CONTRAST_MAX = 0.0, 1.0
SCHEME_OPTIONS = [0, 1, 2, 3]        # default, dark, high-contrast, warm
SPACING_MIN, SPACING_MAX = 0.0, 1.0
STEP = 0.1


@dataclass
class AccessibilitySettings:
    """Current accessibility configuration applied to the website."""
    font_size_norm: float = 0.4
    contrast_level_norm: float = 0.5
    color_scheme_idx: int = 0
    line_spacing_norm: float = 0.4

    def to_vector_components(self) -> list:
        return [
            self.font_size_norm,
            self.contrast_level_norm,
            self.color_scheme_idx / 3.0,
            self.line_spacing_norm,
        ]

    def apply_action(self, action: int) -> "AccessibilitySettings":
        """Return new settings after applying action. Pure function — no mutation."""
        f = self.font_size_norm
        c = self.contrast_level_norm
        s = self.color_scheme_idx
        sp = self.line_spacing_norm

        if action == 0: f = min(FONT_MAX, f + STEP)
        elif action == 1: f = max(FONT_MIN, f - STEP)
        elif action == 2: c = min(CONTRAST_MAX, c + STEP)
        elif action == 3: c = max(CONTRAST_MIN, c - STEP)
        elif action == 4: s = (s + 1) % 4
        elif action == 5: sp = min(SPACING_MAX, sp + STEP)

        return AccessibilitySettings(f, c, s, sp)

    def to_css(self) -> dict:
        """Convert normalised settings to actual CSS values for the frontend."""
        return {
            "font_size_px": int(14 + self.font_size_norm * 10),
            "contrast_pct": int(80 + self.contrast_level_norm * 80),
            "color_scheme": ["default", "dark", "high-contrast", "warm"][self.color_scheme_idx],
            "line_height": round(1.4 + self.line_spacing_norm * 0.8, 2),
        }


@dataclass
class UserContext:
    """Observed user interaction signals that form part of the state."""
    scroll_speed_norm: float = 0.5
    misclick_rate: float = 0.1
    zoom_adjustments_norm: float = 0.0
    time_on_page_norm: float = 0.3
    content_type: float = 0.0      # 0=text-heavy, 1=image-heavy
    device_type: float = 0.0       # 0=desktop, 1=mobile


class AccessibilityEnv:
    """
    Custom Accessibility Personalisation Environment.

    Implements a contextual bandit problem (no episode structure,
    immediate reward, no state transitions between rounds).

    Interface mirrors OpenAI Gym but simplified for contextual bandits:
        env.reset(user_context) → state
        env.step(action)        → (next_state, reward, info)

    Reproducible: always call env = AccessibilityEnv(seed=42) for consistent results.
    """

    def __init__(self, seed: int = 42):
        self.rng = np.random.default_rng(seed)
        self.settings = AccessibilitySettings()
        self.context = UserContext()
        self.step_count = 0
        self.episode_rewards = []

        # For logging
        self._last_action = None
        self._last_reward = None

    def reset(self, context: Optional[UserContext] = None) -> np.ndarray:
        """
        Reset environment for a new user session.
        Returns the initial state vector.
        """
        self.settings = AccessibilitySettings()  # default settings
        self.context = context or UserContext()
        self.step_count = 0
        return self._build_state()

    def step(self, action: int, user_response: Optional[dict] = None) -> Tuple[np.ndarray, float, dict]:
        """
        Apply action, simulate or receive user response, compute reward.

        Args:
            action:        integer in [0, N_ACTIONS)
            user_response: real engagement dict from frontend (or None → simulate)

        Returns:
            (next_state, reward, info)
        """
        assert 0 <= action < N_ACTIONS, f"Invalid action {action}"

        old_settings = self.settings
        self.settings = self.settings.apply_action(action)
        self.step_count += 1

        if user_response is not None:
            reward = self._compute_reward_from_response(user_response)
        else:
            reward = self._simulate_reward(self.settings, self.context)

        self._last_action = action
        self._last_reward = reward
        self.episode_rewards.append(reward)

        next_state = self._build_state()
        info = {
            "action_name": ACTION_NAMES[action],
            "css_values": self.settings.to_css(),
            "old_settings": old_settings,
            "new_settings": self.settings,
            "step": self.step_count,
        }

        return next_state, reward, info

    def _build_state(self) -> np.ndarray:
        """Construct 10-dimensional state vector."""
        return np.array(
            self.settings.to_vector_components() + [
                self.context.scroll_speed_norm,
                self.context.misclick_rate,
                self.context.zoom_adjustments_norm,
                self.context.time_on_page_norm,
                self.context.content_type,
                self.context.device_type,
            ],
            dtype=np.float64,
        )

    @staticmethod
    def _compute_reward_from_response(r: dict) -> float:
        """Compute reward from real frontend engagement data."""
        time_reward = min(r.get("time_on_page", 10) / 30.0, 2.0)
        scroll_reward = r.get("scroll_depth", 0.3)
        total_clicks = max(r.get("total_clicks", 1), 1)
        click_acc = r.get("successful_clicks", 0) / total_clicks
        bounce_penalty = -2.0 if r.get("bounce", False) else 0.0
        zoom_penalty = -0.3 * min(r.get("zoom_adjustments", 0), 5)
        misclick_penalty = -r.get("misclick_rate", 0.1)

        reward = (
            0.4 * time_reward
            + 0.3 * scroll_reward
            + 0.2 * click_acc
            + bounce_penalty
            + zoom_penalty
            + misclick_penalty
        )
        return float(np.clip(reward, -3.0, 3.0))

    def _simulate_reward(self, settings: AccessibilitySettings, context: UserContext) -> float:
        """
        Simulate reward for a given settings + user context combination.
        Used during training when real users are unavailable.

        Comfort is modelled as a Gaussian around the user's implicit
        preferred settings, inferred from the context signals.
        """
        # Infer preferences from context signals (domain heuristics)
        pref_font = context.misclick_rate * 0.8 + 0.3          # high misclick → needs bigger font
        pref_contrast = 1.0 - context.scroll_speed_norm * 0.3   # slow scroller → needs more contrast
        pref_scheme = 1 if context.zoom_adjustments_norm > 0.4 else 0  # frequent zoom → dark mode

        font_comfort = 1 - abs(settings.font_size_norm - pref_font)
        contrast_comfort = 1 - abs(settings.contrast_level_norm - pref_contrast)
        scheme_comfort = 1.0 if settings.color_scheme_idx == pref_scheme else 0.4
        overall_comfort = 0.4 * font_comfort + 0.4 * contrast_comfort + 0.2 * scheme_comfort

        noise = self.rng.normal(0, 0.08)
        time_on_page = max(5.0, 60 * overall_comfort + noise * 10)
        scroll_depth = float(np.clip(overall_comfort * 0.9 + noise, 0, 1))
        misclick_rate = float(np.clip(context.misclick_rate * (1 - overall_comfort) + abs(noise) * 0.05, 0, 1))
        zoom_adj = int(max(0, self.rng.poisson(context.zoom_adjustments_norm * (1 - overall_comfort) * 3)))
        total_clicks = int(self.rng.integers(5, 20))
        successful_clicks = int(total_clicks * (1 - misclick_rate))
        bounce = overall_comfort < 0.25

        return self._compute_reward_from_response({
            "time_on_page": time_on_page,
            "scroll_depth": scroll_depth,
            "successful_clicks": successful_clicks,
            "total_clicks": total_clicks,
            "bounce": bounce,
            "zoom_adjustments": zoom_adj,
            "misclick_rate": misclick_rate,
        })

    def action_space_size(self) -> int:
        return N_ACTIONS

    def state_dim(self) -> int:
        return STATE_DIM

    def cumulative_reward(self) -> float:
        return float(np.sum(self.episode_rewards))

    def average_reward(self) -> float:
        if not self.episode_rewards:
            return 0.0
        return float(np.mean(self.episode_rewards))

    def render(self):
        """Print current environment state for debugging."""
        css = self.settings.to_css()
        print(f"Step {self.step_count:4d} | "
              f"Font: {css['font_size_px']}px | "
              f"Contrast: {css['contrast_pct']}% | "
              f"Scheme: {css['color_scheme']:15s} | "
              f"Last reward: {f'{self._last_reward:.3f}' if self._last_reward is not None else 'N/A'}")


# ─── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    env = AccessibilityEnv(seed=42)
    context = UserContext(misclick_rate=0.3, zoom_adjustments_norm=0.5, scroll_speed_norm=0.2)
    state = env.reset(context)
    print(f"Initial state (dim={len(state)}): {state.round(3)}")

    for step in range(10):
        action = np.random.randint(0, N_ACTIONS)
        next_state, reward, info = env.step(action)
        env.render()

    print(f"\nTotal cumulative reward: {env.cumulative_reward():.4f}")
    print(f"Average reward:          {env.average_reward():.4f}")
