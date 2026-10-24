# Pilot validation protocol

Goal: check that Tilt Sketch's motion metrics are repeatable and move in the expected direction before showing them to clinicians. This is a small engineering pilot with healthy volunteers, not a clinical study. Before involving patients, consult Penn State's Office for Research Protections about IRB review.

## Participants

10–15 adult volunteers without known hand or wrist conditions. Verbal consent; no names stored (use profile codes such as P01).

## Equipment

The volunteer's own phone or one shared phone (record the model), Tilt Sketch Practice mode, a chair without armrests.

## Procedure (about 15 minutes per person)

1. Seated, elbow at about 90°, phone held like a camera. Calibrate range.
2. Session A: one Practice session (5 exercises). Export CSV.
3. Rest 5 minutes.
4. Session B: repeat. Export CSV.
5. Session C (induced difficulty): repeat while holding the phone in the non-dominant hand. Export CSV.

## Analysis

| Question | Measure | Target |
|---|---|---|
| Are metrics repeatable? | Intraclass correlation (ICC 2,1) between sessions A and B for score, steadiness, smoothness and range | ICC ≥ 0.75 |
| Do they detect harder conditions? | Paired comparison A vs C (Wilcoxon signed-rank) | Lower score and smoothness in C |
| Is adaptive difficulty reasonable? | Level reached after 5 exercises | Most reach level 2–4 |

## Reporting

Summarize results in a one-page table for the MVP documentation, including limitations (sample size, healthy volunteers only, single phone model).
