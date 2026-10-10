from collections import Counter

from django.contrib.gis.geos import Point
from django.db import IntegrityError, transaction
from django.db.models import Case, IntegerField, Prefetch, Value, When
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)

from apps.business.models import Business, BusinessLandmark, Location
from apps.business.services.serviceable_boundary_service import (
    ServiceableBoundaryService,
)
from apps.merchant_operations.business_profile.models import (
    BusinessLocationChangeRequest,
    BusinessLocationLandmarkSnapshot,
)
from apps.merchant_operations.business_profile.services.business_change_request_eligibility_service import (
    BusinessChangeRequestEligibilityService,
)
from apps.merchant_operations.business_profile.services.merchant_change_reason import (
    validate_merchant_change_reason,
)
from apps.merchant_operations.business_profile.serializers.business_location_change_serializers import (
    BusinessLocationChangeCreateSerializer,
)


class BusinessLocationChangeService:
    """Manage reviewed location and landmark changes without editing applications."""

    @staticmethod
    def _get_owned_business(user):
        """Resolve the merchant's approved business with a controlled error."""
        try:
            return Business.objects.get(USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.")

    @staticmethod
    def _request_queryset():
        """Load frozen snapshots and the current live location efficiently."""
        return BusinessLocationChangeRequest.objects.select_related(
            "BUSN_ID",
            "BUSN_ID__LOCT_ID",
            "USER_ID",
            "REVIEWER_ID",
        ).prefetch_related(
            Prefetch(
                "landmark_snapshots",
                queryset=BusinessLocationLandmarkSnapshot.objects.order_by(
                    "BLLS_SIDE",
                    "BLLS_ID",
                ),
            ),
            Prefetch(
                "BUSN_ID__LOCT_ID__landmarks",
                queryset=BusinessLandmark.objects.order_by("BLMK_ID"),
            ),
        )

    @staticmethod
    def _live_landmarks(
        location,
        lock=False,
    ):
        """Load live landmarks in a stable lock order."""
        queryset = BusinessLandmark.objects.filter(
            LOCT_ID=location,
        ).order_by("BLMK_ID")
        if lock:
            queryset = queryset.select_for_update()
        return list(queryset)

    @staticmethod
    def _landmark_values(
        landmark,
        snapshot=False,
    ):
        """Compare persisted landmark values without depending on ordering."""
        if snapshot:
            return (
                landmark.BLLS_NAME,
                landmark.BLLS_ADDRESS,
                landmark.BLLS_POINT.x,
                landmark.BLLS_POINT.y,
                landmark.BLLS_SOURCE,
                landmark.BLLS_PLACE_ID,
            )
        return (
            landmark.BLMK_NAME,
            landmark.BLMK_ADDRESS,
            landmark.BLMK_POINT.x,
            landmark.BLMK_POINT.y,
            landmark.BLMK_SOURCE,
            landmark.BLMK_PLACE_ID,
        )

    @staticmethod
    def _proposed_landmark_values(landmark):
        """Normalize a validated proposed landmark for change detection."""
        return (
            landmark["name"],
            landmark.get("address", ""),
            landmark["longitude"],
            landmark["latitude"],
            landmark["source"],
            landmark.get("place_id"),
        )

    @staticmethod
    def _location_values(location):
        """Extract meaningful persisted Location values."""
        return (
            location.LOCT_POINT.x,
            location.LOCT_POINT.y,
            location.LOCT_ADDRESS,
            location.LOCT_CITY,
            location.LOCT_PROVINCE,
            location.LOCT_POSTAL_CODE,
        )

    @staticmethod
    def _previous_values(change_request):
        """Extract the captured Location baseline from a request."""
        return (
            change_request.BLCR_PREVIOUS_POINT.x,
            change_request.BLCR_PREVIOUS_POINT.y,
            change_request.BLCR_PREVIOUS_ADDRESS,
            change_request.BLCR_PREVIOUS_CITY,
            change_request.BLCR_PREVIOUS_PROVINCE,
            change_request.BLCR_PREVIOUS_POSTAL_CODE,
        )

    @staticmethod
    def _proposal_values(location):
        """Extract a validated location proposal for change detection."""
        return (
            location["longitude"],
            location["latitude"],
            location["address"],
            location["city"],
            location["province"],
            location.get("postal_code"),
        )

    @staticmethod
    def _validate_service_area(
        location,
        landmarks,
    ):
        """Check the proposed pin and every landmark against active polygons."""
        ServiceableBoundaryService.validate_serviceable(
            location["latitude"],
            location["longitude"],
            field_label="proposed_location",
        )
        for landmark in landmarks:
            ServiceableBoundaryService.validate_serviceable(
                landmark["latitude"],
                landmark["longitude"],
                field_label="proposed_landmarks",
            )

    @staticmethod
    def _validate_proposal(
        location,
        landmarks,
    ):
        """Apply the same complete payload rules at submission and approval."""
        serializer = BusinessLocationChangeCreateSerializer(data={
            "proposed_location": location,
            "proposed_landmarks": landmarks,
        })
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        BusinessLocationChangeService._validate_service_area(
            validated["proposed_location"],
            validated["proposed_landmarks"],
        )
        return validated

    @staticmethod
    def _create_snapshots(
        change_request,
        live_landmarks,
        proposed_landmarks,
    ):
        """Freeze complete previous and proposed landmark collections."""
        for landmark in live_landmarks:
            BusinessLocationLandmarkSnapshot.objects.create(
                BLCR_ID=change_request,
                BLLS_SIDE=BusinessLocationLandmarkSnapshot.Side.PREVIOUS,
                BLLS_PREVIOUS_BLMK_ID=landmark.BLMK_ID,
                BLLS_NAME=landmark.BLMK_NAME,
                BLLS_ADDRESS=landmark.BLMK_ADDRESS,
                BLLS_POINT=landmark.BLMK_POINT,
                BLLS_SOURCE=landmark.BLMK_SOURCE,
                BLLS_PLACE_ID=landmark.BLMK_PLACE_ID,
            )
        for landmark in proposed_landmarks:
            BusinessLocationLandmarkSnapshot.objects.create(
                BLCR_ID=change_request,
                BLLS_SIDE=BusinessLocationLandmarkSnapshot.Side.PROPOSED,
                BLLS_NAME=landmark["name"],
                BLLS_ADDRESS=landmark.get("address", ""),
                BLLS_POINT=Point(
                    x=landmark["longitude"],
                    y=landmark["latitude"],
                    srid=4326,
                ),
                BLLS_SOURCE=landmark["source"],
                BLLS_PLACE_ID=landmark.get("place_id"),
            )

    @staticmethod
    def submit(
        user,
        proposed_location,
        proposed_landmarks,
        reason,
    ):
        """Capture live baseline and complete proposal without changing live data."""
        merchant_reason = validate_merchant_change_reason(reason)
        try:
            with transaction.atomic():
                try:
                    business = Business.objects.select_for_update().get(USER_ID=user)
                except Business.DoesNotExist:
                    raise NotFound("Your business could not be found.")

                if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
                    raise PermissionDenied(
                        "Location changes cannot be requested while your business is suspended."
                    )
                eligibility = (
                    BusinessChangeRequestEligibilityService.for_location(
                        business,
                    )
                )
                BusinessChangeRequestEligibilityService.enforce(
                    eligibility,
                    request_label="location and landmarks change",
                    pending_message=(
                        "A location change request is already pending."
                    ),
                )

                validated = BusinessLocationChangeService._validate_proposal(
                    proposed_location,
                    proposed_landmarks,
                )
                location_data = validated["proposed_location"]
                landmarks_data = validated["proposed_landmarks"]

                location = Location.objects.select_for_update().get(
                    LOCT_ID=business.LOCT_ID_id,
                )
                live_landmarks = BusinessLocationChangeService._live_landmarks(
                    location,
                    lock=True,
                )
                live_values = Counter(
                    BusinessLocationChangeService._landmark_values(landmark)
                    for landmark in live_landmarks
                )
                proposed_values = Counter(
                    BusinessLocationChangeService._proposed_landmark_values(landmark)
                    for landmark in landmarks_data
                )
                if (
                    BusinessLocationChangeService._location_values(location)
                    == BusinessLocationChangeService._proposal_values(location_data)
                    and live_values == proposed_values
                ):
                    raise ValidationError(
                        "Choose a different location or landmark set."
                    )

                change_request = BusinessLocationChangeRequest.objects.create(
                    BUSN_ID=business,
                    USER_ID=user,
                    BLCR_PREVIOUS_LOCT_ID=location.LOCT_ID,
                    BLCR_PREVIOUS_POINT=location.LOCT_POINT,
                    BLCR_PREVIOUS_ADDRESS=location.LOCT_ADDRESS,
                    BLCR_PREVIOUS_CITY=location.LOCT_CITY,
                    BLCR_PREVIOUS_PROVINCE=location.LOCT_PROVINCE,
                    BLCR_PREVIOUS_POSTAL_CODE=location.LOCT_POSTAL_CODE,
                    BLCR_PROPOSED_POINT=Point(
                        x=location_data["longitude"],
                        y=location_data["latitude"],
                        srid=4326,
                    ),
                    BLCR_PROPOSED_ADDRESS=location_data["address"],
                    BLCR_PROPOSED_CITY=location_data["city"],
                    BLCR_PROPOSED_PROVINCE=location_data["province"],
                    BLCR_PROPOSED_POSTAL_CODE=location_data.get("postal_code"),
                    BLCR_MERCHANT_REASON=merchant_reason,
                    BLCR_SUBMITTED_AT=timezone.now(),
                )
                BusinessLocationChangeService._create_snapshots(
                    change_request,
                    live_landmarks,
                    landmarks_data,
                )
                return BusinessLocationChangeService.get_for_merchant(
                    user,
                    change_request.BLCR_ID,
                )
        except IntegrityError:
            if BusinessLocationChangeRequest.objects.filter(
                BUSN_ID__USER_ID=user,
                BLCR_STATUS=BusinessLocationChangeRequest.Status.PENDING,
            ).exists():
                raise ValidationError(
                    "A location change request is already pending."
                ) from None
            raise

    @staticmethod
    def list_for_merchant(user):
        """Return only owned requests, newest first, including history."""
        business = BusinessLocationChangeService._get_owned_business(user)
        return BusinessLocationChangeService._request_queryset().filter(
            BUSN_ID=business,
            USER_ID=user,
        ).order_by("-BLCR_SUBMITTED_AT", "-BLCR_ID")

    @staticmethod
    def get_eligibility_for_merchant(user):
        """Return the merchant's current location request eligibility."""
        business = BusinessLocationChangeService._get_owned_business(user)
        return BusinessChangeRequestEligibilityService.for_location(
            business,
        )

    @staticmethod
    def get_for_merchant(
        user,
        request_id,
    ):
        """Return one owned request without disclosing foreign history."""
        business = BusinessLocationChangeService._get_owned_business(user)
        try:
            return BusinessLocationChangeService._request_queryset().get(
                BLCR_ID=request_id,
                BUSN_ID=business,
                USER_ID=user,
            )
        except BusinessLocationChangeRequest.DoesNotExist:
            raise NotFound("The location change request could not be found.")

    @staticmethod
    @transaction.atomic
    def withdraw(
        user,
        request_id,
    ):
        """Withdraw an owned pending proposal without changing live location."""
        business = BusinessLocationChangeService._get_owned_business(user)
        try:
            change_request = BusinessLocationChangeRequest.objects.select_for_update().get(
                BLCR_ID=request_id,
                BUSN_ID=business,
                USER_ID=user,
            )
        except BusinessLocationChangeRequest.DoesNotExist:
            raise NotFound("The location change request could not be found.")
        if change_request.BLCR_STATUS != BusinessLocationChangeRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be withdrawn.")
        change_request.BLCR_STATUS = BusinessLocationChangeRequest.Status.WITHDRAWN
        change_request.BLCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=["BLCR_STATUS", "BLCR_RESOLVED_AT", "BLCR_UPDATED_AT"],
        )
        return BusinessLocationChangeService.get_for_merchant(user, request_id)

    @staticmethod
    def list_for_admin(status=None):
        """Return a review queue with pending proposals first."""
        queryset = BusinessLocationChangeService._request_queryset()
        if status:
            if status not in BusinessLocationChangeRequest.Status.values:
                raise ValidationError({"status": ["Choose a valid status."]})
            queryset = queryset.filter(BLCR_STATUS=status)
        return queryset.annotate(
            pending_order=Case(
                When(
                    BLCR_STATUS=BusinessLocationChangeRequest.Status.PENDING,
                    then=Value(0),
                ),
                default=Value(1),
                output_field=IntegerField(),
            ),
        ).order_by("pending_order", "-BLCR_SUBMITTED_AT", "-BLCR_ID")

    @staticmethod
    def get_for_admin(request_id):
        """Return request snapshots with separate current live state."""
        try:
            return BusinessLocationChangeService._request_queryset().get(
                BLCR_ID=request_id,
            )
        except BusinessLocationChangeRequest.DoesNotExist:
            raise NotFound("The location change request could not be found.")

    @staticmethod
    def _stored_proposal(
        change_request,
        snapshots,
    ):
        """Rebuild the submitted proposal from frozen scalar and GIS fields."""
        location = {
            "latitude": change_request.BLCR_PROPOSED_POINT.y,
            "longitude": change_request.BLCR_PROPOSED_POINT.x,
            "address": change_request.BLCR_PROPOSED_ADDRESS,
            "city": change_request.BLCR_PROPOSED_CITY,
            "province": change_request.BLCR_PROPOSED_PROVINCE,
            "postal_code": change_request.BLCR_PROPOSED_POSTAL_CODE,
        }
        landmarks = [
            {
                "name": snapshot.BLLS_NAME,
                "address": snapshot.BLLS_ADDRESS,
                "latitude": snapshot.BLLS_POINT.y,
                "longitude": snapshot.BLLS_POINT.x,
                "source": snapshot.BLLS_SOURCE,
                "place_id": snapshot.BLLS_PLACE_ID,
            }
            for snapshot in snapshots
            if snapshot.BLLS_SIDE == BusinessLocationLandmarkSnapshot.Side.PROPOSED
        ]
        return BusinessLocationChangeService._validate_proposal(location, landmarks)

    @staticmethod
    @transaction.atomic
    def approve(
        request_id,
        reviewer,
    ):
        """Apply a non-stale, still-serviceable proposal in one transaction."""
        try:
            change_request = BusinessLocationChangeRequest.objects.select_for_update().get(
                BLCR_ID=request_id,
            )
        except BusinessLocationChangeRequest.DoesNotExist:
            raise NotFound("The location change request could not be found.")
        if change_request.BLCR_STATUS != BusinessLocationChangeRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be approved.")

        try:
            business = Business.objects.select_for_update().get(
                BUSN_ID=change_request.BUSN_ID_id,
            )
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.")
        if business.USER_ID_id != change_request.USER_ID_id:
            raise ValidationError("The request no longer belongs to this business.")
        if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise ValidationError("Only active businesses can receive a location change.")
        if business.LOCT_ID_id != change_request.BLCR_PREVIOUS_LOCT_ID:
            raise ValidationError(
                "This request is based on outdated business information."
            )

        old_location = Location.objects.select_for_update().get(
            LOCT_ID=business.LOCT_ID_id,
        )
        live_landmarks = BusinessLocationChangeService._live_landmarks(
            old_location,
            lock=True,
        )
        snapshots = list(
            BusinessLocationLandmarkSnapshot.objects.filter(
                BLCR_ID=change_request,
            ).order_by("BLLS_ID")
        )
        previous_landmarks = [
            snapshot
            for snapshot in snapshots
            if snapshot.BLLS_SIDE == BusinessLocationLandmarkSnapshot.Side.PREVIOUS
        ]
        live_values = Counter(
            (
                landmark.BLMK_ID,
                *BusinessLocationChangeService._landmark_values(landmark),
            )
            for landmark in live_landmarks
        )
        previous_values = Counter(
            (
                snapshot.BLLS_PREVIOUS_BLMK_ID,
                *BusinessLocationChangeService._landmark_values(
                    snapshot,
                    snapshot=True,
                ),
            )
            for snapshot in previous_landmarks
        )
        if (
            BusinessLocationChangeService._location_values(old_location)
            != BusinessLocationChangeService._previous_values(change_request)
            or live_values != previous_values
        ):
            raise ValidationError(
                "This request is based on outdated business information."
            )

        validated = BusinessLocationChangeService._stored_proposal(
            change_request,
            snapshots,
        )
        proposed_location = validated["proposed_location"]
        proposed_landmarks = validated["proposed_landmarks"]
        new_location = Location.objects.create(
            LOCT_POINT=Point(
                x=proposed_location["longitude"],
                y=proposed_location["latitude"],
                srid=4326,
            ),
            LOCT_ADDRESS=proposed_location["address"],
            LOCT_CITY=proposed_location["city"],
            LOCT_PROVINCE=proposed_location["province"],
            LOCT_POSTAL_CODE=proposed_location.get("postal_code"),
        )
        for landmark in proposed_landmarks:
            BusinessLandmark.objects.create(
                LOCT_ID=new_location,
                BLMK_NAME=landmark["name"],
                BLMK_ADDRESS=landmark.get("address", ""),
                BLMK_POINT=Point(
                    x=landmark["longitude"],
                    y=landmark["latitude"],
                    srid=4326,
                ),
                BLMK_SOURCE=landmark["source"],
                BLMK_PLACE_ID=landmark.get("place_id"),
            )

        business.LOCT_ID = new_location
        business.save(update_fields=["LOCT_ID", "BUSN_UPDATED_AT"])
        applied_business = Business.objects.get(BUSN_ID=business.BUSN_ID)
        applied_location = Location.objects.get(LOCT_ID=applied_business.LOCT_ID_id)
        applied_landmarks = BusinessLocationChangeService._live_landmarks(
            applied_location,
        )
        if applied_business.LOCT_ID_id != new_location.LOCT_ID:
            raise ValidationError("The new business location could not be applied.")
        if (
            BusinessLocationChangeService._location_values(applied_location)
            != BusinessLocationChangeService._proposal_values(proposed_location)
            or Counter(
                BusinessLocationChangeService._landmark_values(landmark)
                for landmark in applied_landmarks
            )
            != Counter(
                BusinessLocationChangeService._proposed_landmark_values(landmark)
                for landmark in proposed_landmarks
            )
        ):
            raise ValidationError("The new business location could not be applied.")

        change_request.BLCR_STATUS = BusinessLocationChangeRequest.Status.APPROVED
        change_request.REVIEWER_ID = reviewer
        change_request.BLCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=[
                "BLCR_STATUS",
                "REVIEWER_ID",
                "BLCR_RESOLVED_AT",
                "BLCR_UPDATED_AT",
            ],
        )
        if not Business.objects.filter(LOCT_ID=old_location).exists():
            old_location.delete()
        NotificationEventService.merchant_request_resolved(
            recipient=change_request.USER_ID,
            request_id=change_request.pk,
            request_type="business_location_change",
            outcome=change_request.BLCR_STATUS,
        )
        return BusinessLocationChangeService.get_for_admin(request_id)

    @staticmethod
    @transaction.atomic
    def reject(
        request_id,
        reviewer,
        rejection_reason,
    ):
        """Resolve a pending request without touching live location data."""
        try:
            change_request = BusinessLocationChangeRequest.objects.select_for_update().get(
                BLCR_ID=request_id,
            )
        except BusinessLocationChangeRequest.DoesNotExist:
            raise NotFound("The location change request could not be found.")
        if change_request.BLCR_STATUS != BusinessLocationChangeRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be rejected.")
        if not rejection_reason or not rejection_reason.strip():
            raise ValidationError({
                "rejection_reason": ["A rejection reason is required."],
            })
        change_request.BLCR_STATUS = BusinessLocationChangeRequest.Status.REJECTED
        change_request.REVIEWER_ID = reviewer
        change_request.BLCR_REJECTION_REASON = rejection_reason.strip()
        change_request.BLCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=[
                "BLCR_STATUS",
                "REVIEWER_ID",
                "BLCR_REJECTION_REASON",
                "BLCR_RESOLVED_AT",
                "BLCR_UPDATED_AT",
            ],
        )
        NotificationEventService.merchant_request_resolved(
            recipient=change_request.USER_ID,
            request_id=change_request.pk,
            request_type="business_location_change",
            outcome=change_request.BLCR_STATUS,
        )
        return BusinessLocationChangeService.get_for_admin(request_id)
