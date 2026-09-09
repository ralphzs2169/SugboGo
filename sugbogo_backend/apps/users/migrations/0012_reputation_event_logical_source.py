from django.db import migrations, models


def populate_reputation_event_source_keys(
    apps,
    schema_editor,
):
    del schema_editor

    ReputationEvent = apps.get_model(
        "users",
        "ReputationEvent",
    )

    for event in ReputationEvent.objects.iterator():
        event.REVT_SOURCE_KEY = (
            f"legacy:{event.REVT_SOURCE_TYPE}:"
            f"{event.REVT_SOURCE_ID}"
        )
        event.save(
            update_fields=[
                "REVT_SOURCE_KEY",
            ],
        )


class Migration(migrations.Migration):

    dependencies = [
        (
            "users",
            (
                "0011_reputationevent_alter_user_"
                "user_reputation_and_more"
            ),
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="reputationevent",
            name="REVT_SOURCE_KEY",
            field=models.CharField(
                max_length=255,
                null=True,
            ),
        ),
        migrations.RunPython(
            populate_reputation_event_source_keys,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="reputationevent",
            name="REVT_SOURCE_KEY",
            field=models.CharField(
                max_length=255,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="reputationevent",
            name="unique_reputation_event_source",
        ),
        migrations.AddConstraint(
            model_name="reputationevent",
            constraint=models.UniqueConstraint(
                fields=(
                    "REVT_SOURCE_TYPE",
                    "REVT_EVENT_TYPE",
                    "REVT_SOURCE_KEY",
                ),
                name="unique_reputation_event_logical_source",
            ),
        ),
    ]
