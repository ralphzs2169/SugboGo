from unittest.mock import patch

from django.test import override_settings
from django.urls import path
from rest_framework.permissions import IsAuthenticated
from rest_framework.test import APITestCase
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.users.models import User
from core.responses import success_response

from ... import entitlements
from ...permissions import HasMerchantPlus
from ...services.tests.fixtures import MerchantAnalyticsFixtures


class PlusPermissionProbe(APIView):
    """Test-only Premium boundary; no Premium endpoint is registered in production."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT), HasMerchantPlus)

    def get(self, request):
        """Exercise required ownership after the entitlement boundary."""
        business = BusinessProfileService.get_business_for_merchant(request.user)
        return success_response(data={"owned_business_id": business.pk}, message="Permission probe.")


urlpatterns = [path("plus-probe/", PlusPermissionProbe.as_view())]


@override_settings(ROOT_URLCONF=__name__)
class MerchantPlusPermissionTests(MerchantAnalyticsFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.merchant_a)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_gate_off_allows_authenticated_owned_merchant(self):
        self.assertTrue(entitlements.merchant_has_plus_access(self.merchant_a))
        response = self.client.get("/plus-probe/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["owned_business_id"], self.business_a.pk)

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_gate_on_fails_closed_with_exact_plus_required_error_envelope(self):
        self.assertFalse(entitlements.merchant_has_plus_access(self.merchant_a))
        response = self.client.get("/plus-probe/")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["code"], "PLUS_REQUIRED")

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_future_server_entitlement_can_allow_access_through_same_permission(self):
        with patch.object(entitlements, "merchant_has_plus_access", return_value=True) as check:
            response = self.client.get("/plus-probe/")
        self.assertEqual(response.status_code, 200)
        check.assert_called_once_with(self.merchant_a)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_gate_off_does_not_bypass_role_or_authentication(self):
        self.client.force_authenticate(user=self.supporter_a)
        self.assertEqual(self.client.get("/plus-probe/").status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/plus-probe/").status_code, 401)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_gate_off_does_not_bypass_business_ownership(self):
        self.client.force_authenticate(user=self.user("plus-no-business", User.UserRole.MERCHANT))
        self.assertEqual(self.client.get("/plus-probe/").status_code, 404)
