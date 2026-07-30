from django.urls import path

from apps.admin_operations.msme_management.views.category_views import *
from apps.admin_operations.msme_management.views.cluster_views import *
from apps.admin_operations.msme_management.views.summary_views import (
    get_cluster_category_summary,
)

urlpatterns = [
    # Cluster
    path("clusters/", list_clusters),
    path("clusters/<int:cluster_id>/", retrieve_cluster),
    path("clusters/create/", create_cluster),
    path("clusters/<int:cluster_id>/update/", update_cluster),
    path("clusters/<int:cluster_id>/delete/", delete_cluster),

    # Category
    path("categories/", list_categories),
    path("categories/<int:category_id>/", retrieve_category),
    path("categories/create/", create_category),
    path("categories/<int:category_id>/update/", update_category),
    path("categories/<int:category_id>/delete/", delete_category),

    # Summary
    path("cluster-category/summary/", get_cluster_category_summary),
]