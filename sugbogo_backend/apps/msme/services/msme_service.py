from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.msme.models import Msme


class MsmeService:
    @staticmethod
    def list_msmes(search=None, ordering=None, category_id=None, cluster_id=None):
        """
        Retrieve ACTIVE msmes only (UC-02 Browse MSMEs stub) with optional
        search, category/cluster filtering, and ordering.
        Pending/rejected/suspended MSMEs are intentionally excluded —
        they are not yet meant to surface to Explorers.
        """
        queryset = (
            Msme.objects
            .select_related("CTGRY_ID", "CTGRY_ID__CLUS_ID", "LOC_ID")
            .filter(MSME_STATUS=Msme.MsmeStatus.ACTIVE)
        )

        if category_id:
            queryset = queryset.filter(CTGRY_ID=category_id)

        if cluster_id:
            queryset = queryset.filter(CTGRY_ID__CLUS_ID=cluster_id)

        if search:
            queryset = queryset.filter(
                Q(MSME_NAME__icontains=search)
                | Q(MSME_DESCRIPTION__icontains=search)
            )

        ordering_map = {
            "name": "MSME_NAME",
            "-name": "-MSME_NAME",
            "created_at": "MSME_CREATED_AT",
            "-created_at": "-MSME_CREATED_AT",
            "vouch_count": "MSME_VOUCH_COUNT",
            "-vouch_count": "-MSME_VOUCH_COUNT",
        }

        return queryset.order_by(ordering_map.get(ordering, "MSME_NAME"))

    @staticmethod
    def get_msme(msme_id: int):
        """
        Retrieve a specific msme by ID (UC-02 View MSME Profile stub).
        Not restricted to ACTIVE status — a direct-link view is a
        different access pattern than browsing. Revisit once real
        registration/ownership flows exist.
        """
        return get_object_or_404(
            Msme.objects.select_related("CTGRY_ID", "CTGRY_ID__CLUS_ID", "LOC_ID"),
            MSME_ID=msme_id,
        )

    @staticmethod
    @transaction.atomic
    def verify_msme(msme, action: str, reason: str = ""):
        """
        UC-12 Review Merchant Registrations (stub) — binary Approve/Reject.
        Approve sets MSME_STATUS=active AND MSME_IS_VERIFIED=True together,
        per the manuscript's treatment of these as one verification event.

        NOTE: `reason` is accepted but not yet persisted anywhere — no
        admin-notes field exists on MSME. Flagged per UC-12 Alternative
        Flow A1, to revisit once the full registration/audit trail exists.
        """
        if action == "approve":
            msme.MSME_STATUS = Msme.MsmeStatus.ACTIVE
            msme.MSME_IS_VERIFIED = True
        else:  # reject
            msme.MSME_STATUS = Msme.MsmeStatus.REJECTED
            msme.MSME_IS_VERIFIED = False

        msme.save()

        return msme