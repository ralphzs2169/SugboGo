from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0011_businesslandmark"),
    ]

    operations = [
        migrations.RenameField(
            model_name="business",
            old_name="LOC_ID",
            new_name="LOCT_ID",
        ),
    ]