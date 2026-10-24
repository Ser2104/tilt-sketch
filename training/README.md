# Training the Tilt Sketch AI

Fastest: open `train_colab.ipynb` in Google Colab, switch the runtime to GPU and run all cells (about 20 minutes). Download the zip at the end and add its files to the repository.

Locally (slow on CPU):

```bash
pip install tensorflow-cpu pillow numpy
python training/prepare_data.py --per-class 4000   # downloads Quick, Draw! strokes
python training/build_dataset.py --variants 2      # renders with gyro-style augmentation
python training/train.py --epochs 14               # writes models/tiltsketch/
python training/evaluate.py                        # writes docs/EVALUATION.md
python training/check_parity.py --base http://localhost:8766   # browser vs Python check
```

Offline dry run of the whole pipeline: `python training/prepare_data.py --synthetic` then the same steps. Do not publish a model trained on synthetic data.

| File | Purpose |
|---|---|
| `common.py` | Classes, rendering identical to the browser, gyro-style augmentation |
| `prepare_data.py` | Streams recognized drawings per category, builds the "other" pool |
| `build_dataset.py` | Train / validation / test splits, gyro-style and clean test sets |
| `train.py` | CNN, temperature calibration, export to `spec.json` + `weights.bin` |
| `evaluate.py` | Accuracy, calibration, per-object results, confusions, DoodleNet comparison |
| `check_parity.py` | Confirms TensorFlow.js in the browser matches Python |
