from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        (
            "system_configuration",
            (
                "0002_alter_discoveryalgorithmconfiguration_"
                "dac_approved_report_reputation_reward_and_more"
            ),
        ),
    ]

    operations = [
        migrations.RemoveField(
            model_name="discoveryalgorithmconfiguration",
            name="DAC_VOUCH_ONLY_CONFIDENCE",
        ),
        migrations.RemoveField(
            model_name="discoveryalgorithmconfiguration",
            name="DAC_VOUCH_REVIEW_CONFIDENCE",
        ),
        migrations.RemoveField(
            model_name="discoveryalgorithmconfiguration",
            name="DAC_VOUCH_REVIEW_PHOTO_CONFIDENCE",
        ),
    ]
