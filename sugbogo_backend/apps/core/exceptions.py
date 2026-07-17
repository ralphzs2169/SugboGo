from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError, Throttled


def custom_exception_handler(exc, context):
    """
    Wrap DRF exceptions in the project's standard API response format.
    """
    response = exception_handler(exc, context)

    if response is None:
        return None

    # Handle throttling
    if isinstance(exc, Throttled):
        wait = getattr(exc, "wait", None)

        response.data = {
            "success": False,
            "message": "Too many requests.",
            "code": "RATE_LIMIT_EXCEEDED",
            "errors": {
                "detail": "Please wait before trying again.",
                "retry_after": wait,
            },
        }
        return response

    # Handle serializer validation errors
    if isinstance(exc, ValidationError):
        response.data = {
            "success": False,
            "message": "Validation failed.",
            "code": "VALIDATION_ERROR",
            "errors": response.data,
        }
        return response

    # Handle all other DRF exceptions
    message = str(response.data.get("detail", "An error occurred."))

    code = None
    if hasattr(exc, "default_code"):
        code = str(exc.default_code).upper()

    response.data = {
        "success": False,
        "message": message,
        "code": code,
    }

    return response