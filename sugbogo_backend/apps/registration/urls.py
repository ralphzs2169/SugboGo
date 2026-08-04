from django.urls import path

from .views.application_views import application_detail_view, application_submit_view
from .views.application_location_views import (
    landmark_add_view,
    landmark_delete_view,
    location_save_view,
)
from .views.category_options_views import CategoryOptionsView
from .views.cluster_options_views import ClusterOptionsView
from .views.identity_views import identity_save_view
from .views.location_views import (
    nearby_landmarks_view,
    place_details_view,
    place_search_view,
    reverse_geocode_view,
)
from .views.operating_hours_views import operating_hours_replace_view
from .views.photo_document_views import (
    document_delete_view,
    document_upload_view,
    photo_delete_view,
    photo_upload_view,
)

urlpatterns = [
    path("clusters/", ClusterOptionsView.as_view(), name="cluster-options"),
    path("categories/", CategoryOptionsView.as_view(), name="category-options"),

    path("places/search/", place_search_view, name="place-search"),
    path("places/details/", place_details_view, name="place-details"),
    path("reverse-geocode/", reverse_geocode_view, name="reverse-geocode"),
    path("nearby-landmarks/", nearby_landmarks_view, name="nearby-landmarks"),

    path("application/", application_detail_view, name="application-detail"),
    path("application/submit/", application_submit_view, name="application-submit"),

    path("application/identity/", identity_save_view, name="application-identity"),

    path("application/location/", location_save_view, name="application-location"),
    path("application/landmarks/", landmark_add_view, name="application-landmark-add"),
    path(
        "application/landmarks/<int:landmark_id>/",
        landmark_delete_view,
        name="application-landmark-delete",
    ),

    path(
        "application/operating-hours/",
        operating_hours_replace_view,
        name="application-operating-hours",
    ),

    path("application/photos/", photo_upload_view, name="application-photo-upload"),
    path(
        "application/photos/<int:photo_id>/",
        photo_delete_view,
        name="application-photo-delete",
    ),
    path(
        "application/documents/",
        document_upload_view,
        name="application-document-upload",
    ),
    path(
        "application/documents/<int:document_id>/",
        document_delete_view,
        name="application-document-delete",
    ),
]