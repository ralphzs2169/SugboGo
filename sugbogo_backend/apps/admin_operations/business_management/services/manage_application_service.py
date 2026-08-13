from django.db import transaction
from django.db.models import Case, Count, IntegerField, Prefetch, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
    MerchantApplicationFeedback,
    MerchantApplicationReview,
)
from apps.merchant_application.utils.application_queue import get_business_day_cutoff


class ApplicationService:
    """Service class for administrator-facing merchant application queries."""
    
    @staticmethod
    def list_applications(
        search=None,
        ordering=None,
        status=None,
        queue_status=None,
    ):
        """
        Retrieve merchant applications for the admin applications table.

        Supports optional business-name search, status filtering, and
        ordering while eagerly loading the relationships required
        by the list serializer.
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

        if queue_status:
            queryset = ApplicationService._filter_by_queue_status(
                queryset,
                queue_status,
            )

        ordering_map = {
            "business_name": "identity__MIDN_BUSINESS_NAME",
            "-business_name": "-identity__MIDN_BUSINESS_NAME",
            "status": "MAPP_STATUS",
            "-status": "-MAPP_STATUS",
            "submitted_at": "MAPP_SUBMITTED_AT",
            "-submitted_at": "-MAPP_SUBMITTED_AT",
        }

        if ordering:
            return queryset.order_by(
                ordering_map.get(
                    ordering,
                    "-MAPP_SUBMITTED_AT",
                )
            )

        return (
            queryset
            .annotate(
                review_priority=Case(
                    When(
                        MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
                        then=Value(0),
                    ),
                    default=Value(1),
                    output_field=IntegerField(),
                )
            )
            .order_by(
                "review_priority",
                "MAPP_SUBMITTED_AT",
            )
        )

    @staticmethod
    def _filter_by_queue_status(queryset, queue_status):
        """
        Filter applications by their calculated review queue status.

        Uses business-day date boundaries so filtering happens in the
        database before pagination.
        """

        if queue_status == "resolved":
            return queryset.filter(
                MAPP_STATUS__in=[
                    MerchantApplication.ApplicationStatus.APPROVED,
                    MerchantApplication.ApplicationStatus.REJECTED,
                ],
            )

        if queue_status not in {
            "on_time",
            "approaching",
            "overdue",
        }:
            raise ValidationError(
                "Invalid queue status.",
            )

        queryset = queryset.filter(
            MAPP_SUBMITTED_AT__isnull=False,
            MAPP_REVIEWED_AT__isnull=True,
        )

        approaching_cutoff = get_business_day_cutoff(
            APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
        )

        overdue_cutoff = get_business_day_cutoff(
            APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
        )

        if queue_status == "overdue":
            return queryset.filter(
                MAPP_SUBMITTED_AT__date__lte=overdue_cutoff,
            )

        if queue_status == "approaching":
            return queryset.filter(
                MAPP_SUBMITTED_AT__date__gt=overdue_cutoff,
                MAPP_SUBMITTED_AT__date__lte=approaching_cutoff,
            )

        return queryset.filter(
            MAPP_SUBMITTED_AT__date__gt=approaching_cutoff,
        )

    @staticmethod
    def get_document_for_review(application_id, document_id):
        """Retrieve one verification document belonging to an application."""

        return get_object_or_404(
            MerchantApplicationDocument,
            MDOC_ID=document_id,
            MAPP_ID=application_id,
        )


    @staticmethod
    def get_application_for_review(application_id):
        """
        Retrieve one merchant application with all data required
        by the admin review page, including previous review history.
        """

        review_history = Prefetch(
            "reviews",
            queryset=(
                MerchantApplicationReview.objects
                .select_related("USER_ID")
                .prefetch_related("feedback")
                .order_by("-MAREV_REVIEWED_AT")
            ),
            to_attr="admin_review_history",
        )

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
                review_history,
            ),
            MAPP_ID=application_id,
        )

    @staticmethod
    def get_application_statistics():
        """Retrieve aggregate statistics and review SLA configuration."""

        statistics = MerchantApplication.objects.aggregate(
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

        return {
            **statistics,
            "review_sla_business_days": APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
            "review_sla_approaching_business_days": (
                APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS
            ),
        }

    @staticmethod
    @transaction.atomic
    def reject_application(application_id, feedback, reviewer):
        """
        Reject a submitted merchant application.

        Creates a permanent review record and stores the section-specific
        feedback against that review so the feedback remains available
        after future resubmissions.
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

        reviewed_at = timezone.now()

        review = MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            USER_ID=reviewer,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=reviewed_at,
        )

        MerchantApplicationFeedback.objects.bulk_create(
            [
                MerchantApplicationFeedback(
                    MAREV_ID=review,
                    MAPF_SECTION=item["section"],
                    MAPF_MESSAGE=item["message"],
                )
                for item in feedback
            ]
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.REJECTED
        )
        application.MAPP_REVIEWED_AT = reviewed_at

        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ],
        )

        return application

    @staticmethod
    @transaction.atomic
    def approve_application(application_id, reviewer):
        """
        Approve a submitted merchant application.

        Creates a permanent approval review record so the complete
        administrative decision history is preserved.
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

        reviewed_at = timezone.now()

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            USER_ID=reviewer,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=reviewed_at,
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.MAPP_REVIEWED_AT = reviewed_at

        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ],
        )

        return application