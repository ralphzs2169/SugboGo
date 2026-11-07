from django.db.models import CharField, F, Q, Value
from django.db.models.functions import Cast, Concat, Substr

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService,
)
from apps.admin_operations.business_management.services.manage_business_service import (
    BusinessService,
)
from apps.admin_operations.moderation.services.all_review_service import (
    AllReviewService,
)
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.admin_operations.user_management.services import UserManagementService
from apps.merchant_operations.business_profile.services.business_classification_change_service import (
    BusinessClassificationChangeService,
)
from apps.merchant_operations.business_profile.services.business_location_change_service import (
    BusinessLocationChangeService,
)
from apps.merchant_operations.business_profile.services.business_name_change_service import (
    BusinessNameChangeService,
)


class GlobalSearchService:
    """Project existing Admin list scopes into bounded, lightweight search groups."""

    @staticmethod
    def _project(
        queryset,
        *,
        id_field,
        title,
        subtitle,
        status_field,
        ordering,
    ):
        """Select only display scalars and discard management relation prefetches."""
        # values() also removes select_related loading and unselected annotations,
        # including the management lists' media and count subqueries.
        return (
            queryset
            .prefetch_related(None)
            .order_by(*ordering)
            .values(
                id=F(id_field),
                title=Substr(
                    title,
                    1,
                    160,
                ),
                subtitle=Substr(
                    subtitle,
                    1,
                    300,
                ),
                status=F(status_field),
            )
        )

    @staticmethod
    def _request_matches(search):
        """Match existing request business and merchant identities in SQL."""
        return (
            Q(BUSN_ID__BUSN_NAME__icontains=search)
            | Q(USER_ID__USER_FNAME__icontains=search)
            | Q(USER_ID__USER_LNAME__icontains=search)
            | Q(USER_ID__USER_EMAIL__icontains=search)
        )

    @staticmethod
    def _querysets(search):
        """Retain each domain's administrative list visibility and text predicates."""
        return {
            "business": GlobalSearchService._project(
                BusinessService.list_businesses(search=search),
                id_field="BUSN_ID",
                title=F("BUSN_NAME"),
                subtitle=F("LOCT_ID__LOCT_ADDRESS"),
                status_field="BUSN_STATUS",
                ordering=("BUSN_NAME", "BUSN_ID"),
            ),
            "user": GlobalSearchService._project(
                UserManagementService.list_users(search=search),
                id_field="USER_ID",
                title=Concat(
                    "USER_FNAME",
                    Value(" "),
                    "USER_LNAME",
                ),
                subtitle=F("USER_EMAIL"),
                status_field="USER_STATUS",
                ordering=("USER_FNAME", "USER_LNAME", "USER_ID"),
            ),
            "application": GlobalSearchService._project(
                ApplicationService.list_applications(search=search),
                id_field="MAPP_ID",
                title=F("identity__MIDN_BUSINESS_NAME"),
                subtitle=Concat(
                    "USER_ID__USER_FNAME",
                    Value(" "),
                    "USER_ID__USER_LNAME",
                ),
                status_field="MAPP_STATUS",
                ordering=("review_priority", "MAPP_SUBMITTED_AT", "MAPP_ID"),
            ),
            "business_name_request": GlobalSearchService._project(
                BusinessNameChangeService.list_for_admin().filter(
                    GlobalSearchService._request_matches(search)
                    | Q(BNCR_PREVIOUS_BUSINESS_NAME__icontains=search)
                    | Q(BNCR_PROPOSED_BUSINESS_NAME__icontains=search),
                ),
                id_field="BNCR_ID",
                title=F("BUSN_ID__BUSN_NAME"),
                subtitle=Concat(
                    Value("Proposed name: "),
                    "BNCR_PROPOSED_BUSINESS_NAME",
                ),
                status_field="BNCR_STATUS",
                ordering=("pending_order", "-BNCR_SUBMITTED_AT", "-BNCR_ID"),
            ),
            "classification_request": GlobalSearchService._project(
                BusinessClassificationChangeService.list_for_admin().filter(
                    GlobalSearchService._request_matches(search),
                ),
                id_field="BCCR_ID",
                title=F("BUSN_ID__BUSN_NAME"),
                subtitle=Concat(
                    Value("Proposed category: "),
                    "BCCR_PROPOSED_CATEGORY_NAME",
                ),
                status_field="BCCR_STATUS",
                ordering=("pending_order", "-BCCR_SUBMITTED_AT", "-BCCR_ID"),
            ),
            "location_request": GlobalSearchService._project(
                BusinessLocationChangeService.list_for_admin().filter(
                    GlobalSearchService._request_matches(search),
                ),
                id_field="BLCR_ID",
                title=F("BUSN_ID__BUSN_NAME"),
                subtitle=F("BLCR_PROPOSED_ADDRESS"),
                status_field="BLCR_STATUS",
                ordering=("pending_order", "-BLCR_SUBMITTED_AT", "-BLCR_ID"),
            ),
            "review": GlobalSearchService._project(
                AllReviewService.list_reviews({"search": search}),
                id_field="REVW_ID",
                title=Concat(
                    "USER_ID__USER_FNAME",
                    Value(" "),
                    "USER_ID__USER_LNAME",
                    Value(" — "),
                    "BUSN_ID__BUSN_NAME",
                ),
                subtitle=Substr("REVW_TEXT", 1, 160),
                status_field="REVW_STATUS",
                ordering=("-REVW_CREATED_AT", "-REVW_ID"),
            ),
            "review_dispute": GlobalSearchService._project(
                ManageReviewDisputeService.list_disputes(search=search),
                id_field="MRDSP_ID",
                title=Concat(
                    Value("Dispute #"),
                    Cast(
                        "MRDSP_ID",
                        output_field=CharField(),
                    ),
                ),
                subtitle=F("BUSN_ID__BUSN_NAME"),
                status_field="MRDSP_STATUS",
                ordering=("-MRDSP_CREATED_AT", "-MRDSP_ID"),
            ),
        }

    @staticmethod
    def search(
        *,
        search,
        limit_per_type=3,
    ):
        """Read at most one lookahead row per category without total counts."""
        groups = []

        for record_type, queryset in GlobalSearchService._querysets(search).items():
            rows = list(queryset[:limit_per_type + 1])
            groups.append(
                {
                    "type": record_type,
                    "items": rows[:limit_per_type],
                    "has_more": len(rows) > limit_per_type,
                },
            )

        return {
            "search": search,
            "groups": groups,
        }
