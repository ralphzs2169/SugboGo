import django.utils.timezone
from django.db import migrations, models


def activate_existing_business_specialties(
    apps,
    schema_editor,
):
    del schema_editor

    BusinessSpecialtyTag = apps.get_model(
        "business",
        "BusinessSpecialtyTag",
    )

    for business_specialty in BusinessSpecialtyTag.objects.all().iterator():
        business_specialty.BST_IS_ACTIVE = True
        business_specialty.BST_ACTIVATED_AT = (
            business_specialty.BST_CREATED_AT
        )
        business_specialty.BST_DEACTIVATED_AT = None

        business_specialty.save(
            update_fields=[
                "BST_IS_ACTIVE",
                "BST_ACTIVATED_AT",
                "BST_DEACTIVATED_AT",
            ],
        )


class Migration(migrations.Migration):

    dependencies = [
        (
            "business",
            "0021_businessspecialtytag_bst_vouch_count",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="businessspecialtytag",
            name="BST_IS_ACTIVE",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="businessspecialtytag",
            name="BST_ACTIVATED_AT",
            field=models.DateTimeField(
                default=django.utils.timezone.now,
            ),
        ),
        migrations.AddField(
            model_name="businessspecialtytag",
            name="BST_DEACTIVATED_AT",
            field=models.DateTimeField(
                blank=True,
                null=True,
            ),
        ),
        migrations.RunPython(
            activate_existing_business_specialties,
            migrations.RunPython.noop,
        ),
    ]
