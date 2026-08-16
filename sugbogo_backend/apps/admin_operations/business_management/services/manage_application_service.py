from django.db import transaction
from django.db.models import Case, IntegerField, Prefetch, Value, When
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business, BusinessOperatingHours, BusinessPhoto, BusinessSpecialtyTag, Location
from apps.merchant_application.constants import (
    APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS,
    APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
    REVIEWABLE_APPLICATION_STATUSES,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
    MerchantApplicationFeedback,
    MerchantApplicationIdentity,
    MerchantApplicationLocation,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.merchant_application.utils.application_queue import (
    get_business_day_cutoff,
    is_review_sla_compliant,
)
from apps.users.models import User


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
            .filter(
                MAPP_STATUS__in=REVIEWABLE_APPLICATION_STATUSES,
            )
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

        try:
            return MerchantApplicationDocument.objects.get(
                MDOC_ID=document_id,
                MAPP_ID=application_id,
            )
        except MerchantApplicationDocument.DoesNotExist:
            raise NotFound(
                "The requested document could not be found.",
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

        try:
            return (
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
                )
                .get(MAPP_ID=application_id)
            )
        except MerchantApplication.DoesNotExist:
            raise NotFound(
                "The application could not be found.",
            )
    
    @staticmethod
    @transaction.atomic
    def reject_application(application_id, feedback, reviewer):
        """
        Reject a submitted merchant application.

        Creates a permanent review record and stores the section-specific
        feedback against that review so the feedback remains available
        after future resubmissions.
        """

        application = (
            MerchantApplication.objects
            .select_for_update()
            .filter(MAPP_ID=application_id)
            .first()
        )

        if application is None:
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

        # Get the most recent submission for the application
        submission = (
            MerchantApplicationSubmission.objects
            .filter(MAPP_ID=application)
            .order_by("-MASUB_SUBMISSION_NUMBER")
            .first()
        )

        if submission is None:
            raise ValidationError(
                "The application's submission history could not be found.",
            )

        reviewed_at = timezone.now()

        sla_compliant = is_review_sla_compliant(
            submission,
            reviewed_at,
        )
        
        review = MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission,
            USER_ID=reviewer,
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT=reviewed_at,
            MAREV_SLA_COMPLIANT=sla_compliant,
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

        Creates the permanent Business, Location, Photo, and Operating Hours
        records from the approved application data, records the approval review,
        and promotes the applicant to the merchant role.
        """

        application = (
            MerchantApplication.objects
            .select_for_update()
            .filter(MAPP_ID=application_id)
            .first()
        )

        if application is None:
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

        submission = (
            MerchantApplicationSubmission.objects
            .filter(MAPP_ID=application)
            .order_by("-MASUB_SUBMISSION_NUMBER")
            .first()
        )

        if submission is None:
            raise ValidationError(
                "The application's submission history could not be found.",
            )

        try:
            identity = application.identity
        except MerchantApplicationIdentity.DoesNotExist:
            raise ValidationError(
                "The application's business identity could not be found.",
            )

        try:
            application_location = application.location
        except MerchantApplicationLocation.DoesNotExist:
            raise ValidationError(
                "The application's business location could not be found.",
            )

        reviewed_at = timezone.now()

        sla_compliant = is_review_sla_compliant(
            submission,
            reviewed_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=submission,
            USER_ID=reviewer,
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT=reviewed_at,
            MAREV_SLA_COMPLIANT=sla_compliant,
        )

        # Create permanent location.

        location_address_parts = [
            application_location.MLOC_STREET_ADDRESS,
            application_location.MLOC_UNIT,
            application_location.MLOC_BARANGAY,
        ]

        location = Location.objects.create(
            LOCT_POINT=application_location.MLOC_POINT,
            LOCT_ADDRESS=", ".join(
                part
                for part in location_address_parts
                if part
            ),
            LOCT_CITY=application_location.MLOC_CITY,
            LOCT_PROVINCE=application_location.MLOC_PROVINCE,
        )

        # Create permanent business.

        business = Business.objects.create(
            BUSN_NAME=identity.MIDN_BUSINESS_NAME,
            BUSN_DESCRIPTION=identity.MIDN_BUSINESS_DESCRIPTION,
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=application.USER_ID,
            CTGRY_ID=identity.CTGRY_ID,
            LOC_ID=location,
        )

        # Copy specialty tags.

        specialty_tags = identity.specialty_tags.all()

        BusinessSpecialtyTag.objects.bulk_create(
            [
                BusinessSpecialtyTag(
                    BUSN_ID=business,
                    TAG_ID=tag,
                )
                for tag in specialty_tags
            ]
        )

        # Copy approved operating hours.

        application_hours = application.operating_hours.all()

        BusinessOperatingHours.objects.bulk_create(
            [
                BusinessOperatingHours(
                    BUSN_ID=business,
                    BOHR_DAY=hours.MHRS_DAY,
                    BOHR_IS_OPEN=hours.MHRS_IS_OPEN,
                    BOHR_IS_24_HOURS=hours.MHRS_IS_24_HOURS,
                    BOHR_OPEN_TIME=hours.MHRS_OPEN_TIME,
                    BOHR_CLOSE_TIME=hours.MHRS_CLOSE_TIME,
                )
                for hours in application_hours
            ]
        )

        # Link the permanent Business to the approved application.

        application.BUSN_ID = business
        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )
        application.MAPP_REVIEWED_AT = reviewed_at

        application.save(
            update_fields=[
                "BUSN_ID",
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ],
        )

        # Promote the applicant to merchant.

        applicant = application.USER_ID

        applicant.USER_ROLE = User.UserRole.MERCHANT
        applicant.save(
            update_fields=[
                "USER_ROLE",
                "USER_UPDATED_AT",
            ],
        )

        return application