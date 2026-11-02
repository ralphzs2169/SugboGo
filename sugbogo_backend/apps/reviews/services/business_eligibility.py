"""Business eligibility for public review reads and engagement writes."""

from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.users.models import User


def require_active_business(
    business_id,
    *,
    lock=False,
    reader=None,
):
    """Read current eligibility, optionally serializing a write or allowing private owner reads."""
    queryset = Business.objects.all()
    if lock:
        queryset = queryset.select_for_update()
    try:
        business = queryset.get(pk=business_id)
    except Business.DoesNotExist:
        raise NotFound("The business could not be found.") from None
    privileged_read = (
        reader is not None
        and (
            business.USER_ID_id == reader.pk
            or reader.USER_ROLE in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)
        )
    )
    if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE and not privileged_read:
        raise NotFound("The business could not be found.")
    return business
