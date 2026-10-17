from apps.business.services.pocket_collection_service import PocketCollectionService

from .new_businesses_service import NewBusinessesService


class PocketCollectionQueryService:
    """Reuses the maintained discovery card queryset for private collection contents."""

    @staticmethod
    def list_businesses(user, collection_id):
        """Returns available owned contents with image, review, and specialty annotations."""
        collection = PocketCollectionService.get_collection(user, collection_id)
        return (
            NewBusinessesService.list_new_businesses(user)
            .filter(
                pocket_entries__USER_ID=user,
                pocket_entries__collection_memberships__PCOL_ID=collection,
            )
            .order_by(
                "-pocket_entries__collection_memberships__PMEM_CREATED_AT",
                "-pocket_entries__collection_memberships__PMEM_ID",
            )
        )
