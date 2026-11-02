from apps.business.models import Business
from apps.business.services.pocket_collection_service import PocketCollectionService


class PocketCollectionQueryService:
    """Keeps owned saved memberships visible independently of public eligibility."""

    @staticmethod
    def list_businesses(
        user,
        collection_id,
    ):
        """Return saved identity rows in membership order, including unavailable listings."""
        collection = PocketCollectionService.get_collection(user, collection_id)
        return Business.objects.filter(
            pocket_entries__USER_ID=user,
            pocket_entries__collection_memberships__PCOL_ID=collection,
        ).order_by(
            "-pocket_entries__collection_memberships__PMEM_CREATED_AT",
            "-pocket_entries__collection_memberships__PMEM_ID",
        )
