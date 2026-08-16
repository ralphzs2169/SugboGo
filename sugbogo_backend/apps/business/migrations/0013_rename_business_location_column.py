from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0012_rename_business_location_field"),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE "BUSINESS" RENAME COLUMN "LOC_ID" TO "LOCT_ID";',
            reverse_sql='ALTER TABLE "BUSINESS" RENAME COLUMN "LOCT_ID" TO "LOC_ID";',
        ),
    ]