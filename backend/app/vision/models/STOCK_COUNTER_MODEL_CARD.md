# Stock Counter Model Card — YOLOv8-nano

## Overview
Object detection model for the AR stock counter. Detects and counts vaccine
products on warehouse shelves in real-time via device camera.

## Architecture
- **Base**: YOLOv8-nano (ultralytics)
- **Input**: 640×640 RGB images
- **Output**: Bounding boxes + class labels + confidence scores
- **Parameters**: ~3.2M
- **Size target**: <15 MB (ONNX), <10 MB (quantized)

## Classes (5)
| ID | Class             | Description                          |
|----|-------------------|--------------------------------------|
| 0  | vaccine_vial      | Glass/plastic vaccine vials          |
| 1  | syringe           | Syringes (with/without needles)      |
| 2  | cold_box          | Vaccine transport cold boxes         |
| 3  | diluent           | Diluent bottles for reconstitution   |
| 4  | ancillary_product | Ancillary items (cotton, alcohol, etc)|

## Training Data
- **Source**: Synthetic procedural generation (`backend/app/ml/stock_synthetic.py`)
- **Volume**: 600+ images (480 train / 120 val)
- **Format**: YOLO (normalized xywh bounding boxes)
- **Augmentation**: Color jitter, blur, noise, horizontal flip, mosaic, mixup

## Inference
- **Target latency**: <100 ms on mid-range Android (Snapdragon 6-series)
- **Backends**: ultralytics (PyTorch), ONNX Runtime, placeholder (demo)
- **Tracking**: ByteTrack multi-object tracker for frame-to-frame dedup
- **Export formats**: ONNX (opset 12), TensorFlow.js

## Limitations
- **DEMO ONLY** — trained on synthetic data; not validated on real warehouse images
- Synthetic products are simplified geometric shapes, not photorealistic
- Performance on real images will require fine-tuning on annotated photos
- No occlusion handling tested with real product stacking

## Production Recommendations
1. Collect 1000+ real annotated images per class from target facilities
2. Fine-tune from synthetic-pretrained weights
3. Apply INT8 quantization for mobile deployment
4. Add confidence thresholding (0.5+ recommended for production)
5. Validate counting accuracy on held-out real-world test set
