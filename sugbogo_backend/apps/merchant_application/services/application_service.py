from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
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
        Submit a completed merchant application.

        Submission is only allowed for draft applications that have
        successfully completed all registration steps.
        """

        # Validate that the application is in draft 
        if (
            application.MAPP_STATUS
            != MerchantApplication.ApplicationStatus.DRAFT
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

        # Update the application status to submitted and record the submission timestamp
        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )

        application.MAPP_SUBMITTED_AT = timezone.now()

        application.save(
            update_fields=[
                "MAPP_STATUS",
                "MAPP_SUBMITTED_AT",
                "MAPP_UPDATED_AT",
            ]
        )

        return application


