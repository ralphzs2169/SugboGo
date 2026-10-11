"""Narrow, deterministic Cebuano direct-threat fallback for review text."""

import re


OPTIONAL_INTENSIFIER = r"(?:\s+(?:gyud|jud))?"
DIRECT_OBJECT = r"(?:nako|namo|ko|tika|ka)"

DIRECT_THREAT_RULES = (
    (
        "direct_kill_threat",
        re.compile(
            rf"\b(?:patyon|patyun){OPTIONAL_INTENSIFIER}"
            rf"\s+{DIRECT_OBJECT}\b"
        ),
    ),
    (
        "direct_kill_threat",
        re.compile(
            rf"\bmopatay{OPTIONAL_INTENSIFIER}\s+ko\s+nimo\b"
        ),
    ),
    (
        "direct_shoot_threat",
        re.compile(
            rf"\b(?:pusilon|pusilun){OPTIONAL_INTENSIFIER}"
            rf"\s+{DIRECT_OBJECT}\b"
        ),
    ),
    (
        "direct_punch_threat",
        re.compile(
            rf"\b(?:sumbagon|sumbagun){OPTIONAL_INTENSIFIER}"
            rf"\s+{DIRECT_OBJECT}\b"
        ),
    ),
)


class ReviewCebuanoSafetyFallback:
    """Recognize a small set of direct first-person violent threats."""

    @staticmethod
    def finding(text: str) -> dict | None:
        """Return one local moderation finding without retaining review text."""
        normalized_text = " ".join(text.casefold().split())

        for rule_name, pattern in DIRECT_THREAT_RULES:
            if pattern.search(normalized_text):
                return {
                    "source": "local_cebuano_safety",
                    "photo_index": None,
                    "flagged": True,
                    "category": "violence_threat",
                    "matched_rule": rule_name,
                }

        return None
