# Tilt Sketch

Tilt Sketch turns a phone into a brush you control by moving your wrist. It has two sides:

- **Practice:** guided wrist exercises (trace lines, circles, spirals…) that adapt to the person, measure movement quality with on-device AI and track progress over weeks, with a report a therapist can read.
- **Games:** drawing party games for one phone or many phones at once (Solo, Teams relay, Impostor), a daily challenge with a shared ranking, and 40 levels in 5 worlds with stars and a ranking, all judged by an AI that guesses each drawing. The games keep people coming back to the same wrist movements.

**Try it:** https://ser2104.github.io/tilt-sketch/ (open on a phone)

> Tilt Sketch is a game and wellness exercise tool. It is not a medical device and does not diagnose or treat any condition.

## Why

More than 795,000 people in the US have a stroke each year, and stroke reduces mobility in more than half of survivors aged 65 and older ([CDC](https://www.cdc.gov/stroke/data-research/facts-stats)). Recovery depends on repetitive home exercise, yet in a 2026 survey only 24% of people completed all their assigned at-home physical therapy exercises ([Medical Economics, on an Ohio State Wexner Medical Center survey](https://www.medicaleconomics.com/view/patients-aren-t-doing-their-physical-therapy-homework)). Therapists also see little of what happens between visits. Tilt Sketch makes the exercises engaging and turns each session into objective measurements, using only the phone people already own.

## Features

**Practice**
- Range calibration: the person moves their wrist as far as is comfortable; the brush is scaled so the whole sheet fits inside that range.
- Guided tracing across 9 shapes and 5 difficulty levels, with a tolerance band, start and end markers and direction arrows.
- Adaptive difficulty: score ≥ 80 raises the level, < 50 lowers it.
- Motion metrics per exercise: path covered, tracing accuracy, steadiness (tremor), smoothness (log dimensionless jerk), angular speed and range used. See [docs/MOTION_METRICS.md](docs/MOTION_METRICS.md).
- Local profiles, progress charts, CSV export, share sheet and a printable report.

**Games**
- Solo, Teams (the drawing jumps to the teammate's phone) and Impostor (secret object, gallery, timed vote).
- One phone (pass and play) or up to 12 phones in a room joined by QR code, peer to peer with WebRTC.
- Custom time limits; nobody can stall a game (auto start, cut-off and vote deadlines).

**Challenges**
- Daily challenge: the same object for everyone each day (UTC), one official try, shareable result, daily ranking.
- Levels: 40 objects in 5 worlds (First lines, Around the house, Animals, Heroes and legends, Masters) with rising pass marks and 1–3 stars; ranking by highest level and stars.
- Shared rankings use a free Supabase project; see [docs/RANKINGS.md](docs/RANKINGS.md). Without it, results stay on the phone.

**Drawing**
- The brush stays in the center and the sheet moves around it. **Look around** works like a laser pointer (where you point is where the brush goes); **Tilt** works like a joystick (tilt to keep the brush rolling, level the phone to stop). **Recenter** brings the brush back to the center or to the exercise start.
- Brush reach with mouse-style acceleration, One Euro tremor filter and stroke smoothing.
- Optional camera background: the sheet floats in the room.

**Accessibility**
- Larger text, high contrast, voice guidance and a bigger draw button.

## AI

| Part | What it does | Where |
|---|---|---|
| Drawing recognizer | CNN trained for the game's 78 objects plus an "other" class, on Quick, Draw! drawings deformed to look like gyroscope drawings. Runs in the browser with TensorFlow.js. | [training/](training/), [docs/MODEL_CARD.md](docs/MODEL_CARD.md), [docs/EVALUATION.md](docs/EVALUATION.md) |
| Fallback recognizer | DoodleNet (ml5.js), restricted to the game's objects, used until the custom model is published. | `models/doodlenet/` |
| Motion analysis | Signal processing on the phone's orientation stream: tremor band energy, jerk-based smoothness, range of motion. | [js/motor.js](js/motor.js) |
| Adaptive difficulty | Adjusts level after each exercise from the tracing score. | [js/practice.js](js/practice.js) |

Everything runs on the phone. No drawing or measurement leaves the device unless the user exports it.

## Project layout

```
index.html          screens
css/app.css         styles and themes
js/                 core, gyro, drawing engine, motion metrics, AI, practice, progress, games, multiplayer
models/             doodlenet (fallback) and tiltsketch (custom, after training)
training/           data download, rendering + augmentation, training, evaluation, Colab notebook
tests/              browser tests with simulated phones (Playwright)
docs/               architecture, model card, metrics, validation protocol, challenge materials
vendor/             TensorFlow.js, PeerJS, QR generator
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run locally

```bash
python3 -m http.server 8766        # then open http://localhost:8766 (gyroscope needs https on a phone)
```

## Tests

```bash
pip install playwright && python -m playwright install chromium
npm install peer@1.0.2 && node -e "require('peer').PeerServer({port:9000,path:'/',host:'127.0.0.1'})" &
python3 -m http.server 8766 &
python tests/e2e.py            # one phone, AI judging
python tests/e2e_practice.py   # calibration, 5 guided exercises, metrics, report
python tests/e2e_multi.py      # 4 phones: Solo, Teams relay, Impostor
python tests/e2e_time.py       # custom times, auto-start, deadlines, vote timeout
python tests/e2e_fuzz.py       # Practice never freezes; bad play scores near zero
python tests/e2e_scoring.py    # real drawings score high, scribbles score zero
python tests/mock_supabase.py 8790 & python tests/e2e_challenges.py   # daily, levels, rankings
```

They also run on every push with GitHub Actions.

## Train the AI

Open [training/train_colab.ipynb](training/train_colab.ipynb) in Google Colab with a GPU and run all cells, or see [training/README.md](training/README.md).

## License

MIT. See [LICENSE](LICENSE). Quick, Draw! data is © Google, released under CC BY 4.0.
