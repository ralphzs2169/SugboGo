from rest_framework import serializers

from apps.business.models import Business
from apps.business.services.display_cover_photo import display_cover_photo_expression


class BusinessDisplayCoverPhotoField(serializers.Field):
    """Expose the mobile cover preference through existing Admin image fields."""

    def __init__(
        self,
        business_source=None,
        **kwargs,
    ):
        """Read a query annotation or resolve the business for single-record responses."""
        self.business_source = business_source
        super().__init__(
            source="*",
            read_only=True,
            **kwargs,
        )

    def to_representation(self, instance):
        """Use the batched annotation before falling back for standalone serialization."""
        if hasattr(instance, "display_cover_photo_url"):
            return instance.display_cover_photo_url

        business = instance
        if self.business_source:
            business = getattr(instance, self.business_source)
        if business is None:
            return None
        if business.BUSN_COVER_PHOTO_URL:
            return business.BUSN_COVER_PHOTO_URL
        return (
            Business.objects.filter(pk=business.pk)
            .annotate(display_cover_photo_url=display_cover_photo_expression())
            .values_list("display_cover_photo_url", flat=True)
            .first()
        )
