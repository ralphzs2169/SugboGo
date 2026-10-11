from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0027_clusterdiscoveryshortcut"),
    ]

    operations = [
        migrations.RenameField(
            model_name="businessvouch",
            old_name="VOUCH_DEVICE_ID",
            new_name="VOUCH_INSTALLATION_ID",
        ),
    ]
