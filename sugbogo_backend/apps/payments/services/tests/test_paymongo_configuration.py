from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.paymongo import load_paymongo_configuration


class PayMongoConfigurationTests(SimpleTestCase):
    def parse(
        self,
        values,
        *,
        enforced=True,
        mock=False,
    ):
        return load_paymongo_configuration(
            values,
            plus_enforced=enforced,
            mock_enabled=mock,
        )

    def enabled_values(self):
        return {
            "PAYMONGO_CHECKOUT_ENABLED": "True",
            "PAYMONGO_TEST_SECRET_KEY": "sk_test_fixture",
            "PAYMONGO_TEST_WEBHOOK_SECRET": "fixture-signing-value",
            "PAYMONGO_RETURN_BASE_URL": "https://payments.example.com/payments/return/",
        }

    def test_disabled_foundation_requires_no_credentials(self):
        configuration = self.parse({}, enforced=False)
        self.assertFalse(configuration["PAYMONGO_CHECKOUT_ENABLED"])
        self.assertEqual(configuration["PAYMONGO_MODE"], "test")
        self.assertEqual(configuration["PAYMONGO_TEST_SECRET_KEY"], "")
        self.assertEqual(configuration["PAYMONGO_LIVE_SECRET_KEY"], "")

    def test_invalid_mode_flag_or_methods_are_rejected(self):
        for values in (
            {"PAYMONGO_MODE": "production"},
            {"PAYMONGO_CHECKOUT_ENABLED": "maybe"},
            {"PAYMONGO_PAYMENT_METHOD_TYPES": ""},
            {"PAYMONGO_PAYMENT_METHOD_TYPES": "gcash,gcash"},
            {"PAYMONGO_PAYMENT_METHOD_TYPES": "bill-ease"},
        ):
            with self.subTest(values=values):
                with self.assertRaises(ImproperlyConfigured):
                    self.parse(values)

    def test_enabled_checkout_requires_enforcement_and_disables_mock_bypass(self):
        for enforced, mock in ((False, False), (True, True)):
            with self.subTest(enforced=enforced, mock=mock):
                with self.assertRaises(ImproperlyConfigured):
                    self.parse(self.enabled_values(), enforced=enforced, mock=mock)

    def test_enabled_mode_requires_its_own_credentials(self):
        values = self.enabled_values()
        self.assertTrue(self.parse(values)["PAYMONGO_CHECKOUT_ENABLED"])
        values["PAYMONGO_MODE"] = "live"
        with self.assertRaises(ImproperlyConfigured):
            self.parse(values)
        values["PAYMONGO_LIVE_SECRET_KEY"] = "sk_live_fixture"
        values["PAYMONGO_LIVE_WEBHOOK_SECRET"] = "live-fixture-signing-value"
        result = self.parse(values)
        self.assertNotEqual(result["PAYMONGO_TEST_SECRET_KEY"], result["PAYMONGO_LIVE_SECRET_KEY"])

    def test_wrong_key_mode_and_unsafe_return_url_are_rejected_without_secret_output(self):
        values = self.enabled_values()
        values["PAYMONGO_TEST_SECRET_KEY"] = "sk_live_do-not-print"
        with self.assertRaises(ImproperlyConfigured) as raised:
            self.parse(values)
        self.assertNotIn("do-not-print", str(raised.exception))
        for url in (
            "http://example.com/return",
            "https://user:password@example.com/return",
            "https://example.com/return?token=anything",
            "https://example.com/return#fragment",
        ):
            values = self.enabled_values()
            values["PAYMONGO_RETURN_BASE_URL"] = url
            with self.subTest(url=url):
                with self.assertRaises(ImproperlyConfigured):
                    self.parse(values)
