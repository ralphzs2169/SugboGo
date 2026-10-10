from rest_framework import serializers


class MerchantChangeReasonField(serializers.CharField):
    """Validate the merchant's explanation for a reviewed business change."""

    def __init__(self, **kwargs):
        super().__init__(
            min_length=10,
            max_length=500,
            trim_whitespace=True,
            error_messages={
                "required": "Please provide a reason for this change.",
                "blank": "Please provide a reason for this change.",
                "min_length": "Please enter at least 10 characters.",
                "max_length": "Your reason must not exceed 500 characters.",
            },
            **kwargs,
        )
