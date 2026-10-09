from django.db.models import Count, Exists, OuterRef, Prefetch, Subquery

from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch


class VouchHistoryService:
    """Builds business history from the user's currently visible endorsements."""

    @staticmethod
    def _eligible_vouches(user):
        """Returns the user's vouches on active businesses and active assignments."""
        active_assignment = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            TAG_ID=OuterRef("TAG_ID"),
            BST_IS_ACTIVE=True,
        )
        return (
            BusinessVouch.objects
            .filter(
                USER_ID=user,
                BUSN_ID__BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .filter(Exists(active_assignment))
        )

    @staticmethod
    def get_summary(user):
        """Counts eligible businesses and specialty vouches across the full history."""
        return VouchHistoryService._eligible_vouches(user).aggregate(
            total_businesses=Count("BUSN_ID", distinct=True),
            total_specialty_vouches=Count("VOUCH_ID"),
        )

    @staticmethod
    def list_vouches(user, ordering="newest"):
        """Returns unique businesses with the user's eligible vouches eager-loaded."""
        eligible_vouches = VouchHistoryService._eligible_vouches(user)
        latest_vouch = (
            eligible_vouches
            .filter(BUSN_ID=OuterRef("BUSN_ID"))
            .order_by("-VOUCH_CREATED_AT", "-VOUCH_ID")
        )
        user_vouch = BusinessVouch.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            TAG_ID=OuterRef("TAG_ID"),
            USER_ID=user,
        )
        specialty_tags = (
            BusinessSpecialtyTag.objects
            .filter(BST_IS_ACTIVE=True)
            .select_related("TAG_ID")
            .annotate(is_vouched=Exists(user_vouch))
            .order_by("BST_ID")
        )
        order_fields = (
            ("last_vouched_at", "BUSN_ID")
            if ordering == "oldest"
            else ("-last_vouched_at", "-BUSN_ID")
        )
        return (
            Business.objects
            .filter(BUSN_STATUS=Business.BusinessStatus.ACTIVE)
            .annotate(
                last_vouched_at=Subquery(
                    latest_vouch.values("VOUCH_CREATED_AT")[:1],
                ),
            )
            .filter(last_vouched_at__isnull=False)
            .select_related("CTGRY_ID")
            .prefetch_related(
                Prefetch(
                    "specialty_tag_links",
                    queryset=specialty_tags,
                    to_attr="active_specialty_tag_links",
                ),
                Prefetch(
                    "vouches",
                    queryset=(
                        eligible_vouches
                        .select_related("TAG_ID")
                        .order_by("-VOUCH_CREATED_AT", "-VOUCH_ID")
                    ),
                    to_attr="visible_vouches",
                ),
            )
            .order_by(*order_fields)
        )
