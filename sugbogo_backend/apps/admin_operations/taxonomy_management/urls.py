from django.urls import path

from apps.admin_operations.taxonomy_management.views.category_views import (
    CategoryDetailView,
    CategoryListView,
)
from apps.admin_operations.taxonomy_management.views.cluster_views import (
    ClusterDetailView,
    ClusterListView,
)
from apps.admin_operations.taxonomy_management.views.specialty_tag_views import (
    SpecialtyTagDetailView,
    SpecialtyTagListView,
)
from apps.admin_operations.taxonomy_management.views.summary_views import (
    get_cluster_category_summary,
)
from apps.admin_operations.taxonomy_management.views.tag_statistics_views import (
    SpecialtyTagStatisticsView,
)

urlpatterns = [

    path("specialty-tags/", SpecialtyTagListView.as_view()),
    path("specialty-tags/<int:tag_id>/", SpecialtyTagDetailView.as_view()),
    path("specialty-tags/statistics/", SpecialtyTagStatisticsView.as_view()),

    # Cluster
    path("clusters/", ClusterListView.as_view()),
    path("clusters/<int:cluster_id>/", ClusterDetailView.as_view()),

    # Category
    path("categories/", CategoryListView.as_view()),
    path("categories/<int:category_id>/", CategoryDetailView.as_view()),

    

    # Summary
    path("cluster-category/summary/", get_cluster_category_summary),
]