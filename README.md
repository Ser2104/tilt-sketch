# Tilt Sketch

A drawing party game for one phone (pass and play) or several phones at once. You draw by tilting the phone (gyroscope), and an AI that runs in the browser guesses each drawing and scores how recognizable it is.

**Play:** https://ser2104.github.io/tilt-sketch/ (open it on a phone)

## Playing on several phones
1. One player chooses **Multiple phones**, enters a name and taps **Create room**. Every room gets its own QR code and 4-letter code.
2. Everyone else scans the QR with the phone camera. The game opens straight on a "Join room" screen: enter a name, enable the gyroscope and tap Join. Typing the code also works.
3. The host picks the mode in the lobby and taps **Start game**. Up to 12 players.

Phones connect directly to each other with WebRTC (PeerJS). The host's phone runs the game and the AI judge, so keep the host's screen open until the game ends.

- **Solo:** everyone draws at the same time on their own phone.
- **Teams:** the first player of each team draws; when time runs out, the drawing jumps to the teammate's phone, who continues from the exact spot. Teams draw in parallel.
- **Impostor:** each phone shows its own secret object, everyone draws at once, the gallery appears on every phone and each player votes from their own phone after 30 seconds.

## Modes
- **Solo:** everyone draws the same object. Best average accuracy after 3 rounds wins.
- **Teams:** one player draws for 10 seconds, then passes the phone and a teammate continues the same drawing from where it stopped.
- **Impostor:** everyone sees the same object except one player, who gets a similar one. After everyone draws, voting opens at 30 seconds to eliminate the impostor.

## How drawing works
- The brush stays fixed in the center of the screen and the sheet moves around it, like looking through a camera at a large piece of paper.
- **Look around** (default): hold the phone up like a camera and turn or tilt your body to aim. It uses the full 3D orientation of the phone.
- **Tilt**: hold the phone comfortably and tilt it to slide the sheet.
- Wherever you aim during the 3-2-1 countdown becomes your starting point. Hold the big button to put the pen down; "Sticky pen" lets you tap once instead.
- A mini-map in the corner shows the whole sheet, your view and the brush position. In Teams mode the next player starts exactly where the previous one stopped.
- Colors, eraser, pen size and undo never pause the timer. "Center here" recalibrates without moving the cursor.

## AI judge
The judge is DoodleNet, a small convolutional network trained on Google's Quick Draw dataset (345 categories), loaded with TensorFlow.js. The model weights are embedded in `index.html`, so the game needs no server, API key or account.

## Requirements
- A phone with a gyroscope and a modern browser.
- The page must be served over HTTPS (GitHub Pages does this). On iPhone, tap "Allow" when Safari asks for motion access.
