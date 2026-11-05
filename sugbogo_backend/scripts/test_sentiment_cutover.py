"""Run sentiment transition regressions without contacting the live pilot broker."""

import os
import sys
from pathlib import Path


def main():
    """Isolate delivery and run checks plus focused disposable-database suites."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    os.environ["GEMINI_SENTIMENT_SHADOW_ENABLED"] = "False"
    os.environ["GEMINI_SENTIMENT_CUTOVER_ENABLED"] = "False"
    os.environ["GEMINI_SENTIMENT_SHADOW_BUSINESS_IDS"] = ""
    os.environ["CELERY_BROKER_URL"] = "memory://"

    import django

    django.setup()

    from django.core.management import call_command

    call_command("check")
    call_command("makemigrations", check=True, dry_run=True)
    call_command(
        "test",
        "apps.reviews.services.tests.test_gemini_sentiment_shadow",
        "apps.reviews.services.tests.test_gemini_sentiment_cutover",
        "apps.reviews.services.tests.test_review_sentiment_service",
        "apps.reviews.services.tests.test_business_rating_service",
        "apps.reviews.services.tests.test_business_rating_lifecycle",
        "apps.reviews.services.tests.test_business_review_summary_service",
        verbosity=1,
        interactive=False,
    )


if __name__ == "__main__":
    main()
