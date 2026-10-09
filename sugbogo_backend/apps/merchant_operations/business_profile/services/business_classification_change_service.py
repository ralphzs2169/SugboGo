import logging

from django.db import IntegrityError, transaction
from django.db.models import Case, IntegerField, Prefetch, Value, When
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business, BusinessSpecialtyTag, Category, SpecialtyTag
from apps.business.tasks import recompute_discovery_scores
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessClassificationSpecialtySnapshot,
)
from apps.merchant_operations.business_profile.services.business_change_request_eligibility_service import (
    BusinessChangeRequestEligibilityService,
)

logger = logging.getLogger(__name__)


class BusinessClassificationChangeService:
    """Manage proposed classification changes without modifying application evidence."""

    @staticmethod
    def _get_owned_business(user):
        """Resolve the authenticated merchant's approved business."""
        try:
            return Business.objects.get(USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.")

    @staticmethod
    def _request_queryset():
        """Load request context and both sets of immutable tag snapshots."""
        return BusinessClassificationChangeRequest.objects.select_related(
            "BUSN_ID",
            "BUSN_ID__CTGRY_ID__CLUS_ID",
            "USER_ID",
            "REVIEWER_ID",
            "PREVIOUS_CTGRY_ID",
            "PROPOSED_CTGRY_ID",
        ).prefetch_related(
            Prefetch(
                "specialty_snapshots",
                queryset=BusinessClassificationSpecialtySnapshot.objects.order_by(
                    "BCSS_SIDE",
                    "TAG_ID_id",
                ),
            ),
            Prefetch(
                "BUSN_ID__specialty_tag_links",
                queryset=(
                    BusinessSpecialtyTag.objects
                    .filter(BST_IS_ACTIVE=True)
                    .select_related("TAG_ID")
                    .order_by("TAG_ID_id")
                ),
                to_attr="active_classification_links",
            ),
        )

    @staticmethod
    def _validate_proposed_ids(tag_ids):
        """Require exactly three distinct specialty IDs."""
        if len(tag_ids) != 3 or len(set(tag_ids)) != 3:
            raise ValidationError({
                "proposed_specialty_tag_ids": [
                    "Please select exactly 3 distinct specialty tags."
                ],
            })

    @staticmethod
    def _load_proposed_taxonomy(category_id, tag_ids, lock=False):
        """Resolve the proposed taxonomy and reject missing IDs."""
        category_queryset = Category.objects.select_related("CLUS_ID")
        tag_queryset = SpecialtyTag.objects.all()
        if lock:
            category_queryset = category_queryset.select_for_update()
            tag_queryset = tag_queryset.select_for_update()

        try:
            category = category_queryset.get(CTGRY_ID=category_id)
        except Category.DoesNotExist:
            raise ValidationError({
                "proposed_category_id": ["The selected category was not found."],
            })

        tags = list(
            tag_queryset.filter(TAG_ID__in=tag_ids).order_by("TAG_ID"),
        )
        if len(tags) != 3:
            raise ValidationError({
                "proposed_specialty_tag_ids": [
                    "One or more selected specialty tags were not found."
                ],
            })
        return category, tags

    @staticmethod
    def _active_links(business_id, lock=False):
        """Load current active assignments in a stable order."""
        queryset = (
            BusinessSpecialtyTag.objects
            .filter(BUSN_ID_id=business_id, BST_IS_ACTIVE=True)
            .select_related("TAG_ID")
            .order_by("BST_ID")
        )
        if lock:
            queryset = queryset.select_for_update()
        return list(queryset)

    @staticmethod
    def submit(user, proposed_category_id, proposed_specialty_tag_ids):
        """Capture the live baseline and proposal without changing classification."""
        BusinessClassificationChangeService._validate_proposed_ids(
            proposed_specialty_tag_ids,
        )
        try:
            with transaction.atomic():
                try:
                    business = (
                        Business.objects
                        .select_for_update()
                        .select_related("CTGRY_ID__CLUS_ID")
                        .get(USER_ID=user)
                    )
                except Business.DoesNotExist:
                    raise NotFound("Your business could not be found.")

                if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
                    raise PermissionDenied(
                        "Classification changes cannot be requested while "
                        "your business is suspended."
                    )

                eligibility = (
                    BusinessChangeRequestEligibilityService.for_classification(
                        business,
                    )
                )
                BusinessChangeRequestEligibilityService.enforce(
                    eligibility,
                    request_label="classification change",
                    pending_message=(
                        "A classification change request is already pending."
                    ),
                )

                category, tags = (
                    BusinessClassificationChangeService._load_proposed_taxonomy(
                        proposed_category_id,
                        proposed_specialty_tag_ids,
                    )
                )
                active_links = BusinessClassificationChangeService._active_links(
                    business.BUSN_ID,
                )
                active_ids = {link.TAG_ID_id for link in active_links}
                proposed_ids = set(proposed_specialty_tag_ids)
                if (
                    business.CTGRY_ID_id == category.CTGRY_ID
                    and active_ids == proposed_ids
                ):
                    raise ValidationError(
                        "Choose a different category or specialty tags."
                    )

                previous_category = business.CTGRY_ID
                change_request = BusinessClassificationChangeRequest.objects.create(
                    BUSN_ID=business,
                    USER_ID=user,
                    PREVIOUS_CTGRY_ID=previous_category,
                    PROPOSED_CTGRY_ID=category,
                    BCCR_PREVIOUS_CATEGORY_NAME=previous_category.CTGRY_NAME,
                    BCCR_PREVIOUS_CLUSTER_ID=previous_category.CLUS_ID_id,
                    BCCR_PREVIOUS_CLUSTER_NAME=previous_category.CLUS_ID.CLUS_NAME,
                    BCCR_PROPOSED_CATEGORY_NAME=category.CTGRY_NAME,
                    BCCR_PROPOSED_CLUSTER_ID=category.CLUS_ID_id,
                    BCCR_PROPOSED_CLUSTER_NAME=category.CLUS_ID.CLUS_NAME,
                    BCCR_SUBMITTED_AT=timezone.now(),
                )
                snapshots = [
                    BusinessClassificationSpecialtySnapshot(
                        BCCR_ID=change_request,
                        TAG_ID=link.TAG_ID,
                        BCSS_SIDE=(
                            BusinessClassificationSpecialtySnapshot.Side.PREVIOUS
                        ),
                        BCSS_TAG_NAME=link.TAG_ID.TAG_NAME,
                    )
                    for link in active_links
                ]
                snapshots.extend(
                    BusinessClassificationSpecialtySnapshot(
                        BCCR_ID=change_request,
                        TAG_ID=tag,
                        BCSS_SIDE=(
                            BusinessClassificationSpecialtySnapshot.Side.PROPOSED
                        ),
                        BCSS_TAG_NAME=tag.TAG_NAME,
                    )
                    for tag in tags
                )
                BusinessClassificationSpecialtySnapshot.objects.bulk_create(
                    snapshots,
                )
                return BusinessClassificationChangeService.get_for_merchant(
                    user,
                    change_request.BCCR_ID,
                )
        except IntegrityError:
            if BusinessClassificationChangeRequest.objects.filter(
                BUSN_ID__USER_ID=user,
                BCCR_STATUS=BusinessClassificationChangeRequest.Status.PENDING,
            ).exists():
                raise ValidationError(
                    "A classification change request is already pending."
                ) from None
            raise

    @staticmethod
    def list_for_merchant(user):
        """Return only the merchant's own classification request history."""
        business = BusinessClassificationChangeService._get_owned_business(user)
        return BusinessClassificationChangeService._request_queryset().filter(
            BUSN_ID=business,
            USER_ID=user,
        ).order_by("-BCCR_SUBMITTED_AT", "-BCCR_ID")

    @staticmethod
    def get_eligibility_for_merchant(user):
        """Return the merchant's current classification request eligibility."""
        business = BusinessClassificationChangeService._get_owned_business(user)
        return BusinessChangeRequestEligibilityService.for_classification(
            business,
        )

    @staticmethod
    def get_for_merchant(user, request_id):
        """Hide requests outside the merchant's owned business."""
        business = BusinessClassificationChangeService._get_owned_business(user)
        try:
            return BusinessClassificationChangeService._request_queryset().get(
                BCCR_ID=request_id,
                BUSN_ID=business,
                USER_ID=user,
            )
        except BusinessClassificationChangeRequest.DoesNotExist:
            raise NotFound("The classification change request could not be found.")

    @staticmethod
    @transaction.atomic
    def withdraw(user, request_id):
        """Withdraw an owned pending request without changing live taxonomy."""
        business = BusinessClassificationChangeService._get_owned_business(user)
        try:
            change_request = (
                BusinessClassificationChangeRequest.objects
                .select_for_update()
                .get(BCCR_ID=request_id, BUSN_ID=business, USER_ID=user)
            )
        except BusinessClassificationChangeRequest.DoesNotExist:
            raise NotFound("The classification change request could not be found.")

        if (
            change_request.BCCR_STATUS
            != BusinessClassificationChangeRequest.Status.PENDING
        ):
            raise ValidationError("Only pending requests can be withdrawn.")
        change_request.BCCR_STATUS = BusinessClassificationChangeRequest.Status.WITHDRAWN
        change_request.BCCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=["BCCR_STATUS", "BCCR_RESOLVED_AT", "BCCR_UPDATED_AT"],
        )
        return BusinessClassificationChangeService.get_for_merchant(user, request_id)

    @staticmethod
    def list_for_admin(status=None):
        """Return a paginated-ready queue with pending proposals first."""
        queryset = BusinessClassificationChangeService._request_queryset()
        if status:
            if status not in BusinessClassificationChangeRequest.Status.values:
                raise ValidationError({"status": ["Choose a valid status."]})
            queryset = queryset.filter(BCCR_STATUS=status)
        return queryset.annotate(
            pending_order=Case(
                When(
                    BCCR_STATUS=BusinessClassificationChangeRequest.Status.PENDING,
                    then=Value(0),
                ),
                default=Value(1),
                output_field=IntegerField(),
            ),
        ).order_by("pending_order", "-BCCR_SUBMITTED_AT", "-BCCR_ID")

    @staticmethod
    def get_for_admin(request_id):
        """Load request snapshots alongside the current live classification."""
        try:
            return BusinessClassificationChangeService._request_queryset().get(
                BCCR_ID=request_id,
            )
        except BusinessClassificationChangeRequest.DoesNotExist:
            raise NotFound("The classification change request could not be found.")

    @staticmethod
    def _queue_discovery_refresh():
        """Queue the existing all-business refresh after a committed approval."""
        try:
            recompute_discovery_scores.delay()
        except Exception:
            logger.exception(
                "Classification approved but discovery refresh dispatch failed."
            )

    @staticmethod
    @transaction.atomic
    def approve(request_id, reviewer):
        """Apply one pending proposal atomically against its captured baseline."""
        try:
            change_request = (
                BusinessClassificationChangeRequest.objects
                .select_for_update()
                .get(BCCR_ID=request_id)
            )
        except BusinessClassificationChangeRequest.DoesNotExist:
            raise NotFound("The classification change request could not be found.")

        if (
            change_request.BCCR_STATUS
            != BusinessClassificationChangeRequest.Status.PENDING
        ):
            raise ValidationError("Only pending requests can be approved.")

        try:
            business = (
                Business.objects
                .select_for_update()
                .select_related("CTGRY_ID__CLUS_ID")
                .get(BUSN_ID=change_request.BUSN_ID_id)
            )
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.")

        if business.USER_ID_id != change_request.USER_ID_id:
            raise ValidationError("The request no longer belongs to this business.")
        if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise ValidationError("Only active businesses can receive a classification change.")

        all_links = list(
            BusinessSpecialtyTag.objects
            .select_for_update()
            .filter(BUSN_ID=business)
            .order_by("BST_ID"),
        )
        active_ids = {
            link.TAG_ID_id
            for link in all_links
            if link.BST_IS_ACTIVE
        }
        snapshots = list(change_request.specialty_snapshots.all())
        previous_snapshots = [
            snapshot
            for snapshot in snapshots
            if snapshot.BCSS_SIDE == BusinessClassificationSpecialtySnapshot.Side.PREVIOUS
        ]
        proposed_snapshots = [
            snapshot
            for snapshot in snapshots
            if snapshot.BCSS_SIDE == BusinessClassificationSpecialtySnapshot.Side.PROPOSED
        ]
        previous_ids = {snapshot.TAG_ID_id for snapshot in previous_snapshots}
        proposed_ids = {snapshot.TAG_ID_id for snapshot in proposed_snapshots}

        if (
            business.CTGRY_ID_id != change_request.PREVIOUS_CTGRY_ID_id
            or business.CTGRY_ID.CLUS_ID_id != change_request.BCCR_PREVIOUS_CLUSTER_ID
            or active_ids != previous_ids
        ):
            raise ValidationError(
                "This request is based on outdated business information."
            )

        BusinessClassificationChangeService._validate_proposed_ids(
            [snapshot.TAG_ID_id for snapshot in proposed_snapshots],
        )
        category, tags = BusinessClassificationChangeService._load_proposed_taxonomy(
            change_request.PROPOSED_CTGRY_ID_id,
            proposed_ids,
            lock=True,
        )
        if (
            category.CLUS_ID_id != change_request.BCCR_PROPOSED_CLUSTER_ID
            or category.CTGRY_NAME != change_request.BCCR_PROPOSED_CATEGORY_NAME
            or category.CLUS_ID.CLUS_NAME != change_request.BCCR_PROPOSED_CLUSTER_NAME
            or any(
                tag.TAG_NAME != snapshot.BCSS_TAG_NAME
                for tag in tags
                for snapshot in proposed_snapshots
                if tag.TAG_ID == snapshot.TAG_ID_id
            )
        ):
            raise ValidationError(
                "The proposed classification taxonomy has changed since submission."
            )

        if (
            business.CTGRY_ID_id == category.CTGRY_ID
            and active_ids == proposed_ids
        ):
            raise ValidationError("The proposed classification is unchanged.")

        links_by_tag_id = {link.TAG_ID_id: link for link in all_links}
        now = timezone.now()
        for tag_id in sorted(active_ids - proposed_ids):
            link = links_by_tag_id[tag_id]
            link.BST_IS_ACTIVE = False
            link.BST_DEACTIVATED_AT = now
            link.save(
                update_fields=["BST_IS_ACTIVE", "BST_DEACTIVATED_AT", "BST_UPDATED_AT"],
            )

        for tag_id in sorted(proposed_ids - active_ids):
            link = links_by_tag_id.get(tag_id)
            if link is None:
                BusinessSpecialtyTag.objects.create(
                    BUSN_ID=business,
                    TAG_ID_id=tag_id,
                )
            else:
                link.BST_IS_ACTIVE = True
                link.BST_ACTIVATED_AT = now
                link.BST_DEACTIVATED_AT = None
                link.save(
                    update_fields=[
                        "BST_IS_ACTIVE",
                        "BST_ACTIVATED_AT",
                        "BST_DEACTIVATED_AT",
                        "BST_UPDATED_AT",
                    ],
                )

        final_ids = set(
            BusinessSpecialtyTag.objects.filter(
                BUSN_ID=business,
                BST_IS_ACTIVE=True,
            ).values_list("TAG_ID_id", flat=True),
        )
        if len(final_ids) != 3 or final_ids != proposed_ids:
            raise ValidationError("The final specialty selection is invalid.")

        business.CTGRY_ID = category
        business.save(update_fields=["CTGRY_ID", "BUSN_UPDATED_AT"])
        change_request.BCCR_STATUS = BusinessClassificationChangeRequest.Status.APPROVED
        change_request.REVIEWER_ID = reviewer
        change_request.BCCR_RESOLVED_AT = now
        change_request.save(
            update_fields=[
                "BCCR_STATUS",
                "REVIEWER_ID",
                "BCCR_RESOLVED_AT",
                "BCCR_UPDATED_AT",
            ],
        )
        transaction.on_commit(
            BusinessClassificationChangeService._queue_discovery_refresh,
        )
        return BusinessClassificationChangeService.get_for_admin(request_id)

    @staticmethod
    @transaction.atomic
    def reject(request_id, reviewer, rejection_reason):
        """Resolve a pending request without changing live classification."""
        try:
            change_request = (
                BusinessClassificationChangeRequest.objects
                .select_for_update()
                .get(BCCR_ID=request_id)
            )
        except BusinessClassificationChangeRequest.DoesNotExist:
            raise NotFound("The classification change request could not be found.")

        if (
            change_request.BCCR_STATUS
            != BusinessClassificationChangeRequest.Status.PENDING
        ):
            raise ValidationError("Only pending requests can be rejected.")
        if not rejection_reason or not rejection_reason.strip():
            raise ValidationError({
                "rejection_reason": ["A rejection reason is required."],
            })
        change_request.BCCR_STATUS = BusinessClassificationChangeRequest.Status.REJECTED
        change_request.REVIEWER_ID = reviewer
        change_request.BCCR_REJECTION_REASON = rejection_reason.strip()
        change_request.BCCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=[
                "BCCR_STATUS",
                "REVIEWER_ID",
                "BCCR_REJECTION_REASON",
                "BCCR_RESOLVED_AT",
                "BCCR_UPDATED_AT",
            ],
        )
        return BusinessClassificationChangeService.get_for_admin(request_id)
