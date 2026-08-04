from django.urls import path

from .views.category_options_views import CategoryOptionsView
from .views.cluster_options_views import ClusterOptionsView
from .views.location_views import (
    nearby_landmarks_view,
    place_details_view,
    place_search_view,
    reverse_geocode_view,
)
from .views.tag_options_views import (
    SpecialtyTagOptionsView,
)

urlpatterns = [
    path("clusters/", ClusterOptionsView.as_view(), name="cluster-options"),
    path("categories/", CategoryOptionsView.as_view(), name="category-options"),
    path("specialty-tags/", SpecialtyTagOptionsView.as_view(), name="specialty-tag-options"),
    
    path("places/search/", place_search_view, name="place-search"),
    path("places/details/", place_details_view, name="place-details"),
    path("reverse-geocode/", reverse_geocode_view, name="reverse-geocode"),
    path("nearby-landmarks/", nearby_landmarks_view, name="nearby-landmarks"),
]