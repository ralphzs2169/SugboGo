import json
import re
from collections import defaultdict
from hashlib import sha256
from pathlib import Path

from apps.reviews.services.review_keyword_service import ReviewKeywordService
from apps.reviews.services.sentiment import route_sentiment

DATASET_DIRECTORY = Path(__file__).resolve().parent / "datasets"
SENTIMENT_LABELS = ("positive", "neutral", "negative")


def load_dataset(filename, dataset_directory=None):
    directory = Path(dataset_directory or DATASET_DIRECTORY)
    with (directory / filename).open(encoding="utf-8") as stream:
        return json.load(stream)


def dataset_fingerprint(dataset):
    payload = json.dumps(
        dataset,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return sha256(payload.encode("utf-8")).hexdigest()


def _safe_ratio(numerator, denominator):
    return round(numerator / denominator, 4) if denominator else 0.0


def _macro_f1(confusion):
    scores = []
    for label in SENTIMENT_LABELS:
        true_positive = confusion[label][label]
        false_positive = sum(
            confusion[expected][label]
            for expected in SENTIMENT_LABELS
            if expected != label
        )
        false_negative = sum(
            confusion[label][predicted]
            for predicted in SENTIMENT_LABELS
            if predicted != label
        )
        precision = _safe_ratio(true_positive, true_positive + false_positive)
        recall = _safe_ratio(true_positive, true_positive + false_negative)
        scores.append(
            _safe_ratio(2 * precision * recall, precision + recall)
            if precision + recall
            else 0.0
        )
    return round(sum(scores) / len(scores), 4)


def evaluate_sentiment(cases, classifier=route_sentiment):
    """Measures routing and classification without writing application data."""
    confusion = {
        expected: {predicted: 0 for predicted in SENTIMENT_LABELS}
        for expected in SENTIMENT_LABELS
    }
    by_language = defaultdict(lambda: {"total": 0, "correct": 0})
    failures = []
    errors = []
    correct = 0
    routing_correct = 0

    for case in cases:
        expected = case["expected_label"]
        expected_route = case["expected_route"]
        by_language[case["language"]]["total"] += 1
        try:
            score, predicted_label, model = classifier(case["text"])
            predicted = predicted_label.casefold()
            route = "vader" if model == "vader" else "local"
        except Exception as exc:  # Evaluation must record, not hide, model failures.
            errors.append({
                "id": case["id"],
                "error_type": type(exc).__name__,
                "message": str(exc),
            })
            failures.append({
                "id": case["id"],
                "language": case["language"],
                "expected": expected,
                "predicted": None,
                "expected_route": expected_route,
                "actual_route": None,
            })
            continue

        if predicted not in SENTIMENT_LABELS:
            errors.append({
                "id": case["id"],
                "error_type": "InvalidLabel",
                "message": f"Unexpected sentiment label: {predicted_label}",
            })
            continue

        confusion[expected][predicted] += 1
        is_correct = predicted == expected
        route_is_correct = route == expected_route
        correct += int(is_correct)
        routing_correct += int(route_is_correct)
        by_language[case["language"]]["correct"] += int(is_correct)
        if not is_correct or not route_is_correct:
            failures.append({
                "id": case["id"],
                "language": case["language"],
                "expected": expected,
                "predicted": predicted,
                "score": round(float(score), 4),
                "expected_route": expected_route,
                "actual_route": route,
            })

    completed = len(cases) - len(errors)
    return {
        "case_count": len(cases),
        "completed_count": completed,
        "error_count": len(errors),
        "accuracy": _safe_ratio(correct, len(cases)),
        "macro_f1": _macro_f1(confusion),
        "routing_accuracy": _safe_ratio(routing_correct, len(cases)),
        "by_language": {
            language: {
                **counts,
                "accuracy": _safe_ratio(counts["correct"], counts["total"]),
            }
            for language, counts in sorted(by_language.items())
        },
        "confusion_matrix": confusion,
        "failures": failures,
        "errors": errors,
    }


def _tokens(value):
    return set(re.findall(r"[a-z0-9]+", value.casefold()))


def _matches(value, aliases):
    value_tokens = _tokens(value)
    return any(_tokens(alias) <= value_tokens for alias in aliases)


def _evaluate_insight_scenario(scenario, generator):
    reviews = [(review["id"], review["text"]) for review in scenario["reviews"]]
    parsed = ReviewKeywordService._parse(generator(reviews), reviews)
    expected_themes = scenario["expected_themes"]
    matched_expected = set()
    matched_generated = 0
    evidence_issues = []
    generated_themes = parsed["references"]["themes"]

    for generated in generated_themes:
        match = next(
            (
                expected
                for expected in expected_themes
                if _matches(generated["text"], expected["aliases"])
            ),
            None,
        )
        if match is None:
            continue
        matched_generated += 1
        matched_expected.add(match["name"])
        unexpected_ids = sorted(
            set(generated["review_ids"]) - set(match["supporting_review_ids"])
        )
        if unexpected_ids:
            evidence_issues.append({
                "theme": generated["text"],
                "unexpected_review_ids": unexpected_ids,
            })

    forbidden_hits = [
        forbidden["name"]
        for forbidden in scenario.get("forbidden_themes", [])
        if any(
            _matches(generated["text"], forbidden["aliases"])
            for generated in generated_themes
        )
    ]
    precision = _safe_ratio(matched_generated, len(generated_themes))
    recall = _safe_ratio(len(matched_expected), len(expected_themes))
    keyword_f1 = (
        _safe_ratio(2 * precision * recall, precision + recall)
        if precision + recall
        else 0.0
    )
    cited_ids = parsed["references"]["narrative_review_ids"]
    review_text_by_id = dict(reviews)
    return {
        "id": scenario["id"],
        "title": scenario["title"],
        "narrative": parsed["narrative"],
        "narrative_evidence": [
            {"review_id": review_id, "text": review_text_by_id[review_id]}
            for review_id in cited_ids
        ],
        "generated_tags": parsed["tags"],
        "keyword_precision": precision,
        "keyword_recall": recall,
        "keyword_f1": keyword_f1,
        "matched_expected_themes": sorted(matched_expected),
        "missing_expected_themes": sorted(
            theme["name"]
            for theme in expected_themes
            if theme["name"] not in matched_expected
        ),
        "forbidden_theme_hits": forbidden_hits,
        "evidence_issues": evidence_issues,
        "human_review": {
            "expected_facts": scenario["expected_facts"],
            "forbidden_claims": scenario["forbidden_claims"],
            "questions": [
                "Does every narrative claim follow from the cited reviews?",
                "Are negation and mixed opinions preserved?",
                "Are meaningful Filipino or Cebuano terms represented accurately?",
            ],
        },
    }


def _theme_stability(results):
    grouped = defaultdict(list)
    for result in results:
        grouped[result["id"]].append(set(result["matched_expected_themes"]))
    comparisons = []
    for runs in grouped.values():
        if len(runs) == 1:
            comparisons.append(1.0)
            continue
        for left_index, left in enumerate(runs):
            for right in runs[left_index + 1:]:
                union = left | right
                comparisons.append(
                    _safe_ratio(len(left & right), len(union)) if union else 1.0
                )
    return round(sum(comparisons) / len(comparisons), 4) if comparisons else 0.0


def evaluate_generated_insights(
    scenarios,
    generator=ReviewKeywordService._generate,
    repeat_count=1,
):
    """Runs opt-in provider evaluations and retains evidence for human review."""
    if repeat_count < 1:
        raise ValueError("repeat_count must be at least one.")
    results = []
    errors = []
    for scenario in scenarios:
        for run_number in range(1, repeat_count + 1):
            try:
                result = _evaluate_insight_scenario(scenario, generator)
                result["run_number"] = run_number
                results.append(result)
            except Exception as exc:
                errors.append({
                    "id": scenario["id"],
                    "run_number": run_number,
                    "error_type": type(exc).__name__,
                    "message": str(exc),
                })

    metrics = ("keyword_precision", "keyword_recall", "keyword_f1")
    averages = {
        metric: round(sum(result[metric] for result in results) / len(results), 4)
        if results
        else 0.0
        for metric in metrics
    }
    return {
        "scenario_count": len(scenarios),
        "runs_per_scenario": repeat_count,
        "requested_run_count": len(scenarios) * repeat_count,
        "completed_count": len(results),
        "error_count": len(errors),
        **averages,
        "keyword_theme_stability": _theme_stability(results),
        "forbidden_theme_hit_count": sum(
            len(result["forbidden_theme_hits"]) for result in results
        ),
        "evidence_issue_count": sum(
            len(result["evidence_issues"]) for result in results
        ),
        "results": results,
        "errors": errors,
    }


def validate_sentiment_dataset(cases):
    required = {
        "id", "language", "text", "expected_label", "expected_route", "notes",
    }
    ids = [case.get("id") for case in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("Sentiment case IDs must be unique.")
    for case in cases:
        if set(case) != required:
            raise ValueError(f"Invalid sentiment case shape: {case.get('id')}")
        if case["expected_label"] not in SENTIMENT_LABELS:
            raise ValueError(f"Invalid expected label: {case['id']}")
        if case["expected_route"] not in {"vader", "local"}:
            raise ValueError(f"Invalid expected route: {case['id']}")


def validate_insight_dataset(scenarios):
    ids = [scenario.get("id") for scenario in scenarios]
    if len(ids) != len(set(ids)):
        raise ValueError("Insight scenario IDs must be unique.")
    for scenario in scenarios:
        review_ids = {review["id"] for review in scenario["reviews"]}
        if len(review_ids) < ReviewKeywordService.MIN_ELIGIBLE_REVIEWS:
            raise ValueError(f"Insight scenario needs five reviews: {scenario['id']}")
        for theme in scenario["expected_themes"]:
            supporting_ids = set(theme["supporting_review_ids"])
            if (
                len(supporting_ids) < ReviewKeywordService.MIN_REVIEW_COUNT
                or not supporting_ids <= review_ids
            ):
                raise ValueError(f"Invalid theme evidence: {scenario['id']}")
