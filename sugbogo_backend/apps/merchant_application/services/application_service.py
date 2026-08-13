from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
    MerchantApplicationFeedback,
    MerchantApplicationOperatingHours,
    MerchantApplicationPhotos,
    MerchantApplicationReview,
)


class ApplicationService:
    """Service class for handling merchant application operations."""
    
    @staticmethod
    def get_current_application(user):
        """
        Retrieve the current merchant application with all relationships
        required by the application detail serializer eagerly loaded.
        """
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
                "reviews__feedback",
            )
            .filter(USER_ID=user)
            .order_by("-MAPP_CREATED_AT")
            .first()
        ) 
    

    @staticmethod
    def mark_section_updated(application, field_name):
        setattr(application, field_name, timezone.now())
        application.save(
            update_fields=[
                field_name,
                "MAPP_UPDATED_AT",
            ]
        )

    @staticmethod
    def validate_application_editable(application):
        """Allow merchant changes only while drafting or correcting a rejection."""
        if application.MAPP_STATUS not in (
            MerchantApplication.ApplicationStatus.DRAFT,
            MerchantApplication.ApplicationStatus.REJECTED,
        ):
            raise ValidationError(
                "This application is under review or has already been approved."
            )


    
    @staticmethod
    def mark_step_completed(application, step):
        """
        Recalculate persisted progress after a section changes.
        """
        del step
        application.MAPP_HIGHEST_COMPLETED_STEP = (
            ApplicationService.get_highest_completed_step(application)
        )
        application.save(
            update_fields=[
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

    @staticmethod
    def get_highest_completed_step(application):
        """Derive the resume step from the application's saved records."""
        identity = getattr(application, "identity", None)
        if identity is None or not all(
            (
                identity.MIDN_BUSINESS_NAME,
                identity.MIDN_BUSINESS_DESCRIPTION,
                identity.MIDN_CONTACT_NUMBER,
                identity.MIDN_REPRESENTATIVE_NAME,
                identity.MIDN_REPRESENTATIVE_ROLE,
                identity.CLUS_ID_id,
                identity.CTGRY_ID_id,
            )
        ) or identity.specialty_tags.count() != 3:
            return 0

        location = getattr(application, "location", None)
        if location is None or location.MLOC_POINT is None or not all(
            (
                location.MLOC_PROVINCE,
                location.MLOC_CITY,
                location.MLOC_BARANGAY,
                location.MLOC_STREET_ADDRESS,
            )
        ):
            return 1

        operating_hours = MerchantApplicationOperatingHours.objects.filter(
            MAPP_ID=application
        )
        if operating_hours.count() != 7 or not operating_hours.filter(
            MHRS_IS_OPEN=True
        ).exists():
            return 2

        if not MerchantApplicationPhotos.objects.filter(
            MAPP_ID=application,
            MPHT_CATEGORY=MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
        ).exists():
            return 3

        if not MerchantApplicationDocument.objects.filter(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
        ).exists():
            return 4

        return 5

    @staticmethod
    def validate_step_access(application, step_number):
        """
        Validate that the user has access to the specified step of the application.

        Raises a ValidationError if the user does not have access.
        """
        ApplicationService.validate_application_editable(application)

        if application.MAPP_HIGHEST_COMPLETED_STEP < step_number - 1:
            raise ValidationError(
                f"Complete Step {application.MAPP_HIGHEST_COMPLETED_STEP + 1} first."
            )
        
    @staticmethod
    def validate_application_for_submission(application):
        """
        Validate the persisted application state before submission.
        """

        errors = {}

        # Step 1 — Business Identity
        identity = getattr(application, "identity", None)

        if identity is None:
            errors["identity"] = "Business identity is required."
        else:
            if identity.specialty_tags.count() != 3:
                errors["specialty_tags"] = "Exactly 3 specialty tags are required."


        # Step 2 — Business Location
        location = getattr(application, "location", None)

        if location is None:
            errors["location"] = "Business location is required."
        else:
            if location.MLOC_POINT is None:
                errors["location"] = "Business location coordinates are required."

        # Step 3 — Operating Hours
        hours_count = MerchantApplicationOperatingHours.objects.filter(
            MAPP_ID=application
        ).count()

        if hours_count == 0:
            errors["operating_hours"] = "Operating hours are required."
        else:
            if hours_count < 7:
                errors["operating_hours"] = "Operating hours for all 7 days are required."

        # Step 4 — Business Photos
        storefront_count = MerchantApplicationPhotos.objects.filter(
            MAPP_ID=application,
            MPHT_CATEGORY=MerchantApplicationPhotos.PhotoCategory.STOREFRONT,
        ).count()

        if storefront_count < 1:
            errors["photos"] = "At least one storefront photo is required."

        # Step 5 — Verification Documents
        registration_exists = MerchantApplicationDocument.objects.filter(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
        ).exists()

        if not registration_exists:
            errors["documents"] = "Business registration document is required."

        if errors:
            raise ValidationError(errors)

    @staticmethod
    @transaction.atomic
    def submit_application(application):
        """
        Submit or resubmit a merchant application.

        Draft applications may be submitted for the first time.
        Rejected applications may be resubmitted after addressing
        the administrator's previous feedback.
        """

        # Lock the application row to prevent concurrent submissions
        application = (
            MerchantApplication.objects
            .select_for_update()
            .get(MAPP_ID=application.MAPP_ID)
        )

        if application.MAPP_STATUS not in (
            MerchantApplication.ApplicationStatus.DRAFT,
            MerchantApplication.ApplicationStatus.REJECTED,
        ):
            raise ValidationError(
                "This application can no longer be submitted."
            )

        # Check if the application is being resubmitted after rejection
        if application.MAPP_STATUS == MerchantApplication.ApplicationStatus.REJECTED:
            # Check if all sections with feedback have been updated
            latest_review = (
                MerchantApplicationReview.objects
                .filter(
                    MAPP_ID=application,
                    MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
                )
                .prefetch_related("feedback")
                .order_by("-MAREV_REVIEWED_AT")
                .first()
            )

            if latest_review:
                incomplete_feedback = [
                    feedback
                    for feedback in latest_review.feedback.all()
                    if not ApplicationService.has_section_changed_after_review(
                        feedback
                    )
                ]

                if incomplete_feedback:
                    raise ValidationError({
                        "resubmission": (
                            "All sections requiring changes must be updated "
                            "before resubmitting."
                        )
                    })

        ApplicationService.mark_step_completed(application, step=None)

        if application.MAPP_HIGHEST_COMPLETED_STEP < 5:
            raise ValidationError(
                f"Complete Step {application.MAPP_HIGHEST_COMPLETED_STEP + 1} first."
            )

        ApplicationService.validate_application_for_submission(
            application
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.MAPP_SUBMITTED_AT = timezone.now()
        application.MAPP_REVIEWED_AT = None
        application.MAPP_SUBMISSION_COUNT += 1

        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMITTED_AT",
                "MAPP_REVIEWED_AT",
                "MAPP_SUBMISSION_COUNT",
                "MAPP_UPDATED_AT",
            ]
        )

        return application
    

    @staticmethod
    def has_section_changed_after_review(feedback):
        """
        Determine whether the application section associated with this
        feedback was modified after the review that requested the change.
        """
        application = feedback.MAREV_ID.MAPP_ID
        reviewed_at = feedback.MAREV_ID.MAREV_REVIEWED_AT
        section = feedback.MAPF_SECTION

        section_updated_at = {
            MerchantApplicationFeedback.Section.IDENTITY:
                application.MAPP_IDENTITY_UPDATED_AT,

            MerchantApplicationFeedback.Section.LOCATION:
                application.MAPP_LOCATION_UPDATED_AT,

            MerchantApplicationFeedback.Section.OPERATING_HOURS:
                application.MAPP_OPERATING_HOURS_UPDATED_AT,

            MerchantApplicationFeedback.Section.PHOTOS:
                application.MAPP_PHOTOS_UPDATED_AT,

            MerchantApplicationFeedback.Section.DOCUMENTS:
                application.MAPP_DOCUMENTS_UPDATED_AT,
        }.get(section)

        return (
            section_updated_at is not None
            and section_updated_at > reviewed_at
        )