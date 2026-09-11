from apps.explorer_operations.explore_businesses.views.business_detail_views import (
    BusinessDetailView,
)
from apps.explorer_operations.explore_businesses.views.business_pocket_views import (
    BusinessPocketView,
)
from apps.explorer_operations.explore_businesses.views.business_vouch_views import (
    BusinessVouchView,
)
from apps.explorer_operations.explore_businesses.views.cluster_discovery_shortcut_views import (
    ClusterDiscoveryShortcutView,
)
from apps.explorer_operations.explore_businesses.views.discovery_feed_views import (
    DiscoveryFeedView,
)
from apps.explorer_operations.explore_businesses.views.explore_map_preview_views import (
    ExploreMapPreviewView,
)
from apps.explorer_operations.explore_businesses.views.explore_specialty_tag_views import (
    ExploreSpecialtyView,
)
from apps.explorer_operations.explore_businesses.views.filter_options_views import (
    ExploreFilterOptionsView,
)
from apps.explorer_operations.explore_businesses.views.new_businesses_views import (
    NewBusinessesView,
)
from apps.explorer_operations.explore_businesses.views.recommendation_views import (
    RecommendationView,
)
from apps.explorer_operations.explore_businesses.views.similar_business_views import (
    SimilarBusinessView,
)
from apps.explorer_operations.explore_businesses.views.visibility_event_views import (
    BusinessImpressionBatchView,
    BusinessProfileVisitView,
)
from django.urls import path

urlpatterns = [

    path("businesses/<int:business_id>/", BusinessDetailView.as_view(), name="business-detail", ),
    path(
        "businesses/<int:business_id>/similar/",
        SimilarBusinessView.as_view(),
        name="similar-businesses",
    ),
    
    path("new-businesses/", NewBusinessesView.as_view(), name="new-businesses", ),
    path("discovery/", DiscoveryFeedView.as_view(), name="discovery-feed", ),
    path("filter-options/", ExploreFilterOptionsView.as_view(), name="filter-options", ),
    path("specialties/",ExploreSpecialtyView.as_view(),name="explore-specialties"),
    path("recommendations/", RecommendationView.as_view(), name="recommendations", ),
    path("discovery-shortcuts/", ClusterDiscoveryShortcutView.as_view(), name="discovery-shortcuts", ),

    path("map-preview/",ExploreMapPreviewView.as_view(),name="explore-map-preview"),

    path("businesses/<int:business_id>/vouch/", BusinessVouchView.as_view(), name="business-vouch", ),
    path("businesses/<int:business_id>/pocket/", BusinessPocketView.as_view(), name="business-pocket" ),

    path("visibility/impressions/",BusinessImpressionBatchView.as_view(),name="business-impressions",),
    path("businesses/<int:business_id>/profile-visit/", BusinessProfileVisitView.as_view(), name="business-profile-visit", ),
]
