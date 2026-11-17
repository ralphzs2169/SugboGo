from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0035_businesslandmark_blmk_access_directions_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="discoveryscore",
            name="DSC_REFRESH_DEFERRED",
            field=models.BooleanField(default=False),
        ),
    ]
