from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.business.models import Category, SpecialtyTag
from apps.users.models import (
    UserCategoryInterest,
    UserSpecialtyTagInterest,
)


class UserInterestService:
    """Reads and atomically replaces a user's authoritative interests."""

    @staticmethod
    def get_interests(user):
        """Retrieves selected and available interests for a user."""
        category_interests = (
            UserCategoryInterest.objects
            .filter(USER_ID=user)
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
            )
            .order_by("CTGRY_ID_id")
        )

        specialty_interests = (
            UserSpecialtyTagInterest.objects
            .filter(USER_ID=user)
            .select_related("TAG_ID")
            .order_by("TAG_ID_id")
        )

        available_categories = (
            Category.objects
            .select_related("CLUS_ID")
            .order_by(
                "CLUS_ID__CLUS_NAME",
                "CTGRY_NAME",
                "CTGRY_ID",
            )
        )

        available_specialty_tags = (
            SpecialtyTag.objects
            .order_by(
                "TAG_NAME",
                "TAG_ID",
            )
        )

        return {
            "categories": [
                interest.CTGRY_ID
                for interest in category_interests
            ],
            "specialty_tags": [
                interest.TAG_ID
                for interest in specialty_interests
            ],
            "available_categories": available_categories,
            "available_specialty_tags": available_specialty_tags,
        }

    @staticmethod
    def _get_categories(category_ids):
        """Retrieves categories selected by the user."""
        categories = list(
            Category.objects
            .filter(CTGRY_ID__in=category_ids)
            .order_by("CTGRY_ID")
        )

        if len(categories) != len(category_ids):
            raise ValidationError(
                {
                    "category_ids": (
                        "One or more categories could not be found."
                    ),
                },
            )

        return categories

    @staticmethod
    def _get_specialty_tags(specialty_tag_ids):
        """Retrieves specialty tags selected by the user."""
        specialty_tags = list(
            SpecialtyTag.objects
            .filter(TAG_ID__in=specialty_tag_ids)
            .order_by("TAG_ID")
        )

        if len(specialty_tags) != len(specialty_tag_ids):
            raise ValidationError(
                {
                    "specialty_tag_ids": (
                        "One or more specialty tags could not be found."
                    ),
                },
            )

        return specialty_tags

    @staticmethod
    @transaction.atomic
    def update_interests(
        user,
        category_ids=None,
        specialty_tag_ids=None,
        complete_onboarding=False,
    ):
        """Replaces a user's selected interests atomically."""
        if category_ids is not None:
            categories = UserInterestService._get_categories(
                category_ids,
            )

            UserCategoryInterest.objects.filter(
                USER_ID=user,
            ).delete()

            UserCategoryInterest.objects.bulk_create(
                [
                    UserCategoryInterest(
                        USER_ID=user,
                        CTGRY_ID=category,
                    )
                    for category in categories
                ],
            )

        if specialty_tag_ids is not None:
            specialty_tags = UserInterestService._get_specialty_tags(
                specialty_tag_ids,
            )

            UserSpecialtyTagInterest.objects.filter(
                USER_ID=user,
            ).delete()

            UserSpecialtyTagInterest.objects.bulk_create(
                [
                    UserSpecialtyTagInterest(
                        USER_ID=user,
                        TAG_ID=specialty_tag,
                    )
                    for specialty_tag in specialty_tags
                ],
            )

        if complete_onboarding:
            user.HAS_COMPLETED_INTEREST_SELECTION = True
            user.save(
                update_fields=[
                    "HAS_COMPLETED_INTEREST_SELECTION",
                ],
            )

        return UserInterestService.get_interests(user)