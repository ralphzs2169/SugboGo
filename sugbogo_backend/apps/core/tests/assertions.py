from rest_framework import status

"""
This module provides a mixin class for asserting API responses in tests.
"""

class APIResponseAssertionsMixin:
    def assertValidationError(
        self,
        response,
        *fields,
        status_code=status.HTTP_400_BAD_REQUEST,
    ):
        self.assertEqual(response.status_code, status_code)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["message"], "Validation failed.")
        self.assertEqual(response.data["code"], "VALIDATION_ERROR")

        for field in fields:
            self.assertIn(field, response.data["errors"])

    
    def assertAuthenticationError(
        self,
        response,
        code="TOKEN_NOT_VALID",
        status_code=status.HTTP_401_UNAUTHORIZED,
    ):
        self.assertEqual(response.status_code,status_code,)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["code"],code,)
        self.assertIn("message",response.data,)


    def assertRateLimitError(self, response):
        self.assertEqual(response.status_code,status.HTTP_429_TOO_MANY_REQUESTS,)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["message"],"Too many requests.",)
        self.assertEqual(response.data["code"],"RATE_LIMIT_EXCEEDED",)
        self.assertIn("detail",response.data["errors"],)
        self.assertIn("retry_after",response.data["errors"],)