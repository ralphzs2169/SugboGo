from core.responses import success_response
from rest_framework.decorators import api_view

from apps.msme.models import Category, Cluster


@api_view(["GET"])
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