from django.urls import path

from apps.admin_operations.transit_management.views.jeepney_route_views import (
    JeepneyRouteDetailView,
    JeepneyRouteListView,
)
from apps.admin_operations.transit_management.views.route_variant_views import (
    JeepneyRouteVariantDetailView,
    JeepneyRouteVariantListView,
)
from apps.admin_operations.transit_management.views.transit_point_views import (
    TransitPointDetailView,
    TransitPointListView,
)


urlpatterns = [
    path(
        "routes/",
        JeepneyRouteListView.as_view(),
    ),
    path(
        "routes/<int:route_id>/",
        JeepneyRouteDetailView.as_view(),
    ),
    path(
        "transit-points/",
        TransitPointListView.as_view(),
    ),
    path(
        "transit-points/<int:transit_point_id>/",
        TransitPointDetailView.as_view(),
    ),
    path(
        "route-variants/",
        JeepneyRouteVariantListView.as_view(),
    ),
    path(
        "route-variants/<int:variant_id>/",
        JeepneyRouteVariantDetailView.as_view(),
    ),
]
