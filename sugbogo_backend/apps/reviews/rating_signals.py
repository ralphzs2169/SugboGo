"""Cover ORM deletion paths that bypass the review service."""

from django.db.models.signals import pre_delete
from django.dispatch import receiver

from apps.reviews.models import Review
from apps.reviews.services.business_rating_work_service import BusinessRatingWorkService


@receiver(pre_delete, sender=Review)
def invalidate_deleted_review_rating(
    sender,
    instance,
    **kwargs,
):
    """Invalidate existing snapshots without creating rows during parent cascades."""
    Review.objects.select_for_update(of=("self",)).filter(pk=instance.pk).exists()
    BusinessRatingWorkService.request_change(
        instance.BUSN_ID_id,
        initialize=False,
    )
