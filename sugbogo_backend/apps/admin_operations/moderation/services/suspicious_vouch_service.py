"""Read-only queries for advisory vouch findings."""

from django.db.models import Q, Value
from django.db.models.functions import Concat
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import NotFound

from apps.business.models import BusinessVouch
from apps.business.services.vouch_service import VouchService


class SuspiciousVouchService:
    """Loads flagged submissions without redefining evidence eligibility."""

    CONTEXT_LIMIT = 20

    @staticmethod
    def queryset():
        """Retains withdrawn and invalid findings with joined display identities."""
        return BusinessVouch.objects.select_related(
            "USER_ID",
            "BUSN_ID",
            "TAG_ID",
        ).filter(VOUCH_FLAG_SUSPICIOUS=True)

    @staticmethod
    def list_vouches(filters):
        """Searches display identities before stable server-side pagination."""
        queryset = SuspiciousVouchService.queryset()
        search = filters.get("search")
        if search:
            queryset = queryset.annotate(
                author_name=Concat(
                    "USER_ID__USER_FNAME",
                    Value(" "),
                    "USER_ID__USER_LNAME",
                ),
            ).filter(
                Q(author_name__icontains=search)
                | Q(BUSN_ID__BUSN_NAME__icontains=search)
                | Q(TAG_ID__TAG_NAME__icontains=search)
            )
        if filters.get("ordering") == "oldest":
            return queryset.order_by(
                "VOUCH_CREATED_AT",
                "VOUCH_ID",
            )
        return queryset.order_by(
            "-VOUCH_CREATED_AT",
            "-VOUCH_ID",
        )

    @staticmethod
    def get_vouch(vouch_id):
        """Returns a flagged vouch or a controlled not-found response."""
        try:
            return SuspiciousVouchService.queryset().get(pk=vouch_id)
        except BusinessVouch.DoesNotExist:
            raise NotFound("The suspicious vouch could not be found.") from None

    @staticmethod
    def related_vouches(vouch):
        """Bounds live context to the persisted detection window without exposing IDs."""
        evidence = vouch.VOUCH_RELIABILITY_EVIDENCE
        if not isinstance(evidence, dict):
            return None
        finding = evidence.get(VouchService.CONCENTRATION_REASON, {})
        if not isinstance(finding, dict):
            return None
        try:
            window_start = parse_datetime(finding.get("window_start", ""))
            window_end = parse_datetime(finding.get("observed_at", ""))
        except (TypeError, ValueError):
            return None
        if (
            window_start is None
            or window_end is None
            or timezone.is_naive(window_start)
            or timezone.is_naive(window_end)
            or window_start > window_end
            or window_end - window_start > VouchService.CONCENTRATION_WINDOW
            or not vouch.VOUCH_INSTALLATION_ID
        ):
            return None

        rows = list(
            BusinessVouch.objects.select_related(
                "USER_ID",
                "BUSN_ID",
                "TAG_ID",
            ).filter(
                BUSN_ID_id=vouch.BUSN_ID_id,
                VOUCH_INSTALLATION_ID=vouch.VOUCH_INSTALLATION_ID,
                VOUCH_CREATED_AT__gte=window_start,
                VOUCH_CREATED_AT__lte=window_end,
            ).order_by(
                "-VOUCH_CREATED_AT",
                "-VOUCH_ID",
            )[:SuspiciousVouchService.CONTEXT_LIMIT + 1],
        )
        return {
            "items": rows[:SuspiciousVouchService.CONTEXT_LIMIT],
            "has_more": len(rows) > SuspiciousVouchService.CONTEXT_LIMIT,
        }
