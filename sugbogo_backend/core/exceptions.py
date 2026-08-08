from rest_framework.exceptions import Throttled, ValidationError
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Wrap DRF exceptions in the project's standard API response format.

    This keeps all API errors consistent:
    {
        "success": False,
        "message": "...",
        "code": "...",
        "errors": {...}
    }

    It also extracts useful validation messages so the frontend
    can display meaningful feedback instead of generic errors.
    """

    response = exception_handler(exc, context)

    if response is None:
        return None

    # ---------------------------------------------------------
    # Handle rate limiting errors separately.
    # These need extra metadata (retry_after) so clients know
    # when they can attempt the request again.
    # ---------------------------------------------------------
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

    # ---------------------------------------------------------
    # Handle validation errors.
    #
    # DRF ValidationError responses can have different shapes:
    #
    # Example 1:
    # {
    #   "field": [
    #       "This field is required."
    #   ]
    # }
    #
    # Example 2:
    # [
    #   "Complete Step 5 first."
    # ]
    #
    # We extract the first useful message so the frontend
    # toast can display something meaningful.
    # ---------------------------------------------------------
    if isinstance(exc, ValidationError):
        errors = response.data

        message = "Validation failed."

        if isinstance(errors, list) and errors:
            # Non-field validation errors
            message = str(errors[0])

        elif isinstance(errors, dict) and errors:
            # Field validation errors
            first_value = next(iter(errors.values()))

            if isinstance(first_value, list) and first_value:
                message = str(first_value[0])

            elif first_value:
                message = str(first_value)

        response.data = {
            "success": False,
            "message": message,
            "code": "VALIDATION_ERROR",
            "errors": errors,
        }

        return response

    # ---------------------------------------------------------
    # Handle other DRF exceptions.
    #
    # Examples:
    # - NotAuthenticated
    # - PermissionDenied
    # - NotFound
    # ---------------------------------------------------------
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