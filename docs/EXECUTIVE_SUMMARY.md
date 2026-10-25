# Tilt Sketch: home wrist exercise that people want to do, measured by on-device AI

**Team:** Sergio Yacolca (Computer Science, Schreyer Honors College) and teammates to be added
**Nittany AI Challenge 2026–27**

## Problem

More than 795,000 people in the US have a stroke each year, and stroke reduces mobility in more than half of survivors aged 65 and older (CDC). Regaining hand and wrist control depends on repetitive home exercise, but adherence is poor: in a 2026 survey only 24% of people completed all their assigned at-home physical therapy exercises (Ohio State Wexner Medical Center survey, reported by Medical Economics). Therapists rarely see objective data from between visits.

## Solution

Tilt Sketch turns the phone people already own into a wrist-controlled brush. In **Practice**, users trace guided shapes that adapt to their level; the app measures path accuracy, steadiness (tremor), smoothness and range of motion, and builds a progress report for their therapist. In **Games**, families and friends draw together on one or many phones while an AI guesses the drawings, which keeps people practicing the same movements.

## AI

1. **Drawing recognizer** trained for the game's objects, with gyro-style data augmentation and calibrated probabilities, evaluated against an off-the-shelf baseline.
2. **Motion analysis** of the phone's orientation stream: tremor band energy, jerk-based smoothness and range of motion.
3. **Adaptive difficulty** that adjusts shape size, tolerance and time to each person.

4. **Data flywheel:** players can share their gyroscope drawings with consent; they retrain the recognizer and form a real-world test set.

All AI runs on the phone. Data leaves the device only when the person opts in: drawing sharing for training, or sharing practice results with their clinician.

## Status

Working prototype online, with multiplayer rooms by QR code, Practice mode, progress reports, accessibility options and automated browser tests. Next: train and publish the custom model, interview 5–10 therapists, run a 10–15 person repeatability pilot.

## Impact and next steps

Success means more completed home sessions and therapist-readable progress between visits. The prototype already includes a clinician dashboard: therapists create a clinic, patients connect with a code and their progress arrives automatically. After the MVP: exercise plans assigned by clinicians, clinician accounts on a HIPAA-ready host, and a clinical partnership to validate the metrics.

*Tilt Sketch is a wellness and exercise tool, not a medical device.*
