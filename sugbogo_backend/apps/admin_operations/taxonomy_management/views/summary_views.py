from core.responses import success_response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import HasRole
from apps.business.models import Category, Cluster
from apps.users.models import User


@api_view(["GET"])
@permission_classes([IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)])
def get_cluster_category_summary(request):
    """
    Return summary counts for cluster and category management.
    """
    return success_response(
        data={
            "cluster_count": Cluster.objects.count(),
            "category_count": Category.objects.count(),
        }
    )