from rest_framework.response import Response
from rest_framework import status

"""
This module provides standardized response formats for API endpoints.
"""

def success_response(
    *,
    data=None,
    message: str = "Success.",
    status_code: int = status.HTTP_200_OK,
) -> Response:
    """
        Return a standardized successful API response.

        Example
        -------
        {
            "success": True,
            "message": "Registration successful.",
            "data": {
                ...
            }
        }
    """
    return Response(
        {
            "success": True,
            "message": message,
            "data": data,
        },
        status=status_code,
    )


def error_response(
    *,
    message: str = "An error occurred.",
    code: str | None = None,
    errors=None,
    status_code: int = status.HTTP_400_BAD_REQUEST,
) -> Response:
    """
    Return a standardized error API response.

    Args:
        message (str): A human-readable error message.
        code (str | None): An optional error code for programmatic handling.
        errors (dict | list | None): Optional detailed error information.
    """
    payload = {
        "success": False,
        "message": message,
    }

    if code:
        payload["code"] = code

    if errors is not None:
        payload["errors"] = errors

    return Response(
        payload,
        status=status_code,
    )