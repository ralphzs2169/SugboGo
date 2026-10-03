from rest_framework.request import Request

from apps.merchant_operations.business_profile.throttles import (
    BusinessCoverPhotoThrottle,
)


def get_cover_photo_retry_after(request: Request) -> int | None:
    """Return the authenticated merchant's remaining cover-photo cooldown."""

    if not request:
        return None

    return BusinessCoverPhotoThrottle.get_retry_after(
        request.user,
    )


def get_cover_photo_update_allowance(request: Request) -> dict:
    """Return the server-enforced rolling cover-photo allowance."""
    return BusinessCoverPhotoThrottle.get_allowance(
        request.user if request else None,
    )
