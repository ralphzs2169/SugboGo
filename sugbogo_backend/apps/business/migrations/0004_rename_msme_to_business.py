from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0003_specialtytag_tag_color"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Msme",
            new_name="Business",
        ),
        migrations.RenameModel(
            old_name="MsmeSpecialtyTag",
            new_name="BusinessSpecialtyTag",
        ),
    ]