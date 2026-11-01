"""Bounded normalization of persisted administrative decisions for the Dashboard."""

from apps.admin_operations.activity_management.models import AdminActivity
from apps.business.models import Business
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
)
from apps.users.models import User


class RecentDecisionsService:
    """Merge supported application reviews and administrative actions without exposing audit context."""

    LIMIT = 5

    APPLICATION_DECISIONS = {
        MerchantApplicationReview.Decision.APPROVED: (
            "application_approved",
            "Application approved",
        ),
        MerchantApplicationReview.Decision.REJECTED: (
            "application_rejected",
            "Application rejected",
        ),
    }

    ACTIVITY_ACTIONS = {
        AdminActivity.Action.BUSINESS_NAME_CHANGE_APPROVED: (
            "Business name change approved",
            "business_name_change_request",
            "request_id",
        ),
        AdminActivity.Action.BUSINESS_NAME_CHANGE_REJECTED: (
            "Business name change rejected",
            "business_name_change_request",
            "request_id",
        ),
        AdminActivity.Action.BUSINESS_CLASSIFICATION_CHANGE_APPROVED: (
            "Classification change approved",
            "business_classification_change_request",
            "request_id",
        ),
        AdminActivity.Action.BUSINESS_CLASSIFICATION_CHANGE_REJECTED: (
            "Classification change rejected",
            "business_classification_change_request",
            "request_id",
        ),
        AdminActivity.Action.BUSINESS_LOCATION_CHANGE_APPROVED: (
            "Location change approved",
            "business_location_change_request",
            "request_id",
        ),
        AdminActivity.Action.BUSINESS_LOCATION_CHANGE_REJECTED: (
            "Location change rejected",
            "business_location_change_request",
            "request_id",
        ),
        AdminActivity.Action.REVIEW_MODERATION_APPROVED: (
            "Review published",
            "review",
            "review_id",
        ),
        AdminActivity.Action.REVIEW_MODERATION_REJECTED: (
            "Review rejected",
            "review",
            "review_id",
        ),
        AdminActivity.Action.REVIEW_DISPUTE_UPHELD: (
            "Dispute upheld",
            "review_dispute",
            "dispute_id",
        ),
        AdminActivity.Action.REVIEW_DISPUTE_DISMISSED: (
            "Dispute dismissed",
            "review_dispute",
            "dispute_id",
        ),
        AdminActivity.Action.REVIEW_REPORT_APPROVED: (
            "Review report approved",
            "review",
            "review_id",
        ),
        AdminActivity.Action.REVIEW_REPORT_REJECTED: (
            "Review report rejected",
            "review",
            "review_id",
        ),
        AdminActivity.Action.REPORTED_REVIEW_KEPT: (
            "Reported review kept",
            "review",
            "review_id",
        ),
        AdminActivity.Action.REPORTED_REVIEW_REJECTED: (
            "Reported review rejected",
            "review",
            "review_id",
        ),
        AdminActivity.Action.USER_SUSPENDED: (
            "User suspended",
            "user",
            None,
        ),
        AdminActivity.Action.USER_REACTIVATED: (
            "User reactivated",
            "user",
            None,
        ),
    }

    @classmethod
    def get_recent_decisions(cls):
        """Return the latest five supported decisions, failing if either source is unavailable."""
        application_reviews = (
            MerchantApplicationReview.objects
            .filter(
                MAREV_DECISION__in=cls.APPLICATION_DECISIONS,
            )
            .order_by("-MAREV_REVIEWED_AT", "-MAREV_ID")
            .values(
                "MAREV_ID",
                "MAREV_DECISION",
                "MAREV_REVIEWED_AT",
                "MAPP_ID",
                "USER_ID",
            )[:cls.LIMIT]
        )
        activities = (
            AdminActivity.objects
            .filter(
                AACT_ACTION__in=cls.ACTIVITY_ACTIONS,
            )
            .order_by("-AACT_CREATED_AT", "-AACT_ID")
            .values(
                "AACT_ID",
                "AACT_ACTION",
                "AACT_CREATED_AT",
                "AACT_CONTEXT",
                "ACTOR_ID",
                "TARGET_USER_ID",
            )[:cls.LIMIT]
        )
        events = [
            cls._normalize_application_review(review)
            for review in application_reviews
        ]
        events.extend(
            cls._normalize_activity(activity)
            for activity in activities
        )
        # Source and numeric source ID also determine which tied records survive LIMIT.
        events.sort(
            key=lambda event: (
                event["timestamp"],
                event["_source"],
                event["_source_id"],
            ),
            reverse=True,
        )
        events = events[:cls.LIMIT]

        labels = cls._hydrate_labels(events)
        users = labels["users"]
        businesses = labels["businesses"]
        applications = labels["applications"]
        items = []
        for event in events:
            administrator = users.get(event["_administrator_id"])
            administrator_name = "Administrator unavailable"
            if (
                administrator is not None
                and administrator.full_name
            ):
                administrator_name = administrator.full_name

            items.append({
                "id": event["id"],
                "action": event["action"],
                "action_label": event["action_label"],
                "entity": {
                    "type": event["entity_type"],
                    "id": event["entity_id"],
                    "label": cls._entity_label(
                        event,
                        users=users,
                        businesses=businesses,
                        applications=applications,
                    ),
                },
                "administrator_name": administrator_name,
                "timestamp": event["timestamp"],
            })

        return {"items": items}

    @classmethod
    def _normalize_application_review(
        cls,
        review,
    ):
        """Use the recorded application decision and reviewer, independently of current status."""
        definition = cls.APPLICATION_DECISIONS[review["MAREV_DECISION"]]
        action = definition[0]
        label = definition[1]

        return {
            "id": f"application_review:{review['MAREV_ID']}",
            "action": action,
            "action_label": label,
            "entity_type": "merchant_application",
            "entity_id": review["MAPP_ID"],
            "timestamp": review["MAREV_REVIEWED_AT"],
            "_source": "application_review",
            "_source_id": review["MAREV_ID"],
            "_administrator_id": review["USER_ID"],
            "_business_id": None,
        }

    @classmethod
    def _normalize_activity(
        cls,
        activity,
    ):
        """Extract only allowlisted action semantics and minimal recorded target identifiers."""
        definition = cls.ACTIVITY_ACTIONS[activity["AACT_ACTION"]]
        label = definition[0]
        entity_type = definition[1]
        context_key = definition[2]
        context = activity["AACT_CONTEXT"]
        if not isinstance(context, dict):
            context = {}

        if entity_type == "user":
            entity_id = activity["TARGET_USER_ID"]
        else:
            entity_id = cls._context_id(context.get(context_key))

        return {
            "id": f"admin_activity:{activity['AACT_ID']}",
            "action": activity["AACT_ACTION"],
            "action_label": label,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "timestamp": activity["AACT_CREATED_AT"],
            "_source": "admin_activity",
            "_source_id": activity["AACT_ID"],
            "_administrator_id": activity["ACTOR_ID"],
            "_business_id": cls._context_id(context.get("business_id")),
        }

    @staticmethod
    def _context_id(value):
        """Accept only positive AutoField-sized integers from internal JSON metadata."""
        if (
            type(value) is int
            and 0 < value <= 2147483647
        ):
            return value

        return None

    @staticmethod
    def _hydrate_labels(events):
        """Batch current user, business, and application labels only for the final five events."""
        user_ids = {
            event["_administrator_id"]
            for event in events
        }
        user_ids.update(
            event["entity_id"]
            for event in events
            if event["entity_type"] == "user"
        )
        business_ids = {
            event["_business_id"]
            for event in events
            if event["_business_id"] is not None
        }
        application_ids = {
            event["entity_id"]
            for event in events
            if event["entity_type"] == "merchant_application"
        }
        users = (
            User.objects
            .only("USER_ID", "USER_FNAME", "USER_LNAME")
            .in_bulk(user_ids)
        )
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

        return {
            "users": users,
            "businesses": businesses,
            "applications": applications,
        }

    @staticmethod
    def _entity_label(
        event,
        *,
        users,
        businesses,
        applications,
    ):
        """Show current names with safe fallbacks without asserting historical label snapshots."""
        entity_type = event["entity_type"]
        entity_id = event["entity_id"]
        if entity_type == "merchant_application":
            return applications.get(
                entity_id,
                f"Application #{entity_id}",
            )
        if entity_type == "user":
            user = users.get(entity_id)
            if (
                user is not None
                and user.full_name
            ):
                return user.full_name
            return "User unavailable"

        business_name = businesses.get(event["_business_id"])
        if entity_type == "review":
            if business_name:
                return f"Review for {business_name}"
            if entity_id is not None:
                return f"Review #{entity_id}"
            return "Review unavailable"
        if entity_type == "review_dispute":
            if business_name:
                return f"Dispute for {business_name}"
            if entity_id is not None:
                return f"Dispute #{entity_id}"
            return "Dispute unavailable"

        return business_name or "Business unavailable"
