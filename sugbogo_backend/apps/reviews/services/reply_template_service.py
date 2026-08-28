from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import Business
from apps.reviews.constants import MAX_REPLY_TEMPLATES
from apps.reviews.models import ReplyTemplate
from apps.users.models import User


class ReplyTemplateService:
    """Handles saved reply templates for business owners."""

    @staticmethod
    def _get_business_for_merchant(
        user: User,
    ) -> Business:
        try:
            return Business.objects.get(
                USER_ID=user,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "Your business could not be found.",
            )

    @staticmethod
    def _get_template(
        user: User,
        template_id: int,
    ) -> ReplyTemplate:
        business = ReplyTemplateService._get_business_for_merchant(
            user,
        )

        try:
            return ReplyTemplate.objects.get(
                RTPL_ID=template_id,
                BUSN_ID=business,
            )
        except ReplyTemplate.DoesNotExist:
            raise NotFound(
                "The reply template could not be found.",
            )

    @staticmethod
    def get_templates(
        user: User,
    ):
        """Retrieve all saved reply templates for the merchant's business."""

        business = ReplyTemplateService._get_business_for_merchant(
            user,
        )

        return ReplyTemplate.objects.filter(
            BUSN_ID=business,
        )

    @staticmethod
    @transaction.atomic
    def create_template(
        user: User,
        title: str,
        text: str,
    ) -> ReplyTemplate:
        """Create a saved reply template for the merchant's business."""

        business = ReplyTemplateService._get_business_for_merchant(
            user,
        )

        template_count = ReplyTemplate.objects.filter(
            BUSN_ID=business,
        ).count()

        if template_count >= MAX_REPLY_TEMPLATES:
            raise ValidationError(
                f"You can only save up to {MAX_REPLY_TEMPLATES} "
                "reply templates.",
            )

        return ReplyTemplate.objects.create(
            BUSN_ID=business,
            RTPL_TITLE=title,
            RTPL_TEXT=text,
        )

    @staticmethod
    @transaction.atomic
    def update_template(
        user: User,
        template_id: int,
        title: str | None = None,
        text: str | None = None,
    ) -> ReplyTemplate:
        """Update a saved reply template owned by the merchant."""

        template = ReplyTemplateService._get_template(
            user,
            template_id,
        )

        if title is None and text is None:
            raise ValidationError(
                "Provide a title or text to update.",
            )

        if title is not None:
            template.RTPL_TITLE = title

        if text is not None:
            template.RTPL_TEXT = text

        template.save(
            update_fields=[
                "RTPL_TITLE",
                "RTPL_TEXT",
                "RTPL_UPDATED_AT",
            ],
        )

        return template

    @staticmethod
    @transaction.atomic
    def delete_template(
        user: User,
        template_id: int,
    ) -> None:
        """Delete a saved reply template owned by the merchant."""

        template = ReplyTemplateService._get_template(
            user,
            template_id,
        )

        template.delete()