from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.merchant_application.models import MerchantApplication


class ApplicationService:
    @staticmethod
    def get_current_application(user):
        """
        Retrieve the merchant's current application (most recent one),
        regardless of status. Returns None if they haven't started yet.
        """
        return (
            MerchantApplication.objects
            .filter(USER_ID=user)
            .order_by("-MAPP_CREATED_AT")
            .first()
        )

    @staticmethod
    def get_application_for_user(user, application_id):
        """Retrieve a specific application, scoped to its owner."""
        return get_object_or_404(
            MerchantApplication,
            MAPP_ID=application_id,
            USER_ID=user,
        )

    @staticmethod
    def mark_step_completed(application, step):
        """
        Records the step that was successfully saved and advances the
        highest completed step without allowing it to move backward.
        """
        application.MAPP_CURRENT_STEP = step
        application.MAPP_HIGHEST_COMPLETED_STEP = max(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            step,
        )
        application.save(
            update_fields=[
                "MAPP_CURRENT_STEP",
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

    @staticmethod
    def validate_step_access(application, step):
        """Ensure the requested step does not skip an incomplete step."""
        if step > application.MAPP_HIGHEST_COMPLETED_STEP + 1:
            raise ValidationError(
                f"Complete Step {application.MAPP_HIGHEST_COMPLETED_STEP + 1} first."
            )

        
    @staticmethod
    @transaction.atomic
    def submit_application(application):
        """
        Flip the application to SUBMITTED and stamp the submission time.

        NOTE: Does not currently validate that every step (identity,
        location, hours, photos, documents) is complete before allowing
        submission — flag with Ralph/adviser whether that check belongs
        here or on the frontend before calling this endpoint.
        """
        application.MAPP_STATUS = MerchantApplication.ApplicationStatus.SUBMITTED
        application.MAPP_SUBMITTED_AT = timezone.now()
        application.save(
            update_fields=["MAPP_STATUS", "MAPP_SUBMITTED_AT", "MAPP_UPDATED_AT"]
        )
        return application