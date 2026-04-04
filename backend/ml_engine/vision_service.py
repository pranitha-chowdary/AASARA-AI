"""
AASARA Vision AI -- EfficientNetB0 Disruption Verification
==========================================================
Analyzes a worker-submitted photo to confirm a genuine disruption event.

Pipeline
--------
1. Image feature analysis (brightness, saturation, colour variance) -- runs even
   without PyTorch; acts as a fast heuristic layer.
2. EfficientNetB0 inference (ImageNet-1K weights, torchvision).
   Top-k predictions are mapped to outdoor/rain/indoor semantic groups via
   keyword matching on ImageNet class labels.
3. Score fusion: feature score + model score -> disruption_score (0-100).
   Threshold >= 55 = VERIFIED.

Graceful degradation
--------------------
If PyTorch/torchvision is not installed, the module falls back to
image-feature analysis only (brightness / saturation / variance).
The ML engine will NOT crash.

Install:
  pip install torch torchvision pillow
"""

import base64
import io
import os
import numpy as np

#  Optional PyTorch / torchvision import 
try:
    import torch
    import torchvision.models as tv_models
    import torchvision.transforms as T
    from PIL import Image

    TORCH_AVAILABLE = True
    print("[VisionAI] PyTorch detected -- EfficientNetB0 (ImageNet) will be used for verification")
except ImportError:
    TORCH_AVAILABLE = False
    print("[VisionAI] PyTorch not installed -- using image-feature analysis only")
    print("[VisionAI] Run: pip install torch torchvision pillow  to enable EfficientNetB0")

try:
    from PIL import Image as _PIL_Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

#  Thresholds 
BRIGHTNESS_DARK_THRESHOLD = 110   # mean pixel value < 110 -> overcast / storm
SATURATION_GREY_THRESHOLD = 0.30  # mean saturation < 30 % -> rain / grey scene
DISRUPTION_SCORE_THRESHOLD = 55   # score >= 55 = photo verified

#  ImageNet label keyword sets 
_OUTDOOR_KEYWORDS = {
    'car', 'truck', 'road', 'street', 'traffic', 'motorcycle', 'bike',
    'vehicle', 'bus', 'van', 'ambulance', 'taxi', 'auto', 'scooter',
    'rain', 'umbrella', 'poncho', 'water', 'flood', 'shore', 'lake',
    'pole', 'sidewalk', 'curb', 'drain', 'gutter', 'mud', 'puddle',
    'tree', 'bush', 'mountain', 'valley', 'field', 'sky', 'cloud',
    'fence', 'bridge', 'railway', 'tractor', 'crane', 'fire_engine',
}
_RAIN_KEYWORDS = {
    'umbrella', 'poncho', 'raincoat', 'slicker', 'galosh', 'rain_barrel',
}
_INDOOR_KEYWORDS = {
    'sofa', 'bed', 'chair', 'table', 'lamp', 'keyboard', 'monitor',
    'curtain', 'bookcase', 'shelf', 'wardrobe', 'couch', 'desk',
    'computer', 'laptop', 'television', 'remote', 'pillow', 'toilet',
    'bathtub', 'microwave', 'refrigerator', 'stove',
}

#  ImageNet class list (1000 classes) 
# We load it lazily from torchvision's bundled weights metadata.
_imagenet_classes: list = []

def _get_imagenet_classes() -> list:
    global _imagenet_classes
    if _imagenet_classes:
        return _imagenet_classes
    try:
        from torchvision.models import EfficientNet_B0_Weights
        _imagenet_classes = EfficientNet_B0_Weights.IMAGENET1K_V1.meta['categories']
    except Exception:
        # Hardcoded minimal fallback -- first 5 classes are enough for graceful degradation
        _imagenet_classes = ['tench'] * 1000
    return _imagenet_classes

#  Singleton model 
_model = None
_preprocess = None

def _load_model():
    """Lazy-load EfficientNetB0 with ImageNet weights (called only once)."""
    global _model, _preprocess
    if _model is not None:
        return _model

    if not TORCH_AVAILABLE:
        return None

    try:
        print("[VisionAI] Loading EfficientNetB0 (ImageNet weights)...")
        from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
        weights    = EfficientNet_B0_Weights.IMAGENET1K_V1
        _model     = efficientnet_b0(weights=weights)
        _model.eval()
        _preprocess = weights.transforms()
        print("[VisionAI]  EfficientNetB0 ready")
        return _model
    except Exception as exc:
        print(f"[VisionAI] Model load failed: {exc}")
        _model = None
        return None

#  Image utilities 

def _decode_image(image_data):
    """
    Accept base64 (with/without data-URL prefix) or raw bytes.
    Returns a PIL Image in RGB mode.
    """
    if isinstance(image_data, str):
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]
        image_data = base64.b64decode(image_data)

    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow not installed -- cannot decode image. Run: pip install pillow")

    return Image.open(io.BytesIO(image_data)).convert('RGB')


