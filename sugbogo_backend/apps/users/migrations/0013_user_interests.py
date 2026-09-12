import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0025_alter_discoveryscore_options_and_more"),
        ("users", "0012_reputation_event_logical_source"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserCategoryInterest",
            fields=[
                (
                    "UCIN_ID",
                    models.AutoField(
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("UCIN_CREATED_AT", models.DateTimeField(auto_now_add=True)),
                (
                    "CTGRY_ID",
                    models.ForeignKey(
                        db_column="CTGRY_ID",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_interests",
                        to="business.category",
                    ),
                ),
                (
                    "USER_ID",
                    models.ForeignKey(
                        db_column="USER_ID",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="category_interests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "USER_CATEGORY_INTEREST",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("USER_ID", "CTGRY_ID"),
                        name="unique_user_category_interest",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="UserSpecialtyTagInterest",
            fields=[
                (
                    "UTIN_ID",
                    models.AutoField(
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("UTIN_CREATED_AT", models.DateTimeField(auto_now_add=True)),
                (
                    "TAG_ID",
                    models.ForeignKey(
                        db_column="TAG_ID",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_interests",
                        to="business.specialtytag",
                    ),
                ),
                (
                    "USER_ID",
                    models.ForeignKey(
                        db_column="USER_ID",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="specialty_tag_interests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "USER_SPECIALTY_TAG_INTEREST",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("USER_ID", "TAG_ID"),
                        name="unique_user_specialty_tag_interest",
                    ),
                ],
            },
        ),
    ]
