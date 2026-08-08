from django.db import transaction

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationIdentity,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.users.models import User


class IdentityService:
    STEP = 1

    @staticmethod
    @transaction.atomic
    def save_identity(user, validated_data):
        """
        Step 1. First save for this user: creates the parent
        MerchantApplication and the Identity record together, atomically.
        Subsequent saves: updates the existing Identity in place.

        Progress is advanced only when the persisted identity contains
        all required Step 1 information.
        """

        specialty_tags = validated_data.pop("specialty_tags", None)

        # Locking the user row serializes first saves from multiple devices.
        # The database uniqueness constraint is the final backstop.
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        application, _ = MerchantApplication.objects.get_or_create(
            USER_ID=locked_user
        )

        ApplicationService.validate_application_editable(application)

        identity = getattr(application, "identity", None)

        if identity is None:
            # First save for this application.
            identity = MerchantApplicationIdentity.objects.create(
                MAPP_ID=application,
                **validated_data,
            )
        else:
            # Subsequent saves update only the supplied fields.
            for field, value in validated_data.items():
                setattr(identity, field, value)

            # Save only the fields included in the partial update.
            if validated_data:
                identity.save(
                    update_fields=list(validated_data.keys())
                )

        # Only modify specialty tags when they were included in the PATCH.
        if specialty_tags is not None:
            identity.specialty_tags.set(specialty_tags)

        ApplicationService.mark_step_completed(application, IdentityService.STEP)

        return application, identity

    @staticmethod
    def _is_step_complete(identity):
        """Return whether the persisted identity satisfies Step 1 requirements."""

        required_fields = (
            identity.MIDN_BUSINESS_NAME,
            identity.MIDN_CONTACT_NUMBER,
            identity.MIDN_REPRESENTATIVE_NAME,
            identity.MIDN_REPRESENTATIVE_ROLE,
            identity.CLUS_ID_id,
            identity.CTGRY_ID_id,
        )

        if not all(required_fields):
            return False

        return identity.specialty_tags.count() == 3
