from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
    MerchantApplicationFeedback,
    MerchantApplicationOperatingHours,
    MerchantApplicationPhotos,
)


class ApplicationService:
    @staticmethod
    def get_current_application(user):
        """
        Retrieve the current merchant application for the given user.

        Returns None if no application exists.
        """
        return MerchantApplication.objects.filter(
            USER_ID=user
        ).order_by("-MAPP_CREATED_AT").first()

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
        Records the step that was successfully saved and advances the
        highest completed step without allowing it to move backward.
        """
        application.MAPP_HIGHEST_COMPLETED_STEP = max(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            step,
        )
        application.save(
            update_fields=[
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )


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
        Rejected applications may be resubmitted after the merchant
        addresses the administrator's feedback.
        """

        # Validate that the application is in draft 
        if application.MAPP_STATUS not in (
            MerchantApplication.ApplicationStatus.DRAFT,
            MerchantApplication.ApplicationStatus.REJECTED,
        ):
            raise ValidationError(
                "This application can no longer be submitted."
            )

        # Validate that the application has completed all steps
        if application.MAPP_HIGHEST_COMPLETED_STEP < 5:
            raise ValidationError(
                f"Complete Step {application.MAPP_HIGHEST_COMPLETED_STEP + 1} first."
            )
        
        ApplicationService.validate_application_for_submission(
            application
        )

         # Remove previous admin feedback when starting a new review cycle.
        if application.MAPP_STATUS == MerchantApplication.ApplicationStatus.REJECTED:
            application.feedback.all().delete()

        # Update the application status to submitted and record the submission timestamp
        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )

        application.MAPP_SUBMITTED_AT = timezone.now()
        application.MAPP_REVIEWED_AT = None
        application.MAPP_REJECTION_REASON = None

        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMITTED_AT",
                "MAPP_REVIEWED_AT",
                "MAPP_REJECTION_REASON",
                "MAPP_UPDATED_AT",
            ]
        )

        return application

    @staticmethod
    @transaction.atomic
    def review_application(application, action, rejection_reason="", feedback=None):
        """Complete one admin review of a submitted merchant application."""
        locked_application = MerchantApplication.objects.select_for_update().get(
            pk=application.pk
        )

        if (
            locked_application.MAPP_STATUS
            != MerchantApplication.ApplicationStatus.SUBMITTED
        ):
            raise ValidationError("Only submitted applications can be reviewed.")

        locked_application.MAPP_REVIEWED_AT = timezone.now()

        if action == "approve":
            locked_application.MAPP_STATUS = (
                MerchantApplication.ApplicationStatus.APPROVED
            )
            locked_application.MAPP_REJECTION_REASON = None
            locked_application.feedback.all().delete()
        else:
            locked_application.MAPP_STATUS = (
                MerchantApplication.ApplicationStatus.REJECTED
            )
            locked_application.MAPP_REJECTION_REASON = rejection_reason
            locked_application.feedback.all().delete()
            MerchantApplicationFeedback.objects.bulk_create(
                [
                    MerchantApplicationFeedback(
                        MAPP_ID=locked_application,
                        MAPF_SECTION=item["section"],
                        MAPF_MESSAGE=item["message"],
                    )
                    for item in feedback or []
                ]
            )

        locked_application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_REVIEWED_AT",
                "MAPP_REJECTION_REASON",
                "MAPP_UPDATED_AT",
            ]
        )

        return locked_application

