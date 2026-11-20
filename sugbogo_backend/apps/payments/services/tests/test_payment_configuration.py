from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.payments import load_payment_configuration


class PaymentConfigurationTests(SimpleTestCase):
    def parse(
        self,
        environment,
        *,
        plus_enforced=True,
    ):
        return load_payment_configuration(
            environment,
            plus_enforced=plus_enforced,
        )

    def enabled_configuration(self):
        return {
            "MAYA_CHECKOUT_ENABLED": "True",
            "MAYA_SANDBOX_PUBLIC_KEY": "pk-fixture",
            "MAYA_SANDBOX_SECRET_KEY": "sk-fixture",
            "MAYA_RETURN_BASE_URL": "https://payments.example.com/return/",
        }

    def test_default_settings_are_maya_test_with_checkout_disabled(self):
        configuration = self.parse({
            "PAYMONGO_MODE": "live",
            "PAYMONGO_CHECKOUT_ENABLED": "True",
            "MAYA_SANDBOX_API_BASE_URL": "https://override.example.com",
        })
        self.assertEqual(configuration["PAYMENT_PROVIDER"], "maya")
        self.assertEqual(configuration["PAYMENT_MODE"], "test")
        self.assertFalse(configuration["MAYA_CHECKOUT_ENABLED"])
        self.assertEqual(configuration["MAYA_SANDBOX_PUBLIC_KEY"], "")
        self.assertEqual(configuration["MAYA_SANDBOX_SECRET_KEY"], "")
        self.assertEqual(configuration["MAYA_SANDBOX_API_BASE_URL"], "https://pg-sandbox.paymaya.com")
        self.assertNotIn("PAYMONGO_CHECKOUT_ENABLED", configuration)

    def test_legacy_live_mode_is_readable_without_any_provider_credentials(self):
        configuration = self.parse({
            "PAYMENT_PROVIDER": "paymongo",
            "PAYMENT_MODE": "live",
        })
        self.assertEqual(configuration["PAYMENT_MODE"], "live")
        self.assertFalse(configuration["MAYA_CHECKOUT_ENABLED"])

    def test_invalid_provider_mode_or_flag_fails_configuration(self):
        for overrides in (
            {"PAYMENT_PROVIDER": "unknown"},
            {"PAYMENT_MODE": "sandbox"},
            {"PAYMENT_MODE": "live"},
            {"MAYA_CHECKOUT_ENABLED": "maybe"},
            {"PAYMENT_PROVIDER": "paymongo", **self.enabled_configuration()},
        ):
            with self.subTest(fields=list(overrides)):
                with self.assertRaises(ImproperlyConfigured):
                    self.parse(overrides)

    def test_enabled_settings_require_plus_enforcement(self):
        values = self.enabled_configuration()
        self.assertTrue(self.parse(values)["MAYA_CHECKOUT_ENABLED"])
        with self.assertRaises(ImproperlyConfigured):
            self.parse(values, plus_enforced=False)

    def test_enabled_settings_require_both_api_keys_and_safe_https_return(self):
        for field, value in (
            ("MAYA_SANDBOX_PUBLIC_KEY", ""),
            ("MAYA_SANDBOX_PUBLIC_KEY", "sk-fixture"),
            ("MAYA_SANDBOX_SECRET_KEY", "pk-fixture"),
            ("MAYA_SANDBOX_SECRET_KEY", "sk-fixture:password"),
            ("MAYA_RETURN_BASE_URL", ""),
            ("MAYA_RETURN_BASE_URL", "http://example.com/return"),
            ("MAYA_RETURN_BASE_URL", "https://example.com/return?"),
            ("MAYA_RETURN_BASE_URL", "https://example.com/return#"),
            ("MAYA_RETURN_BASE_URL", "https://user@example.com/return"),
        ):
            with self.subTest(field=field):
                values = self.enabled_configuration()
                values[field] = value
                with self.assertRaises(ImproperlyConfigured) as error:
                    self.parse(values)
                if value:
                    self.assertNotIn(value, str(error.exception))
