from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

from django.contrib.gis.geos import Point
from django.db import connection, connections
from django.test import TransactionTestCase, override_settings

from apps.business.models import Business, Category, Cluster, Location
from apps.users.models import User

from ...models import DemoMerchantPlusEntitlement
from ..mock_plus_service import MockPlusService


@override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=True)
class MockPlusConcurrencyTests(TransactionTestCase):
    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requires PostgreSQL row locking.")
        self.user = User.objects.create_user(
            email="concurrent-plus@example.com", password=None, USER_FNAME="Demo", USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT, USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=Decimal("0.50"),
        )
        cluster = Cluster.objects.create(CLUS_NAME="Concurrent Plus cluster")
        category = Category.objects.create(CTGRY_NAME="Concurrent Plus category", CLUS_ID=cluster)
        location = Location.objects.create(LOCT_POINT=Point(123.88, 10.31, srid=4326), LOCT_ADDRESS="Cebu")
        self.business = Business.objects.create(
            BUSN_NAME="Concurrent Plus business", BUSN_CONTACT_NUMBER="09170000000", USER_ID=self.user,
            CTGRY_ID=category, LOCT_ID=location,
        )

    def race(self, action):
        barrier = Barrier(2)

        def worker():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout = '10s'")
                    cursor.execute("SET statement_timeout = '15s'")
                user = User.objects.get(pk=self.user.pk)
                barrier.wait(timeout=10)
                return action(user)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(worker) for _ in range(2)]
            return [future.result(timeout=30) for future in futures]

    def test_concurrent_first_activation_creates_one_row_and_one_state_transition(self):
        results = self.race(lambda user: MockPlusService.activate(user, "success"))
        self.assertEqual(sum(result["changed"] for result in results), 1)
        self.assertEqual(DemoMerchantPlusEntitlement.objects.count(), 1)
        entitlement = DemoMerchantPlusEntitlement.objects.get(BUSN_ID=self.business)
        self.assertTrue(entitlement.DMPE_IS_ACTIVE)
        self.assertIsNotNone(entitlement.DMPE_ACTIVATED_AT)

    def test_concurrent_resets_produce_one_revocation(self):
        MockPlusService.activate(self.user, "success")
        results = self.race(MockPlusService.reset)
        self.assertEqual(sum(result["changed"] for result in results), 1)
        entitlement = DemoMerchantPlusEntitlement.objects.get(BUSN_ID=self.business)
        self.assertFalse(entitlement.DMPE_IS_ACTIVE)
        self.assertIsNotNone(entitlement.DMPE_RESET_AT)
