from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.business.models import Business


class BusinessService:
    @staticmethod
    def list_businesses(search=None, ordering=None, category_id=None, cluster_id=None):
        """
        Retrieve ACTIVE businesses only (UC-02 Browse Businesses stub) with optional
        search, category/cluster filtering, and ordering.
        Pending/rejected/suspended Businesses are intentionally excluded —
        they are not yet meant to surface to Explorers.
        """
        queryset = (
            Business.objects
            .select_related("CTGRY_ID", "CTGRY_ID__CLUS_ID", "LOC_ID")
            .filter(BUSN_STATUS=Business.BusinessStatus.ACTIVE)
        )

        if category_id:
            queryset = queryset.filter(CTGRY_ID=category_id)

        if cluster_id:
            queryset = queryset.filter(CTGRY_ID__CLUS_ID=cluster_id)

        if search:
            queryset = queryset.filter(
                Q(BUSN_NAME__icontains=search)
                | Q(BUSN_DESCRIPTION__icontains=search)
            )

        ordering_map = {
            "name": "BUSN_NAME",
            "-name": "-BUSN_NAME",
            "created_at": "BUSN_CREATED_AT",
            "-created_at": "-BUSN_CREATED_AT",
            "vouch_count": "BUSN_VOUCH_COUNT",
            "-vouch_count": "-BUSN_VOUCH_COUNT",
        }

        return queryset.order_by(ordering_map.get(ordering, "BUSN_NAME"))

    @staticmethod
    def get_business(business_id: int):
        """
        Retrieve a specific business by ID (UC-02 View Business Profile stub).
        Not restricted to ACTIVE status — a direct-link view is a
        different access pattern than browsing. Revisit once real
        registration/ownership flows exist.
        """
        return get_object_or_404(
            Business.objects.select_related("CTGRY_ID", "CTGRY_ID__CLUS_ID", "LOC_ID"),
            BUSN_ID=business_id,
        )

    @staticmethod
    @transaction.atomic
    def verify_business(business: Business, action: str, reason: str = ""):
        """
        UC-12 Review Merchant Registrations (stub) — binary Approve/Reject.
        Approve sets BUSN_STATUS=active AND BUSN_IS_VERIFIED=True together,
        per the manuscript's treatment of these as one verification event.

        NOTE: `reason` is accepted but not yet persisted anywhere — no
        admin-notes field exists on Business. Flagged per UC-12 Alternative
        Flow A1, to revisit once the full registration/audit trail exists.
        """
        if action == "approve":
            business.BUSN_STATUS = Business.BusinessStatus.ACTIVE
            business.BUSN_IS_VERIFIED = True
        else:  # reject
            business.BUSN_STATUS = Business.BusinessStatus.REJECTED
            business.BUSN_IS_VERIFIED = False

        business.save()

        return business