"""Bounded pending-work selection using existing application queue priority rules."""

from datetime import UTC, datetime

from django.db.models import Case, CharField, Count, DateTimeField, F, Min, Value, When
from django.utils import timezone

from apps.business.models import Business
from apps.merchant_application.models import MerchantApplication
from apps.merchant_application.utils.application_queue import (
    count_business_days,
    get_application_queue_aging_filters,
)
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport


class PriorityWorklistService:
    """Prioritize overdue and approaching applications before oldest remaining pending work."""

    LIMIT = 5

    TITLES = {
        "merchant_application": "Merchant application awaiting review",
        "business_name_change": "Business name change awaiting review",
        "classification_change": "Classification change awaiting review",
        "location_change": "Location change awaiting review",
        "under_review": "Review under review",
        "reported_review": "Reported review awaiting resolution",
        "review_dispute": "Review dispute awaiting resolution",
    }

    CHANGE_REQUESTS = (
        ("business_name_change", BusinessNameChangeRequest, "BNCR"),
        ("classification_change", BusinessClassificationChangeRequest, "BCCR"),
        ("location_change", BusinessLocationChangeRequest, "BLCR"),
    )

    @classmethod
    def get_worklist(cls):
        """Read at most five items per source and preserve failures instead of hiding queues."""
        as_of = timezone.now()
        aging_filters = get_application_queue_aging_filters(
            reference_time=as_of,
        )
        submitted = MerchantApplication.objects.filter(
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        )
        items = []
        for priority in ("overdue", "approaching"):
            remaining = cls.LIMIT - len(items)
            if remaining == 0:
                break
            items.extend(
                cls._application_candidates(
                    submitted.filter(aging_filters[priority]),
                    aging_filters=aging_filters,
                    as_of=as_of,
                    limit=remaining,
                    priority=priority,
                ),
            )

        remaining = cls.LIMIT - len(items)
        if remaining:
            candidates = cls._application_candidates(
                submitted.exclude(
                    aging_filters["overdue"] | aging_filters["approaching"],
                ),
                aging_filters=aging_filters,
                as_of=as_of,
                limit=remaining,
                priority="pending",
            )
            candidates.extend(cls._change_request_candidates(remaining))
            candidates.extend(cls._under_review_candidates(remaining))
            candidates.extend(cls._reported_review_candidates(remaining))
            candidates.extend(cls._dispute_candidates(remaining))
            candidates.sort(key=cls._pending_order)
            items.extend(candidates[:remaining])

        cls._hydrate_items(
            items,
            as_of=as_of,
        )
        return {
            "as_of": as_of,
            "items": items,
        }

    @classmethod
    def _application_candidates(
        cls,
        queryset,
        *,
        aging_filters,
        as_of,
        limit,
        priority,
    ):
        """Use shared aging predicates and leave missing or future submission times unclassified."""
        applications = (
            queryset
            .annotate(
                queue_timestamp=Case(
                    When(
                        MAPP_SUBMITTED_AT__lte=as_of,
                        then=F("MAPP_SUBMITTED_AT"),
                    ),
                    default=Value(None),
                    output_field=DateTimeField(),
                ),
                aging_status=Case(
                    *[
                        When(
                            condition,
                            then=Value(status),
                        )
                        for status, condition in aging_filters.items()
                    ],
                    default=Value("unknown_age"),
                    output_field=CharField(),
                ),
            )
            .order_by(
                F("queue_timestamp").asc(nulls_last=True),
                "MAPP_ID",
            )
            .values(
                "MAPP_ID",
                "BUSN_ID",
                "queue_timestamp",
                "aging_status",
            )[:limit]
        )
        items = []
        for application in applications:
            item = cls._item(
                "merchant_application",
                application["MAPP_ID"],
                timestamp=application["queue_timestamp"],
                timestamp_source="application_submitted_at",
                status=MerchantApplication.ApplicationStatus.SUBMITTED,
                business_id=application["BUSN_ID"],
                priority=priority,
            )
            item["application_aging"] = {
                "status": application["aging_status"],
                "business_days": None,
            }
            items.append(item)

        return items

    @classmethod
    def _change_request_candidates(
        cls,
        limit,
    ):
        """Read a bounded oldest-first selection from each actual pending request workflow."""
        items = []
        for work_type, model, prefix in cls.CHANGE_REQUESTS:
            requests = (
                model.objects
                .filter(**{
                    f"{prefix}_STATUS": model.Status.PENDING,
                })
                .order_by(
                    f"{prefix}_SUBMITTED_AT",
                    f"{prefix}_ID",
                )
                .values(
                    f"{prefix}_ID",
                    "BUSN_ID",
                    f"{prefix}_SUBMITTED_AT",
                )[:limit]
            )
            for request in requests:
                items.append(cls._item(
                    work_type,
                    request[f"{prefix}_ID"],
                    timestamp=request[f"{prefix}_SUBMITTED_AT"],
                    timestamp_source="request_submitted_at",
                    status=model.Status.PENDING,
                    business_id=request["BUSN_ID"],
                ))

        return items

    @classmethod
    def _under_review_candidates(
        cls,
        limit,
    ):
        """Read held reviews without interpreting their state as exclusively manual moderation."""
        reviews = (
            Review.objects
            .filter(REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW)
            .order_by("REVW_CREATED_AT", "REVW_ID")
            .values("REVW_ID", "BUSN_ID", "REVW_CREATED_AT")[:limit]
        )
        return [
            cls._item(
                "under_review",
                review["REVW_ID"],
                timestamp=review["REVW_CREATED_AT"],
                timestamp_source="review_created_at",
                status=Review.ReviewStatus.UNDER_REVIEW,
                business_id=review["BUSN_ID"],
            )
            for review in reviews
        ]

    @classmethod
    def _reported_review_candidates(
        cls,
        limit,
    ):
        """Match Reported Reviews cases using the oldest pending report and one row per review."""
        cases = (
            ReviewReport.objects
            .filter(RREP_STATUS=ReviewReport.ReportStatus.PENDING)
            .order_by()
            .values("REVW_ID", "REVW_ID__BUSN_ID")
            .annotate(
                queue_timestamp=Min("RREP_CREATED_AT"),
                pending_report_count=Count("RREP_ID"),
            )
            .order_by("queue_timestamp", "REVW_ID")[:limit]
        )
        return [
            cls._item(
                "reported_review",
                case["REVW_ID"],
                timestamp=case["queue_timestamp"],
                timestamp_source="first_pending_report_created_at",
                status=ReviewReport.ReportStatus.PENDING,
                business_id=case["REVW_ID__BUSN_ID"],
                pending_report_count=case["pending_report_count"],
            )
            for case in cases
        ]

    @classmethod
    def _dispute_candidates(
        cls,
        limit,
    ):
        """Read pending merchant disputes using their persisted case creation timestamps."""
        disputes = (
            MerchantReviewDispute.objects
            .filter(MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.PENDING)
            .order_by("MRDSP_CREATED_AT", "MRDSP_ID")
            .values("MRDSP_ID", "BUSN_ID", "MRDSP_CREATED_AT")[:limit]
        )
        return [
            cls._item(
                "review_dispute",
                dispute["MRDSP_ID"],
                timestamp=dispute["MRDSP_CREATED_AT"],
                timestamp_source="dispute_created_at",
                status=MerchantReviewDispute.DisputeStatus.PENDING,
                business_id=dispute["BUSN_ID"],
            )
            for dispute in disputes
        ]

    @classmethod
    def _item(
        cls,
        work_type,
        entity_id,
        *,
        timestamp,
        timestamp_source,
        status,
        business_id,
        priority="pending",
        pending_report_count=None,
    ):
        """Build an explicit safe work-item shape while keeping hydration identifiers internal."""
        if timestamp is None:
            timestamp_source = None

        return {
            "id": f"{work_type}:{entity_id}",
            "type": work_type,
            "title": cls.TITLES[work_type],
            "status": status,
            "timestamp": timestamp,
            "timestamp_source": timestamp_source,
            "priority": priority,
            "entity": {
                "id": entity_id,
                "label": "Business unavailable",
            },
            "application_aging": None,
            "pending_report_count": pending_report_count,
            "_business_id": business_id,
        }

    @staticmethod
    def _pending_order(item):
        """Order dated work oldest first, then undated work, with stable type and numeric ID ties."""
        return (
            item["timestamp"] is None,
            item["timestamp"] or datetime.max.replace(tzinfo=UTC),
            item["type"],
            item["entity"]["id"],
        )

    @staticmethod
    def _hydrate_items(
        items,
        *,
        as_of,
    ):
        """Batch current labels for the final five items and calculate only known application ages."""
        business_ids = {
            item["_business_id"]
            for item in items
            if (
                item["_business_id"] is not None
                and item["type"] != "merchant_application"
            )
        }
        application_ids = {
            item["entity"]["id"]
            for item in items
            if item["type"] == "merchant_application"
        }
        businesses = dict(
            Business.objects
            .filter(pk__in=business_ids)
            .values_list("BUSN_ID", "BUSN_NAME")
        )
        applications = {
            application["MAPP_ID"]: (
                application["BUSN_ID__BUSN_NAME"]
                or application["identity__MIDN_BUSINESS_NAME"]
                or f"Application #{application['MAPP_ID']}"
            )
            for application in (
                MerchantApplication.objects
                .filter(pk__in=application_ids)
                .values(
                    "MAPP_ID",
                    "BUSN_ID__BUSN_NAME",
                    "identity__MIDN_BUSINESS_NAME",
                )
            )
        }
        for item in items:
            business_id = item.pop("_business_id")
            if item["type"] == "merchant_application":
                entity_id = item["entity"]["id"]
                item["entity"]["label"] = applications.get(
                    entity_id,
                    f"Application #{entity_id}",
                )
                if item["application_aging"]["status"] != "unknown_age":
                    item["application_aging"]["business_days"] = count_business_days(
                        item["timestamp"],
                        as_of,
                    )
            else:
                item["entity"]["label"] = (
                    businesses.get(business_id) or "Business unavailable"
                )
