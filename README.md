# Tilt Sketch

Tilt Sketch is a drawing game where your phone is the pencil: you aim it like a camera and move it to draw, and an AI we trained ourselves guesses what you drew, out loud, while you draw.

- **Play your way:** a daily challenge with a shared leaderboard and a streak, 40 levels in 5 worlds, and 30 guided drawings.
- **Play with friends:** Solo, Teams (relay drawing) and Impostor, on one phone or up to 12 phones joined by a 4-letter code or QR.
- **Keep coming back:** player levels and XP, 14 trophies, unlockable brush colors, and shareable result images.
- **A real AI:** a custom CNN trained on 395,000 drawings with gyroscope-style augmentation. It is right 82% of the time on shaky phone drawings, against 39% for DoodleNet, and runs on the phone with no internet.

**Try it:** https://ser2104.github.io/tilt-sketch/ (open on a phone). Android app: see [docs/play-store](docs/play-store/README.md).

The original HackPSU version also had a wrist-practice mode and a clinician dashboard. They are still in the code, hidden by default; open the site with `?rehab=1` to turn them on.

## Features

**Practice**
- Range calibration: the person moves their wrist as far as is comfortable; the brush is scaled so the whole sheet fits inside that range.
- Guided tracing across 9 shapes and 5 difficulty levels, with a tolerance band, start and end markers and direction arrows.
- Adaptive difficulty: score ≥ 80 raises the level, < 50 lowers it.
- Motion metrics per exercise: path covered, tracing accuracy, steadiness (tremor), smoothness (log dimensionless jerk), angular speed and range used. See [docs/MOTION_METRICS.md](docs/MOTION_METRICS.md).
- Local profiles, progress charts, CSV export, share sheet and a printable report.
- **Share with my clinician:** a therapist creates a clinic (code + private key) in **For clinicians**; patients connect with the code or a QR link and their session summaries are sent automatically. The clinician dashboard lists every patient with sessions, latest score and trend, and opens the same charts, CSV and printable report. Patients can stop sharing at any time, which deletes their shared data.

**Games**
- Solo, Teams (the drawing jumps to the teammate's phone) and Impostor (secret object, gallery, timed vote).
- One phone (pass and play) or up to 12 phones in a room joined by QR code, peer to peer with WebRTC.
- Custom time limits; nobody can stall a game (auto start, cut-off and vote deadlines).

**Challenges**
- Every free drawing (games, daily challenge, levels) first shows a reference picture and a one-line tip on how to draw it in a few lines, and keeps the picture next to the name while drawing.
- Before each free drawing the player also sees three real drawings by other people that the AI recognizes best, so they know the shape the AI expects (colors do not count, only the shape).
- While drawing, the AI shows its live guess ("AI sees: sun · 89%"); in levels and the daily challenge the turn ends as soon as the AI is sure.
- Levels and the daily challenge use only objects the model recognizes at least 80% of the time on gyroscope-style test drawings.
- Guided drawings: 30 original line-art figures in 5 worlds (Warm-up, Sky and space, Heroes, Movie night, Animals) traced line by line with no time limit. The current line is highlighted with its start dot, direction arrow and end ring; finished lines turn green; the drawing completes itself when every line is covered. Stars, unlocks and a shared ranking. All figures are original designs, not copyrighted characters.
- Daily challenge: the same object for everyone each day (UTC); every try can raise your best score on the daily ranking; shareable result.
- Levels and the daily challenge only use objects with a shape that is hard to confuse (no crescent moon, plain sun or star), so a good drawing is not mistaken for something else.
- Levels: 40 objects in 5 worlds (First lines, Around the house, Animals, Heroes and legends, Masters) with rising pass marks and 1–3 stars; ranking by highest level and stars.
- Shared rankings use a free Supabase project; see [docs/RANKINGS.md](docs/RANKINGS.md). Without it, results stay on the phone.

**Drawing**
- The brush stays in the center and the sheet moves around it. **Look around** works like a laser pointer (where you point is where the brush goes); **Tilt** works like a joystick (tilt to keep the brush rolling, level the phone to stop). **Recenter** brings the brush back to the center or to the exercise start.
- Brush reach with mouse-style acceleration, One Euro tremor filter and stroke smoothing.
- Optional camera background: the sheet floats in the room.

**Accessibility and reach**
- Larger text, high contrast, voice guidance and a bigger draw button.
- English and Spanish (language switch on the home screen; voice guidance speaks the chosen language).
- Installable app that works offline: Practice, guided drawings and one-phone games run without internet; rankings, sharing and feedback sync when the phone is back online.

**Feedback and evidence**
- A 10-second survey after practice sessions, challenges and games (ease of control, would use again, and for practice whether it feels like good exercise), plus a **Send feedback** screen. Answers are anonymous and give the project real usability numbers: run `select feedback_summary();` in the Supabase SQL editor.

## AI

| Part | What it does | Where |
|---|---|---|
| Drawing recognizer | **82.3% top-1 on gyroscope-style drawings vs 38.7% for DoodleNet** (91.9% top-3, calibration error 0.004). CNN trained for the game's 78 objects plus an "other" class, on Quick, Draw! drawings deformed to look like gyroscope drawings. Runs in the browser with TensorFlow.js. | [training/](training/), [docs/MODEL_CARD.md](docs/MODEL_CARD.md), [docs/EVALUATION.md](docs/EVALUATION.md) |
| Explanations | Every result shows the AI's top three guesses with their confidence, and says when it is not sure, so players and judges can see why a drawing scored what it did. | [js/ai.js](js/ai.js) |
| Fallback recognizer | DoodleNet (ml5.js), restricted to the game's objects, used only if the custom model cannot load. | `models/doodlenet/` |
| Motion analysis | Signal processing on the phone's orientation stream: tremor band energy, jerk-based smoothness, range of motion. | [js/motor.js](js/motor.js) |
| Adaptive difficulty | Adjusts level after each exercise from the tracing score. | [js/practice.js](js/practice.js) |
| Data flywheel | Players can choose to share their gyroscope drawings. They are added to training and a held-out part becomes a real-world test set, so the model is measured on real play, not only on simulated wobble. | [js/donate.js](js/donate.js), [training/fetch_donations.py](training/fetch_donations.py) |

Everything runs on the phone. Nothing leaves the device unless the person turns on drawing sharing or clinician sharing; see [docs/PRIVACY.md](docs/PRIVACY.md).

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
python tests/e2e_guided.py     # guided figures: line-by-line tracing, auto-complete, stars, ranking
python tests/e2e_cloud.py      # drawing donations with consent and deletion; clinic, patient sharing, dashboard
python tests/e2e_extras.py     # AI explanations, feedback survey, offline reload with the service worker
python tests/e2e_es.py         # Spanish interface: no English left on the main screens, switching back
```

They also run on every push with GitHub Actions.

## Train the AI

Open [training/train_colab.ipynb](training/train_colab.ipynb) in Google Colab with a GPU and run all cells, or see [training/README.md](training/README.md).

## License

MIT. See [LICENSE](LICENSE). Quick, Draw! data is © Google, released under CC BY 4.0.
