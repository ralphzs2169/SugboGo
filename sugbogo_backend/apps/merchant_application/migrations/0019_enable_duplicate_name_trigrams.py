from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("merchant_application", "0018_duplicate_business_review"),
    ]

    operations = [
        TrigramExtension(),
    ]
