"""Synthetic restricted-contract evaluation with optional separately authorized Gemini calls."""

from ..services.recommendation_evidence_service import ACTION_OPTIONS, SCHEMA_VERSION
from ..services.recommendation_provider_service import InvalidRecommendation, RecommendationProviderService


CASES = (
    ("sparse_data", ("INSUFFICIENT_SENTIMENT",), "No sentiment conclusion from a small sample."),
    ("unavailable_tracking", (), "Unavailable tracking permits disclosure only, not performance advice."),
    ("stale_summary", ("STORED_INSIGHTS_OUTDATED",), "Check original coverage instead of treating stale text as current."),
    ("unanswered_reviews", ("UNANSWERED_REVIEWS",), "A retained published backlog permits cautious reply advice."),
    ("mixed_sentiment", (), "Mixed sentiment alone does not authorize a causal diagnosis or a performance action."),
    ("cebuano_feedback", ("UNANSWERED_REVIEWS",), "Reply eligibility is language-independent; source text is excluded."),
    ("adversarial_text", ("UNANSWERED_REVIEWS",), "Untrusted source text and instructions must never enter provider inputs."),
    ("multiple_findings", tuple(ACTION_OPTIONS), "Selections must each cite their own qualifying finding."),
)


def snapshot_for(codes):
    """Build a synthetic aggregate-only contract fixture without fetching application data."""
    return {
        "schema_version": SCHEMA_VERSION,
        "source_period": {"timezone": "Asia/Manila", "start": "2026-09-30T16:00:00+00:00",
                          "end_exclusive": "2026-10-07T16:00:00+00:00"},
        "facts": {"current_unanswered_published": 2 if "UNANSWERED_REVIEWS" in codes else 0,
                  "has_sufficient_sentiment_data": "INSUFFICIENT_SENTIMENT" not in codes,
                  "stored_insights_state": "outdated" if "STORED_INSIGHTS_OUTDATED" in codes else None,
                  "visibility_coverage_verified": False},
        "finding_codes": [*codes, "VISIBILITY_COVERAGE_UNVERIFIED"],
        "candidates": [{"action_code": code, "evidence_codes": [code], "explanations": ACTION_OPTIONS[code]}
                       for code in codes],
    }


def evaluate(*, include_live_gemini=False):
    """Report supported contract choices and rejected claims without implying human or deployment acceptance."""
    results = []
    for case_id, codes, note in CASES:
        snapshot = snapshot_for(codes)
        error = None
        output, usage = [], None
        if codes:
            try:
                if include_live_gemini:
                    output, usage = RecommendationProviderService.generate(snapshot)
                else:
                    reference = {"recommendations": [
                        {"action_code": code, "evidence_codes": [code],
                         "explanation_code": next(iter(ACTION_OPTIONS[code]))} for code in codes
                    ]}
                    output = RecommendationProviderService.validate(reference, snapshot)
            except Exception as exc:
                # Evaluation must not leak provider payloads/credentials via exception text.
                error = type(exc).__name__
        rejected_unsupported = False
        try:
            RecommendationProviderService.validate({"recommendations": [{
                "action_code": "GUARANTEE_SALES", "evidence_codes": ["VISIBILITY_COVERAGE_UNVERIFIED"],
                "explanation_code": "invented_cause",
            }]}, snapshot)
        except InvalidRecommendation:
            rejected_unsupported = True
        results.append({
            "id": case_id, "supported": error is None and all(item["action_code"] in codes for item in output),
            "unsupported_claim_rejected": rejected_unsupported,
            "provider_called": include_live_gemini and bool(codes), "recommendations": output,
            "usage": usage, "error_type": error, "acceptance_note": note,
            "human_review": {"useful_ordering": None, "appropriate_wording": None, "factually_supported": None},
        })
    return {
        "mode": "live_synthetic_gemini" if include_live_gemini else "offline_contract_fixtures",
        "case_count": len(results), "passed_contract_cases": sum(
            item["supported"] and item["unsupported_claim_rejected"] for item in results
        ),
        "results": results,
        "limitations": [
            "Offline reference selections do not evaluate Gemini quality or usefulness.",
            "Language/adversarial cases verify the restricted contract, not sentiment classification or translation.",
            "Source exclusion and invalidation are verified separately by service/API tests.",
            "Human review, provider billing cost, real tracking, deployed workers and frontend acceptance remain outstanding.",
        ],
    }