def _image_features(pil_image) -> dict:
    """Compute brightness, saturation, colour variance from pixel statistics."""
    arr = np.array(pil_image, dtype=np.float32)   # (H, W, 3)

    brightness       = float(np.mean(arr))
    r, g, b          = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    max_c            = np.maximum(np.maximum(r, g), b)
    min_c            = np.minimum(np.minimum(r, g), b)
    sat_raw          = np.where(max_c > 0, (max_c - min_c) / np.maximum(max_c, 1e-6), 0.0)
    saturation       = float(np.mean(sat_raw))
    colour_variance  = float(np.var(arr))

    return {
        'brightness':      round(brightness, 1),
        'saturation':      round(saturation, 4),
        'colour_variance': round(colour_variance, 1),
        'is_dark':         brightness < BRIGHTNESS_DARK_THRESHOLD,
        'is_grey':         saturation < SATURATION_GREY_THRESHOLD,
    }


def _run_efficientnet(pil_image) -> list:
    """
    Run EfficientNetB0 and return top-20 predictions as
    [{ label: str, confidence: float }, ...].
    """
    model = _load_model()
    if model is None:
        return []

    try:
        tensor = _preprocess(pil_image).unsqueeze(0)   # (1, 3, 224, 224)
        with torch.no_grad():
            logits = model(tensor)

        probs   = torch.softmax(logits, dim=1)[0]
        top_k   = torch.topk(probs, k=20)
        classes = _get_imagenet_classes()

        return [
            {
                'label':      classes[idx.item()].replace('_', ' '),
                'confidence': round(val.item(), 4),
            }
            for val, idx in zip(top_k.values, top_k.indices)
        ]
    except Exception as exc:
        print(f"[VisionAI] Inference error: {exc}")
        return []


#  Main entry point 

def analyze_disruption_photo(image_data) -> dict:
    """
    Analyze a photo and return a structured verification result.

    Parameters
    ----------
    image_data : str | bytes
        Base64-encoded image (data-URL or raw) or raw bytes.

    Returns
    -------
    dict:
        verified         bool    True if disruption_score >= 55
        confidence       float   0-100 composite score
        disruption_score float   alias for confidence
        analysis         dict    image features + reasoning list
        model_used       str     description of analysis method
        top_predictions  list    EfficientNet top-5 labels (empty without PyTorch)
        error            str     present only on decode failure
    """
    #  Decode 
    try:
        pil_image = _decode_image(image_data)
    except Exception as exc:
        return {
            'verified':         False,
            'confidence':        0,
            'disruption_score':  0,
            'error':             str(exc),
            'model_used':        'decode_error',
            'analysis':          {},
            'top_predictions':   [],
        }

    #  Image feature layer 
    features  = _image_features(pil_image)
    score     = 50.0
    reasoning = []

    if features['is_dark']:
        score += 12
        reasoning.append(f"Overcast/dark image (brightness={features['brightness']:.0f}) -- consistent with storm")

    if features['is_grey']:
        score += 10
        reasoning.append(f"Desaturated scene (sat={features['saturation']:.3f}) -- matches rain or flooding")

    if features['colour_variance'] > 3_000:
        score += 5
        reasoning.append("High colour variance -- complex outdoor scene")
    elif features['colour_variance'] < 400:
        score -= 12
        reasoning.append("Very low colour variance -- possibly a plain wall or dark room")

    #  EfficientNetB0 layer 
    top_predictions = []
    if TORCH_AVAILABLE:
        top_predictions = _run_efficientnet(pil_image)
        outdoor_hits = 0
        indoor_hits  = 0

        for pred in top_predictions[:10]:
            label_lc   = pred['label'].lower()
            confidence = pred['confidence']
            is_outdoor = any(kw in label_lc for kw in _OUTDOOR_KEYWORDS)
            is_indoor  = any(kw in label_lc for kw in _INDOOR_KEYWORDS)
            is_rain    = any(kw in label_lc for kw in _RAIN_KEYWORDS)

            if is_outdoor:
                outdoor_hits += 1
                delta = round(8 * confidence, 2)
                score += delta
                reasoning.append(f"Outdoor context: '{pred['label']}' ({confidence*100:.0f}%) +{delta:.1f}pts")

            if is_indoor:
                indoor_hits += 1
                delta = round(15 * confidence, 2)
                score -= delta
                reasoning.append(f"Indoor object flagged: '{pred['label']}' ({confidence*100:.0f}%) -{delta:.1f}pts")

            if is_rain:
                delta = round(18 * confidence, 2)
                score += delta
                reasoning.append(f"Rain/weather gear detected: '{pred['label']}' -- +{delta:.1f}pts")

        if indoor_hits >= 2 and indoor_hits > outdoor_hits:
            score -= 20
            reasoning.append("Multiple indoor objects without outdoor context -- photo likely not from disruption zone")

        model_used = 'EfficientNetB0 (ImageNet-1K, torchvision, zero-shot disruption scoring)'
    else:
        model_used = 'Image-feature analysis (install torch torchvision for EfficientNetB0)'
        reasoning.append("Brightness and saturation analysis only -- PyTorch not installed")

    #  Final score 
    disruption_score = round(max(0.0, min(100.0, score)), 1)
    verified = disruption_score >= DISRUPTION_SCORE_THRESHOLD

    return {
        'verified':         verified,
        'confidence':        disruption_score,
        'disruption_score':  disruption_score,
        'analysis': {
            **features,
            'reasoning': reasoning[:6],
        },
        'model_used':       model_used,
        'top_predictions':  top_predictions[:5],
    }

