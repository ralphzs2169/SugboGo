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
from apps.explorer_operations.explore_businesses.views.direct_journey_views import (
    DirectJourneyMapView,
    DirectJourneySearchView,
)
from apps.explorer_operations.explore_businesses.views.discovery_feed_views import (
    DiscoveryFeedView,
)
from apps.explorer_operations.explore_businesses.views.explore_collection_views import (
    ExploreCollectionView,
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
from apps.explorer_operations.explore_businesses.views.journey_origin_views import (
    JourneyOriginPlaceDetailsView,
    JourneyOriginPlaceSearchView,
    JourneyOriginReverseGeocodeView,
)
from apps.explorer_operations.explore_businesses.views.map_discovery_views import (
    MapDiscoveryView,
    MapDirectoryView,
)
from apps.explorer_operations.explore_businesses.views.new_businesses_views import (
    NewBusinessesView,
)
from apps.explorer_operations.explore_businesses.views.open_now_businesses_views import (
    OpenNowBusinessesView,
)
from apps.explorer_operations.explore_businesses.views.recommendation_views import (
    RecommendationView,
)
from apps.explorer_operations.explore_businesses.views.road_route_views import (
    RoadRouteView,
)
from apps.explorer_operations.explore_businesses.views.similar_business_views import (
    SimilarBusinessView,
)
from apps.explorer_operations.explore_businesses.views.visibility_event_views import (
    BusinessImpressionBatchView,
    BusinessProfileVisitView,
)
from apps.explorer_operations.explore_businesses.views.vouch_history_views import (
    VouchHistoryView,
)
from .views.activity_timeline_views import ActivityTimelineView
from django.urls import path
from .views.route_intent_views import RouteIntentView
from .views.pocket_collection_views import (
    PocketCollectionBusinessesView,
    PocketCollectionDetailView,
    PocketCollectionListView,
)
from .views.business_pocket_membership_views import (
    BusinessPocketMembershipView,
    PocketBusinessMembershipView,
)

urlpatterns = [
    path(
        "activity-timeline/",
        ActivityTimelineView.as_view(),
        name="activity-timeline",
    ),
    path(
        "businesses/<int:business_id>/route-intent/",
        RouteIntentView.as_view(),
        name="business-route-intent",
    ),

    path("pockets/", PocketCollectionListView.as_view(), name="pocket-collections"),
    path(
        "pockets/<int:collection_id>/",
        PocketCollectionDetailView.as_view(),
        name="pocket-collection-detail",
    ),
    path(
        "pockets/<int:collection_id>/businesses/",
        PocketCollectionBusinessesView.as_view(),
        name="pocket-collection-businesses",
    ),
    path(
        "businesses/<int:business_id>/pockets/",
        BusinessPocketMembershipView.as_view(),
        name="business-pocket-memberships",
    ),
    path(
        "pockets/<int:collection_id>/businesses/<int:business_id>/",
        PocketBusinessMembershipView.as_view(),
        name="pocket-business-membership",
    ),

    path(
        "journey-origins/places/search/",
        JourneyOriginPlaceSearchView.as_view(),
        name="journey-origin-place-search",
    ),
    path(
        "journey-origins/places/details/",
        JourneyOriginPlaceDetailsView.as_view(),
        name="journey-origin-place-details",
    ),
    path(
        "journey-origins/reverse-geocode/",
        JourneyOriginReverseGeocodeView.as_view(),
        name="journey-origin-reverse-geocode",
    ),

    path("businesses/<int:business_id>/", BusinessDetailView.as_view(), name="business-detail", ),
    path(
        "businesses/<int:business_id>/direct-journeys/map/",
        DirectJourneyMapView.as_view(),
        name="business-direct-journey-map",
    ),
    path(
        "businesses/<int:business_id>/direct-journeys/",
        DirectJourneySearchView.as_view(),
        name="business-direct-journeys",
    ),
    path(
        "businesses/<int:business_id>/road-route/",
        RoadRouteView.as_view(),
        name="business-road-route",
    ),
    path("businesses/<int:business_id>/similar/",SimilarBusinessView.as_view(),name="similar-businesses",),
    path("collections/<str:collection_type>/",ExploreCollectionView.as_view(),name="explore-collection",),
    
    path("new-businesses/", NewBusinessesView.as_view(), name="new-businesses", ),
    path(
        "open-now/",
        OpenNowBusinessesView.as_view(),
        name="open-now-businesses",
    ),
    path("discovery/", DiscoveryFeedView.as_view(), name="discovery-feed", ),
    path("filter-options/", ExploreFilterOptionsView.as_view(), name="filter-options", ),
    path("specialties/",ExploreSpecialtyView.as_view(),name="explore-specialties"),
    path("recommendations/", RecommendationView.as_view(), name="recommendations", ),
    path("discovery-shortcuts/", ClusterDiscoveryShortcutView.as_view(), name="discovery-shortcuts", ),

    path("map-preview/",ExploreMapPreviewView.as_view(),name="explore-map-preview"),
    path(
        "map/businesses/",
        MapDirectoryView.as_view(),
        name="map-directory",
    ),
    path(
        "map/",
        MapDiscoveryView.as_view(),
        name="map-discovery",
    ),

    path("businesses/<int:business_id>/vouch/", BusinessVouchView.as_view(), name="business-vouch", ),
    path("vouch-history/", VouchHistoryView.as_view(), name="vouch-history"),
    path("businesses/<int:business_id>/pocket/", BusinessPocketView.as_view(), name="business-pocket" ),

    path("visibility/impressions/",BusinessImpressionBatchView.as_view(),name="business-impressions",),
    path("businesses/<int:business_id>/profile-visit/", BusinessProfileVisitView.as_view(), name="business-profile-visit", ),
]
