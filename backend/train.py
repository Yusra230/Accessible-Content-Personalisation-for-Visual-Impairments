"""
Training Script — CT-469 Project P15
Trains LinUCB and Thompson Sampling agents using the AccessibilityEnv environment.
Logs metrics per episode, saves model weights, outputs training_metrics.json.

Usage:
    python train.py --episodes 2000 --alpha 1.0 --seed 42

Reproducible with fixed --seed. Pre-trained weights saved to ../models/.
"""

import argparse
import json
import os
import numpy as np
import logging

from environment import AccessibilityEnv, UserContext, N_ACTIONS, STATE_DIM
from rl_agent import (
    LinUCBAgent, ThompsonSamplingAgent, StaticDefaultAgent, PERSONAS, ACTIONS
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def persona_to_context(persona_key: str) -> UserContext:
    p = PERSONAS[persona_key]
    return UserContext(
        scroll_speed_norm=p.scroll_speed,
        misclick_rate=p.misclick_baseline,
        zoom_adjustments_norm=p.zoom_tendency,
        time_on_page_norm=0.3,
        content_type=float(np.random.choice([0.0, 0.5, 1.0])),
        device_type=float(np.random.choice([0.0, 0.5, 1.0])),
    )


def run_training(episodes: int, alpha: float, seed: int) -> dict:
    np.random.seed(seed)
    logger.info(f"Training start | episodes={episodes}  alpha={alpha}  seed={seed}")

    linucb   = LinUCBAgent(N_ACTIONS, STATE_DIM, alpha=alpha)
    thompson = ThompsonSamplingAgent(N_ACTIONS, STATE_DIM)
    static   = StaticDefaultAgent()

    env_l = AccessibilityEnv(seed=seed)
    env_t = AccessibilityEnv(seed=seed)
    env_s = AccessibilityEnv(seed=seed)

    metrics = {
        name: {"rewards": [], "cumulative": [], "window_avg": []}
        for name in ["linucb", "thompson", "static"]
    }

    persona_keys = list(PERSONAS.keys())
    window = 50

    for ep in range(episodes):
        persona_key = persona_keys[ep % len(persona_keys)]
        context = persona_to_context(persona_key)

        state_l = env_l.reset(context)
        state_t = env_t.reset(context)
        state_s = env_s.reset(context)

        for (agent, env, state, name) in [
            (linucb,   env_l, state_l, "linucb"),
            (thompson, env_t, state_t, "thompson"),
            (static,   env_s, state_s, "static"),
        ]:
            action = agent.select_action(state)
            next_state, reward, info = env.step(action)
            agent.update(action, state, reward)

            m = metrics[name]
            m["rewards"].append(reward)
            prev_cum = m["cumulative"][-1] if m["cumulative"] else 0.0
            m["cumulative"].append(prev_cum + reward)
            if len(m["rewards"]) >= window:
                m["window_avg"].append(float(np.mean(m["rewards"][-window:])))

        if (ep + 1) % 200 == 0:
            lr = np.mean(metrics["linucb"]["rewards"][-window:])
            tr = np.mean(metrics["thompson"]["rewards"][-window:])
            sr = np.mean(metrics["static"]["rewards"][-window:])
            logger.info(f"Episode {ep+1:4d} | LinUCB avg={lr:.3f} | Thompson avg={tr:.3f} | Static avg={sr:.3f}")

    linucb.save(os.path.join(MODELS_DIR, "linucb.pkl"))
    thompson.save(os.path.join(MODELS_DIR, "thompson.pkl"))

    serialisable = {
        k: {
            "rewards":    [float(x) for x in v["rewards"]],
            "cumulative": [float(x) for x in v["cumulative"]],
            "window_avg": [float(x) for x in v["window_avg"]],
        }
        for k, v in metrics.items()
    }
    metrics_path = os.path.join(MODELS_DIR, "training_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(serialisable, f)
    logger.info(f"Metrics saved -> {metrics_path}")

    logger.info("-" * 60)
    for name in ["linucb", "thompson", "static"]:
        last_avg = float(np.mean(metrics[name]["rewards"][-200:]))
        cum      = metrics[name]["cumulative"][-1]
        logger.info(f"{name:12s} | last-200 avg = {last_avg:.4f} | cumulative = {cum:.2f}")
    logger.info("Training complete.")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AccessAI RL agents")
    parser.add_argument("--episodes", type=int,   default=2000)
    parser.add_argument("--alpha",    type=float,  default=1.0)
    parser.add_argument("--seed",     type=int,   default=42)
    args = parser.parse_args()
    run_training(args.episodes, args.alpha, args.seed)
