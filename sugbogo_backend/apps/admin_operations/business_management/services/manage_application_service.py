from django.shortcuts import get_object_or_404

from apps.merchant_application.models import MerchantApplication


class ApplicationService:
    """Service class for administrator-facing merchant application queries."""

    @staticmethod
    def list_applications(search=None, ordering=None, status=None):
        """
        Retrieve merchant applications for the admin applications table.

        Supports optional business-name search, status filtering, and
        ordering while eagerly loading the relationships required by
        the list serializer.
        """

        queryset = (
            MerchantApplication.objects
            .select_related(
                "USER_ID",
                "identity",
                "identity__CLUS_ID",
                "identity__CTGRY_ID",
            )
        )

        if search:
            queryset = queryset.filter(
                identity__MIDN_BUSINESS_NAME__icontains=search,
            )

        if status:
            queryset = queryset.filter(
                MAPP_STATUS=status,
            )

        ordering_map = {
            "business_name": "identity__MIDN_BUSINESS_NAME",
            "-business_name": "-identity__MIDN_BUSINESS_NAME",
            "status": "MAPP_STATUS",
            "-status": "-MAPP_STATUS",
            "submitted_at": "MAPP_SUBMITTED_AT",
            "-submitted_at": "-MAPP_SUBMITTED_AT",
        }

        return queryset.order_by(
            ordering_map.get(
                ordering,
                "-MAPP_SUBMITTED_AT",
            )
        )

    @staticmethod
    def get_application_for_review(application_id):
        """
        Retrieve one merchant application with all data required
        by the admin review page.
        """

        return get_object_or_404(
            MerchantApplication.objects
            .select_related(
                "identity",
                "identity__CLUS_ID",
                "identity__CTGRY_ID",
                "location",
            )
            .prefetch_related(
                "identity__specialty_tags",
                "location__landmarks",
                "operating_hours",
                "photos",
                "documents",
                "feedback",
            ),
            MAPP_ID=application_id,
        )