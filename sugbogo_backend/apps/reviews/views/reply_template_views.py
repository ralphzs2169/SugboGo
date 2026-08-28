from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.reply_template_serializers import (
    ReplyTemplateCreateSerializer,
    ReplyTemplateResponseSerializer,
    ReplyTemplateUpdateSerializer,
)
from apps.reviews.services.reply_template_service import (
    ReplyTemplateService,
)
from apps.users.models import User


class ReplyTemplateView(APIView):
    """Handle saved reply template creation and retrieval."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(self, request):
        """Retrieve all saved reply templates for the merchant."""

        templates = ReplyTemplateService.get_templates(
            user=request.user,
        )

        serializer = ReplyTemplateResponseSerializer(
            templates,
            many=True,
        )

        return success_response(
            data=serializer.data,
            message="Reply templates retrieved successfully.",
        )

    def post(self, request):
        """Create a saved reply template for the merchant."""

        serializer = ReplyTemplateCreateSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        template = ReplyTemplateService.create_template(
            user=request.user,
            title=serializer.validated_data["title"],
            text=serializer.validated_data["text"],
        )

        response_serializer = ReplyTemplateResponseSerializer(
            template,
        )

        return success_response(
            data=response_serializer.data,
            message="Reply template created successfully.",
        )


class ReplyTemplateDetailView(APIView):
    """Handle updates and deletion of a saved reply template."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def patch(self, request, template_id):
        """Update a saved reply template."""

        serializer = ReplyTemplateUpdateSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        template = ReplyTemplateService.update_template(
            user=request.user,
            template_id=template_id,
            **serializer.validated_data,
        )

        response_serializer = ReplyTemplateResponseSerializer(
            template,
        )

        return success_response(
            data=response_serializer.data,
            message="Reply template updated successfully.",
        )

    def delete(self, request, template_id):
        """Delete a saved reply template."""

        ReplyTemplateService.delete_template(
            user=request.user,
            template_id=template_id,
        )

        return success_response(
            data={"template_id": template_id},
            message="Reply template deleted successfully.",
        )