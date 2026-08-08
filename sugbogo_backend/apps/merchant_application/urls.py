from django.urls import path

from .views.application_location_views import (
    location_save_view,
)
from .views.application_views import (
    application_detail_view,
    application_status_view,
    application_submit_view,
)
from .views.category_options_views import CategoryOptionsView
from .views.cluster_options_views import ClusterOptionsView
from .views.document_views import document_save_view
from .views.identity_views import identity_save_view
from .views.location_views import (
    nearby_landmarks_view,
    place_details_view,
    place_search_view,
    reverse_geocode_view,
)
from .views.operating_hours_views import operating_hours_save_view
from .views.photo_views import photo_save_view
from .views.review_views import application_review_view
from .views.tag_options_views import SpecialtyTagOptionsView

urlpatterns = [
    # Merchant Application Options endpoints
    path("clusters/", ClusterOptionsView.as_view(), name="cluster-options"),
    path("categories/", CategoryOptionsView.as_view(), name="category-options"),
    path("specialty-tags/", SpecialtyTagOptionsView.as_view(), name="specialty-tag-options"),
    
    # Google Places API endpoints
    path("places/search/", place_search_view, name="place-search"),
    path("places/details/", place_details_view, name="place-details"),
    path("reverse-geocode/", reverse_geocode_view, name="reverse-geocode"),
    path("nearby-landmarks/", nearby_landmarks_view, name="nearby-landmarks"),

    # Merchant Application save/submit endpoints
    path("", application_detail_view, name="application-detail"),
    path("submit/", application_submit_view, name="application-submit"),
    path("identity/", identity_save_view, name="application-identity"),
    path("location/", location_save_view, name="application-location"),
    path("operating-hours/", operating_hours_save_view,name="application-operating-hours",),
    path("photos/",name="application-photos",view=photo_save_view,),
    path("documents/",document_save_view,name="application-document-upload",),
    path("<int:application_id>/review/", application_review_view, name="application-review"),

    path("status/", application_status_view, name="application-status"),
]
