from django.db import transaction

from apps.registration.models import MerchantApplication, MerchantApplicationIdentity
from apps.registration.services.application_service import ApplicationService


class IdentityService:
    STEP = 1

    @staticmethod
    @transaction.atomic
    def save_identity(user, validated_data):
        """
        Step 1. First save for this user: creates the parent
        MerchantApplication and the Identity record together, atomically.
        Subsequent saves: updates the existing Identity in place.

        Progress is determined and updated by the backend after
        the identity data has been successfully saved.
        """
    
        specialty_tags = validated_data.pop("specialty_tags")

        application = (
            MerchantApplication.objects
            .filter(USER_ID=user)
            .order_by("-MAPP_CREATED_AT")
            .first()
        )

        if application is None:
            application = MerchantApplication.objects.create(USER_ID=user)


        identity = getattr(application, "identity", None)

        if identity is None:
            # First save for this application: create the Identity record.
            identity = MerchantApplicationIdentity.objects.create(
                MAPP_ID=application, **validated_data
            )
        else:
            # Subsequent save: update the existing Identity record in place.
            for field, value in validated_data.items():
                setattr(identity, field, value)

            identity.save(update_fields=list(validated_data.keys()))

        if specialty_tags:
            identity.specialty_tags.set(specialty_tags)

        # Mark Step 1 as completed on the parent application.
        ApplicationService.mark_step_completed(
                    application,
                    IdentityService.STEP,
                )
        
        return application, identity