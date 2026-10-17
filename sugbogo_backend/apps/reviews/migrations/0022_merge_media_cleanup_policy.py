"""Join review cleanup and stored-summary policy provenance without rewriting applied history."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0020_review_media_cleanup"),
        ("reviews", "0021_review_summary_policy_provenance"),
    ]

    operations = []
