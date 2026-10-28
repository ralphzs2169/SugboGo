"""Small domain fixtures shared by focused administrator reporting tests."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point

from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class ReportingFixtures:
    NOW = datetime(
        2026,
        10,
        14,
        4,
        30,
        tzinfo=UTC,
    )

    def setUp(self):
        super().setUp()
        clock = patch(
            "django.utils.timezone.now",
            return_value=self.NOW,
        )
        clock.start()
        self.addCleanup(clock.stop)
        self.sequence = 0
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.period = resolve_period(
            preset="custom",
            start_date="2026-10-05",
            end_date="2026-10-11",
            now=self.NOW,
        )

    def make_user(
        self,
        role=User.UserRole.EXPLORER,
        created_at=None,
        **fields,
    ):
        self.sequence += 1
        user = User.objects.create_user(
            email=f"report-{self.sequence}@example.com",
            password=None,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=Decimal("0.20"),
            **fields,
        )
        if created_at is None:
            created_at = self.period.previous_start - timedelta(days=1)
        User.objects.filter(pk=user.pk).update(USER_CREATED_AT=created_at)
        return user

    def make_business(
        self,
        status=Business.BusinessStatus.ACTIVE,
        created_at=None,
    ):
        if not hasattr(
            self,
            "category",
        ):
            cluster = Cluster.objects.create(CLUS_NAME="Reporting cluster")
            self.category = Category.objects.create(
                CLUS_ID=cluster,
                CTGRY_NAME="Reporting category",
            )
            self.location = Location.objects.create(
                LOCT_ADDRESS="Cebu City",
                LOCT_POINT=Point(
                    123.88,
                    10.31,
                    srid=4326,
                ),
            )
        owner = self.make_user(User.UserRole.MERCHANT)
        business = Business.objects.create(
            USER_ID=owner,
            BUSN_NAME=f"Reporting business {self.sequence}",
            BUSN_CONTACT_NUMBER="09170000000",
            BUSN_STATUS=status,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        if created_at is None:
            created_at = self.period.previous_start - timedelta(days=1)
        Business.objects.filter(pk=business.pk).update(BUSN_CREATED_AT=created_at)
        return business

    def make_application(
        self,
        business=None,
    ):
        if business is None:
            user = self.make_user()
        else:
            user = business.USER_ID
        return MerchantApplication.objects.create(
            USER_ID=user,
            BUSN_ID=business,
        )

    def make_submission(
        self,
        application,
        when,
        number=1,
    ):
        return MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMITTED_AT=when,
            MASUB_SUBMISSION_NUMBER=number,
        )

    def make_decision(
        self,
        application,
        when,
        decision=MerchantApplicationReview.Decision.REJECTED,
        submission=None,
    ):
        if not hasattr(
            self,
            "reviewer",
        ):
            self.reviewer = self.make_user(User.UserRole.ADMIN)
        return MerchantApplicationReview.objects.create(
            USER_ID=self.reviewer,
            MAPP_ID=application,
            MASUB_ID=submission,
            MAREV_DECISION=decision,
            MAREV_REVIEWED_AT=when,
        )
