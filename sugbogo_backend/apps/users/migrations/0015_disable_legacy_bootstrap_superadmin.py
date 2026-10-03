from django.contrib.auth.hashers import make_password
from django.db import migrations


def disable_legacy_bootstrap_superadmin(apps, schema_editor):
    """Disable the retired bootstrap identity without assigning a new secret."""
    user_model = apps.get_model("users", "User")

    # These non-secret values were all written by the historical bootstrap
    # migration and distinguish its record from an unrelated same-email user.
    user_model.objects.filter(
        USER_EMAIL="superadmin@gmail.com",
        USER_FNAME="Super",
        USER_LNAME="Admin",
        USER_ROLE="super_admin",
        USER_STATUS="active",
        EMAIL_VERIFIED=True,
        EMAIL_VERIFIED_AT__isnull=True,
        USER_IS_VERIFIED=True,
        is_staff=True,
        is_superuser=True,
    ).update(
        password=make_password(None),
        USER_STATUS="disabled",
        EMAIL_VERIFIED=False,
        EMAIL_VERIFIED_AT=None,
        is_staff=False,
        is_superuser=False,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0014_remove_user_user_use_oauth_avatar_and_more"),
    ]

    operations = [
        migrations.RunPython(
            disable_legacy_bootstrap_superadmin,
            migrations.RunPython.noop,
        ),
    ]
