"""Join the duplicated review merge heads while preserving both migration histories."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0022_merge_20261016_0400"),
        ("reviews", "0022_merge_media_cleanup_policy"),
    ]

    operations = []
