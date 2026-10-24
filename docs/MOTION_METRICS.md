# Motion metrics

All metrics are computed on the phone from the orientation stream recorded while the timer runs (`js/motor.js`). Samples are resampled to 60 Hz.

| Metric | Definition | Shown as |
|---|---|---|
| Path covered | Share of points along the guide shape that have a drawn point within the tolerance band | % |
| Tracing accuracy | 1 − mean distance from drawn points to the guide ÷ (2 × tolerance), floored at 0 | % |
| Exercise score | 0.6 × path covered + 0.4 × accuracy | 0–100 |
| Tremor amplitude | RMS of the orientation signal after removing a 0.15 s moving average (keeps roughly > 4 Hz) | degrees |
| Tremor peak | Frequency with most power between 4 and 12 Hz (Goertzel, 0.5 Hz steps) | Hz |
| Steadiness | 100 − 60 × tremor amplitude, clamped to 0–100 | 0–100 |
| Smoothness | Log dimensionless jerk (LDLJ) of each pen-down stroke, averaged; rescaled as (LDLJ + 14) / 10 × 100, clamped | 0–100 |
| Angular speed | Mean angular speed of the phone while the pen is down | °/s |
| Range used | 5th–95th percentile span of the aim angles, side to side and up and down | degrees |

## Verified behavior

`tests/e2e_practice.py` traces the guides with simulated hands:

| Simulated hand | Score | Steadiness |
|---|---|---|
| Accurate, 0.05° tremor | 99–100 | 93–96 |
| Wavy path | ≈ 77 | 93 |
| 1.2° tremor at 8 Hz | 76–96 | 30–32 |

## Limits

- The constants that map raw values to 0–100 (steadiness, smoothness) are engineering choices, not clinical norms. They must be checked against real users (see [VALIDATION_PROTOCOL.md](VALIDATION_PROTOCOL.md)).
- Phone sensors and sampling rates vary by model; compare a person with themselves over time, not across devices.
- These measures are for exercise feedback only and must not be used for diagnosis.
