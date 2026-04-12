# VVM Classifier — Model Card

## Model Details

| Field | Value |
|-------|-------|
| **Model Name** | VVM Stage Classifier |
| **Version** | 0.1.0-demo |
| **Type** | Image classification (4-class) |
| **Frameworks** | scikit-learn (RandomForest), PyTorch (SmallCNN) |
| **Export Formats** | pickle (sklearn), ONNX (CNN), TFLite (via CI conversion) |
| **Model Size** | sklearn: ~2 MB, ONNX: 0.11 MB |
| **Owner** | VaxAI Vision ML Team |

## Intended Use

Classifies Vaccine Vial Monitor (VVM) indicator images into one of four stages:

| Stage | Description | Action |
|-------|-------------|--------|
| **Stage 1** | Inner square lighter than outer circle | Safe to use |
| **Stage 2** | Inner and outer colors similar | Use soon |
| **Stage 3** | Inner square darker than outer | Do not use |
| **Stage 4** | Inner square much darker | Expired — discard |

**Primary use case:** Demo/prototype for the VaxAI Vision VVM Scanner feature.  
**Not intended for:** Clinical decision-making in production without real-image retraining.

## Architecture

### sklearn (Primary — demo)
- **Algorithm:** RandomForest (200 trees, max_depth=20)
- **Features:** 32-bin color histograms per channel (96 features) + center-vs-border color statistics (9 features) = 105 features
- **Inference:** CPU only, ~1ms per image

### SmallCNN (Secondary — on-device path)
- **Architecture:** Conv2d(16) → MaxPool → Conv2d(32) → MaxPool → Conv2d(64) → GAP → FC(64) → FC(4)
- **Parameters:** ~55K
- **Input:** 224×224×3 RGB, normalized to [0,1]
- **Export:** ONNX opset 13, convertible to TFLite via CI

## Training Data

- **Source:** Programmatically generated synthetic VVM indicator images
- **Generator:** `backend/app/ml/vvm_synthetic.py`
- **Total samples:** 600 (150 per class)
- **Split:** 80% train (480), 20% validation (120)
- **Image size:** 224×224 RGB PNG
- **Augmentation:** Random color jitter (±20), Gaussian blur (30% probability), 90° rotation variants, positional offset (±5px)

### Synthetic image characteristics
- Circular outer region with VVM-stage-appropriate color
- Inner square with stage-dependent color relationship to outer region
- Random background noise and slight blur to simulate camera variation
- Color profiles derived from VVM specification color ranges

## Evaluation Results

### Validation set (120 images, 30 per class)

| Model | Accuracy | Stage 1 F1 | Stage 2 F1 | Stage 3 F1 | Stage 4 F1 |
|-------|----------|-----------|-----------|-----------|-----------|
| sklearn RF | **100%** | 1.00 | 1.00 | 1.00 | 1.00 |
| SmallCNN (ONNX) | **95%** | — | — | — | — |

### Live inference test (80 fresh synthetic images)

| Backend | Accuracy |
|---------|----------|
| sklearn | 100% |
| ONNX | 95% |

## Limitations

1. **Synthetic data only.** Models have not been validated on real VVM photographs. Real-world performance will require fine-tuning on captured VVM images with varying lighting, angles, and camera quality.
2. **Simplified VVM geometry.** Synthetic images use idealized circle+square shapes. Real VVMs have specific branding, text, and surrounding label context.
3. **No background variation.** Training images have uniform backgrounds. Real images will include vial surfaces, fingers, backgrounds.
4. **Stage boundary ambiguity.** Stage 2↔3 boundary is intentionally narrow; real-world boundary cases will need clinical validation.
5. **Demo model size.** The ONNX model is only 0.11 MB — suitable for demo but a production model with real data will be larger.

## Ethical Considerations

- **Safety-critical application:** VVM classification directly affects vaccine administration decisions. False positives (classifying stage 3/4 as stage 1/2) could lead to administering ineffective vaccines. The demo model must NOT be used for real clinical decisions.
- **Deployment guard:** Inference module defaults to "placeholder" backend when no trained model is found, preventing silent failures.

## Recommendations for Production

1. Collect and annotate 500+ real VVM images per stage from field conditions
2. Fine-tune the SmallCNN on real data with transfer learning
3. Add stage 2↔3 boundary test suite with clinical expert labels
4. Implement confidence thresholding — reject predictions below 0.8
5. Convert to TFLite with INT8 quantization for mobile deployment
6. Set up continuous evaluation with field feedback loop
