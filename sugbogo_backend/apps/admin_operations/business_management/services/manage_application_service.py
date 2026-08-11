from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationFeedback,
)


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

    @staticmethod
    def get_application_statistics():
        """Retrieve aggregate statistics for merchant applications."""

        return MerchantApplication.objects.aggregate(
            pending_review=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
                ),
            ),
            approved=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
                ),
            ),
            rejected=Count(
                "MAPP_ID",
                filter=Q(
                    MAPP_STATUS=MerchantApplication.ApplicationStatus.REJECTED,
                ),
            ),
            total_applications=Count("MAPP_ID"),
        )

    @staticmethod
    @transaction.atomic
    def reject_application(application_id, feedback):
        """
        Reject a submitted merchant application and store
        section-specific administrator feedback.
        """

        try:
            application = MerchantApplication.objects.get(
                MAPP_ID=application_id,
            )
        except MerchantApplication.DoesNotExist:
            raise NotFound(
                "The application could not be found.",
            )

        if (
            application.MAPP_STATUS
            != MerchantApplication.ApplicationStatus.SUBMITTED
        ):
            raise ValidationError(
                "Only submitted applications can be rejected.",
            )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
        application.MAPP_REVIEWED_AT = timezone.now()

        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ],
        )

        MerchantApplicationFeedback.objects.filter(
            MAPP_ID=application,
        ).delete()

        MerchantApplicationFeedback.objects.bulk_create(
            [
                MerchantApplicationFeedback(
                    MAPP_ID=application,
                    MAPF_SECTION=item["section"],
                    MAPF_MESSAGE=item["message"],
                )
                for item in feedback
            ]
        )

        return application

    @staticmethod
    @transaction.atomic
    def approve_application(application_id):
        """
        Approve a submitted merchant application.
        """

        try:
            application = MerchantApplication.objects.get(
                MAPP_ID=application_id,
            )
        except MerchantApplication.DoesNotExist:
            raise NotFound(
                "The application could not be found.",
            )

        if (
            application.MAPP_STATUS
            != MerchantApplication.ApplicationStatus.SUBMITTED
        ):
            raise ValidationError(
                "Only submitted applications can be approved.",
            )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.MAPP_REVIEWED_AT = timezone.now()

        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ],
        )

        return application