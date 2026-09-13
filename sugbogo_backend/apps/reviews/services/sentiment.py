"""Local review scoring. No model downloads or loading at import time."""

import math
import os
from pathlib import Path
from threading import Lock

ENGLISH_CONFIDENCE_THRESHOLD = 0.80  # Initial policy, not calibrated accuracy.
MAX_SENTIMENT_TOKENS = 510  # RoBERTa position offset; truncate the trailing text.
TAGALOG_MODEL_ID = "dost-asti/RoBERTa-tl-sentiment-analysis"
TAGALOG_MODEL_REVISION = "3355ad5a830178573c59684adf149d6544f3d86f"
LABELS = ("Negative", "Positive", "Neutral")
_models = {}
_load_lock = Lock()


def _text(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Review text must contain non-whitespace characters.")
    return text.strip()


def _path(variable: str, *, directory: bool = False) -> Path:
    value = os.environ.get(variable)
    if not value:
        raise RuntimeError(f"Set {variable} to a provisioned local model path.")
    path = Path(value).expanduser()
    if not path.is_absolute() or not (path.is_dir() if directory else path.is_file()):
        raise RuntimeError(f"{variable} must reference an existing absolute model path.")
    return path


def _load_model(name):
    if name == "vader":
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

        return SentimentIntensityAnalyzer()
    if name == "fasttext":
        import fasttext

        return fasttext.load_model(str(_path("FASTTEXT_LID_MODEL_PATH")))
    if name == "tagalog":
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        path = str(_path("TAGALOG_SENTIMENT_MODEL_PATH", directory=True))
        tokenizer = AutoTokenizer.from_pretrained(
            path, local_files_only=True, trust_remote_code=False,
        )
        model = AutoModelForSequenceClassification.from_pretrained(
            path, local_files_only=True, trust_remote_code=False, weights_only=True,
        )
        if model.config.id2label != {i: f"LABEL_{i}" for i in range(3)}:
            raise RuntimeError("Unexpected Tagalog model label configuration.")
        torch.set_num_threads(1)  # Process-wide CPU budget; benchmark before scaling.
        model.to("cpu")
        model.eval()
        return tokenizer, model
    raise RuntimeError(f"Unknown sentiment model: {name}")


def _get_model(name):
    with _load_lock:
        if name not in _models:
            _models[name] = _load_model(name)
        return _models[name]


def score_with_vader(text: str) -> tuple[float, str]:
    text = _text(text)
    score = float(_get_model("vader").polarity_scores(text)["compound"])
    if not math.isfinite(score) or not -1 <= score <= 1:
        raise RuntimeError("VADER returned an invalid compound score.")
    label = "Positive" if score >= 0.05 else "Negative" if score <= -0.05 else "Neutral"
    return score, label


def detect_language(text: str) -> tuple[str, float]:
    text = _text(text)
    if not any(character.isalpha() for character in text):
        return "und", 0.0
    # Public batch API avoids the NumPy 2 copy=False path for single strings.
    labels, probabilities = _get_model("fasttext").predict(
        [" ".join(text.split())], k=1,
    )
    if not labels or not labels[0]:
        return "und", 0.0
    label = labels[0][0]
    confidence = float(probabilities[0][0])
    if not label.startswith("__label__") or not math.isfinite(confidence):
        raise RuntimeError("fastText returned an invalid language prediction.")
    # fastText can report a probability slightly above 1 due to its epsilon.
    return label.removeprefix("__label__"), max(0.0, min(1.0, confidence))


def score_with_tagalog_model(text: str) -> tuple[float, str]:
    # Approved empirical mapping at TAGALOG_MODEL_REVISION: 0 neg, 1 pos, 2 neu.
    # Known limitation: "Napakapangit ng serbisyo. Galit ako at hinding-hindi na
    # ako babalik." favored LABEL_1 (Positive) ~72% over LABEL_0 ~28%.
    # This negation-handling limitation is documented, never corrected by heuristics.
    text = _text(text)
    import torch

    tokenizer, model = _get_model("tagalog")
    inputs = tokenizer(
        text, return_tensors="pt", truncation=True, max_length=MAX_SENTIMENT_TOKENS,
    )
    with torch.inference_mode():
        logits = model(**inputs).logits
        if tuple(logits.shape) != (1, 3) or not torch.isfinite(logits).all().item():
            raise RuntimeError("Tagalog model returned invalid logits.")
        probabilities = torch.softmax(logits[0], dim=-1)
    best = probabilities.max()
    label = "Neutral" if (probabilities == best).sum().item() > 1 else LABELS[
        int(probabilities.argmax().item())
    ]
    # Same direction/range as VADER, but NOT statistically calibrated across models.
    score = float((probabilities[1] - probabilities[0]).item())
    return score, label


def route_sentiment(text: str) -> tuple[float, str, str]:
    text = _text(text)
    language, confidence = detect_language(text)
    if language == "en" and confidence >= ENGLISH_CONFIDENCE_THRESHOLD:
        score, label = score_with_vader(text)
        return score, label, "vader"
    score, label = score_with_tagalog_model(text)
    return score, label, TAGALOG_MODEL_ID
