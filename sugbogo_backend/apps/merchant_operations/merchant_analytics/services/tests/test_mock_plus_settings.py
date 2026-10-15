import os
from pathlib import Path
import subprocess
import sys

from django.test import SimpleTestCase


class MockPlusSettingsTests(SimpleTestCase):
    def import_settings(self, value):
        environment = os.environ.copy()
        environment["MERCHANT_PLUS_ENFORCED"] = "False"
        environment["MERCHANT_PLUS_MOCK_ENABLED"] = value
        return subprocess.run(
            [sys.executable, "-B", "-c", "from config.settings import MERCHANT_PLUS_MOCK_ENABLED; print(MERCHANT_PLUS_MOCK_ENABLED)"],
            cwd=Path(__file__).resolve().parents[5], env=environment,
            capture_output=True, text=True, timeout=30,
        )

    def test_invalid_mock_flag_fails_startup_instead_of_silently_enabling_demo(self):
        result = self.import_settings("maybe")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("MERCHANT_PLUS_MOCK_ENABLED must be True or False.", result.stderr)

    def test_mock_flag_accepts_explicit_boolean_spelling_case_and_whitespace(self):
        for value, expected in ((" TRUE ", "True"), (" false ", "False")):
            with self.subTest(value=value):
                result = self.import_settings(value)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stdout.strip(), expected)
