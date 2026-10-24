# Tilt Sketch

A pass-and-play drawing party game for one phone. You draw by tilting the phone (gyroscope), and an AI that runs in the browser guesses each drawing and scores how recognizable it is.

**Play:** https://ser2104.github.io/tilt-sketch/ (open it on a phone)

## Modes
- **Solo:** everyone draws the same object. Best average accuracy after 3 rounds wins.
- **Teams:** one player draws for 10 seconds, then passes the phone and a teammate continues the same drawing from where it stopped.
- **Impostor:** everyone sees the same object except one player, who gets a similar one. After everyone draws, voting opens at 30 seconds to eliminate the impostor.

## How drawing works
- Hold the phone comfortably during the 3-2-1 countdown. That tilt becomes the center of the sheet.
- Tilt to move the cursor and hold the big button to put the pen down. "Sticky pen" lets you tap once instead.
- Colors, eraser, pen size and undo never pause the timer. "Center here" recalibrates without moving the cursor.

## AI judge
The judge is DoodleNet, a small convolutional network trained on Google's Quick Draw dataset (345 categories), loaded with TensorFlow.js. The model weights are embedded in `index.html`, so the game needs no server, API key or account.

## Requirements
- A phone with a gyroscope and a modern browser.
- The page must be served over HTTPS (GitHub Pages does this). On iPhone, tap "Allow" when Safari asks for motion access.
