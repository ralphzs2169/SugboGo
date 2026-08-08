from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("merchant_application", "0004_merchantapplicationfeedback"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="merchantapplication",
            constraint=models.UniqueConstraint(
                fields=("USER_ID",),
                name="unique_merchant_application_per_user",
            ),
        ),
    ]
