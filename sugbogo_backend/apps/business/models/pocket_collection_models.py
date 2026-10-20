from django.conf import settings
from django.db import models
from django.db.models.functions import Lower, Trim

from .business_pocket_models import BusinessPocket


class PocketCollection(models.Model):
    """A private named collection owned by one explorer account."""

    PCOL_ID = models.AutoField(primary_key=True)
    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="pocket_collections",
    )
    PCOL_NAME = models.CharField(max_length=100)
    PCOL_IS_DEFAULT = models.BooleanField(default=False)
    PCOL_CREATED_AT = models.DateTimeField(auto_now_add=True)
    PCOL_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "POCKET_COLLECTION"
        ordering = ["-PCOL_IS_DEFAULT", "PCOL_CREATED_AT", "PCOL_ID"]
        constraints = [
            models.UniqueConstraint(
                models.F("USER_ID"),
                Lower(Trim("PCOL_NAME")),
                name="unique_owner_pocket_name",
            ),
            models.UniqueConstraint(
                fields=["USER_ID"],
                condition=models.Q(PCOL_IS_DEFAULT=True),
                name="unique_owner_default_pocket",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(PCOL_NAME="")
                    & models.Q(PCOL_NAME=Trim("PCOL_NAME"))
                ),
                name="pocket_name_trimmed_nonempty",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(PCOL_IS_DEFAULT=False)
                    | models.Q(PCOL_NAME="Favorites")
                ),
                name="default_pocket_named_favorites",
            ),
        ]


class PocketMembership(models.Model):
    """Places a unique saved business in one of its owner's collections."""

    PMEM_ID = models.AutoField(primary_key=True)
    PCOL_ID = models.ForeignKey(
        PocketCollection,
        on_delete=models.CASCADE,
        db_column="PCOL_ID",
        related_name="memberships",
    )
    PCKT_ID = models.ForeignKey(
        BusinessPocket,
        on_delete=models.CASCADE,
        db_column="PCKT_ID",
        related_name="collection_memberships",
    )
    PMEM_CREATED_AT = models.DateTimeField(auto_now_add=True)
    PMEM_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "POCKET_MEMBERSHIP"
        ordering = ["-PMEM_CREATED_AT", "-PMEM_ID"]
        constraints = [
            models.UniqueConstraint(
                fields=["PCOL_ID", "PCKT_ID"],
                name="unique_collection_saved_business",
            ),
        ]
        indexes = [
            models.Index(
                fields=["PCOL_ID", "-PMEM_CREATED_AT", "-PMEM_ID"],
                name="pocket_membership_chronology",
            ),
        ]
