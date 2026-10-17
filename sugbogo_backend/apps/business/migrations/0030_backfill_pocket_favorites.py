from django.db import migrations
from django.db.models import Q


def backfill_favorites(apps, schema_editor):
    """Associates historical saves with Favorites without replaying save lifecycle effects."""
    database = schema_editor.connection.alias
    user_model = apps.get_model("users", "User")
    collection_model = apps.get_model("business", "PocketCollection")
    saved_model = apps.get_model("business", "BusinessPocket")
    membership_model = apps.get_model("business", "PocketMembership")

    # Preserve legacy saves even if their owner no longer has an eligible role.
    users = user_model.objects.using(database).filter(
        Q(USER_ROLE__in=("explorer", "merchant"))
        | Q(business_pockets__isnull=False),
    ).distinct().order_by("pk")
    for user in users.iterator(chunk_size=500):
        collection_model.objects.using(database).get_or_create(
            USER_ID_id=user.pk,
            PCOL_IS_DEFAULT=True,
            defaults={"PCOL_NAME": "Favorites"},
        )

    batch = []
    for saved in saved_model.objects.using(database).order_by("pk").iterator(chunk_size=500):
        batch.append(saved)
        if len(batch) == 500:
            backfill_memberships(collection_model, membership_model, database, batch)
            batch = []
    if batch:
        backfill_memberships(collection_model, membership_model, database, batch)


def backfill_memberships(collection_model, membership_model, database, saves):
    """Copies original save timestamps to new memberships in bounded, repeatable batches."""
    favorites = dict(
        collection_model.objects.using(database).filter(
            USER_ID_id__in={saved.USER_ID_id for saved in saves},
            PCOL_IS_DEFAULT=True,
        ).values_list("USER_ID_id", "pk"),
    )
    existing = set(
        membership_model.objects.using(database).filter(
            PCKT_ID_id__in=[saved.pk for saved in saves],
        ).values_list("PCOL_ID_id", "PCKT_ID_id"),
    )
    pending = []
    timestamps = {}
    for saved in saves:
        collection_id = favorites[saved.USER_ID_id]
        if (collection_id, saved.pk) in existing:
            continue
        pending.append(membership_model(PCOL_ID_id=collection_id, PCKT_ID_id=saved.pk))
        timestamps[saved.pk] = (saved.PCKT_CREATED_AT, saved.PCKT_UPDATED_AT)
    if not pending:
        return
    membership_model.objects.using(database).bulk_create(pending, batch_size=500)
    # auto_now fields are populated during bulk_create; restore historical values afterward.
    for membership in pending:
        membership.PMEM_CREATED_AT, membership.PMEM_UPDATED_AT = timestamps[membership.PCKT_ID_id]
    membership_model.objects.using(database).bulk_update(
        pending,
        ["PMEM_CREATED_AT", "PMEM_UPDATED_AT"],
        batch_size=500,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0029_pocket_collections"),
        ("users", "0015_disable_legacy_bootstrap_superadmin"),
    ]

    operations = [
        migrations.RunPython(backfill_favorites, migrations.RunPython.noop),
    ]
