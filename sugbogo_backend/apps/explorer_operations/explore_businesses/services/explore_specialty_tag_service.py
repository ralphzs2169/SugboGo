import hashlib

from apps.business.models import Business, SpecialtyTag
from django.db.models import Count, Q
from django.utils import timezone


class ExploreSpecialtyService:
    """Provide rotating Specialty Tag shortcuts for Explorer discovery."""

    DISPLAY_LIMIT = 6
    PREFERRED_MIN_BUSINESSES = 3

    @classmethod
    def list_specialties(cls):
        """
        Return up to six Specialty Tags with discoverable businesses.

        Tags with at least three active businesses are preferred. When fewer
        than six preferred tags exist, tags with one or two active businesses
        fill the remaining positions.

        Candidate selection rotates deterministically each day, while the
        selected tags are presented from highest to lowest business count.
        """

        specialties = list(
            SpecialtyTag.objects.annotate(
                business_count=Count(
                    "business_links__BUSN_ID",
                    filter=Q(
                        business_links__BST_IS_ACTIVE=True,
                        business_links__BUSN_ID__BUSN_STATUS=(
                            Business.BusinessStatus.ACTIVE
                        ),
                    ),
                    distinct=True,
                ),
            )
            .filter(
                business_count__gte=1,
            )
        )

        preferred = [
            specialty
            for specialty in specialties
            if specialty.business_count >= cls.PREFERRED_MIN_BUSINESSES
        ]

        fallback = [
            specialty
            for specialty in specialties
            if specialty.business_count < cls.PREFERRED_MIN_BUSINESSES
        ]

        rotation_date = timezone.localdate().isoformat()

        def daily_rotation_key(specialty):
            value = (
                f"explore-specialties:"
                f"{rotation_date}:"
                f"{specialty.TAG_ID}"
            )

            return hashlib.sha256(
                value.encode("utf-8"),
            ).digest()

        preferred.sort(
            key=daily_rotation_key,
        )

        fallback.sort(
            key=daily_rotation_key,
        )

        if len(preferred) >= cls.DISPLAY_LIMIT:
            selected = preferred[: cls.DISPLAY_LIMIT]
        else:
            remaining_slots = cls.DISPLAY_LIMIT - len(preferred)

            selected = [
                *preferred,
                *fallback[:remaining_slots],
            ]

        selected.sort(
            key=lambda specialty: (
                -specialty.business_count,
                specialty.TAG_ID,
            ),
        )

        return selected