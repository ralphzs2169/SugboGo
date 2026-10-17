"""Join independent entitlement and recommendation histories without changing their operations."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("merchant_analytics", "0001_initial"),
        ("merchant_analytics", "0002_merchant_recommendations"),
    ]

    operations = []
