# AccessAI — Adaptive Accessibility Personalisation via Reinforcement Learning

**CT-469 Reinforcement Learning | Project P16 | Spring 2026**

> A contextual bandit agent (LinUCB) that learns optimal accessibility settings per user by observing interaction patterns — no manual configuration required.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [MDP Design](#mdp-design)
4. [Setup & Installation](#setup--installation)
5. [Running Training](#running-training)
6. [Running the Web App](#running-the-web-app)
7. [Reproducing Results](#reproducing-results)
8. [File Structure](#file-structure)
---

## Project Overview

Websites offer limited accessibility customisation for visually impaired users. Screen readers are slow, font-size adjustments are binary, and colour contrast is static. Users with low vision, colour blindness, or photophobia abandon sites rather than manually configuring settings.

**Our solution:** A LinUCB contextual bandit agent that personalises font size, contrast, line spacing, and colour scheme in real time by observing:
- Scroll speed and depth
- Click accuracy (misclick rate)
- Time on page
- Manual zoom adjustments

The agent learns what settings maximise engagement for each user's implicit feedback — without any explicit questionnaire or setup.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│   Demo Website  │  RL Panel  │  Analytics Dashboard          │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (JSON)
┌────────────────────────▼────────────────────────────────────┐
│                    FastAPI Backend                           │
│   /api/recommend  │  /api/reward  │  /api/analytics          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      RL Layer (Python)                       │
│   LinUCB Agent  │  Thompson Sampling  │  Static Baseline     │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Model Persistence                          │
│   models/linucb.pkl  │  models/thompson.pkl                  │
│   models/training_metrics.json                               │
└─────────────────────────────────────────────────────────────┘
```

---

## MDP Design

### State Space (10-dimensional vector)

| Feature | Description | Range |
|---------|-------------|-------|
| `font_size_norm` | Current font size (normalised) | [0, 1] |
| `contrast_level_norm` | Current contrast level | [0, 1] |
| `color_scheme_idx` | Active colour scheme (0-3) | {0,1,2,3}/3 |
| `line_spacing_norm` | Line spacing (normalised) | [0, 1] |
| `scroll_speed_norm` | User's scroll speed | [0, 1] |
| `misclick_rate` | Fraction of inaccurate clicks | [0, 1] |
| `zoom_adjustments_norm` | Manual zoom frequency | [0, 1] |
| `time_on_page_norm` | Normalised session duration | [0, 1] |
| `content_type` | Page type (0=text, 1=image) | [0, 1] |
| `device_type` | Device (0=desktop, 1=mobile) | [0, 1] |

### Action Space (6 discrete actions)

| ID | Action | Justification |
|----|--------|---------------|
| 0 | `increase_font` | Reduces misclick rate for low-vision users |
| 1 | `decrease_font` | Prevents over-magnification |
| 2 | `increase_contrast` | Helps photophobic and low-vision users |
| 3 | `decrease_contrast` | Reduces eye strain for photophobic users |
| 4 | `switch_color_mode` | Toggles dark/warm/high-contrast scheme |
| 5 | `adjust_line_spacing` | Improves readability for dyslexic users |

### Reward Function

```python
reward = (
    0.4 * min(time_on_page / 30.0, 2.0)    # capped time normalisation
  + 0.3 * scroll_depth                       # content consumption
  + 0.2 * (successful_clicks / total_clicks) # interaction accuracy
  - 2.0 * bounce                             # strong discomfort signal
  - 0.3 * min(zoom_adjustments, 5)           # RL failure signal
  - misclick_rate                             # visual clarity failure
)
```

**Design justification:**
- Time is normalised against 30s baseline and capped at 2× to avoid rewarding confusion-based long stays.
- Zoom adjustments are penalised because each manual correction means the agent failed to pre-emptively set the right magnification.
- Bounce carries the highest penalty because it is an unambiguous signal of discomfort.

---

## Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- Git

### 1. Clone Repository

```bash
git clone https://github.com/Yusra230/Accessible-Content-Personalisation-for-Visual-Impairments.git
cd accessibility-rl
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

---

## Running Training

Train the LinUCB and Thompson Sampling agents using simulated user personas:

```bash
cd backend
python train.py --episodes 2000 --alpha 1.0 --seed 42
```

**Arguments:**

| Argument | Default | Description |
|----------|---------|-------------|
| `--episodes` | 2000 | Number of training rounds |
| `--alpha` | 1.0 | LinUCB exploration parameter |
| `--seed` | 42 | Random seed for reproducibility |

**Expected output:**

```
Episode  200 | LinUCB avg=0.821 | Thompson avg=0.714 | Static avg=0.540
Episode  400 | LinUCB avg=1.102 | Thompson avg=0.934 | Static avg=0.541
...
Episode 2000 | LinUCB avg=1.412 | Thompson avg=1.183 | Static avg=0.540

linucb       | Last-200 avg reward: 1.4121 | Total cumulative: 1847.32
thompson     | Last-200 avg reward: 1.1831 | Total cumulative: 1543.12
static       | Last-200 avg reward: 0.5401 | Total cumulative:  703.21
```

Training saves model weights to `models/` and metrics to `models/training_metrics.json`.

---

## Running the Web App

### Start Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`  
API docs at: `http://localhost:8000/docs`

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Reproducing Results

Pre-trained model weights are included in `models/`. To skip training and run the demo directly:

```bash
# Just start the backend (loads saved weights automatically)
cd backend && uvicorn main:app --reload

# Start frontend
cd frontend && npm run dev
```

To reproduce training from scratch with the same seed:

```bash
cd backend
python train.py --episodes 2000 --alpha 1.0 --seed 42
```

---

## File Structure

```
accessibility-rl/
├── backend/
│   ├── rl_agent.py          # LinUCB, Thompson Sampling, reward function, user simulator
│   ├── train.py             # Training script — runs all agents, saves metrics
│   ├── main.py              # FastAPI server — /recommend, /reward, /analytics endpoints
│   └── requirements.txt
├── frontend/
│   └── src/
│       └── App.jsx          # Full React frontend — demo website + RL panel + analytics
├── models/
│   ├── linucb.pkl           # Pre-trained LinUCB weights
│   ├── thompson.pkl         # Pre-trained Thompson Sampling weights
│   └── training_metrics.json
├── docs/
│   ├── report.md            # Technical project report
│   └── wcag_audit.md        # Accessibility audit
└── README.md
```

---

## API Reference

### `POST /api/recommend`

Get RL-recommended accessibility action for a user.

**Request:**
```json
{
  "user_id": "user_001",
  "font_size_norm": 0.4,
  "contrast_level_norm": 0.5,
  "color_scheme_idx": 0,
  "misclick_rate": 0.25,
  "agent": "linucb"
}
```

**Response:**
```json
{
  "session_id": "uuid-...",
  "action": 0,
  "action_name": "increase_font",
  "new_settings": { "font_size_norm": 0.52, ... },
  "css_values": { "font_size": "19px", "contrast": "120%", ... },
  "ucb_scores": [1.82, 0.41, 1.63, 0.22, 0.71, 0.55]
}
```

### `POST /api/reward`

Submit engagement feedback to update the agent.

### `GET /api/analytics`

Returns comparison metrics between LinUCB, Thompson Sampling, and static baseline.

### `GET /api/training-metrics`

Returns training curve data from the last training run.

## Team

| Member | Roll No |
|--------|------|
| Yusra | AI-010 |
| Muhammad Umer | AI-035 |
| Syed Muhammad Bilal Hussain | AI-046|

**CT-469 · Reinforcement Learning . Spring 2026 · Final Year 8th Semester**
