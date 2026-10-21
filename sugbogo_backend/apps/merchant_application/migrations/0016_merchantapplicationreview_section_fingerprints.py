from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("merchant_application", "0015_merchantapplication_mapp_merchant_mode_acknowledged"),
    ]

    operations = [
        migrations.AddField(
            model_name="merchantapplicationreview",
            name="MAREV_SECTION_FINGERPRINTS",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
