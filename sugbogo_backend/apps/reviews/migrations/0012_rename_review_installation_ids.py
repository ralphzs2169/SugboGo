from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0011_review_revw_moderation_data"),
    ]

    operations = [
        migrations.RenameField(
            model_name="review",
            old_name="REVW_DEVICE_ID",
            new_name="REVW_INSTALLATION_ID",
        ),
        migrations.RenameField(
            model_name="reviewreport",
            old_name="RREP_DEVICE_ID",
            new_name="RREP_INSTALLATION_ID",
        ),
    ]
