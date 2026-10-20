from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.authentication.login_history_serializers import LoginEventSerializer
from apps.authentication.services.login_history_service import LoginHistoryService
from core.pagination import StandardPagination


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def login_history_view(request):
    """Lists only the requesting account's retained authentication events."""
    paginator = StandardPagination()
    page = paginator.paginate_queryset(LoginHistoryService.for_user(request.user), request)
    return paginator.get_paginated_response(LoginEventSerializer(page, many=True).data)
