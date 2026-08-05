from django.db import transaction

from apps.registration.models import MerchantApplication, MerchantApplicationIdentity


class IdentityService:
    @staticmethod
    @transaction.atomic
    def save_identity(user, validated_data):
        """
        Step 1. First save for this user: creates the parent
        MerchantApplication and the Identity record together, atomically.
        Subsequent saves: updates the existing Identity in place.

        current_step / highest_completed_step are popped off here since
        they belong to the parent Application, not Identity.
        """
        current_step = validated_data.pop("MAPP_CURRENT_STEP")
        highest_completed_step = validated_data.pop("MAPP_HIGHEST_COMPLETED_STEP")
        specialty_tags = validated_data.pop("specialty_tags", [])

        application = (
            MerchantApplication.objects
            .filter(USER_ID=user)
            .order_by("-MAPP_CREATED_AT")
            .first()
        )

        if application is None:
            application = MerchantApplication.objects.create(USER_ID=user)

        application.MAPP_CURRENT_STEP = current_step
        application.MAPP_HIGHEST_COMPLETED_STEP = highest_completed_step
        application.save(
            update_fields=[
                "MAPP_CURRENT_STEP",
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

        identity = getattr(application, "identity", None)

        if identity is None:
            identity = MerchantApplicationIdentity.objects.create(
                MAPP_ID=application, **validated_data
            )
        else:
            for field, value in validated_data.items():
                setattr(identity, field, value)
            identity.save()

        if specialty_tags:
            identity.specialty_tags.set(specialty_tags)

        return application, identity