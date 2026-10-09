from django.db.models import Exists, OuterRef, Prefetch

from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch


class VouchHistoryService:
    """Builds the authenticated user's currently visible specialty vouch history."""

    @staticmethod
    def list_vouches(user, ordering="newest"):
        """Returns active specialty vouches with all history relations eager-loaded."""
        active_assignment = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            TAG_ID=OuterRef("TAG_ID"),
            BST_IS_ACTIVE=True,
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
            ("VOUCH_CREATED_AT", "VOUCH_ID")
            if ordering == "oldest"
            else ("-VOUCH_CREATED_AT", "-VOUCH_ID")
        )
        return (
            BusinessVouch.objects
            .filter(
                USER_ID=user,
                BUSN_ID__BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .filter(Exists(active_assignment))
            .select_related("BUSN_ID__CTGRY_ID", "TAG_ID")
            .prefetch_related(
                Prefetch(
                    "BUSN_ID__specialty_tag_links",
                    queryset=specialty_tags,
                    to_attr="active_specialty_tag_links",
                ),
            )
            .order_by(*order_fields)
        )
