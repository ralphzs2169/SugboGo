import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "business",
            "0005_remove_businessspecialtytag_unique_msme_specialty_tag_and_more",
        ),
    ]

    operations = [
        # Remove the old constraint before renaming its field.
        migrations.RemoveConstraint(
            model_name="businessspecialtytag",
            name="unique_business_specialty_tag",
        ),

        # Business field renames.
        migrations.RenameField(
            model_name="business",
            old_name="MSME_ID",
            new_name="BUSN_ID",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_NAME",
            new_name="BUSN_NAME",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_DESCRIPTION",
            new_name="BUSN_DESCRIPTION",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_STATUS",
            new_name="BUSN_STATUS",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_IS_VERIFIED",
            new_name="BUSN_IS_VERIFIED",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_VOUCH_COUNT",
            new_name="BUSN_VOUCH_COUNT",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_REVIEW_COUNT",
            new_name="BUSN_REVIEW_COUNT",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_POCKET_COUNT",
            new_name="BUSN_POCKET_COUNT",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_CREATED_AT",
            new_name="BUSN_CREATED_AT",
        ),
        migrations.RenameField(
            model_name="business",
            old_name="MSME_UPDATED_AT",
            new_name="BUSN_UPDATED_AT",
        ),

        # BusinessSpecialtyTag field renames.
        migrations.RenameField(
            model_name="businessspecialtytag",
            old_name="MTAG_ID",
            new_name="BST_ID",
        ),
        migrations.RenameField(
            model_name="businessspecialtytag",
            old_name="MTAG_CREATED_AT",
            new_name="BST_CREATED_AT",
        ),
        migrations.RenameField(
            model_name="businessspecialtytag",
            old_name="MTAG_UPDATED_AT",
            new_name="BST_UPDATED_AT",
        ),
        migrations.RenameField(
            model_name="businessspecialtytag",
            old_name="MSME_ID",
            new_name="BUSN_ID",
        ),

        # DiscoveryScore field rename.
        migrations.RenameField(
            model_name="discoveryscore",
            old_name="MSME_ID",
            new_name="BUSN_ID",
        ),

        # Update the explicit database column names and FK targets.
        migrations.AlterField(
            model_name="businessspecialtytag",
            name="BUSN_ID",
            field=models.ForeignKey(
                db_column="BUSN_ID",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="specialty_tag_links",
                to="business.business",
            ),
        ),
        migrations.AlterField(
            model_name="discoveryscore",
            name="BUSN_ID",
            field=models.ForeignKey(
                db_column="BUSN_ID",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="discovery_scores",
                to="business.business",
            ),
        ),

        # Restore the constraint using the new field name.
        migrations.AddConstraint(
            model_name="businessspecialtytag",
            constraint=models.UniqueConstraint(
                fields=("BUSN_ID", "TAG_ID"),
                name="unique_business_specialty_tag",
            ),
        ),
    ]