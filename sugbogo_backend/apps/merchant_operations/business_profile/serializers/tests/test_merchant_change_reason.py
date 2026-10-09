from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from apps.merchant_operations.business_profile.serializers.business_classification_change_serializers import (
    BusinessClassificationChangeCreateSerializer,
)
from apps.merchant_operations.business_profile.serializers.business_location_change_serializers import (
    BusinessLocationChangeCreateSerializer,
)
from apps.merchant_operations.business_profile.serializers.business_name_change_serializers import (
    BusinessNameChangeCreateSerializer,
)
from apps.merchant_operations.business_profile.services.merchant_change_reason import (
    validate_merchant_change_reason,
)


class MerchantChangeReasonTests(SimpleTestCase):
    """Require the same trimmed merchant explanation for all three requests."""

    def test_reason_boundaries(self):
        for value in (None, "", "   ", "short", "x" * 501):
            with self.subTest(value=value):
                with self.assertRaises(ValidationError):
                    validate_merchant_change_reason(value)

        self.assertEqual(
            validate_merchant_change_reason("  1234567890  "),
            "1234567890",
        )
        self.assertEqual(
            len(validate_merchant_change_reason("x" * 500)),
            500,
        )

    def test_submission_serializers_trim_and_validate_reason(self):
        payloads = (
            (
                BusinessNameChangeCreateSerializer,
                {"proposed_business_name": "New business name"},
            ),
            (
                BusinessClassificationChangeCreateSerializer,
                {
                    "proposed_category_id": 1,
                    "proposed_specialty_tag_ids": [1, 2, 3],
                },
            ),
            (
                BusinessLocationChangeCreateSerializer,
                {
                    "proposed_location": {
                        "latitude": 10.3,
                        "longitude": 123.9,
                        "address": "Some street",
                        "city": "Cebu City",
                        "province": "Cebu",
                    },
                    "proposed_landmarks": [],
                },
            ),
        )
        for serializer_class, payload in payloads:
            with self.subTest(serializer=serializer_class.__name__):
                serializer = serializer_class(
                    data={
                        **payload,
                        "reason": "  1234567890  ",
                    },
                )
                self.assertTrue(serializer.is_valid(), serializer.errors)
                self.assertEqual(
                    serializer.validated_data["reason"],
                    "1234567890",
                )

                for invalid in (" ", "short", "x" * 501):
                    serializer = serializer_class(
                        data={
                            **payload,
                            "reason": invalid,
                        },
                    )
                    self.assertFalse(serializer.is_valid())
                    self.assertIn("reason", serializer.errors)
